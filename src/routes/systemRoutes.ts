import { Router } from 'express';
import {
  getSystemHealth,
  resetAndSeedData,
  purgeDummyData,
  verifyEmailSystem,
  testEmailSystem,
} from '../controllers/systemController.js';

const router = Router();

router.get('/health', getSystemHealth);
router.post('/seed', resetAndSeedData);
router.post('/clear-dummy-data', purgeDummyData);
router.get('/verify-email', verifyEmailSystem);
router.get('/test-email', testEmailSystem);
router.post('/test-email', testEmailSystem);

export default router;
