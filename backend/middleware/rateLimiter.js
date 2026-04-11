/**
 * Middleware de rate limiting específico para el endpoint de login
 * - Máximo 5 intentos por IP cada 15 minutos
 * - Bloqueo progresivo: 15min → 30min → 1h → 2h → 4h → 8h → 24h
 * - Registro en SystemLog para auditoría de seguridad
 */

const rateLimit = require('express-rate-limit');
const SystemLog = require('../models/SystemLog');

// Almacén en memoria de bloqueos progresivos por IP
// Estructura: { ip: { count: number } }
const progressiveBlocks = new Map();

/**
 * Calcula el tiempo de bloqueo basado en cuántas veces se ha bloqueado esta IP
 * Progresión: 15min, 30min, 1h, 2h, 4h, 8h, 24h (cap)
 */
function getProgressiveWindowMs(blockCount) {
    const baseWindows = [
        15 * 60 * 1000,   // 15 min (1er bloqueo)
        30 * 60 * 1000,   // 30 min
        60 * 60 * 1000,   // 1 hora
        2 * 60 * 60 * 1000, // 2 horas
        4 * 60 * 60 * 1000, // 4 horas
        8 * 60 * 60 * 1000, // 8 horas
        24 * 60 * 60 * 1000 // 24 horas (máximo)
    ];
    const idx = Math.min(blockCount - 1, baseWindows.length - 1);
    return baseWindows[Math.max(0, idx)];
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Rate limiter principal para el login
 * API compatible con express-rate-limit v8
 */
const loginRateLimiter = rateLimit({
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
    message: {
        success: false,
        message: 'Demasiados intentos de acceso. Por seguridad, el acceso está temporalmente bloqueado. Inténtalo más tarde.',
        code: 'RATE_LIMITED'
    },
    statusCode: 429,
    standardHeaders: false,
    legacyHeaders: false,

    /**
     * Handler que se ejecuta cuando una IP excede el límite (v8 API)
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @param {object} next
     * @param {object} options
     * @param {number} options.current - número actual de requests en la ventana
     */
    handler: async (req, res /* next, options */) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';

        // Actualizar contador de bloqueos progresivos
        const entry = progressiveBlocks.get(ip) || { count: 0 };
        entry.count++;
        progressiveBlocks.set(ip, entry);

        const windowMs = getProgressiveWindowMs(entry.count);
        const blockUntil = new Date(Date.now() + windowMs).toISOString();

        // Registrar en auditoría
        try {
            await SystemLog.create({
                action: 'RATE_LIMIT_EXCEEDED',
                module: 'AUTH',
                details: JSON.stringify({
                    ip,
                    blockCount: entry.count,
                    blockDurationMs: windowMs,
                    blockUntil
                }),
                ip,
                userAgent: req.headers['user-agent'] || 'unknown'
            });
        } catch (err) {
            console.error('⚠️ No se pudo registrar el intento de fuerza bruta en SystemLog:', err.message);
        }

        console.warn(`🚫 BLOQUEO PROGRESIVO: IP ${ip} - Bloqueo #${entry.count} por ${Math.round(windowMs / 60000)} min`);

        res.status(429).json({
            success: false,
            message: 'Demasiados intentos de acceso. Por seguridad, el acceso está temporalmente bloqueado. Inténtalo más tarde.',
            code: 'RATE_LIMITED'
        });
    }
});

/**
 * Middleware de retraso artificial (500ms) para dificultar automatización
 * Se aplica siempre, incluso cuando el login es exitoso o fallido
 */
function loginDelay(req, res, next) {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    res.json = function (body) {
        const elapsed = Date.now() - startTime;
        const remaining = 500 - elapsed;
        if (remaining > 0) {
            return setTimeout(() => originalJson(body), remaining);
        }
        return originalJson(body);
    };

    next();
}

module.exports = { loginRateLimiter, loginDelay, progressiveBlocks };
