const supabase = require('../config/supabase');
const logger = require('../config/logger');
const fs = require('fs');

exports.listar = async (req, res) => {
    try {
        // Traemos problemas y sus pasos asociados de forma relacional
        const { data, error } = await supabase
            .from('problemas')
            .select('*, pasos(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('index', { problemas: data, user: res.locals.user });
    } catch (err) {
        logger.error(`Error al listar problemas: ${err.message}`);
        res.status(500).render('500.twig');
    }
};

exports.crear = async (req, res) => {
    const { titulo, pasos_desc } = req.body;
    const files = req.files;

    try {
        // 1. Insertar el Problema (como ya lo hacías)
        const { data: problemaInsertado, error: errorP } = await supabase
                .from('problemas')
                .insert([{ titulo: titulo, creado_por: req.user.id }])
                .select()
                .single();

        if (errorP) throw errorP;

        // 2. Subir imágenes a Supabase Storage y armar los pasos
        const pasosParaInsertar = await Promise.all(pasos_desc.map(async (desc, index) => {
                let publicUrl = null;

            if (files && files[index]) {
                const file = files[index];
                const fileName = `${Date.now()}_${file.originalname}`;
                const filePath = file.path;

                // Subir a Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('imagenes_pasos')
                    .upload(fileName, fs.readFileSync(filePath), {
                        contentType: file.mimetype,
                        upsert: false
                    });

                if (uploadError) {
                    logger.error(`Error al subir imagen a Supabase: ${uploadError.message}`);
                    throw uploadError; // Esto detendrá el proceso y enviará al bloque catch
                } else {
                    // Obtener la URL pública
                    const { data: { publicUrl: url } } = supabase.storage
                        .from('imagenes_pasos')
                        .getPublicUrl(fileName);
                    publicUrl = url;
                }

                // Borrar archivo temporal del servidor (Render) para liberar espacio
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            return {
                problema_id: problemaInsertado.id, // ID obtenido de la inserción anterior
                descripcion: desc,
                orden: index + 1,
                imagen_url: publicUrl
            };
        }));

        // 3. Insertar Pasos en la DB
        await supabase.from('pasos').insert(pasosParaInsertar);

        res.redirect('/');
    } catch (err) {
        console.error("Error al crear manual:", err.message);
        res.status(500).render('500.twig');
    }
};

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
            .single();

        if (error || !data) return res.redirect('/');
        res.render('editar.twig', { problema: data });
    } catch (err) {
        res.redirect('/');
    }
};

// ACTUALIZAR (Placeholder para que no crashee)
exports.actualizar = async (req, res) => {
    logger.info(`Actualizando problema ${req.params.id}`);
    res.redirect('/');
};