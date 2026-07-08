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
  updateProductStock
} from '../controllers/productController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Special routes first
router.get('/low-stock', getLowStock);
router.get('/out-of-stock', getOutOfStock);

// CRUD routes
router.route('/')
  .post(createProduct)
  .get(getProducts);

router.route('/:id')
  .get(getProduct)
  .put(updateProduct)
  .delete(deleteProduct);

// Stock update
router.patch('/:id/stock', updateProductStock);

export default router;