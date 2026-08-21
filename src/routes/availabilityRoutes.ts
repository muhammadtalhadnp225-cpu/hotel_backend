import express from 'express';
import {
  searchAvailability,
  checkRoomAvailability,
  verifyRoomSelection,
} from '../controllers/bookingController.js';

const router = express.Router();

router.get('/check', searchAvailability);
router.post('/check', checkRoomAvailability);
router.post('/verify-selection', verifyRoomSelection);

export default router;
