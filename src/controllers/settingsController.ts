import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settings = await StorageService.getSystemSettings();
    res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updatedSettings = await StorageService.updateSystemSettings(req.body);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'SYSTEM_SETTINGS_UPDATED',
      details: 'Updated global ERP hotel settings and system preferences.',
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'System settings updated successfully',
      settings: updatedSettings,
    });
  } catch (error) {
    next(error);
  }
};
