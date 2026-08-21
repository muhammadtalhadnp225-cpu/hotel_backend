import { Router } from 'express';
import {
  getMaintenanceOverview,
  getMaintenanceRequests,
  createMaintenanceRequest,
  updateMaintenanceRequest,
  deleteMaintenanceRequest,
} from '../controllers/maintenanceController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/overview', getMaintenanceOverview);
router.get('/requests', getMaintenanceRequests);
router.post('/requests', createMaintenanceRequest);
router.put('/requests/:id', updateMaintenanceRequest);
router.delete('/requests/:id', deleteMaintenanceRequest);

export default router;
