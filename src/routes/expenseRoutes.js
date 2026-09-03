import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  getExpenseSummary,
  updateExpense,
  deleteExpense
} from '../controllers/expenseController.js';

const router = express.Router();

router.use(protect);

router.post('/', createExpense);
router.get('/', getExpenses);
router.get('/summary', getExpenseSummary);
router.get('/:id', getExpenseById);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;