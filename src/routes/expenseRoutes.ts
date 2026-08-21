import { Router } from 'express';
import { getExpenses, createExpense, deleteExpense } from '../controllers/expenseController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, authorize('admin', 'receptionist'), getExpenses);
router.post('/', protect, authorize('admin'), createExpense);
router.delete('/:id', protect, authorize('admin'), deleteExpense);

export default router;
