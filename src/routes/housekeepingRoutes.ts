import { Router } from 'express';
import {
  getHousekeepingOverview,
  getHousekeepingTasks,
  createHousekeepingTask,
  updateHousekeepingTask,
  updateRoomCleaningStatus,
  getHousekeepingStaff,
} from '../controllers/housekeepingController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all housekeeping routes with authentication
router.use(authenticate);

router.get('/overview', getHousekeepingOverview);
router.get('/tasks', getHousekeepingTasks);
router.get('/staff', getHousekeepingStaff);
router.post('/tasks', createHousekeepingTask);
router.put('/tasks/:id', updateHousekeepingTask);
router.patch('/room-status', updateRoomCleaningStatus);

export default router;
