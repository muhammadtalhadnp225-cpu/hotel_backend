import { Router } from 'express';
import {
  getRooms,
  getRoomById,
  checkRoomAvailability,
  createRoom,
  updateRoom,
  changeRoomStatus,
  deleteRoom,
} from '../controllers/roomController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Public/authenticated room reading
router.get('/', getRooms);
router.get('/:id', getRoomById);
router.get('/:id/availability', checkRoomAvailability);

// Room status updating (Accessible by admin, receptionist)
router.patch('/:id/status', protect, authorize('admin', 'receptionist'), changeRoomStatus);

// Protected room management
router.post('/', protect, authorize('admin'), createRoom);
router.put('/:id', protect, authorize('admin'), updateRoom);
router.delete('/:id', protect, authorize('admin'), deleteRoom);

export default router;
