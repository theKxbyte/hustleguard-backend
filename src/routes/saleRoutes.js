// routes/saleRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  recordSale,
  getSales,
  getSale,
  getSaleByInvoice,
  getDailySales,
  getSalesStats,
  getSalesByProduct,
  getSalesSummary,
  updatePaymentStatus,
  deleteSale
} from '../controllers/saleController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================================
// Main Sale Routes
// ============================================================

// GET /api/sales - Get all sales (with filters)
// POST /api/sales - Record a new sale (multi-item)
router.route('/')
  .get(getSales)
  .post(recordSale);

// ============================================================
// Stats & Summary Routes
// ============================================================

// GET /api/sales/daily - Get daily sales summary
router.get('/daily', getDailySales);

// GET /api/sales/stats - Get sales statistics
router.get('/stats', getSalesStats);

// POST /api/sales/summary - Get sales summary for date range
router.post('/summary', getSalesSummary);

// ============================================================
// Product-specific Sales
// ============================================================

// GET /api/sales/product/:productId - Get sales by product
router.get('/product/:productId', getSalesByProduct);

// ============================================================
// Invoice & Single Sale Routes
// ============================================================

// GET /api/sales/invoice/:invoiceNumber - Get sale by invoice number
router.get('/invoice/:invoiceNumber', getSaleByInvoice);

// GET /api/sales/:id - Get single sale by ID
// PUT /api/sales/:id/payment - Update payment status
// DELETE /api/sales/:id - Delete/void a sale
router.get('/:id', getSale);
router.put('/:id/payment', updatePaymentStatus);
router.delete('/:id', deleteSale);

export default router;