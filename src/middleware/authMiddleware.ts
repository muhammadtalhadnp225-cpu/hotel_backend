import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { StorageService } from '../services/storageService.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name: string;
  department?: string;
  status?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Authentication Middleware:
 * Extracts Bearer JWT token from Authorization header,
 * verifies cryptographic signature, checks user existence & active status in database,
 * and attaches user data to Express request.
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  // Extract Bearer token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
    return;
  }

  try {
    // Cryptographic verification against server secret
    const decoded: any = jwt.verify(token, ENV.JWT_SECRET);
    
    // Look up user from persistence store
    const user = await StorageService.findUserById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication failed. The token owner account no longer exists.',
      });
      return;
    }

    if (user.status === 'inactive' || user.status === 'suspended') {
      res.status(403).json({
        success: false,
        message: 'Account is deactivated or suspended. Please contact your system administrator.',
      });
      return;
    }

    // Attach authenticated identity to request object
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: (user.role || 'receptionist').toLowerCase(),
      name: user.name,
      department: user.department,
      status: user.status,
    };

    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please log in again.',
      error: error.message,
    });
  }
};

// Optional Auth Middleware for routes that allow both guest public access and authenticated staff access
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded: any = jwt.verify(token, ENV.JWT_SECRET);
    const user = await StorageService.findUserById(decoded.id);

    if (user && user.status !== 'inactive' && user.status !== 'suspended') {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: (user.role || 'receptionist').toLowerCase(),
        name: user.name,
        department: user.department,
        status: user.status,
      };
    }
  } catch (error) {
    // Ignore token verification failure on public optional routes
  }
  next();
};

// Aliases for compatibility
export const protect = authMiddleware;
export const authenticate = authMiddleware;
export default authMiddleware;

