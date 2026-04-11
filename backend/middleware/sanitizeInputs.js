/**
 * Middleware de sanitización general para inputs no cubiertos por express-validator
 */

const xss = require('xss');

/**
 * Sanitiza recursivamente todos los strings en un objeto
 */
function sanitizeObject(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 5) return obj;

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = xss(value.trim());
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value, depth + 1);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/**
 * Middleware global de sanitización
 * Limpia req.body, req.query y req.params de posibles XSS
 */
function sanitizeInputs(req, res, next) {
    // Sanitizar body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }

    // Sanitizar query params (excepto campos que express-validator procesará después)
    if (req.query && typeof req.query === 'object') {
        for (const key of Object.keys(req.query)) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = xss(req.query[key].trim());
            }
        }
    }

    next();
}

module.exports = { sanitizeInputs, sanitizeObject };
