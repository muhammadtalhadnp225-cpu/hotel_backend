import express from 'express';
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  updateBookingStatus,
  addPaymentToBooking,
  deleteBooking,
  searchAvailability,
  checkRoomAvailability,
  verifyRoomSelection,
} from '../controllers/bookingController.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public / Protected Reservation routes
router.get('/search-availability', searchAvailability);
router.post('/check-availability', checkRoomAvailability);
router.post('/verify-selection', verifyRoomSelection);
router.get('/lookup/:reference', getBookingById);

router.get('/', getBookings);
router.get('/:id', getBookingById);
router.post('/', optionalAuth, createBooking);
router.put('/:id', protect, updateBooking);
router.patch('/:id/status', protect, updateBookingStatus);
router.post('/:id/payments', protect, addPaymentToBooking);
router.delete('/:id', protect, deleteBooking);

export default router;

