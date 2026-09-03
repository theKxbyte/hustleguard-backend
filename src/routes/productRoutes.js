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

// GET /api/products/low-stock
router.get('/low-stock', getLowStock);

// GET /api/products/out-of-stock
router.get('/out-of-stock', getOutOfStock);

// GET /api/products/alerts
router.get('/alerts', getStockAlerts);

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', getProductByBarcode);

// POST /api/products/bulk
router.post('/bulk', bulkCreateProducts);

// ============================================================
// Product Stock Routes
// ============================================================

// POST /api/products/:id/stock - Add stock
router.post('/:id/stock', addProductStock);

// ============================================================
// Main CRUD Routes
// ============================================================

// GET /api/products
// POST /api/products
router.route('/')
  .get(getProducts)
  .post(createProduct);

// GET /api/products/:id
// PUT /api/products/:id
// DELETE /api/products/:id
router.route('/:id')
  .get(getProduct)
  .put(updateProduct)
  .delete(deleteProduct);

export default router;