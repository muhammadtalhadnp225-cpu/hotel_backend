import { Request, Response, NextFunction } from 'express';
import { getDatabaseStatus } from '../config/db.js';
import { StorageService } from '../services/storageService.js';
import { seedDatabase } from '../services/seedService.js';

export const getSystemHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dbStatus = getDatabaseStatus();
    const rooms = await StorageService.getAllRooms();
    const bookings = await StorageService.getAllBookings();
    const users = await StorageService.getAllUsers();
    const guests = await StorageService.getAllGuests();

    res.status(200).json({
      success: true,
      status: 'operational',
      app: 'Hotel ERP',
      version: '1.0.0',
      database: dbStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      counts: {
        rooms: rooms.length,
        bookings: bookings.length,
        staff: users.length,
        guests: guests.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resetAndSeedData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await seedDatabase(true);
    res.status(200).json({
      success: true,
      message: 'Hotel ERP database reset and seeded with initial records.',
      details: result,
    });
  } catch (error) {
    next(error);
  }
};

export const purgeDummyData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { clearAllDummyData } = await import('../services/seedService.js');
    const result = await clearAllDummyData();
    res.status(200).json({
      success: true,
      message: 'All dummy operational data removed cleanly. ERP ready for production usage.',
      details: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmailSystem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { EmailService } = await import('../services/emailService.js');
    const result = await EmailService.verifyTransporter();
    res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'SMTP verification failed', error: error.message });
  }
};

export const testEmailSystem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { EmailService } = await import('../services/emailService.js');
    const targetEmail = req.body?.to || req.query?.to || req.query?.email;
    const result = await EmailService.sendTestEmail(typeof targetEmail === 'string' ? targetEmail : undefined);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Diagnostic test email dispatched successfully',
        messageId: result.messageId,
        recipient: targetEmail || 'Default Administrator Email',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Test email failed', error: error.message });
  }
};

