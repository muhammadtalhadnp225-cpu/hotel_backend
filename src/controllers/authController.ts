import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { StorageService } from '../services/storageService.js';
import { EmailService } from '../services/emailService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

/**
 * Handles user login with email & password
 * Returns signed JWT and sanitized user profile
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
      return;
    }

    const { token, user } = await AuthService.login(email, password);

    // Audit log login action
    await StorageService.logAction({
      userName: user.name,
      userRole: user.role,
      module: 'system',
      action: 'USER_LOGIN',
      details: `User ${user.email} (${user.role.toUpperCase()}) authenticated successfully.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token,
      user,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

/**
 * Handles new patron / guest registration from the website
 * Returns signed JWT and sanitized user profile
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      email, 
      password, 
      title, 
      firstName, 
      lastName, 
      name,
      phone, 
      nationality,
      idType,
      idNumber,
      address, 
      stayPreferences 
    } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
      return;
    }

    const { token, user } = await AuthService.registerPatron({
      email,
      password,
      title,
      firstName,
      lastName,
      name,
      phone,
      nationality,
      idType,
      idNumber,
      address,
      stayPreferences,
    });

    // Audit log registration action
    await StorageService.logAction({
      userName: user.name,
      userRole: 'guest',
      module: 'system',
      action: 'PATRON_REGISTERED',
      details: `New patron account enrolled for ${user.email} (${user.name}).`,
      ipAddress: req.ip,
    });

    // Automatically send VIP Patron Welcome Email
    EmailService.sendWelcomeEmail(user).catch((emailErr) => {
      console.warn('[AuthController] Background welcome email notification warning:', emailErr.message);
    });

    res.status(201).json({
      success: true,
      message: 'Patron enrollment successful. Welcome email dispatched.',
      token,
      user,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

/**
 * Handles user logout
 * Records audit event and confirms session termination
 */
export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await StorageService.logAction({
        userName: req.user.name,
        userRole: req.user.role,
        module: 'system',
        action: 'USER_LOGOUT',
        details: `User ${req.user.email} (${req.user.role.toUpperCase()}) logged out.`,
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns current authenticated user profile
 */
export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const userProfile = await AuthService.getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      user: userProfile,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

/**
 * Registers new staff member account (Admin-only capability)
 */
export const registerStaff = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role, department, phone } = req.body;

    const newUser = await AuthService.registerStaff({
      name,
      email,
      password,
      role,
      department,
      phone,
    });

    // Audit log
    await StorageService.logAction({
      userName: req.user?.name || 'Administrator',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'STAFF_REGISTERED',
      details: `Created new staff account for ${name} (${email}) with role [${role || 'receptionist'}].`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Staff account registered successfully',
      user: newUser,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

/**
 * Updates authenticated user's profile details (name, phone, avatarUrl, password)
 */
export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { 
      name, 
      firstName, 
      lastName, 
      title, 
      email, 
      phone, 
      nationality, 
      idType, 
      idNumber, 
      address, 
      stayPreferences, 
      avatarUrl, 
      password 
    } = req.body;
    const userId = req.user.id || (req.user as any)._id;

    if (email && email.toLowerCase().trim() !== req.user.email.toLowerCase().trim()) {
      const existing = await StorageService.findUserByEmail(email.toLowerCase().trim());
      if (existing && (existing._id?.toString() !== userId.toString())) {
        res.status(400).json({ success: false, message: 'This email address is already registered to another account.' });
        return;
      }
    }

    const updatePayload: any = {};
    if (name) updatePayload.name = name;
    if (firstName !== undefined) updatePayload.firstName = firstName;
    if (lastName !== undefined) updatePayload.lastName = lastName;
    if (title !== undefined) updatePayload.title = title;
    if (nationality !== undefined) updatePayload.nationality = nationality;
    if (idType !== undefined) updatePayload.idType = idType;
    if (idNumber !== undefined) updatePayload.idNumber = idNumber;
    if (address !== undefined) updatePayload.address = address;
    if (stayPreferences !== undefined) updatePayload.stayPreferences = stayPreferences;
    if (email) updatePayload.email = email.toLowerCase().trim();
    if (phone !== undefined) updatePayload.phone = phone;
    if (avatarUrl !== undefined) updatePayload.avatarUrl = avatarUrl;
    if (password) updatePayload.password = password;

    const updatedUser = await StorageService.updateUser(userId, updatePayload, req.user.email);

    // Also synchronize corresponding Employee profile if matching user email exists
    const oldEmail = req.user.email;
    const emp = await StorageService.findEmployeeByEmail(oldEmail);
    if (emp) {
      await StorageService.updateEmployee(emp._id, {
        ...(name ? { name } : {}),
        ...(email ? { email: email.toLowerCase().trim() } : {}),
        ...(phone !== undefined ? { phone } : {}),
      });
    }

    // Also synchronize corresponding Guest record in Admin Panel
    try {
      await StorageService.syncUserToGuest(updatedUser);
    } catch (e: any) {
      console.warn('[Sync User to Guest on Update Warning]:', e.message);
    }

    // Audit log
    await StorageService.logAction({
      userName: name || req.user.name,
      userRole: req.user.role,
      module: 'system',
      action: 'USER_PROFILE_UPDATED',
      details: `User ${req.user.email} updated profile details.`,
      ipAddress: req.ip,
    });

    const newToken = AuthService.generateToken({
      id: updatedUser._id ? updatedUser._id.toString() : userId,
      email: updatedUser.email,
      role: updatedUser.role,
      name: updatedUser.name,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
      data: updatedUser,
      token: newToken,
    });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export default {
  login,
  logout,
  getMe,
  registerStaff,
  updateProfile,
};
