const supabase = require('../config/supabase');

module.exports = async (req, res, next) => {
    // 1. Verificamos si la cookie existe
    const token = req.cookies.supabase_token;

    if (!token) {
        console.log("No hay token en la cookie, redirigiendo al login...");
        return res.redirect('/auth/login');
    }

    try {
        // 2. Validamos el token con Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            console.error("Token inválido o expirado:", error?.message);
            res.clearCookie('supabase_token');
            return res.redirect('/auth/login');
        }

        // 3. Si todo está bien, pasamos el usuario a la vista y al siguiente paso
        res.locals.user = user;
        req.user = user;
        next();
    } catch (err) {
        console.error("Error en el middleware de auth:", err.message);
        res.redirect('/auth/login');
    }
};