// routes/stockMonitorRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getTodayStockSnapshot,
  getMonitorMeta
} from '../controllers/stockMonitorController.js';

const router = express.Router();

router.use(protect);

// GET /api/stock-monitor/today - Today's stock snapshot (with draft info)
router.get('/today', getTodayStockSnapshot);

// GET /api/stock-monitor/meta - Lightweight draft/confirmed-status check
router.get('/meta', getMonitorMeta);

export default router;