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
  deleteResolvedAlerts
} from '../controllers/alertController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// ============================================================
// Special Routes (must come before /:id routes)
// ============================================================

// GET /api/alerts/unread/count
router.get('/unread/count', getUnreadCount);

// GET /api/alerts/summary
router.get('/summary', getAlertSummary);

// PUT /api/alerts/read-all
router.put('/read-all', markAllAsRead);

// PUT /api/alerts/resolve-all
router.put('/resolve-all', markAllAsResolved);

// DELETE /api/alerts/resolved
router.delete('/resolved', deleteResolvedAlerts);

// ============================================================
// Main CRUD Routes
// ============================================================

// GET /api/alerts
router.get('/', getAlerts);

// ============================================================
// Single Alert Routes
// ============================================================

router.get('/:id', getAlert);
router.delete('/:id', deleteAlert);
router.put('/:id/read', markAsRead);
router.put('/:id/resolve', markAsResolved);

export default router;