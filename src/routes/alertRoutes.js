// routes/alertRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getAlerts,
  getAlert,
  getUnreadCount,
  getAlertSummary,
  markAsRead,
  markAsResolved,
  markAllAsRead,
  markAllAsResolved,
  deleteAlert,
  deleteResolvedAlerts,
  runStockChecks,
  runStockCheckType,
  getAlertsByProduct
} from '../controllers/alertController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// ============================================================
// Special Routes (must come before /:id routes)
// ============================================================

// GET /api/alerts/unread/count - Get unread alerts count
router.get('/unread/count', getUnreadCount);

// GET /api/alerts/summary - Get alert summary by type/severity
router.get('/summary', getAlertSummary);

// PUT /api/alerts/read-all - Mark all alerts as read
router.put('/read-all', markAllAsRead);

// PUT /api/alerts/resolve-all - Mark all alerts as resolved
router.put('/resolve-all', markAllAsResolved);

// DELETE /api/alerts/resolved - Delete all resolved alerts
router.delete('/resolved', deleteResolvedAlerts);

// ============================================================
// Stock Check Routes
// ============================================================

// POST /api/alerts/check-stock - Run all stock checks
router.post('/check-stock', runStockChecks);

// POST /api/alerts/check/:type - Run specific stock check
router.post('/check/:type', runStockCheckType);

// ============================================================
// Product-specific Alerts
// ============================================================

// GET /api/alerts/product/:productId - Get alerts by product
router.get('/product/:productId', getAlertsByProduct);

// ============================================================
// Main CRUD Routes
// ============================================================

// GET /api/alerts - Get all alerts (with filters)
router.route('/')
  .get(getAlerts);

// ============================================================
// Single Alert Routes
// ============================================================

// GET /api/alerts/:id - Get single alert by ID
// DELETE /api/alerts/:id - Delete alert
router.route('/:id')
  .get(getAlert)
  .delete(deleteAlert);

// PUT /api/alerts/:id/read - Mark alert as read
router.put('/:id/read', markAsRead);

// PUT /api/alerts/:id/resolve - Mark alert as resolved
router.put('/:id/resolve', markAsResolved);

export default router;