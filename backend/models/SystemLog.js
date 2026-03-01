const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

/**
 * Modelo para el registro de auditoría de acciones críticas
 */
const SystemLog = sequelize.define('SystemLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Descripción de la acción (ej: LOGIN_ADMIN, FACTORY_RESET)'
    },
    module: {
        type: DataTypes.STRING,
        defaultValue: 'ADMIN_API',
        allowNull: false
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON o texto con detalles adicionales del evento'
    },
    ip: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true, // Crea automáticamente createdAt y updatedAt
    tableName: 'system_logs'
});

module.exports = SystemLog;
