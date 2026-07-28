import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  recordSale,
  getSales,
  getDailySales,
  getSalesStats
} from '../controllers/saleController.js';

const router = express.Router();


router.use(protect);

router.route('/')
  .post(recordSale)
  .get(getSales);

router.get('/daily', getDailySales);
router.get('/stats', getSalesStats);

export default router;