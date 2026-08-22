import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore DNS config error
}

import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { seedDatabase, clearAllDummyData, dropExtraCollections } from './services/seedService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { StorageService } from './services/storageService.js';
import { EmailService } from './services/emailService.js';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import roomTypeRoutes from './routes/roomTypeRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import guestRoutes from './routes/guestRoutes.js';
import housekeepingRoutes from './routes/housekeepingRoutes.js';
import guestServiceRoutes from './routes/guestServiceRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

import availabilityRoutes from './routes/availabilityRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import publicWebsiteRoutes from './routes/publicWebsiteRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

export const createExpressApp = () => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || ENV.CORS_ORIGIN === '*' || origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
        callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logger for API development
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // REST API Routes & Aliases
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/users', adminRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/room-types', roomTypeRoutes);
  app.use('/api/availability', availabilityRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/reservations', bookingRoutes);
  app.use('/api/guests', guestRoutes);
  app.use('/api/housekeeping', housekeepingRoutes);
  app.use('/api/guest-services', guestServiceRoutes);
  app.use('/api/services', guestServiceRoutes);
  app.use('/api/customer', customerRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/inquiries', contactRoutes);
  app.use('/api', publicWebsiteRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/system', systemRoutes);

  // Hotel Info & ERP Status endpoints for website integration
  app.get('/api/hotel/info', async (req, res) => {
    try {
      const settings = await StorageService.getSystemSettings();
      const hotelInfo = settings?.hotelInfo || {};
      res.json({
        success: true,
        data: {
          name: hotelInfo.name || 'Aethelgard',
          tagLine: hotelInfo.tagline || 'Resort & Sanctuary',
          description: hotelInfo.description || 'Experience 5-star luxury in the heart of the city.',
          address: hotelInfo.address || '1000 Celestial Point, Coral Peninsula',
          city: hotelInfo.city || 'Coral Peninsula',
          country: hotelInfo.country || 'Maldives',
          phone: hotelInfo.phone || '+1 (800) 555-LUXE',
          email: hotelInfo.email || ENV.HOTEL_EMAIL || 't02407446@gmail.com',
          logoUrl: hotelInfo.logoUrl || '',
          checkInTime: hotelInfo.checkInTime || '15:00',
          checkOutTime: hotelInfo.checkOutTime || '11:00',
          currency: 'RS',
          starRating: 5,
        },
      });
    } catch (e) {
      res.json({
        success: true,
        data: {
          name: 'Aethelgard',
          tagLine: 'Resort & Sanctuary',
          currency: 'RS',
        },
      });
    }
  });

  app.get('/api/erp/status', (req, res) => {
    res.json({
      online: true,
      databaseConnected: true,
      erpVersion: 'v4.2.0',
      lastSynced: new Date().toISOString()
    });
  });

  // Health route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Hotel ERP API', timestamp: new Date().toISOString() });
  });

  // Catch-all 404 for unhandled API routes so requests never hang or timeout
  app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.path} not found` });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

// Initialize DB connection and ready state
export const initializeBackend = async () => {
  try {
    await connectDatabase();
    await seedDatabase(false);
    console.log('[Backend Init] Database connected and ready. No automatic guests seeded.');
    
    // Background SMTP connectivity check
    EmailService.verifyTransporter().catch((mailErr) => {
      console.warn('[Backend Init] SMTP Transporter background check warning:', mailErr.message);
    });
  } catch (error: any) {
    console.error('[Backend Init] Warning during initialization:', error.message);
  }
};

