import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  searchPosProducts,
  getProductByBarcode,
  getProductsBatch,
  getProductSuggestions
} from '../controllers/posProductController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Product search and suggestions
router.get('/products/search', searchPosProducts);
router.get('/products/suggestions', getProductSuggestions);

// Product by barcode (for scanning)
router.get('/products/barcode/:barcode', getProductByBarcode);

// Batch product retrieval (for cart)
router.post('/products/batch', getProductsBatch);

export default router;