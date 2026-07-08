import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getAlerts,
  getUnreadCount,
  markAsRead,
  markAsResolved,
  markAllAsRead,
  deleteAlert,
  runStockChecks
} from '../controllers/alertController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Special routes first
router.get('/unread/count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.post('/check-stock', runStockChecks);

// CRUD routes
router.route('/')
  .get(getAlerts);

router.route('/:id')
  .delete(deleteAlert);

// Action routes
router.put('/:id/read', markAsRead);
router.put('/:id/resolve', markAsResolved);

export default router;