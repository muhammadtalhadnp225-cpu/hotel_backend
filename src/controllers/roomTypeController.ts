import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Get all room types
export const getRoomTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive } = req.query;
    const roomTypes = await StorageService.getAllRoomTypes({ isActive });
    res.status(200).json({
      success: true,
      count: roomTypes.length,
      roomTypes,
    });
  } catch (error) {
    next(error);
  }
};

// Get single room type by ID
export const getRoomTypeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const roomType = await StorageService.getRoomTypeById(id);
    if (!roomType) {
      res.status(404).json({ success: false, message: 'Room type not found' });
      return;
    }
    res.status(200).json({
      success: true,
      roomType,
    });
  } catch (error) {
    next(error);
  }
};

// Create custom or standard room type
export const createRoomType = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, code, description, basePrice, capacity, bedConfiguration, amenities, maxExtraBeds, sizeSqFt, images } = req.body;

    if (!name || basePrice === undefined) {
      res.status(400).json({
        success: false,
        message: 'Please provide room type name and basePrice.',
      });
      return;
    }

    const typeCode = (code || name.slice(0, 3)).toUpperCase().trim();
    const existing = await StorageService.getRoomTypeByNameOrCode(typeCode);
    if (existing) {
      res.status(400).json({
        success: false,
        message: `A room type with code '${typeCode}' or name '${name}' already exists.`,
      });
      return;
    }

    const newRoomType = await StorageService.createRoomType({
      name: name.trim(),
      code: typeCode,
      description: description || '',
      basePrice: Number(basePrice),
      capacity: Number(capacity) || 2,
      bedConfiguration: bedConfiguration || '1 King Bed',
      amenities: amenities || ['High-speed Wi-Fi', 'Smart TV', 'Air Conditioning', 'En-suite Bathroom'],
      maxExtraBeds: Number(maxExtraBeds) || 0,
      sizeSqFt: sizeSqFt ? Number(sizeSqFt) : undefined,
      images: images || ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'],
      isActive: true,
    });

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'ROOM_TYPE_CREATED',
      details: `Created new Room Type: ${name} (${typeCode}) with base rate $${basePrice}/night.`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Room Type '${name}' created successfully`,
      roomType: newRoomType,
    });
  } catch (error) {
    next(error);
  }
};

// Update room type
export const updateRoomType = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await StorageService.updateRoomType(id, updateData);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Room type not found' });
      return;
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'ROOM_TYPE_UPDATED',
      details: `Updated configuration for Room Type ${updated.name} (${updated.code}).`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Room type updated successfully',
      roomType: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Delete room type
export const deleteRoomType = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const roomType = await StorageService.getRoomTypeById(id);
    if (!roomType) {
      res.status(404).json({ success: false, message: 'Room type not found' });
      return;
    }

    // Check if any rooms currently use this room type
    const allRooms = await StorageService.getAllRooms();
    const isUsed = allRooms.some(
      (r: any) =>
        r.type?.toLowerCase() === roomType.name?.toLowerCase() ||
        r.type?.toLowerCase() === roomType.code?.toLowerCase() ||
        String(r.roomType) === String(id)
    );

    if (isUsed) {
      res.status(400).json({
        success: false,
        message: `Cannot delete '${roomType.name}' because active rooms are currently assigned to this room type. Reassign or delete those rooms first.`,
      });
      return;
    }

    await StorageService.deleteRoomType(id);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'ROOM_TYPE_DELETED',
      details: `Deleted Room Type ${roomType.name} (${roomType.code}).`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Room Type '${roomType.name}' deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};
