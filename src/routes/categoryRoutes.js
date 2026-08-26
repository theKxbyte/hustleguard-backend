// routes/categoryRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts
} from '../controllers/categoryController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================================
// Main CRUD Routes
// ============================================================

// GET /api/categories - Get all categories
// POST /api/categories - Create a new category
router.route('/')
  .get(getCategories)
  .post(createCategory);

// GET /api/categories/:id - Get single category
// PUT /api/categories/:id - Update category
// DELETE /api/categories/:id - Delete category
router.route('/:id')
  .get(getCategory)
  .put(updateCategory)
  .delete(deleteCategory);

// GET /api/categories/:id/products - Get products in category
router.get('/:id/products', getCategoryProducts);

export default router;