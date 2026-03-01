const express = require('express');
const router = express.Router();
const controller = require('../controllers/problemasController');
const multer = require('multer');
const path = require('path');
const logger = require('../config/logger'); // Importamos tu logger

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        logger.info(`Multer: Guardando archivo en public/uploads/`);
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + path.extname(file.originalname);
        logger.info(`Multer: Archivo procesado como ${uniqueName}`);
        cb(null, uniqueName);
    }
});

// En tu archivo de rutas
const upload = multer({ dest: 'uploads/' }); // Carpeta temporal

// 1. Ruta pública (poner arriba de las protegidas)
router.get('/compartir/:uuid', controller.verPublico);

// Ruta principal
router.get('/', (req, res, next) => {
    logger.info('Ruta GET / accedida');
    next();
}, controller.listar);

// Ruta de creación con monitoreo de payload
router.post('/nuevo', (req, res, next) => {
    logger.info('--- NUEVA PETICIÓN POST /nuevo ---');
    next();
}, upload.array('imagenes_pasos'), (req, res, next) => {
    // Log para verificar qué llegó después de pasar por Multer
    const cantArchivos = req.files ? req.files.length : 0;
    const titulo = req.body.titulo || 'SIN TÍTULO';
    
    logger.info(`Datos recibidos - Título: "${titulo}" | Archivos: ${cantArchivos}`);
    
    if (cantArchivos === 0) {
        logger.warn('Aviso: No se subieron imágenes para este manual.');
    }
    
    next();
}, controller.crear);

// Línea 57 aprox.
router.post('/eliminar/:id', controller.eliminar); 

router.get('/editar/:id', controller.mostrarEditar);

router.post('/editar/:id', upload.array('imagenes_pasos'), controller.actualizar);

module.exports = router;