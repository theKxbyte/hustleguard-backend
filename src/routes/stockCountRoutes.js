// src/routes/stockCountRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  createDraft,
  updateDraft,
  countSingleItem,
  confirmCount,
  cancelDraft,
  getHistory,
  getLatestConfirmed,
  getLatestDraft,
  getCountById
} from '../controllers/stockCountController.js';

const router = express.Router();
router.use(protect);

router.get('/latest-confirmed', getLatestConfirmed);
router.get('/latest-draft', getLatestDraft);

router.post('/draft', createDraft);
router.put('/:id', updateDraft);
router.post('/:id/count-item', countSingleItem);
router.post('/:id/confirm', confirmCount);
router.delete('/:id', cancelDraft);

router.get('/', getHistory);
router.get('/:id', getCountById);

export default router;