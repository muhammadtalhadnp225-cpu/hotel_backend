import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getSettings);
router.put('/', protect, authorize('admin'), updateSettings);

export default router;
