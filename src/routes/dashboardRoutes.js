// routes/dashboardRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getDashboardStats,
  getInventoryValue,
  getInventoryByCategory,
  getWeeklySales,
  getWeeklyGrossProfit,
  getMonthlySales,
  getTopProducts,
  getSalesSummary
} from '../controllers/dashboardController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// ============================================================
// Main Dashboard Stats (all in one)
// ============================================================

// GET /api/dashboard/stats - Get all dashboard statistics
router.get('/stats', getDashboardStats);

// ============================================================
// Inventory Routes
// ============================================================

// GET /api/dashboard/inventory-value - Get total inventory value
router.get('/inventory-value', getInventoryValue);

// GET /api/dashboard/inventory-by-category - Inventory breakdown by category
router.get('/inventory-by-category', getInventoryByCategory);

// ============================================================
// Sales Routes
// ============================================================

// GET /api/dashboard/weekly-sales - Get weekly sales breakdown by day
router.get('/weekly-sales', getWeeklySales);

// GET /api/dashboard/weekly-profit - Get weekly gross profit
router.get('/weekly-profit', getWeeklyGrossProfit);

// GET /api/dashboard/monthly-sales - Get monthly sales
router.get('/monthly-sales', getMonthlySales);

// POST /api/dashboard/sales-summary - Get sales summary for custom date range
router.post('/sales-summary', getSalesSummary);

// ============================================================
// Product Performance Routes
// ============================================================

// GET /api/dashboard/top-products - Get top selling products
router.get('/top-products', getTopProducts);

export default router;