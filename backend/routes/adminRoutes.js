const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authAdmin = require('../middleware/authAdmin');
const { adminActionLimiter } = require('../middleware/adminRateLimiter');

// --- RUTAS DE MONITOREO ---

// Ruta de salud del sistema (Requiere PIN Maestro)
router.get('/health', authAdmin, adminController.getHealth);

// Ruta para ver logs de auditoría
router.get('/logs', authAdmin, adminController.getLogs);


// --- RUTAS DE MANTENIMIENTO (ACCIONES CRÍTICAS) ---

// Resetear dispositivos/terminales (con límite de tasa)
router.post('/reset/devices', authAdmin, adminActionLimiter, adminController.resetDevices);

// Limpiar historial de ventas (Transacciones)
router.post('/reset/sales', authAdmin, adminActionLimiter, adminController.resetSales);

// Eliminar usuarios secundarios
router.post('/users/reset-secondary', authAdmin, adminActionLimiter, adminController.resetSecondaryUsers);

// Reset de Fábrica (Borrar todo) - límite más estricto
router.post('/reset/factory', authAdmin, adminActionLimiter, adminController.factoryReset);

module.exports = router;
