// routes/dashboardRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getDashboardStats,
  getInventoryValue,
  getWeeklySales,
  getWeeklyGrossProfit
} from '../controllers/dashboardController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Get all dashboard stats in one request
router.get('/stats', getDashboardStats);

// Individual endpoints if you need them separately
router.get('/inventory-value', getInventoryValue);
router.get('/weekly-sales', getWeeklySales);
router.get('/weekly-profit', getWeeklyGrossProfit);

export default router;