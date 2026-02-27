const express = require('express');
const router = express.Router();
const logger = require('../config/logger'); // Importamos tu logger
const { createClient } = require('@supabase/supabase-js');

// Verificación inmediata de variables al cargar el archivo
logger.info(`Auth Route: Inicializando cliente con URL: ${process.env.SUPABASE_URL ? 'OK' : 'FALTA'}`);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.get('/login', (req, res) => {
    logger.info('GET /auth/login - Renderizando vista');
    res.render('login.twig');
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    // LOG 1: Entrada de datos
    logger.info(`POST /auth/login - Intento para: ${email}`);

    try {
        // LOG 2: Antes de la promesa
        logger.info('Llamando a Supabase Auth (signInWithPassword)...');
        
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email, 
            password 
        });

        // LOG 3: Respuesta recibida
        if (error) {
            logger.error(`Error de Supabase Auth: ${error.message}`);
            return res.render('login.twig', { error: 'Credenciales inválidas. Por favor, reintente.' });
        }

        if (data && data.session) {
            // LOG 4: Éxito y sesión creada
            logger.info(`Login exitoso para: ${email}. Generando cookie.`);
            res.cookie('supabase_token', data.session.access_token, { httpOnly: true });
            return res.redirect('/');
        } else {
            // LOG 5: Caso borde (sin error pero sin sesión)
            logger.warn('Auth finalizado sin error pero sin sesión activa.');
            return res.render('login.twig', { error: 'No se pudo iniciar sesión. Intente nuevamente.' });
        }

    } catch (err) {
        // LOG 6: Fallo crítico (red, timeout, error de sintaxis)
        logger.error(`FALLO CRÍTICO en proceso de login: ${err.message}`);
        return res.status(500).render('500.twig');
    }
});

router.get('/logout', (req, res) => {
    logger.info('Cerrando sesión y limpiando cookie.');
    res.clearCookie('supabase_token');
    res.redirect('/auth/login');
});

module.exports = router;