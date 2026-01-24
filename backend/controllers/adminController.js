/**
 * Controlador para operaciones administrativas y de soporte
 */
const sequelize = require('../db/conexion');
const SystemLog = require('../models/SystemLog');
const { Sale } = require('../models/Sale');
const { Product } = require('../models/Product');
const User = require('../models/User');
const Terminal = require('../models/Terminal');

exports.getHealth = async (req, res) => {
    try {
        await SystemLog.create({
            action: 'HEALTH_CHECK',
            module: 'ADMIN_API',
            details: 'Validación de conexión a base de datos exitosa',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        await sequelize.authenticate();
        
        res.json({
            success: true,
            status: 'Operational',
            database: 'Connected',
            timestamp: new Date().toISOString(),
            version: '1.0.0-admin-alpha'
        });
    } catch (error) {
        await SystemLog.create({
            action: 'HEALTH_CHECK_FAILED',
            module: 'ADMIN_API',
            details: `Error: ${error.message}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(500).json({
            success: false,
            status: 'Degraded',
            database: 'Disconnected',
            error: error.message
        });
    }
};

exports.getLogs = async (req, res) => {
    try {
        const logs = await SystemLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: 100
        });
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * RESET DE DISPOSITIVOS (TERMINALES)
 * Borra todas las terminales registradas para liberar licencias
 */
exports.resetDevices = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const count = await Terminal.count();
        await Terminal.destroy({ where: {}, truncate: true, transaction: t });

        await SystemLog.create({
            action: 'RESET_DEVICES',
            module: 'ADMIN_API',
            details: `Se liberaron ${count} terminales/dispositivos.`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: `Se han liberado ${count} dispositivos correctamente.` });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * LIMPIAR TRANSACCIONES
 * Borra historial de ventas pero mantiene productos y usuarios
 */
exports.resetSales = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const count = await Sale.count();
        await Sale.destroy({ where: {}, truncate: true, transaction: t });

        await SystemLog.create({
            action: 'RESET_SALES',
            module: 'ADMIN_API',
            details: `Se eliminaron ${count} registros de ventas/transacciones.`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: `Se han eliminado ${count} ventas. El inventario permanece intacto.` });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * RESET DE USUARIOS SECUNDARIOS
 * Elimina todos los usuarios excepto el Administrador inicial
 */
exports.resetSecondaryUsers = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // Obtenemos el admin (usualmente el primero creado o con profile admin)
        const admins = await User.findAll({ where: { profile: 'admin' }, order: [['createdAt', 'ASC']] });
        const primaryAdminId = admins[0]?.id;

        if (!primaryAdminId) throw new Error("No se encontró un Administrador principal para preservar.");

        const deletedCount = await User.destroy({
            where: {
                id: { [sequelize.Sequelize.Op.ne]: primaryAdminId }
            },
            transaction: t
        });

        await SystemLog.create({
            action: 'RESET_USERS',
            module: 'ADMIN_API',
            details: `Se eliminaron ${deletedCount} usuarios secundarios. Se preservó el Admin ID: ${primaryAdminId}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: `Se han eliminado ${deletedCount} usuarios. Solo el Administrador tiene acceso.` });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * RESET DE FÁBRICA (BORRAR TODO)
 * Limpia absolutamente todas las tablas excepto la configuración de sistema
 */
exports.factoryReset = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // 1. Borrar Ventas
        await Sale.destroy({ where: {}, truncate: true, transaction: t });
        // 2. Borrar Productos
        await Product.destroy({ where: {}, truncate: true, transaction: t });
        // 3. Borrar Terminales
        await Terminal.destroy({ where: {}, truncate: true, transaction: t });
        // 4. Borrar Usuarios Secundarios (Preservar 1 Admin)
        const admins = await User.findAll({ where: { profile: 'admin' }, order: [['createdAt', 'ASC']] });
        const primaryAdminId = admins[0]?.id;
        if (primaryAdminId) {
            await User.destroy({
                where: { id: { [sequelize.Sequelize.Op.ne]: primaryAdminId } },
                transaction: t
            });
        }

        await SystemLog.create({
            action: 'FACTORY_RESET',
            module: 'ADMIN_API',
            details: 'RESETEO TOTAL DEL SISTEMA EJECUTADO.',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: "El sistema ha sido reseteado a valores de fábrica. Todo el historial y productos han sido eliminados." });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};
