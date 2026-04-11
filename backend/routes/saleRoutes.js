const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const {
    validateId,
    validatePagination,
    validateDateRange,
    validateCreateSale
} = require('../middleware/validation');

// Rutas para ventas - Las rutas más específicas van primero
router.get('/stats/top-products', saleController.getTopProducts);           // GET /api/sales/stats/top-products
router.get('/stats/date-range', validateDateRange, saleController.getStatsByDateRange);  // GET /api/sales/stats/date-range
router.get('/stats', saleController.getSalesStats);                         // GET /api/sales/stats
router.get('/', validatePagination, saleController.getAllSales);            // GET /api/sales
router.get('/:id', validateId, saleController.getSaleById);                 // GET /api/sales/:id
router.post('/', validateCreateSale, saleController.createSale);            // POST /api/sales

module.exports = router;
