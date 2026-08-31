// routes/reportRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  generateWeeklyStockReport,
  getWeeklyStockReports,
  getWeeklyStockReportById,
  finalizeWeeklyStockReport,
  getStockValueSummary
} from '../controllers/stockReportController.js';
import {
  calculateWeeklyProfit,
  getProfitSummary,
  getProfitByCategory,
  getProfitTrends
} from '../controllers/profitController.js';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  getExpenseSummary,
  updateExpense,
  deleteExpense
} from '../controllers/expenseController.js';
import {
  recordPhysicalCount,
  getPhysicalCounts,
  getVarianceSummary,
  getProductsNeedingCount
} from '../controllers/physicalCountController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================================
// STOCK REPORT ROUTES
// ============================================================

// POST /api/reports/stock/weekly - Generate weekly stock report
router.post('/stock/weekly', generateWeeklyStockReport);

// GET /api/reports/stock/weekly - Get all weekly stock reports
router.get('/stock/weekly', getWeeklyStockReports);

// GET /api/reports/stock/weekly/:id - Get single report by ID
router.get('/stock/weekly/:id', getWeeklyStockReportById);

// PUT /api/reports/stock/weekly/:id/finalize - Finalize report
router.put('/stock/weekly/:id/finalize', finalizeWeeklyStockReport);

// GET /api/reports/stock/value - Get current stock value summary
router.get('/stock/value', getStockValueSummary);

// ============================================================
// PROFIT ROUTES
// ============================================================

// POST /api/reports/profit/weekly - Calculate weekly profit
router.post('/profit/weekly', calculateWeeklyProfit);

// POST /api/reports/profit/summary - Get P&L summary for date range
router.post('/profit/summary', getProfitSummary);

// GET /api/reports/profit/by-category - Profit by product category
router.get('/profit/by-category', getProfitByCategory);

// GET /api/reports/profit/trends - Profit trends (weekly/monthly)
router.get('/profit/trends', getProfitTrends);

// ============================================================
// EXPENSE ROUTES
// ============================================================

// POST /api/reports/expenses - Create expense
router.post('/expenses', createExpense);

// GET /api/reports/expenses - Get all expenses
router.get('/expenses', getExpenses);

// GET /api/reports/expenses/summary - Get expense summary
router.get('/expenses/summary', getExpenseSummary);

// GET /api/reports/expenses/:id - Get expense by ID
router.get('/expenses/:id', getExpenseById);

// PUT /api/reports/expenses/:id - Update expense
router.put('/expenses/:id', updateExpense);

// DELETE /api/reports/expenses/:id - Delete expense
router.delete('/expenses/:id', deleteExpense);

// ============================================================
// PHYSICAL COUNT ROUTES
// ============================================================

// POST /api/reports/physical-counts - Record physical count
router.post('/physical-counts', recordPhysicalCount);

// GET /api/reports/physical-counts - Get all physical counts
router.get('/physical-counts', getPhysicalCounts);

// GET /api/reports/physical-counts/variance-summary - Get variance summary
router.get('/physical-counts/variance-summary', getVarianceSummary);

// GET /api/reports/physical-counts/needing-count - Products needing count
router.get('/physical-counts/needing-count', getProductsNeedingCount);

export default router;