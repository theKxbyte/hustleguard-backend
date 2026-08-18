// routes/posRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  searchPosProducts,
  getProductByBarcode,
  getProductsBatch,
  getProductSuggestions,
  getPosProductStock,
  checkUnitAvailability,
  quickScanProduct,
  getRecentProducts,
  getProductUnitPrice
} from '../controllers/posProductController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================================
// Product Search & Suggestions
// ============================================================

// GET /api/pos/products/search - Search products with UOM and stock
router.get('/products/search', searchPosProducts);

// GET /api/pos/products/suggestions - Autocomplete suggestions
router.get('/products/suggestions', getProductSuggestions);

// ============================================================
// Quick Actions (Cashier Workflow)
// ============================================================

// GET /api/pos/products/quick-scan - Quick scan by name or barcode
router.get('/products/quick-scan', quickScanProduct);

// GET /api/pos/products/recent - Recently sold products
router.get('/products/recent', getRecentProducts);

// ============================================================
// Barcode & Batch
// ============================================================

// GET /api/pos/products/barcode/:barcode - Get product by barcode (with units)
router.get('/products/barcode/:barcode', getProductByBarcode);

// POST /api/pos/products/batch - Get multiple products by IDs
router.post('/products/batch', getProductsBatch);

// ============================================================
// Stock & Unit Validation
// ============================================================

// GET /api/pos/products/:id/stock - Get product stock for POS
router.get('/products/:id/stock', getPosProductStock);

// GET /api/pos/products/:id/check-unit/:unitName - Check unit availability
router.get('/products/:id/check-unit/:unitName', checkUnitAvailability);

// GET /api/pos/products/:id/price/:unitName - Get price for specific unit
router.get('/products/:id/price/:unitName', getProductUnitPrice);

export default router;