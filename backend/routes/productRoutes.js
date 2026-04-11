const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const {
    validateId,
    validateSearchQuery,
    validatePagination,
    validateCreateProduct,
    validateUpdateProduct,
    validateStockEntry,
    validateBarcode
} = require('../middleware/validation');

// Rutas para productos
router.get('/', validatePagination, productController.getAllProducts);               // GET /api/products
router.get('/search', validateSearchQuery, productController.searchProducts);        // GET /api/products/search?q=
router.get('/low-stock', productController.getLowStockProducts);                     // GET /api/products/low-stock
router.get('/barcode/:barcode', validateBarcode, productController.getProductByBarcode); // GET /api/products/barcode/:barcode
router.get('/:id', validateId, productController.getProductById);                    // GET /api/products/:id
router.post('/', validateCreateProduct, productController.createProduct);            // POST /api/products
router.put('/:id', validateUpdateProduct, productController.updateProduct);          // PUT /api/products/:id
router.delete('/:id', validateId, productController.deleteProduct);                  // DELETE /api/products/:id
router.post('/:id/entradas', validateStockEntry, productController.registrarEntrada); // POST /api/products/:id/entradas

module.exports = router;