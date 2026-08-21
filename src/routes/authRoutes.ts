import { Router } from 'express';
import { login, register, logout, getMe, registerStaff, updateProfile } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/authorizationMiddleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/login', login);
router.post('/register', register);

// Protected Authentication Endpoints
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);

// Admin-Restricted Staff Provisioning Endpoint
router.post('/register-staff', authMiddleware, requireAdmin, registerStaff);

export default router;
