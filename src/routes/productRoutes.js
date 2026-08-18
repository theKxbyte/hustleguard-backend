// routes/productRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getLowStock,
  getOutOfStock,
  addProductStock,
  getProductStock,
  convertStock,
  getProductByBarcode,
  bulkCreateProducts,
  getStockAlerts
} from '../controllers/productController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================================
// Special Routes (must come before /:id routes)
// ============================================================

// GET /api/products/low-stock - Get low stock products
router.get('/low-stock', getLowStock);

// GET /api/products/out-of-stock - Get out of stock products
router.get('/out-of-stock', getOutOfStock);

// GET /api/products/alerts - Get stock alerts summary
router.get('/alerts', getStockAlerts);

// GET /api/products/barcode/:barcode - Get product by barcode
router.get('/barcode/:barcode', getProductByBarcode);

// POST /api/products/bulk - Bulk import products
router.post('/bulk', bulkCreateProducts);

// ============================================================
// Product Stock Routes
// ============================================================

// GET /api/products/:id/stock - Get product stock breakdown
// POST /api/products/:id/stock - Add stock to product
router.get('/:id/stock', getProductStock);
router.post('/:id/stock', addProductStock);

// POST /api/products/:id/convert - Convert stock between units
router.post('/:id/convert', convertStock);

// ============================================================
// Main CRUD Routes
// ============================================================

// GET /api/products - Get all products
// POST /api/products - Create a new product
router.route('/')
  .get(getProducts)
  .post(createProduct);

// GET /api/products/:id - Get single product
// PUT /api/products/:id - Update product
// DELETE /api/products/:id - Delete product
router.route('/:id')
  .get(getProduct)
  .put(updateProduct)
  .delete(deleteProduct);

export default router;