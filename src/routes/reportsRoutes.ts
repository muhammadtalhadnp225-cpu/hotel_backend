import { Router } from 'express';
import { getAdminReports, getReceptionReports } from '../controllers/reportsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/admin', protect, getAdminReports);
router.get('/reception', protect, getReceptionReports);

export default router;
