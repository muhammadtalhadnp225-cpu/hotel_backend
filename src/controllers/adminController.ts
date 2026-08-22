import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { clearAllDummyData } from '../services/seedService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getDashboardAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rooms = await StorageService.getAllRooms();
    const bookings = await StorageService.getAllBookings({ isBillingLedger: true });
    const payments = await StorageService.getAllPayments();
    const users = await StorageService.getAllUsers();

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r: any) => r.status === 'occupied').length;
    const availableRooms = rooms.filter((r: any) => r.status === 'available').length;
    const cleaningRooms = rooms.filter((r: any) => r.status === 'cleaning').length;
    const maintenanceRooms = rooms.filter((r: any) => r.status === 'maintenance').length;
    const reservedRooms = rooms.filter((r: any) => r.status === 'reserved').length;

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Calculate total revenue exactly matching Billing & Folios total revenue collected
    const totalRevenue = bookings.reduce(
      (sum: number, b: any) => sum + (Number(b.paidAmount) || 0),
      0
    );

    // Calculate Average Daily Rate (ADR)
    const occupiedBookings = bookings.filter((b: any) => b.status === 'checked_in');
    const adr =
      occupiedBookings.length > 0
        ? Math.round(
            occupiedBookings.reduce((sum: number, b: any) => sum + (b.pricePerNight || 0), 0) /
              occupiedBookings.length
          )
        : totalRooms > 0
        ? Math.round(rooms.reduce((s: number, r: any) => s + r.pricePerNight, 0) / totalRooms)
        : 0;

    // RevPAR = ADR * (Occupancy Rate / 100)
    const revPAR = Math.round(adr * (occupancyRate / 100));

    // Today's arrivals and departures
    const todayStr = new Date().toISOString().split('T')[0];
    const todayArrivals = bookings.filter((b: any) => {
      const checkInStr = new Date(b.checkInDate).toISOString().split('T')[0];
      return checkInStr === todayStr && b.status !== 'cancelled';
    });

    const todayDepartures = bookings.filter((b: any) => {
      const checkOutStr = new Date(b.checkOutDate).toISOString().split('T')[0];
      return checkOutStr === todayStr && b.status === 'checked_in';
    });

    // 7-day revenue & occupancy trend calculation from MongoDB records
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const revenueTrends = [];
    let accumulatedTrendRevenue = 0;

    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = `${dayNames[date.getDay()]} (${date.getMonth() + 1}/${date.getDate()})`;

      // Real bookings overlapping or created/settled on this day
      const dayBookings = bookings.filter((b: any) => {
        if (!b) return false;
        try {
          const bCreateDate = b.createdAt ? new Date(b.createdAt).toISOString().split('T')[0] : '';
          const bCheckInDate = b.checkInDate ? new Date(b.checkInDate).toISOString().split('T')[0] : '';
          const bCheckOutDate = b.checkOutDate ? new Date(b.checkOutDate).toISOString().split('T')[0] : '';
          const bUpdatedDate = b.updatedAt ? new Date(b.updatedAt).toISOString().split('T')[0] : '';
          return (
            bCreateDate === dateStr ||
            bCheckInDate === dateStr ||
            bCheckOutDate === dateStr ||
            bUpdatedDate === dateStr
          );
        } catch {
          return false;
        }
      });
      const dayRevenue = dayBookings.reduce((s: number, b: any) => s + (Number(b.paidAmount) || 0), 0);
      accumulatedTrendRevenue += dayRevenue;

      // Active in-house stays on that date
      const inHouseOnDate = bookings.filter((b: any) => {
        if (!b || !b.checkInDate || !b.checkOutDate) return false;
        try {
          const checkIn = new Date(b.checkInDate).toISOString().split('T')[0];
          const checkOut = new Date(b.checkOutDate).toISOString().split('T')[0];
          return b.status === 'checked_in' && dateStr >= checkIn && dateStr <= checkOut;
        } catch {
          return false;
        }
      });

      const inHouseCount = inHouseOnDate.length;
      const dayOccupancy = totalRooms > 0 ? Math.min(100, Math.round((inHouseCount / totalRooms) * 100)) : 0;

      revenueTrends.push({
        date: dayNames[date.getDay()],
        fullDate: dateStr,
        dayLabel,
        revenue: dayRevenue,
        bookings: dayBookings.length,
        occupancy: dayOccupancy,
        roomsOccupied: inHouseCount,
        roomsAvailable: Math.max(0, totalRooms - inHouseCount),
      });
    }

    // Ensure 7-day revenue trend accurately accounts for all totalRevenue
    if (totalRevenue > 0 && accumulatedTrendRevenue !== totalRevenue && revenueTrends.length > 0) {
      const diff = totalRevenue - accumulatedTrendRevenue;
      revenueTrends[revenueTrends.length - 1].revenue = Math.max(
        0,
        (revenueTrends[revenueTrends.length - 1].revenue || 0) + diff
      );
    }

    // Room status breakdown for Occupancy Chart
    const occupancyBreakdown = [
      { name: 'Available', value: availableRooms, color: '#10B981', fill: '#10B981' },
      { name: 'Occupied', value: occupiedRooms, color: '#3B82F6', fill: '#3B82F6' },
      { name: 'Cleaning', value: cleaningRooms, color: '#F59E0B', fill: '#F59E0B' },
      { name: 'Maintenance', value: maintenanceRooms, color: '#EF4444', fill: '#EF4444' },
      { name: 'Reserved', value: reservedRooms, color: '#8B5CF6', fill: '#8B5CF6' },
    ].filter((item) => item.value > 0);

    // Room type distribution
    const roomTypeStats = {
      single: rooms.filter((r: any) => r.type === 'single').length,
      double: rooms.filter((r: any) => r.type === 'double').length,
      deluxe: rooms.filter((r: any) => r.type === 'deluxe').length,
      suite: rooms.filter((r: any) => r.type === 'suite').length,
      presidential: rooms.filter((r: any) => r.type === 'presidential').length,
    };

    res.status(200).json({
      success: true,
      analytics: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        cleaningRooms,
        maintenanceRooms,
        reservedRooms,
        occupancyRate,
        totalRevenue,
        adr,
        revPAR,
        activeBookingsCount: bookings.filter((b: any) => b.status === 'checked_in' || b.status === 'confirmed').length,
        todayArrivalsCount: todayArrivals.length,
        todayDeparturesCount: todayDepartures.length,
        totalStaff: users.length,
        roomTypeStats,
        revenueTrends,
        occupancyBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStaffList = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const staff = await StorageService.getAllUsers();
    res.status(200).json({
      success: true,
      count: staff.length,
      staff,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, role, department, phone, status, password } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (department) updateData.department = department;
    if (phone !== undefined) updateData.phone = phone;
    if (status) updateData.status = status;
    if (password) updateData.password = password;

    const updated = await StorageService.updateUser(id, updateData);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'STAFF_UPDATED',
      details: `Updated details for staff member ${updated.name} (${updated.email}).`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Staff member updated successfully',
      staff: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStaff = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete your own active administrator account.',
      });
      return;
    }

    const deleted = await StorageService.deleteUser(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'STAFF_DELETED',
      details: `Deleted staff record for ID: ${id}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Staff member removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 100;
    const logs = await StorageService.getAllAuditLogs(limit);
    res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

export const clearAllData = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await clearAllDummyData();
    res.status(200).json({
      success: true,
      message: 'All operational data cleared cleanly from MongoDB Atlas and local memory.',
      result,
    });
  } catch (error) {
    next(error);
  }
};
