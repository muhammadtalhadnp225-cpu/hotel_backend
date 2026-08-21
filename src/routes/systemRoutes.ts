import { Router } from 'express';
import { getSystemHealth, resetAndSeedData, purgeDummyData } from '../controllers/systemController.js';

const router = Router();

router.get('/health', getSystemHealth);
router.post('/seed', resetAndSeedData);
router.post('/clear-dummy-data', purgeDummyData);

export default router;
