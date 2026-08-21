import authMiddleware, {
  protect,
  authenticate,
  optionalAuth,
  type AuthenticatedUser,
  type AuthenticatedRequest,
} from './authMiddleware.js';

import {
  authorizationMiddleware,
  authorize,
  requireRole,
  requireAdmin,
  requireReceptionistOrAdmin,
} from './authorizationMiddleware.js';

export {
  authMiddleware,
  protect,
  authenticate,
  optionalAuth,
  authorizationMiddleware,
  authorize,
  requireRole,
  requireAdmin,
  requireReceptionistOrAdmin,
  type AuthenticatedUser,
  type AuthenticatedRequest,
};

export default authMiddleware;


