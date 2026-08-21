import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MaintenanceRequest, IMaintenanceRequest } from '../models/MaintenanceRequest.js';
import { Room, IRoom } from '../models/Room.js';
import { AuditLog } from '../models/AuditLog.js';
import { InMemoryStore } from '../services/seedService.js';

export const getMaintenanceOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const isMongo = mongoose.connection.readyState === 1;
    let requests: any[] = [];

    if (isMongo) {
      requests = await MaintenanceRequest.find().sort({ reportedAt: -1 }).lean();
    } else {
      requests = InMemoryStore.maintenance || [];
    }

    const counts = {
      total: requests.length,
      reported: requests.filter((r) => r.status === 'reported').length,
      in_progress: requests.filter((r) => r.status === 'in_progress').length,
      waiting_parts: requests.filter((r) => r.status === 'waiting_parts').length,
      resolved: requests.filter((r) => r.status === 'resolved').length,
      urgent: requests.filter((r) => (r.priority === 'urgent' || r.priority === 'high') && r.status !== 'resolved').length,
      totalCost: requests.reduce((acc, r) => acc + (r.actualCost || r.estimatedCost || 0), 0),
    };

    res.json({ success: true, data: { counts, recent: requests.slice(0, 10) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMaintenanceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, category, roomNumber, priority } = req.query;
    const isMongo = mongoose.connection.readyState === 1;
    let requests: any[] = [];

    if (isMongo) {
      const filter: any = {};
      if (status && status !== 'all') filter.status = status;
      if (category && category !== 'all') filter.category = category;
      if (roomNumber) filter.roomNumber = roomNumber;
      if (priority && priority !== 'all') filter.priority = priority;

      requests = await MaintenanceRequest.find(filter)
        .populate('room')
        .sort({ reportedAt: -1, priority: -1 })
        .lean();
    } else {
      requests = (InMemoryStore.maintenance || []).filter((r) => {
        if (status && status !== 'all' && r.status !== status) return false;
        if (category && category !== 'all' && r.category !== category) return false;
        if (roomNumber && r.roomNumber !== roomNumber) return false;
        if (priority && priority !== 'all' && r.priority !== priority) return false;
        return true;
      });
    }

    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMaintenanceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      roomId,
      roomNumber,
      category,
      title,
      description,
      priority,
      assignedStaffName,
      estimatedCost,
      reportedBy,
      scheduledDate,
    } = req.body;

    if (!roomNumber || !title || !description) {
      res.status(400).json({ success: false, message: 'Room number, title, and description are required' });
      return;
    }

    const isMongo = mongoose.connection.readyState === 1;
    const ticketNumber = `MNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let request: any;

    if (isMongo) {
      let roomObj = await Room.findOne({ roomNumber });
      if (!roomObj && roomId) {
        roomObj = await Room.findById(roomId);
      }

      request = await MaintenanceRequest.create({
        ticketNumber,
        room: roomObj?._id || new mongoose.Types.ObjectId(),
        roomNumber,
        category: category || 'general',
        title,
        description,
        priority: priority || 'medium',
        status: 'reported',
        reportedBy: reportedBy || (req as any).user?.name || 'Staff Member',
        assignedStaffName: assignedStaffName || 'Duty Maintenance Engineer',
        estimatedCost: estimatedCost ? Number(estimatedCost) : 0,
        actualCost: 0,
        reportedAt: new Date(),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      });

      // Automatically update room status to MAINTENANCE
      if (roomObj) {
        roomObj.cleaningStatus = 'MAINTENANCE';
        roomObj.status = 'maintenance';
        await roomObj.save();
      }
    } else {
      const roomObj = InMemoryStore.rooms.find((r) => r.roomNumber === roomNumber);
      request = {
        _id: new mongoose.Types.ObjectId().toString(),
        ticketNumber,
        room: roomObj?._id || roomId || new mongoose.Types.ObjectId().toString(),
        roomNumber,
        category: category || 'general',
        title,
        description,
        priority: priority || 'medium',
        status: 'reported',
        reportedBy: reportedBy || (req as any).user?.name || 'Staff Member',
        assignedStaffName: assignedStaffName || 'Duty Maintenance Engineer',
        estimatedCost: estimatedCost ? Number(estimatedCost) : 0,
        actualCost: 0,
        reportedAt: new Date(),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (!InMemoryStore.maintenance) InMemoryStore.maintenance = [];
      InMemoryStore.maintenance.unshift(request);

      if (roomObj) {
        roomObj.cleaningStatus = 'MAINTENANCE';
        roomObj.status = 'maintenance';
      }
    }

    // Audit log
    const audit = {
      userName: (req as any).user?.name || 'Front Desk / Housekeeping',
      userRole: (req as any).user?.role || 'staff',
      module: 'maintenance' as const,
      action: 'CREATE_MAINTENANCE_TICKET',
      details: `Created maintenance ticket ${ticketNumber} for Room ${roomNumber}: ${title} (${category || 'general'}). Room set to MAINTENANCE.`,
      timestamp: new Date(),
    };

    if (isMongo) {
      await AuditLog.create(audit);
    } else {
      InMemoryStore.auditLogs.unshift(audit);
    }

    res.status(201).json({
      success: true,
      data: request,
      message: `Maintenance ticket ${ticketNumber} created. Room ${roomNumber} placed in MAINTENANCE status.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMaintenanceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      status,
      priority,
      assignedStaffName,
      resolutionNotes,
      actualCost,
      estimatedCost,
      scheduledDate,
    } = req.body;

    const isMongo = mongoose.connection.readyState === 1;
    let updatedRequest: any;

    if (isMongo) {
      const request = await MaintenanceRequest.findById(id);
      if (!request) {
        res.status(404).json({ success: false, message: 'Maintenance request not found' });
        return;
      }

      if (status) request.status = status;
      if (priority) request.priority = priority;
      if (assignedStaffName) request.assignedStaffName = assignedStaffName;
      if (resolutionNotes !== undefined) request.resolutionNotes = resolutionNotes;
      if (actualCost !== undefined) request.actualCost = Number(actualCost);
      if (estimatedCost !== undefined) request.estimatedCost = Number(estimatedCost);
      if (scheduledDate) request.scheduledDate = new Date(scheduledDate);

      if (status === 'resolved') {
        request.resolvedAt = new Date();
        // Restore room status to INSPECTED or CLEAN and mark as available if not occupied
        const roomObj = await Room.findOne({ roomNumber: request.roomNumber });
        if (roomObj) {
          roomObj.cleaningStatus = 'INSPECTED';
          if (roomObj.status === 'maintenance') {
            roomObj.status = 'available';
          }
          await roomObj.save();
        }
      }

      await request.save();
      updatedRequest = request;
    } else {
      if (!InMemoryStore.maintenance) InMemoryStore.maintenance = [];
      const index = InMemoryStore.maintenance.findIndex((r) => r._id === id || r.ticketNumber === id);
      if (index === -1) {
        res.status(404).json({ success: false, message: 'Maintenance request not found' });
        return;
      }

      const request = InMemoryStore.maintenance[index];
      if (status) request.status = status;
      if (priority) request.priority = priority;
      if (assignedStaffName) request.assignedStaffName = assignedStaffName;
      if (resolutionNotes !== undefined) request.resolutionNotes = resolutionNotes;
      if (actualCost !== undefined) request.actualCost = Number(actualCost);
      if (estimatedCost !== undefined) request.estimatedCost = Number(estimatedCost);
      if (scheduledDate) request.scheduledDate = new Date(scheduledDate);
      request.updatedAt = new Date();

      if (status === 'resolved') {
        request.resolvedAt = new Date();
        const roomObj = InMemoryStore.rooms.find((r) => r.roomNumber === request.roomNumber);
        if (roomObj) {
          roomObj.cleaningStatus = 'INSPECTED';
          if (roomObj.status === 'maintenance') {
            roomObj.status = 'available';
          }
        }
      }

      updatedRequest = request;
    }

    // Audit log
    const audit = {
      userName: (req as any).user?.name || 'Maintenance Lead',
      userRole: (req as any).user?.role || 'staff',
      module: 'maintenance' as const,
      action: 'UPDATE_MAINTENANCE_TICKET',
      details: `Updated maintenance ticket ${updatedRequest.ticketNumber} for Room ${updatedRequest.roomNumber} status to ${status || updatedRequest.status}.`,
      timestamp: new Date(),
    };

    if (isMongo) {
      await AuditLog.create(audit);
    } else {
      InMemoryStore.auditLogs.unshift(audit);
    }

    res.json({
      success: true,
      data: updatedRequest,
      message: `Maintenance ticket updated successfully${status === 'resolved' ? '. Room restored to INSPECTED/AVAILABLE' : ''}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMaintenanceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isMongo = mongoose.connection.readyState === 1;

    if (isMongo) {
      await MaintenanceRequest.findByIdAndDelete(id);
    } else {
      if (InMemoryStore.maintenance) {
        InMemoryStore.maintenance = InMemoryStore.maintenance.filter((r) => r._id !== id && r.ticketNumber !== id);
      }
    }

    res.json({ success: true, message: 'Maintenance ticket deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
