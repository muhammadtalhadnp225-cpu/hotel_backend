import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { StorageService } from '../services/storageService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Allowed Room Statuses
export const VALID_ROOM_STATUSES = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'maintenance',
  'out_of_service',
];

// Get all rooms with optional filtering
export const getRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, type, floor } = req.query;
    const rooms = await StorageService.getAllRooms({ status, type, floor });
    res.status(200).json({
      success: true,
      count: rooms.length,
      rooms,
      data: rooms,
    });
  } catch (error) {
    next(error);
  }
};

// Get single room by ID
export const getRoomById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const room = await StorageService.getRoomById(id);
    if (!room) {
      res.status(404).json({ success: false, message: `Room '${id}' not found in hotel inventory.` });
      return;
    }
    res.status(200).json({
      success: true,
      room,
      data: room,
    });
  } catch (error) {
    next(error);
  }
};

// Check room dynamic availability
export const checkRoomAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { checkInDate, checkOutDate } = req.query;
    const result = await StorageService.checkRoomAvailability(
      id,
      checkInDate as string,
      checkOutDate as string
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// Create a new Room
export const createRoom = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      roomNumber,
      floor,
      type,
      roomType,
      pricePerNight,
      capacity,
      amenities,
      status,
      description,
      images,
      keyCardNumber,
    } = req.body;

    if (!roomNumber || floor === undefined || !type || pricePerNight === undefined) {
      res.status(400).json({
        success: false,
        message: 'Please provide roomNumber, floor, room type, and pricePerNight.',
      });
      return;
    }

    if (Number(pricePerNight) < 0) {
      res.status(400).json({
        success: false,
        message: 'Room price cannot be negative.',
      });
      return;
    }

    if (Number(capacity) < 1) {
      res.status(400).json({
        success: false,
        message: 'Room capacity must be at least 1 guest.',
      });
      return;
    }

    if (Number(floor) < 1) {
      res.status(400).json({
        success: false,
        message: 'Floor level must be at least 1.',
      });
      return;
    }

    const initialStatus = (status || 'available').toLowerCase();
    if (!VALID_ROOM_STATUSES.includes(initialStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid room status '${status}'. Must be one of: ${VALID_ROOM_STATUSES.join(', ')}`,
      });
      return;
    }

    const allRooms = await StorageService.getAllRooms();
    const duplicate = allRooms.find((r: any) => r.roomNumber?.trim() === String(roomNumber).trim());
    if (duplicate) {
      res.status(400).json({
        success: false,
        message: `Room number ${roomNumber} already exists in hotel inventory.`,
      });
      return;
    }

    // Standardize amenities
    const parsedAmenities = Array.isArray(amenities)
      ? amenities
      : typeof amenities === 'string'
      ? amenities.split(',').map((s) => s.trim()).filter(Boolean)
      : ['High-speed Wi-Fi', 'Smart TV', 'Air Conditioning', 'En-suite Bathroom'];

    let validRoomTypeId = null;
    if (roomType && mongoose.Types.ObjectId.isValid(String(roomType))) {
      validRoomTypeId = roomType;
    }

    const newRoom = await StorageService.createRoom({
      roomNumber: String(roomNumber).trim(),
      floor: Number(floor),
      type: String(type).toLowerCase().trim(),
      roomType: validRoomTypeId,
      pricePerNight: Number(pricePerNight),
      capacity: Number(capacity) || 2,
      amenities: parsedAmenities,
      status: initialStatus,
      keyCardNumber: keyCardNumber || `KC-${roomNumber}`,
      description: description || '',
      images: images && images.length > 0 ? images : [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
      ],
    });

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'ROOM_CREATED',
      details: `Created new room ${roomNumber} (Type: ${type}, Floor: ${floor}, Capacity: ${capacity || 2}, Rate: Rs. ${pricePerNight}/night, Status: ${initialStatus}).`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Room ${roomNumber} created successfully`,
      room: newRoom,
    });
  } catch (error) {
    next(error);
  }
};

// Update Room
export const updateRoom = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      roomNumber,
      floor,
      type,
      roomType,
      pricePerNight,
      capacity,
      amenities,
      status,
      description,
      images,
      keyCardNumber,
    } = req.body;

    const existingRoom = await StorageService.getRoomById(id);
    if (!existingRoom) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (roomNumber && roomNumber !== existingRoom.roomNumber) {
      const allRooms = await StorageService.getAllRooms();
      const duplicate = allRooms.find(
        (r: any) => r.roomNumber?.trim() === String(roomNumber).trim() && String(r._id) !== id
      );
      if (duplicate) {
        res.status(400).json({
          success: false,
          message: `Room number ${roomNumber} is already in use by another unit.`,
        });
        return;
      }
    }

    if (pricePerNight !== undefined && Number(pricePerNight) < 0) {
      res.status(400).json({
        success: false,
        message: 'Room price cannot be negative.',
      });
      return;
    }

    if (capacity !== undefined && Number(capacity) < 1) {
      res.status(400).json({
        success: false,
        message: 'Room capacity must be at least 1 guest.',
      });
      return;
    }

    if (floor !== undefined && Number(floor) < 1) {
      res.status(400).json({
        success: false,
        message: 'Floor level must be at least 1.',
      });
      return;
    }

    if (status) {
      const formattedStatus = String(status).toLowerCase();
      if (!VALID_ROOM_STATUSES.includes(formattedStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid room status '${status}'. Must be one of: ${VALID_ROOM_STATUSES.join(', ')}`,
        });
        return;
      }
    }

    const updatePayload: any = {};
    if (roomNumber !== undefined) updatePayload.roomNumber = String(roomNumber).trim();
    if (floor !== undefined) updatePayload.floor = Number(floor);
    if (type !== undefined) updatePayload.type = String(type).toLowerCase().trim();
    if (roomType !== undefined) {
      updatePayload.roomType = roomType && mongoose.Types.ObjectId.isValid(String(roomType)) ? roomType : null;
    }
    if (pricePerNight !== undefined) updatePayload.pricePerNight = Number(pricePerNight);
    if (capacity !== undefined) updatePayload.capacity = Number(capacity);
    if (status !== undefined) updatePayload.status = String(status).toLowerCase();
    if (description !== undefined) updatePayload.description = description;
    if (keyCardNumber !== undefined) updatePayload.keyCardNumber = keyCardNumber;
    if (images !== undefined) updatePayload.images = images;
    if (amenities !== undefined) {
      updatePayload.amenities = Array.isArray(amenities)
        ? amenities
        : typeof amenities === 'string'
        ? amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : amenities;
    }

    const updated = await StorageService.updateRoom(id, updatePayload);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'ROOM_UPDATED',
      details: `Updated details for Room ${updated.roomNumber} (Status: ${updated.status}, Price: Rs. ${updated.pricePerNight}, Capacity: ${updated.capacity}).`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Room ${updated.roomNumber} updated successfully`,
      room: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Update Room Status specifically
export const changeRoomStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      res.status(400).json({ success: false, message: 'Please provide status' });
      return;
    }

    const formattedStatus = String(status).toLowerCase();
    if (!VALID_ROOM_STATUSES.includes(formattedStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid room status '${status}'. Must be one of: ${VALID_ROOM_STATUSES.join(', ')}`,
      });
      return;
    }

    const existingRoom = await StorageService.getRoomById(id);
    if (!existingRoom) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    const updateData: any = { status: formattedStatus };
    if (formattedStatus === 'available' || formattedStatus === 'cleaning') {
      updateData.lastCleaned = new Date();
    }
    if (notes) {
      updateData.notes = notes;
    }

    const updated = await StorageService.updateRoom(id, updateData);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'housekeeping',
      action: 'ROOM_STATUS_CHANGED',
      details: `Changed Room ${existingRoom.roomNumber} status from ${existingRoom.status.toUpperCase()} to ${formattedStatus.toUpperCase()}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Room ${existingRoom.roomNumber} status updated to ${formattedStatus.toUpperCase()}`,
      room: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Room
export const deleteRoom = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const room = await StorageService.getRoomById(id);
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (room.status === 'occupied') {
      res.status(400).json({
        success: false,
        message: `Cannot delete Room ${room.roomNumber} while it is currently occupied by an active guest.`,
      });
      return;
    }

    await StorageService.deleteRoom(id);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'ROOM_DELETED',
      details: `Deleted Room ${room.roomNumber} from inventory.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Room ${room.roomNumber} deleted successfully from inventory`,
    });
  } catch (error) {
    next(error);
  }
};
