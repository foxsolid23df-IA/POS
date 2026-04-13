/**
 * Rate limiter para acciones administrativas críticas
 * Previene abuso de endpoints de reset/factory
 */

const rateLimit = require('express-rate-limit');
const SystemLog = require('../models/SystemLog');

/**
 * Rate limiter para acciones administrativas destructivas
 * Máximo 3 acciones críticas por IP cada 30 minutos
 */
const adminActionLimiter = rateLimit({
    max: 3,
    windowMs: 30 * 60 * 1000, // 30 minutos
    message: {
        success: false,
        message: 'Demasiadas acciones administrativas. Por seguridad, espera antes de realizar otra operación crítica.',
        code: 'ADMIN_RATE_LIMITED'
    },
    statusCode: 429,
    standardHeaders: false,
    legacyHeaders: false,
    handler: async (req, res) => {
        const ip = req.ip || 'unknown';
        try {
            await SystemLog.create({
                action: 'ADMIN_RATE_LIMIT_EXCEEDED',
                module: 'ADMIN_API',
                details: JSON.stringify({ ip, action: req.originalUrl }),
                ip,
                userAgent: req.headers['user-agent'] || 'unknown'
            });
        } catch (_) { /* no interrumpir */ }

        console.warn(`🚫 BLOQUEO ADMIN: IP ${ip} excedió límite de acciones críticas`);

        res.status(429).json({
            success: false,
            message: 'Demasiadas acciones administrativas. Por seguridad, espera antes de realizar otra operación crítica.',
            code: 'ADMIN_RATE_LIMITED'
        });
    }
});

module.exports = { adminActionLimiter };
