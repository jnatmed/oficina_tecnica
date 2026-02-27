const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs'); // Para verificar si el archivo existe físicamente
require('dotenv').config();

// --- BLOQUE DE LOGGING DIAGNÓSTICO ---
console.log("--------------------------------------------------");
console.log("🔍 DIAGNÓSTICO DE INICIO:");

// 1. Verificar existencia física del .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log("✅ Archivo .env encontrado en:", envPath);
} else {
    console.error("❌ ERROR: No se encuentra el archivo .env en la raíz.");
}

// 2. Verificar variables clave
console.log("PORT en .env:", process.env.PORT || "No definido");
console.log("SUPABASE_URL cargada:", process.env.SUPABASE_URL ? "SÍ" : "NO");
console.log("SUPABASE_KEY cargada:", process.env.SUPABASE_KEY ? "SÍ" : "NO");
console.log("--------------------------------------------------");
// -------------------------------------

const app = express();
// ... resto de tu configuración

// Configuración de Twig
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

// Opcional: Desactivar caché en desarrollo para ver cambios en Twig al instante
app.set('twig options', { 
    allow_async: true, 
    strict_variables: false 
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir archivos estáticos (CSS, JS frontal)
app.use(express.static(path.join(__dirname, 'public')));

// IMPORTANTE: Servir la carpeta de imágenes para que el Modal pueda mostrarlas
// Esto permite que /uploads/nombre-imagen.jpg sea accesible
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Rutas
const authRoutes = require('./routes/auth');
const problemasRoutes = require('./routes/problemas');
const authMiddleware = require('./middleware/auth');

app.use('/auth', authRoutes);

// Aplicamos el middleware de autenticación a todas las rutas de problemas
app.use('/', authMiddleware, problemasRoutes);

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).render('404.twig');
});

// Middleware de manejo de errores (debe tener 4 parámetros)
app.use((err, req, res, next) => {
    console.error(err.stack); // Registra el error en la consola de Render
    res.status(500).render('500.twig');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor de la oficina técnica corriendo en el puerto ${PORT}`);
});