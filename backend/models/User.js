const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    profile: {
        type: DataTypes.ENUM('admin', 'user'),
        defaultValue: 'user',
        allowNull: false
    },
    pin: {
        type: DataTypes.STRING,
        allowNull: false
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    hooks: {
        beforeCreate: async (user) => {
            if (user.pin) {
                const salt = await bcrypt.genSalt(10);
                user.pin = await bcrypt.hash(user.pin, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('pin')) {
                const salt = await bcrypt.genSalt(10);
                user.pin = await bcrypt.hash(user.pin, salt);
            }
        }
    }
});

// Método para verificar PIN
User.prototype.comparePin = async function (candidatePin) {
    return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = User;
