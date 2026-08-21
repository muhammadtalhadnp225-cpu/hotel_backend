import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Housekeeping, IHousekeeping } from '../models/Housekeeping.js';
import { Room, IRoom } from '../models/Room.js';
import { EmployeeModel } from '../models/Employee.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { InMemoryStore } from '../services/seedService.js';

export const getHousekeepingOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const isMongo = mongoose.connection.readyState === 1;

    let rooms: any[] = [];
    let tasks: any[] = [];

    if (isMongo) {
      rooms = await Room.find().lean();
      tasks = await Housekeeping.find().sort({ scheduledDate: -1, createdAt: -1 }).lean();
    } else {
      rooms = InMemoryStore.rooms;
      tasks = InMemoryStore.housekeeping;
    }

    // Calculate room cleaning status metrics
    const statusCounts = {
      DIRTY: 0,
      CLEANING: 0,
      CLEAN: 0,
      INSPECTED: 0,
      MAINTENANCE: 0,
    };

    rooms.forEach((r) => {
      const cStatus = (r.cleaningStatus || (r.status === 'cleaning' ? 'CLEANING' : r.status === 'maintenance' ? 'MAINTENANCE' : 'CLEAN')).toUpperCase();
      if (cStatus in statusCounts) {
        statusCounts[cStatus as keyof typeof statusCounts]++;
      } else if (r.status === 'cleaning') {
        statusCounts.CLEANING++;
      } else if (r.status === 'maintenance') {
        statusCounts.MAINTENANCE++;
      } else {
        statusCounts.CLEAN++;
      }
    });

    const taskCounts = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      verified: tasks.filter((t) => t.status === 'verified').length,
      high_priority: tasks.filter((t) => t.priority === 'high' || t.priority === 'urgent').length,
    };

    res.json({
      success: true,
      data: {
        statusCounts,
        taskCounts,
        totalRooms: rooms.length,
        recentTasks: tasks.slice(0, 10),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHousekeepingTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority, roomNumber, taskType, date } = req.query;
    const isMongo = mongoose.connection.readyState === 1;

    let tasks: any[] = [];

    if (isMongo) {
      const filter: any = {};
      if (status && status !== 'all') filter.status = status;
      if (priority && priority !== 'all') filter.priority = priority;
      if (roomNumber) filter.roomNumber = roomNumber;
      if (taskType && taskType !== 'all') filter.taskType = taskType;

      tasks = await Housekeeping.find(filter)
        .populate('room')
        .populate('employee')
        .sort({ scheduledDate: -1, priority: -1, createdAt: -1 })
        .lean();
    } else {
      tasks = InMemoryStore.housekeeping.filter((t) => {
        if (status && status !== 'all' && t.status !== status) return false;
        if (priority && priority !== 'all' && t.priority !== priority) return false;
        if (roomNumber && t.roomNumber !== roomNumber) return false;
        if (taskType && taskType !== 'all' && t.taskType !== taskType) return false;
        return true;
      });
    }

    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createHousekeepingTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      roomId,
      roomNumber,
      employeeId,
      assignedStaffName,
      taskType,
      priority,
      scheduledDate,
      checklist,
      notes,
    } = req.body;

    if (!roomNumber) {
      res.status(400).json({ success: false, message: 'Room number is required' });
      return;
    }

    const isMongo = mongoose.connection.readyState === 1;
    const taskNumber = `HK-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const defaultChecklist = checklist && checklist.length > 0
      ? checklist
      : [
          { task: 'Change bed linen and pillowcases', isCompleted: false },
          { task: 'Clean and sanitize bathroom & toilet', isCompleted: false },
          { task: 'Vacuum carpet / mop floors', isCompleted: false },
          { task: 'Dust furniture and sanitize high-touch surfaces', isCompleted: false },
          { task: 'Restock minibar, towels, toiletries', isCompleted: false },
        ];

    let task: any;

    if (isMongo) {
      let roomObj = await Room.findOne({ roomNumber });
      if (!roomObj && roomId) {
        roomObj = await Room.findById(roomId);
      }

      task = await Housekeeping.create({
        taskNumber,
        room: roomObj?._id || new mongoose.Types.ObjectId(),
        roomNumber: roomNumber || roomObj?.roomNumber,
        employee: employeeId || new mongoose.Types.ObjectId(),
        assignedStaffName: assignedStaffName || 'Duty Housekeeper',
        taskType: taskType || 'daily_cleaning',
        priority: priority || 'medium',
        status: 'pending',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        checklist: defaultChecklist,
        notes: notes || '',
      });

      // Update room cleaning status to DIRTY or CLEANING if scheduled for immediate execution
      if (roomObj) {
        roomObj.cleaningStatus = 'DIRTY';
        await roomObj.save();
      }
    } else {
      const roomObj = InMemoryStore.rooms.find((r) => r.roomNumber === roomNumber || r._id === roomId);
      task = {
        _id: new mongoose.Types.ObjectId().toString(),
        taskNumber,
        room: roomObj?._id || roomId || new mongoose.Types.ObjectId().toString(),
        roomNumber: roomNumber || roomObj?.roomNumber,
        employee: employeeId || new mongoose.Types.ObjectId().toString(),
        assignedStaffName: assignedStaffName || 'Duty Housekeeper',
        taskType: taskType || 'daily_cleaning',
        priority: priority || 'medium',
        status: 'pending',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        checklist: defaultChecklist,
        notes: notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      InMemoryStore.housekeeping.unshift(task);
      if (roomObj) {
        roomObj.cleaningStatus = 'DIRTY';
      }
    }

    // Audit log
    const audit = {
      userName: (req as any).user?.name || 'Reception / Housekeeping Lead',
      userRole: (req as any).user?.role || 'staff',
      module: 'housekeeping' as const,
      action: 'CREATE_CLEANING_TASK',
      details: `Scheduled ${taskType || 'cleaning'} task ${taskNumber} for Room ${roomNumber}. Assigned to: ${assignedStaffName || 'Duty Housekeeper'}`,
      timestamp: new Date(),
    };
    if (isMongo) {
      await AuditLog.create(audit);
    } else {
      InMemoryStore.auditLogs.unshift(audit);
    }

    res.status(201).json({ success: true, data: task, message: 'Housekeeping task scheduled successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHousekeepingTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, priority, assignedStaffName, checklist, notes } = req.body;
    const isMongo = mongoose.connection.readyState === 1;

    let updatedTask: any;

    if (isMongo) {
      const task = await Housekeeping.findById(id);
      if (!task) {
        res.status(404).json({ success: false, message: 'Housekeeping task not found' });
        return;
      }

      if (status) task.status = status;
      if (priority) task.priority = priority;
      if (assignedStaffName) task.assignedStaffName = assignedStaffName;
      if (checklist) task.checklist = checklist;
      if (notes !== undefined) task.notes = notes;

      if (status === 'in_progress' && !task.startedAt) {
        task.startedAt = new Date();
        // Update room status
        await Room.findOneAndUpdate(
          { roomNumber: task.roomNumber },
          { cleaningStatus: 'CLEANING', status: 'cleaning' }
        );
      } else if (status === 'completed') {
        task.completedAt = new Date();
        await Room.findOneAndUpdate(
          { roomNumber: task.roomNumber },
          { cleaningStatus: 'CLEAN', lastCleaned: new Date() }
        );
      } else if (status === 'verified') {
        task.verifiedBy = (req as any).user?.id || (req as any).user?._id;
        const r = await Room.findOne({ roomNumber: task.roomNumber });
        if (r) {
          r.cleaningStatus = 'INSPECTED';
          if (r.status === 'cleaning' || r.status === 'dirty') {
            r.status = 'available';
          }
          await r.save();
        }
      }

      await task.save();
      updatedTask = task;
    } else {
      const taskIndex = InMemoryStore.housekeeping.findIndex((t) => t._id === id || t.taskNumber === id);
      if (taskIndex === -1) {
        res.status(404).json({ success: false, message: 'Housekeeping task not found' });
        return;
      }

      const task = InMemoryStore.housekeeping[taskIndex];
      if (status) task.status = status;
      if (priority) task.priority = priority;
      if (assignedStaffName) task.assignedStaffName = assignedStaffName;
      if (checklist) task.checklist = checklist;
      if (notes !== undefined) task.notes = notes;
      task.updatedAt = new Date();

      const roomObj = InMemoryStore.rooms.find((r) => r.roomNumber === task.roomNumber || r._id === task.room);

      if (status === 'in_progress') {
        task.startedAt = new Date();
        if (roomObj) {
          roomObj.cleaningStatus = 'CLEANING';
          if (roomObj.status !== 'occupied') roomObj.status = 'cleaning';
        }
      } else if (status === 'completed') {
        task.completedAt = new Date();
        if (roomObj) {
          roomObj.cleaningStatus = 'CLEAN';
          roomObj.lastCleaned = new Date();
        }
      } else if (status === 'verified') {
        if (roomObj) {
          roomObj.cleaningStatus = 'INSPECTED';
          if (roomObj.status === 'cleaning' || roomObj.status === 'dirty') {
            roomObj.status = 'available';
          }
        }
      }

      updatedTask = task;
    }

    res.json({ success: true, data: updatedTask, message: 'Task updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRoomCleaningStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomNumber, cleaningStatus, notes } = req.body;

    const validStatuses = ['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'MAINTENANCE'];
    const upperStatus = String(cleaningStatus).toUpperCase();

    if (!validStatuses.includes(upperStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid cleaning status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const isMongo = mongoose.connection.readyState === 1;
    let room: any;

    if (isMongo) {
      room = await Room.findOne({ roomNumber });
      if (!room) {
        res.status(404).json({ success: false, message: `Room ${roomNumber} not found` });
        return;
      }

      room.cleaningStatus = upperStatus as any;

      if (upperStatus === 'MAINTENANCE') {
        room.status = 'maintenance';
      } else if (upperStatus === 'CLEANING') {
        if (room.status !== 'occupied') room.status = 'cleaning';
      } else if (upperStatus === 'CLEAN') {
        room.lastCleaned = new Date();
      } else if (upperStatus === 'INSPECTED') {
        if (room.status === 'cleaning' || room.status === 'maintenance' || room.status === 'dirty') {
          room.status = 'available';
        }
        room.lastCleaned = new Date();
      }

      if (notes) room.notes = notes;
      await room.save();
    } else {
      const roomIndex = InMemoryStore.rooms.findIndex((r) => r.roomNumber === roomNumber);
      if (roomIndex === -1) {
        res.status(404).json({ success: false, message: `Room ${roomNumber} not found` });
        return;
      }

      room = InMemoryStore.rooms[roomIndex];
      room.cleaningStatus = upperStatus;

      if (upperStatus === 'MAINTENANCE') {
        room.status = 'maintenance';
      } else if (upperStatus === 'CLEANING') {
        if (room.status !== 'occupied') room.status = 'cleaning';
      } else if (upperStatus === 'CLEAN') {
        room.lastCleaned = new Date();
      } else if (upperStatus === 'INSPECTED') {
        if (room.status === 'cleaning' || room.status === 'maintenance' || room.status === 'dirty') {
          room.status = 'available';
        }
        room.lastCleaned = new Date();
      }
      if (notes) room.notes = notes;
    }

    // Audit log
    const audit = {
      userName: (req as any).user?.name || 'Housekeeping Supervisor',
      userRole: (req as any).user?.role || 'staff',
      module: 'housekeeping' as const,
      action: 'UPDATE_ROOM_CLEANING_STATUS',
      details: `Room ${roomNumber} cleaning status set to ${upperStatus}.`,
      timestamp: new Date(),
    };

    if (isMongo) {
      await AuditLog.create(audit);
    } else {
      InMemoryStore.auditLogs.unshift(audit);
    }

    res.json({
      success: true,
      data: room,
      message: `Room ${roomNumber} updated to ${upperStatus}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHousekeepingStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const isMongo = mongoose.connection.readyState === 1;
    let staff: any[] = [];

    if (isMongo) {
      const dbUsers = await User.find({
        department: { $regex: /^housekeeping$/i },
        role: { $nin: ['admin', 'receptionist'] }
      }).select('name email role department phone').lean();

      const dbEmps = await EmployeeModel.find({
        $or: [
          { department: { $regex: /^housekeeping$/i } },
          { position: { $regex: /housekeeper|cleaner|attendant|supervisor|inspector/i } }
        ]
      }).select('name email position department shift').lean();

      const map = new Map();
      dbUsers.forEach((u: any) => {
        const r = (u.role || '').toLowerCase();
        if (r !== 'admin' && r !== 'receptionist') {
          map.set(u.name, { ...u, role: u.role || 'Housekeeper', department: u.department || 'Housekeeping' });
        }
      });

      dbEmps.forEach((e: any) => {
        const p = (e.position || '').toLowerCase();
        if (!map.has(e.name) && !p.includes('reception') && !p.includes('admin')) {
          map.set(e.name, { _id: e._id?.toString(), name: e.name, email: e.email, role: e.position || 'Housekeeper', department: e.department || 'Housekeeping', shift: e.shift || 'Morning' });
        }
      });

      staff = Array.from(map.values());
    } else {
      staff = InMemoryStore.employees.filter((e) => {
        const dep = (e.department || '').toLowerCase();
        const pos = (e.position || e.role || '').toLowerCase();
        return (dep === 'housekeeping' || pos.includes('housekeeper')) && !pos.includes('admin') && !pos.includes('reception');
      });
    }

    res.json({ success: true, data: staff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
