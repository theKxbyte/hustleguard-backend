// routes/stockMovementRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  receiveStock,
  recordAdjustment,
  listMovements,
  reverseMovement
} from '../controllers/stockMovementController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================================
// Receive & Adjust
// ============================================================

// POST /api/stock-movements/receive - Formalized stock-in
router.post('/receive', receiveStock);

// POST /api/stock-movements/adjust - Non-sale adjustment
router.post('/adjust', recordAdjustment);

// ============================================================
// List & Reverse
// ============================================================

// GET /api/stock-movements - List movements (filters: productId, type, reason, dates)
router.get('/', listMovements);

// DELETE /api/stock-movements/:id - Reverse a movement (soft)
router.delete('/:id', reverseMovement);

export default router;