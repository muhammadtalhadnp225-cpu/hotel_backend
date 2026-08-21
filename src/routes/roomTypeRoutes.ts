import { Router } from 'express';
import {
  getRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} from '../controllers/roomTypeController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Public / Authenticated read
router.get('/', getRoomTypes);
router.get('/:id', getRoomTypeById);

// Protected Admin room type management
router.post('/', protect, authorize('admin'), createRoomType);
router.put('/:id', protect, authorize('admin'), updateRoomType);
router.delete('/:id', protect, authorize('admin'), deleteRoomType);

export default router;
