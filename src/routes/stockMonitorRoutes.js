// routes/stockMonitorRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import { getTodayStockSnapshot } from '../controllers/stockMonitorController.js';

const router = express.Router();

router.use(protect);

// GET /api/stock-monitor/today - Today's stock snapshot
router.get('/today', getTodayStockSnapshot);

export default router;