const supabase = require('../config/supabase');
const logger = require('../config/logger');
const fs = require('fs');

// LISTAR CON FILTROS DE PRIVACIDAD Y CATEGORÍAS
exports.listar = async (req, res) => {
    try {
        // 1. Traer problemas con sus pasos y categorías asociadas
        // Filtro: Traer si es_publico OR (es privado pero el creado_por es el usuario actual)
        const { data: problemas, error } = await supabase
            .from('problemas')
            .select('*, pasos(*), categorias:problema_categorias(categorias(*))')
            .or(`es_publico.eq.true,creado_por.eq.${req.user.id}`)
            .order('created_at', { ascending: false })
            .order('orden', { foreignTable: 'pasos', ascending: true });;

        if (error) throw error;

        // 2. Formatear la estructura de categorías para Twig (aplanar el array)
        const problemasFormateados = problemas.map(p => ({
            ...p,
            categorias: p.categorias.map(c => c.categorias)
        }));

        // 3. Obtener todas las categorías y contar cuántos manuales tienen cada una
        // (Esto alimenta el buscador de la derecha)
        const { data: catData } = await supabase
            .from('categorias')
            .select('nombre, id');
        
        const categoriasConContador = await Promise.all(catData.map(async (cat) => {
            const { count } = await supabase
                .from('problema_categorias')
                .select('*', { count: 'exact', head: true })
                .eq('categoria_id', cat.id);
            return { ...cat, count: count || 0 };
        }));

        res.render('index', { 
            problemas: problemasFormateados, 
            categorias: categoriasConContador,
            user: res.locals.user 
        });
    } catch (err) {
        logger.error(`Error al listar: ${err.message}`);
        res.status(500).render('500.twig');
    }
};

// CREAR CON TAGS Y VISIBILIDAD
exports.crear = async (req, res) => {
    const { titulo, pasos_desc, es_publico, tags } = req.body;
    const files = req.files;

    try {
        // 1. Insertar el Problema con visibilidad
        const { data: problemaInsertado, error: errorP } = await supabase
            .from('problemas')
            .insert([{ 
                titulo: titulo, 
                creado_por: req.user.id,
                es_publico: es_publico === 'on' // El switch de HTML envía 'on' si está marcado
            }])
            .select()
            .single();

        if (errorP) throw errorP;

        // 2. Procesar Tags (Categorías)
        if (tags && tags.trim() !== "") {
            const listaTags = tags.split(',').map(t => t.trim().toLowerCase());
            
            for (const nombreTag of listaTags) {
                // Upsert de la categoría (la crea si no existe)
                const { data: cat, error: errCat } = await supabase
                    .from('categorias')
                    .upsert({ nombre: nombreTag }, { onConflict: 'nombre' })
                    .select()
                    .single();

                if (!errCat) {
                    // Relacionar en la tabla intermedia
                    await supabase.from('problema_categorias').insert({
                        problema_id: problemaInsertado.id,
                        categoria_id: cat.id
                    });
                }
            }
        }

        // 3. Subir imágenes y armar pasos (Tu lógica original mejorada)
        const pasosParaInsertar = await Promise.all(pasos_desc.map(async (desc, index) => {
            let publicUrl = null;
            if (files && files[index]) {
                const file = files[index];
                const fileName = `${Date.now()}_${file.originalname}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('imagenes_pasos')
                    .upload(fileName, fs.readFileSync(file.path), {
                        contentType: file.mimetype
                    });

                if (!uploadError) {
                    const { data: { publicUrl: url } } = supabase.storage
                        .from('imagenes_pasos')
                        .getPublicUrl(fileName);
                    publicUrl = url;
                }
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            }

            return {
                problema_id: problemaInsertado.id,
                descripcion: desc,
                orden: index + 1,
                imagen_url: publicUrl
            };
        }));

        await supabase.from('pasos').insert(pasosParaInsertar);
        res.redirect('/?success=true');
    } catch (err) {
        logger.error(`Error al crear manual: ${err.message}`);
        res.status(500).render('500.twig');
    }
};

// ... Resto de funciones (eliminar, mostrarEditar, verPublico) se mantienen similares
// ELIMINAR MANUAL
exports.eliminar = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Opcional: Borrar imágenes de Storage primero
        const { data: pasos } = await supabase
            .from('pasos')
            .select('imagen_url')
            .eq('problema_id', id);

        const imagenes = pasos
            ?.filter(p => p.imagen_url)
            .map(p => p.imagen_url.split('/').pop());

        if (imagenes?.length > 0) {
            await supabase.storage.from('imagenes_pasos').remove(imagenes);
        }

        // 2. Borrar pasos manualmente (si no tienes CASCADE activado)
        await supabase.from('pasos').delete().eq('problema_id', id);

        // 3. Borrar el problema principal (Usa 'Problemas' con P mayúscula si es necesario)
        const { error } = await supabase.from('problemas').delete().eq('id', id);
        
        if (error) throw error;
        
        res.redirect('/');
    } catch (err) {
        logger.error(`Error al eliminar manual ${id}: ${err.message}`);
        res.status(500).send("Error al eliminar: " + err.message);
    }
};

// MOSTRAR VISTA PARA EDITAR
exports.mostrarEditar = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('problemas')
            .select('*, pasos(*)')
            .eq('id', req.params.id)
            .order('orden', { foreignTable: 'pasos', ascending: true })
            .single();

        if (error || !data) return res.redirect('/');
        res.render('editar.twig', { problema: data });
    } catch (err) {
        res.redirect('/');
    }
};

// ACTUALIZAR (Placeholder para que no crashee)
exports.actualizar = async (req, res) => {
    const { id } = req.params;
    const { titulo, es_publico, tags, pasos_id, pasos_desc } = req.body;
    const files = req.files;

    try {
        // 1. Actualizar datos básicos del Problema
        const { error: errP } = await supabase
            .from('problemas')
            .update({ 
                titulo, 
                es_publico: es_publico === 'on' 
            })
            .eq('id', id);

        if (errP) throw errP;

        // 2. Gestionar TAGS (Borrar anteriores y poner los nuevos)
        await supabase.from('problema_categorias').delete().eq('problema_id', id);
        
        if (tags && tags.trim() !== "") {
            const listaTags = tags.split(',').map(t => t.trim().toLowerCase());
            for (const nombreTag of listaTags) {
                const { data: cat } = await supabase
                    .from('categorias')
                    .upsert({ nombre: nombreTag }, { onConflict: 'nombre' })
                    .select().single();
                
                await supabase.from('problema_categorias').insert({ 
                    problema_id: id, 
                    categoria_id: cat.id 
                });
            }
        }

        // 3. Gestionar PASOS (Actualizar existentes y crear nuevos)
        const promesasPasos = pasos_desc.map(async (desc, index) => {
            // Aseguramos que el ID del paso corresponda exactamente a su posición en el formulario
            const pasoId = (pasos_id && pasos_id[index]) ? pasos_id[index] : null;
            let publicUrl = null;

            // Si hay una nueva imagen para este paso
            if (files && files[index]) {
                const file = files[index];
                const fileName = `${Date.now()}_${file.originalname}`;
                const { error: upErr } = await supabase.storage
                    .from('imagenes_pasos')
                    .upload(fileName, fs.readFileSync(file.path), { contentType: file.mimetype });

                if (!upErr) {
                    const { data } = supabase.storage.from('imagenes_pasos').getPublicUrl(fileName);
                    publicUrl = data.publicUrl;
                }
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            }

            const datosPaso = {
                descripcion: desc,
                orden: index + 1,
                problema_id: id
            };
            if (publicUrl) datosPaso.imagen_url = publicUrl;

            if (pasoId) {
                // Actualizar paso existente
                return supabase.from('pasos').update(datosPaso).eq('id', pasoId);
            } else {
                // Insertar paso nuevo (olvidado anteriormente)
                return supabase.from('pasos').insert([datosPaso]);
            }
        });

        await Promise.all(promesasPasos);
        res.redirect('/?update=success');

    } catch (err) {
        logger.error(`Error al actualizar manual ${id}: ${err.message}`);
        res.status(500).render('500.twig');
    }
};


// CONTROLADOR: Vista pública de compartido
exports.verPublico = async (req, res) => {
    const { uuid } = req.params;
    try {
        const { data, error } = await supabase
            .from('problemas')
            .select('*, pasos(*)')
            .eq('uuid', uuid) // Buscamos por el ID único público
            .order('orden', { foreignTable: 'pasos', ascending: true })
            .single();

        if (error || !data) {
            return res.status(404).render('404.twig', { message: "Manual no encontrado" });
        }

        // Renderizamos una vista especial "publica" sin barra de navegación privada
        res.render('publico.twig', { 
            problema: data,
            esPublico: true
        });
    } catch (err) {
        res.status(500).send("Error del servidor");
    }
};

