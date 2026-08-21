import express from 'express';
import {
  getGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
  getGuestHistory,
} from '../controllers/guestController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Guest Routes
router.get('/', getGuests);
router.get('/:id', getGuestById);
router.get('/:id/history', getGuestHistory);
router.post('/', protect, createGuest);
router.put('/:id', protect, updateGuest);
router.delete('/:id', protect, deleteGuest);

export default router;
