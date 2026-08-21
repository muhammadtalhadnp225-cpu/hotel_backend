import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware.js';

/**
 * Authorization Middleware Factory:
 * Enforces Role-Based Access Control (RBAC) on protected endpoints.
 * Backend verifies caller's role on every protected API request.
 * 
 * Rules:
 * - Admin has access to the Admin module and all hotel modules.
 * - Receptionist has access ONLY to Reception & Front Desk functionality.
 */
export const authorizationMiddleware = (...allowedRoles: string[]) => {
  const normalizedAllowedRoles = allowedRoles.map((r) => r.toLowerCase().trim());

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required before verifying permissions.',
      });
      return;
    }

    const userRole = (req.user.role || '').toLowerCase().trim();

    // Check if user's role is permitted (admin has universal access)
    if (!normalizedAllowedRoles.includes(userRole) && userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: `Forbidden: User role [${req.user.role.toUpperCase()}] is not authorized to access this resource. Requires: [${allowedRoles.join(', ').toUpperCase()}].`,
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
};

/**
 * Helper: Strictly require ADMIN role (Admin module access)
 */
export const requireAdmin = authorizationMiddleware('admin');

/**
 * Helper: Allow ADMIN and RECEPTIONIST roles (Reception / Front desk operations)
 */
export const requireReceptionistOrAdmin = authorizationMiddleware('admin', 'receptionist');

// Compatibility aliases
export const authorize = authorizationMiddleware;
export const requireRole = authorizationMiddleware;
export default authorizationMiddleware;
