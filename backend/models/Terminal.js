const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

/**
 * Modelo para las terminales (computadoras/dispositivos) registradas
 */
const Terminal = sequelize.define('Terminal', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_main: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true,
    tableName: 'terminals'
});

module.exports = Terminal;
