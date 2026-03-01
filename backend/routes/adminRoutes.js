const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authAdmin = require('../middleware/authAdmin');

// --- RUTAS DE MONITOREO ---

// Ruta de salud del sistema (Requiere PIN Maestro)
router.get('/health', authAdmin, adminController.getHealth);

// Ruta para ver logs de auditoría
router.get('/logs', authAdmin, adminController.getLogs);


// --- RUTAS DE MANTENIMIENTO (ACCIONES CRÍTICAS) ---

// Resetear dispositivos/terminales
router.post('/reset/devices', authAdmin, adminController.resetDevices);

// Limpiar historial de ventas (Transacciones)
router.post('/reset/sales', authAdmin, adminController.resetSales);

// Eliminar usuarios secundarios
router.post('/users/reset-secondary', authAdmin, adminController.resetSecondaryUsers);

// Reset de Fábrica (Borrar todo)
router.post('/reset/factory', authAdmin, adminController.factoryReset);

module.exports = router;
