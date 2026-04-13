/**
 * Middleware para validar el acceso de Soporte Maestro / Administrador Global
 * Usa exclusivamente la variable de entorno MASTER_PIN (sin fallback hardcodeado)
 */

const authAdmin = (req, res, next) => {
    try {
        // Log para depuración (verás esto en la consola del backend)
        console.log('🔍 Validando acceso administrativo...');

        let masterPin = null;

        if (req.headers && req.headers['x-master-pin']) {
            masterPin = req.headers['x-master-pin'];
        } else if (req.query && req.query.masterPin) {
            masterPin = req.query.masterPin;
        } else if (req.body && req.body.masterPin) {
            masterPin = req.body.masterPin;
        }

        const MASTER_PIN = process.env.MASTER_PIN;

        if (!MASTER_PIN) {
            console.error('❌ MASTER_PIN no está configurado en las variables de entorno');
            return res.status(500).json({
                success: false,
                message: 'Error de configuración del servidor: MASTER_PIN no configurado.'
            });
        }

        if (masterPin === MASTER_PIN) {
            console.log('✅ Acceso administrativo concedido');
            return next();
        }

        console.warn('⚠️ Intento de acceso administrativo fallido');
        return res.status(403).json({
            success: false,
            message: 'Acceso Denegado: PIN de Soporte incorrecto o no proporcionado.'
        });
    } catch (error) {
        console.error('❌ Error crítico en authAdmin:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno en la validación de seguridad.'
        });
    }
};

module.exports = authAdmin;
