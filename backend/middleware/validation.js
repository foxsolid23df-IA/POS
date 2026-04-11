/**
 * Middleware de validación de entradas con express-validator
 * 
 * Proporciona validadores reutilizables para todos los endpoints
 * y un handler global de errores de validación.
 */

const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');

// ── Sanitización XSS para strings ──────────────────────────────
function sanitizeXSS(value) {
    if (typeof value !== 'string') return value;
    return xss(value.trim());
}

// ── Validación de fecha ISO 8601 ───────────────────────────────
function isValidISODate(str) {
    if (!str) return false;
    const date = new Date(str);
    return !isNaN(date.getTime());
}

// ── Validación de rango de fecha razonable ─────────────────────
function isReasonableDate(str) {
    if (!isValidISODate(str)) return false;
    const date = new Date(str);
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return date >= yearAgo && date <= tomorrow;
}

// ── Handler global de errores de validación ────────────────────
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Error de validación en los datos enviados',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
}

// ── Validadores reutilizables ──────────────────────────────────

/**
 * Validador de ID numérico (para params :id)
 */
const validateId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo'),
    handleValidationErrors
];

/**
 * Validador de búsqueda de texto (query ?q=)
 */
const validateSearchQuery = [
    query('q')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('La búsqueda debe tener entre 1 y 200 caracteres')
        .customSanitizer(sanitizeXSS),
    handleValidationErrors
];

/**
 * Validador de paginación (query ?limit= & ?offset=)
 */
const validatePagination = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('El límite debe ser un número entre 1 y 500')
        .toInt(),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('El offset debe ser un número entero no negativo')
        .toInt(),
    handleValidationErrors
];

/**
 * Validador de rango de fechas (query ?fechaInicio= & ?fechaFin=)
 */
const validateDateRange = [
    query('fechaInicio')
        .optional()
        .custom(isValidISODate)
        .withMessage('fechaInicio debe tener formato ISO 8601 (YYYY-MM-DD o ISO string)')
        .custom(isReasonableDate)
        .withMessage('fechaInicio debe estar dentro de un rango de 2 años'),
    query('fechaFin')
        .optional()
        .custom(isValidISODate)
        .withMessage('fechaFin debe tener formato ISO 8601 (YYYY-MM-DD o ISO string)')
        .custom(isReasonableDate)
        .withMessage('fechaFin debe estar dentro de un rango de 2 años'),
    // Verificar que fechaFin >= fechaInicio si ambos están presentes
    handleValidationErrors,
    (req, res, next) => {
        const { fechaInicio, fechaFin } = req.query;
        if (fechaInicio && fechaFin) {
            const start = new Date(fechaInicio);
            const end = new Date(fechaFin);
            if (end < start) {
                return res.status(400).json({
                    success: false,
                    message: 'Error de validación en los datos enviados',
                    errors: [{ field: 'fechaFin', message: 'fechaFin debe ser posterior o igual a fechaInicio' }]
                });
            }
        }
        next();
    }
];

/**
 * Validador de login por PIN
 */
const validateLoginPin = [
    body('pin')
        .trim()
        .notEmpty()
        .withMessage('El PIN es requerido')
        .isLength({ min: 4, max: 6 })
        .withMessage('El PIN debe tener entre 4 y 6 dígitos')
        .isNumeric()
        .withMessage('El PIN debe contener solo números'),
    handleValidationErrors
];

/**
 * Validador de creación de usuario
 */
const validateCreateUser = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres')
        .customSanitizer(sanitizeXSS),
    body('profile')
        .trim()
        .notEmpty()
        .withMessage('El perfil es requerido')
        .isIn(['admin', 'user'])
        .withMessage('El perfil debe ser "admin" o "user"'),
    body('pin')
        .trim()
        .notEmpty()
        .withMessage('El PIN es requerido')
        .isLength({ min: 4, max: 6 })
        .withMessage('El PIN debe tener entre 4 y 6 dígitos')
        .isNumeric()
        .withMessage('El PIN debe contener solo números'),
    handleValidationErrors
];

/**
 * Validador de cambio de PIN
 */
const validatePinChange = [
    body('currentPin')
        .trim()
        .notEmpty()
        .withMessage('El PIN actual es requerido')
        .isLength({ min: 4, max: 6 })
        .withMessage('El PIN debe tener entre 4 y 6 dígitos')
        .isNumeric()
        .withMessage('El PIN debe contener solo números'),
    body('newPin')
        .trim()
        .notEmpty()
        .withMessage('El nuevo PIN es requerido')
        .isLength({ min: 4, max: 6 })
        .withMessage('El PIN debe tener entre 4 y 6 dígitos')
        .isNumeric()
        .withMessage('El PIN debe contener solo números'),
    handleValidationErrors
];

/**
 * Validador de admin reset PIN
 */
const validateAdminResetPin = [
    body('newPin')
        .trim()
        .notEmpty()
        .withMessage('El nuevo PIN es requerido')
        .isLength({ min: 4, max: 6 })
        .withMessage('El PIN debe tener entre 4 y 6 dígitos')
        .isNumeric()
        .withMessage('El PIN debe contener solo números'),
    handleValidationErrors
];

/**
 * Validador de creación de producto
 */
const validateCreateProduct = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('El nombre del producto es requerido')
        .isLength({ min: 1, max: 200 })
        .withMessage('El nombre debe tener entre 1 y 200 caracteres')
        .customSanitizer(sanitizeXSS),
    body('price')
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número positivo')
        .toFloat(),
    body('cost')
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage('El costo debe ser un número positivo')
        .toFloat(),
    body('stock')
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage('El stock debe ser un número entero no negativo')
        .toInt(),
    body('barcode')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('El código de barras no debe exceder 50 caracteres')
        .customSanitizer(sanitizeXSS),
    body('category')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 100 })
        .withMessage('La categoría no debe exceder 100 caracteres')
        .customSanitizer(sanitizeXSS),
    handleValidationErrors
];

/**
 * Validador de actualización de producto
 */
const validateUpdateProduct = [
    ...validateId.slice(0, -1), // Re-validar el ID
    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('El nombre no puede estar vacío')
        .isLength({ min: 1, max: 200 })
        .withMessage('El nombre debe tener entre 1 y 200 caracteres')
        .customSanitizer(sanitizeXSS),
    body('price')
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número positivo')
        .toFloat(),
    body('cost')
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage('El costo debe ser un número positivo')
        .toFloat(),
    body('stock')
        .optional({ nullable: true })
        .isInt()
        .withMessage('El stock debe ser un número entero')
        .toInt(),
    body('barcode')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('El código de barras no debe exceder 50 caracteres')
        .customSanitizer(sanitizeXSS),
    body('category')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 100 })
        .withMessage('La categoría no debe exceder 100 caracteres')
        .customSanitizer(sanitizeXSS),
    handleValidationErrors
];

/**
 * Validador de entrada de stock
 */
const validateStockEntry = [
    ...validateId.slice(0, -1),
    body('cantidadEntrante')
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage('La cantidad entrante debe ser un número entero no negativo')
        .toInt(),
    body('cantidadMerma')
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage('La cantidad de merma debe ser un número entero no negativo')
        .toInt(),
    handleValidationErrors,
    (req, res, next) => {
        const { cantidadEntrante, cantidadMerma } = req.body;
        if ((cantidadEntrante === undefined || cantidadEntrante === null) &&
            (cantidadMerma === undefined || cantidadMerma === null)) {
            return res.status(400).json({
                success: false,
                message: 'Error de validación en los datos enviados',
                errors: [{ field: 'cantidadEntrante', message: 'Se requiere al menos cantidadEntrante o cantidadMerma' }]
            });
        }
        next();
    }
];

/**
 * Validador de creación de venta
 */
const validateCreateSale = [
    body('items')
        .isArray({ min: 1, max: 500 })
        .withMessage('La venta debe tener al menos 1 producto y máximo 500'),
    body('items.*.productId')
        .isInt({ min: 1 })
        .withMessage('Cada producto debe tener un ID válido'),
    body('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('La cantidad debe ser al menos 1'),
    body('items.*.price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El precio unitario debe ser un número positivo')
        .toFloat(),
    body('total')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El total debe ser un número positivo')
        .toFloat(),
    body('paymentMethod')
        .optional()
        .trim()
        .isIn(['efectivo', 'tarjeta', 'transferencia', 'otro'])
        .withMessage('El método de pago no es válido'),
    body('customerName')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 200 })
        .withMessage('El nombre del cliente no debe exceder 200 caracteres')
        .customSanitizer(sanitizeXSS),
    body('observations')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Las observaciones no deben exceder 500 caracteres')
        .customSanitizer(sanitizeXSS),
    handleValidationErrors
];

/**
 * Validador de barcode (params :barcode)
 */
const validateBarcode = [
    param('barcode')
        .trim()
        .notEmpty()
        .withMessage('El código de barras es requerido')
        .isLength({ max: 50 })
        .withMessage('El código de barras no debe exceder 50 caracteres')
        .customSanitizer(sanitizeXSS),
    handleValidationErrors
];

module.exports = {
    // Handler central
    handleValidationErrors,
    // Validadores individuales
    validateId,
    validateSearchQuery,
    validatePagination,
    validateDateRange,
    validateLoginPin,
    validateCreateUser,
    validatePinChange,
    validateAdminResetPin,
    validateCreateProduct,
    validateUpdateProduct,
    validateStockEntry,
    validateCreateSale,
    validateBarcode,
    // Utilidades
    sanitizeXSS,
    isValidISODate,
    isReasonableDate
};
