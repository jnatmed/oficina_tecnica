const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger'); // Importamos tu logger para trazabilidad
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Verificación de seguridad antes de inicializar
if (!supabaseUrl || !supabaseKey) {
    logger.error("❌ ERROR CRÍTICO: No se pudieron cargar las credenciales de Supabase en supabase.js");
}

logger.info(`Supabase Client: URL=${process.env.SUPABASE_URL ? 'OK' : 'MISSING'}`);

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;