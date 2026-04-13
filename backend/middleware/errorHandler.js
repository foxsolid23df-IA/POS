/**
 * Middleware global de manejo de errores
 * Captura errores no controlados y retorna respuestas seguras
 * sin exponer detalles internos del servidor.
 */

function errorHandler(err, req, res, next) {
    // Log interno para depuración (nunca se envía al cliente)
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);

    // Errores de Sequelize
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Error de validación en los datos enviados',
            errors: err.errors.map(e => ({
                field: e.path,
                message: e.message
            }))
        });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            success: false,
            message: 'El recurso ya existe o hay un conflicto de datos únicos'
        });
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
            success: false,
            message: 'Referencia a un recurso inexistente'
        });
    }

    // Errores de tipo (JSON malformed, etc)
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'El cuerpo de la petición tiene un formato JSON inválido'
        });
    }

    // Errores de validación de express-validator (fallback)
    if (err.name === 'ValidationError' || err.errors) {
        return res.status(400).json({
            success: false,
            message: 'Error de validación en los datos enviados',
            errors: err.errors?.map(e => ({
                field: e.path || e.param || 'unknown',
                message: e.msg || e.message || 'Campo inválido'
            }))
        });
    }

    // Error no controlado
    const isProduction = process.env.NODE_ENV === 'production';
    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json({
        success: false,
        message: isProduction ? 'Error interno del servidor' : err.message,
        ...(isProduction ? {} : { stack: err.stack })
    });
}

module.exports = errorHandler;
