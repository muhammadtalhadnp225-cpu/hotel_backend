import { Router } from 'express';
import {
  submitContactInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiryStatus,
  replyInquiry,
  deleteInquiry,
} from '../controllers/contactController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Public website contact submission
router.post('/', submitContactInquiry);
router.post('/inquiries', submitContactInquiry);

// Admin & Receptionist endpoints to manage contact inquiries (supporting both /api/contact and /api/contact/inquiries)
router.get('/', protect, authorize('admin', 'receptionist'), getAllInquiries);
router.get('/inquiries', protect, authorize('admin', 'receptionist'), getAllInquiries);

router.get('/:id', protect, authorize('admin', 'receptionist'), getInquiryById);
router.get('/inquiries/:id', protect, authorize('admin', 'receptionist'), getInquiryById);

router.patch('/:id/status', protect, authorize('admin', 'receptionist'), updateInquiryStatus);
router.patch('/inquiries/:id/status', protect, authorize('admin', 'receptionist'), updateInquiryStatus);

router.post('/:id/reply', protect, authorize('admin', 'receptionist'), replyInquiry);
router.post('/inquiries/:id/reply', protect, authorize('admin', 'receptionist'), replyInquiry);

router.delete('/:id', protect, authorize('admin'), deleteInquiry);
router.delete('/inquiries/:id', protect, authorize('admin'), deleteInquiry);

export default router;
