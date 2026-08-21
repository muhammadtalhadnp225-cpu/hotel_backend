import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User.js';
import { Room, IRoom } from '../models/Room.js';
import { RoomTypeModel, IRoomType } from '../models/RoomType.js';
import { Booking, IBooking } from '../models/Booking.js';
import { Guest, IGuest } from '../models/Guest.js';
import { Payment, IPayment } from '../models/Payment.js';
import { AuditLog, IAuditLog } from '../models/AuditLog.js';
import { Folio, IFolio } from '../models/Folio.js';
import { Invoice, IInvoice } from '../models/Invoice.js';
import { Service, IService } from '../models/Service.js';
import { Housekeeping, IHousekeeping } from '../models/Housekeeping.js';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { GuestServiceRequest } from '../models/GuestServiceRequest.js';
import { EmployeeModel } from '../models/Employee.js';
import { AttendanceModel } from '../models/Attendance.js';
import { EmployeeLeaveModel } from '../models/EmployeeLeave.js';
import { ExpenseModel } from '../models/Expense.js';
import { SystemSettingsModel } from '../models/SystemSettings.js';
import { RestaurantCategory, RestaurantMenuItem, RestaurantTable, RestaurantOrder } from '../models/RestaurantModels.js';
import { InventoryItem, InventoryLog, Supplier, PurchaseOrder, SupplierPayment } from '../models/InventoryModels.js';
import { ContactInquiry, IContactInquiry } from '../models/ContactInquiry.js';
import { InMemoryStore, seedDatabase } from './seedService.js';
import { connectDatabase } from '../config/db.js';

// Helper to check if Mongoose connection is ready
const isMongo = () => mongoose.connection.readyState === 1;

let lastDbConnectAttempt = 0;
const DB_RETRY_INTERVAL_MS = 60000;

export class StorageService {
  // Ensure database connection and store readiness
  static async ensureReady() {
    const now = Date.now();
    if (mongoose.connection.readyState !== 1 && (now - lastDbConnectAttempt > DB_RETRY_INTERVAL_MS)) {
      lastDbConnectAttempt = now;
      try {
        await connectDatabase();
      } catch (e) {
        // Ignore connection retry error
      }
    }
    if (!InMemoryStore.isInitialized || (!isMongo() && InMemoryStore.users.length === 0)) {
      await seedDatabase(false);
    }
  }

  // ================= USERS =================
  static async findUserByEmail(email: string, includePassword = false) {
    await this.ensureReady();
    const normalizedEmail = email.toLowerCase().trim();
    if (isMongo()) {
      const query = (User as any).findOne({ email: normalizedEmail });
      if (includePassword) query.select('+password');
      let foundUser = await query.exec();
      if (!foundUser && (normalizedEmail === 'admin@hotelerp.com' || normalizedEmail === 'reception@hotelerp.com')) {
        try {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          const staffPassword = await bcrypt.hash('reception123', 10);
          await User.insertMany([
            {
              name: 'System Admin',
              email: 'admin@hotelerp.com',
              password: hashedPassword,
              role: 'admin',
              department: 'Administration',
              status: 'active',
            },
            {
              name: 'Front Desk Receptionist',
              email: 'reception@hotelerp.com',
              password: staffPassword,
              role: 'receptionist',
              department: 'Front Desk',
              status: 'active',
            },
          ] as any);
          console.log('[StorageService] Auto-provisioned essential admin/staff in MongoDB.');
        } catch (e: any) {
          // ignore duplicate key error
        }
        const refetchQuery = (User as any).findOne({ email: normalizedEmail });
        if (includePassword) refetchQuery.select('+password');
        foundUser = await refetchQuery.exec();
      }
      return foundUser;
    }
    let user = InMemoryStore.users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    if (!user && (normalizedEmail === 'admin@hotelerp.com' || normalizedEmail === 'reception@hotelerp.com')) {
      await seedDatabase(false);
      user = InMemoryStore.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    }
    if (!user) return null;
    if (!includePassword) {
      const { password, ...rest } = user;
      return rest;
    }
    return user;
  }

  static async findUserById(id: string) {
    await this.ensureReady();
    if (!id) return null;
    if (isMongo()) {
      let u = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        u = await (User as any).findById(id).select('-password').exec();
      }
      if (!u) {
        u = await (User as any).findOne({ $or: [{ _id: id }, { email: id.toLowerCase().trim() }] }).select('-password').exec();
      }
      if (!u) {
        u = await (User as any).findOne({ role: 'admin' }).select('-password').exec();
      }
      if (u && (u as any).toObject) u = (u as any).toObject();
      return u;
    }
    const user = InMemoryStore.users.find((u) => u._id === id || u._id?.toString() === id?.toString() || u.email?.toLowerCase() === id.toLowerCase().trim() || u.role === 'admin');
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  }

  static async getAllUsers() {
    await this.ensureReady();
    if (isMongo()) {
      return await (User as any).find({ isDeleted: { $ne: true } }).select('-password').sort({ createdAt: -1 }).exec();
    }
    return (InMemoryStore.users || [])
      .filter((u: any) => !u.isDeleted)
      .map(({ password, ...u }: any) => u);
  }

  static async createUser(userData: any) {
    await this.ensureReady();
    const rawPassword = userData.password || 'reception123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    let userObj: any = null;
    if (isMongo()) {
      try {
        const user = new User({
          ...userData,
          password: rawPassword,
          isDeleted: false,
        });
        await user.save();
        userObj = user.toObject();
      } catch (e: any) {
        console.warn('[StorageService] Mongo save failed, saving to InMemoryStore:', e.message);
      }
    }

    if (!userObj) {
      userObj = {
        _id: new mongoose.Types.ObjectId().toString(),
        name: userData.name,
        firstName: userData.firstName,
        lastName: userData.lastName,
        title: userData.title,
        nationality: userData.nationality,
        idType: userData.idType || 'passport',
        idNumber: userData.idNumber,
        address: userData.address,
        stayPreferences: userData.stayPreferences,
        membershipTier: userData.membershipTier || 'Patron Circle',
        email: userData.email.toLowerCase().trim(),
        password: hashedPassword,
        role: userData.role || 'guest',
        phone: userData.phone || '',
        department: userData.department || 'Patron Guest',
        status: userData.status || 'active',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    InMemoryStore.users = InMemoryStore.users || [];
    const idx = InMemoryStore.users.findIndex((u: any) => u.email?.toLowerCase() === userData.email.toLowerCase().trim());
    const storeObj = { ...userObj, password: hashedPassword };
    if (idx === -1) {
      InMemoryStore.users.push(storeObj);
    } else {
      InMemoryStore.users[idx] = storeObj;
    }

    const { password, ...rest } = userObj;
    return rest;
  }

  static async updateUser(id: string, updateData: any, currentEmail?: string) {
    await this.ensureReady();
    const rawPassword = updateData.password;
    let hashedPass: string | undefined = undefined;
    if (rawPassword) {
      const salt = await bcrypt.genSalt(10);
      hashedPass = await bcrypt.hash(rawPassword, salt);
    }

    const setFields: any = {};
    if (updateData.name !== undefined) {
      setFields.name = updateData.name;
    } else if (updateData.firstName !== undefined || updateData.lastName !== undefined) {
      setFields.name = `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim();
    }
    if (updateData.firstName !== undefined) setFields.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) setFields.lastName = updateData.lastName;
    if (updateData.title !== undefined) setFields.title = updateData.title;
    if (updateData.nationality !== undefined) setFields.nationality = updateData.nationality;
    if (updateData.idType !== undefined) setFields.idType = updateData.idType;
    if (updateData.idNumber !== undefined) setFields.idNumber = updateData.idNumber;
    if (updateData.address !== undefined) setFields.address = updateData.address;
    if (updateData.stayPreferences !== undefined) setFields.stayPreferences = updateData.stayPreferences;
    if (updateData.membershipTier !== undefined) setFields.membershipTier = updateData.membershipTier;
    if (updateData.email !== undefined) setFields.email = updateData.email.toLowerCase().trim();
    if (updateData.phone !== undefined) setFields.phone = updateData.phone;
    if (updateData.department !== undefined) setFields.department = updateData.department;
    if (updateData.role !== undefined) setFields.role = updateData.role;
    if (updateData.status !== undefined) setFields.status = updateData.status;
    if (updateData.avatarUrl !== undefined) setFields.avatarUrl = updateData.avatarUrl;
    if (hashedPass) setFields.password = hashedPass;

    let updatedUserObj: any = null;

    if (isMongo()) {
      try {
        const searchEmail = (currentEmail || updateData.email || '').toLowerCase().trim();
        const orConditions: any[] = [];
        if (id && mongoose.Types.ObjectId.isValid(id)) {
          orConditions.push({ _id: id });
        }
        if (searchEmail) {
          orConditions.push({ email: searchEmail });
        }
        if (id === 'usr_admin_001' || (!id && searchEmail.includes('admin'))) {
          orConditions.push({ role: 'admin' });
          orConditions.push({ email: 'admin@hotelerp.com' });
        }

        if (orConditions.length > 0) {
          updatedUserObj = await (User as any).findOneAndUpdate(
            orConditions.length === 1 ? orConditions[0] : { $or: orConditions },
            { $set: setFields },
            { new: true, runValidators: false }
          ).select('-password').exec();
        }

        if (updatedUserObj && (updatedUserObj as any).toObject) {
          updatedUserObj = (updatedUserObj as any).toObject();
        }

        if (updatedUserObj) {
          console.log('[StorageService] Successfully updated MongoDB user profile:', updatedUserObj?.email, updatedUserObj?.name);
          // Also sync employee profile if exists
          if (updatedUserObj.email) {
            await EmployeeModel.updateMany(
              { email: updatedUserObj.email },
              { $set: { ...(setFields.name ? { name: setFields.name } : {}), ...(setFields.phone ? { phone: setFields.phone } : {}) } }
            ).exec();
          }
        }
      } catch (err: any) {
        console.error('[StorageService] Error updating user profile in Mongo:', err.message);
      }
    }

    const searchEmail = (currentEmail || updateData.email || '').toLowerCase().trim();
    const index = InMemoryStore.users.findIndex((u) => 
      u._id === id || 
      u._id?.toString() === id?.toString() || 
      (searchEmail && u.email?.toLowerCase() === searchEmail) || 
      (u.role === 'admin' && (!id || id === 'usr_admin_001' || searchEmail === 'admin@hotelerp.com'))
    );

    if (index !== -1) {
      InMemoryStore.users[index] = {
        ...InMemoryStore.users[index],
        ...updateData,
        ...(hashedPass ? { password: hashedPass } : {}),
        updatedAt: new Date(),
      };
      if (!updatedUserObj) {
        const { password, ...rest } = InMemoryStore.users[index];
        updatedUserObj = rest;
      }
    }
    return updatedUserObj;
  }

  static async deleteUser(id: string) {
    await this.ensureReady();
    let deleted: any = null;
    if (isMongo()) {
      deleted = await (User as any).findByIdAndDelete(id).exec();
    } else {
      const index = InMemoryStore.users.findIndex((u) => u._id === id);
      if (index !== -1) {
        deleted = InMemoryStore.users.splice(index, 1)[0];
      }
    }
    if (deleted && deleted.email) {
      if (isMongo()) {
        await (EmployeeModel as any).deleteMany({ email: deleted.email.toLowerCase() }).exec();
      }
      InMemoryStore.employees = (InMemoryStore.employees || []).filter(
        (e: any) => e.email?.toLowerCase() !== deleted.email.toLowerCase()
      );
    }
    return deleted;
  }

  static async deleteUserByEmail(email: string) {
    await this.ensureReady();
    if (!email) return;
    if (isMongo()) {
      await (User as any).deleteMany({ email: email.toLowerCase() }).exec();
    }
    InMemoryStore.users = (InMemoryStore.users || []).filter(
      (u: any) => u.email?.toLowerCase() !== email.toLowerCase()
    );
  }

  // ================= ROOM TYPES =================
  static async getAllRoomTypes(filter: any = {}) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (filter.isActive !== undefined && filter.isActive !== 'all') {
        query.isActive = filter.isActive === true || filter.isActive === 'true';
      }
      return await (RoomTypeModel as any).find(query).sort({ basePrice: 1 }).exec();
    }

    return InMemoryStore.roomTypes.filter((rt) => {
      if (filter.isActive !== undefined && filter.isActive !== 'all') {
        const activeBool = filter.isActive === true || filter.isActive === 'true';
        if (rt.isActive !== activeBool) return false;
      }
      return true;
    });
  }

  static async getRoomTypeById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RoomTypeModel as any).findById(id).exec();
    }
    return InMemoryStore.roomTypes.find((rt) => rt._id === id) || null;
  }

  static async getRoomTypeByNameOrCode(nameOrCode: string) {
    await this.ensureReady();
    const term = nameOrCode.toLowerCase().trim();
    if (isMongo()) {
      return await (RoomTypeModel as any)
        .findOne({
          $or: [
            { code: term.toUpperCase() },
            { name: { $regex: new RegExp(`^${term}$`, 'i') } },
          ],
        })
        .exec();
    }
    return (
      InMemoryStore.roomTypes.find(
        (rt) => rt.code?.toLowerCase() === term || rt.name?.toLowerCase() === term
      ) || null
    );
  }

  static async createRoomType(typeData: any) {
    await this.ensureReady();
    const formattedData = {
      ...typeData,
      code: (typeData.code || typeData.name.slice(0, 3)).toUpperCase().trim(),
      basePrice: Number(typeData.basePrice || typeData.pricePerNight || 100),
      capacity: Number(typeData.capacity || 2),
      bedConfiguration: typeData.bedConfiguration || '1 King Bed',
      amenities: Array.isArray(typeData.amenities)
        ? typeData.amenities
        : (typeData.amenities || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      maxExtraBeds: Number(typeData.maxExtraBeds || 0),
      isActive: typeData.isActive !== false,
      images: typeData.images || [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
      ],
    };

    if (isMongo()) {
      const roomType = new RoomTypeModel(formattedData);
      return await roomType.save();
    }

    const newType = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...formattedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    InMemoryStore.roomTypes.push(newType);
    return newType;
  }

  static async updateRoomType(id: string, updateData: any) {
    await this.ensureReady();
    if (updateData.code) updateData.code = updateData.code.toUpperCase().trim();
    if (updateData.basePrice) updateData.basePrice = Number(updateData.basePrice);
    if (updateData.capacity) updateData.capacity = Number(updateData.capacity);

    if (isMongo()) {
      return await (RoomTypeModel as any)
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();
    }

    const index = InMemoryStore.roomTypes.findIndex((rt) => rt._id === id);
    if (index === -1) return null;
    InMemoryStore.roomTypes[index] = {
      ...InMemoryStore.roomTypes[index],
      ...updateData,
      updatedAt: new Date(),
    };
    return InMemoryStore.roomTypes[index];
  }

  static async deleteRoomType(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RoomTypeModel as any).findByIdAndDelete(id).exec();
    }
    const index = InMemoryStore.roomTypes.findIndex((rt) => rt._id === id);
    if (index === -1) return null;
    return InMemoryStore.roomTypes.splice(index, 1)[0];
  }

  // ================= ROOMS =================
  static async getAllRooms(filter: any = {}) {
    await this.ensureReady();
    // Synchronize dynamic status based on active reservations if requested or general fetch
    await this.syncRoomStatusesWithBookings();

    if (isMongo()) {
      const query: any = {};
      if (filter.status && filter.status !== 'all') query.status = filter.status.toLowerCase();
      if (filter.type && filter.type !== 'all') query.type = filter.type.toLowerCase();
      if (filter.floor && filter.floor !== 'all') query.floor = Number(filter.floor);
      return await (Room as any).find(query).sort({ roomNumber: 1 }).exec();
    }

    return InMemoryStore.rooms.filter((r) => {
      if (filter.status && filter.status !== 'all' && r.status !== filter.status.toLowerCase()) return false;
      if (filter.type && filter.type !== 'all' && r.type.toLowerCase() !== filter.type.toLowerCase()) return false;
      if (filter.floor && filter.floor !== 'all' && r.floor !== Number(filter.floor)) return false;
      return true;
    });
  }

  // Dynamic Room Availability Synchronization with Reservations
  static async syncRoomStatusesWithBookings() {
    try {
      const now = new Date();
      if (isMongo()) {
        const activeBookings: any[] = await (Booking as any).find({
          status: { $in: ['checked_in', 'confirmed'] },
        }).exec();

        // Get non-out-of-service/maintenance rooms
        const rooms: any[] = await (Room as any).find().exec();
        for (const room of rooms) {
          // If room is manually set to maintenance or cleaning, preserve unless overridden
          if (room.status === 'maintenance' || room.status === 'out_of_service' || room.status === 'cleaning') {
            continue;
          }

          const matchedBooking = activeBookings.find(
            (b) => String(b.roomId || b.room) === String(room._id) || b.roomNumber === room.roomNumber
          );

          if (matchedBooking) {
            const checkIn = new Date(matchedBooking.checkInDate);
            const checkOut = new Date(matchedBooking.checkOutDate);

            if (matchedBooking.status === 'checked_in') {
              if (room.status !== 'occupied') {
                room.status = 'occupied';
                room.currentBookingId = matchedBooking._id;
                await room.save();
              }
            } else if (matchedBooking.status === 'confirmed') {
              // If booking is today or upcoming active
              if (now >= checkIn && now <= checkOut) {
                if (room.status !== 'reserved' && room.status !== 'occupied') {
                  room.status = 'reserved';
                  room.currentBookingId = matchedBooking._id;
                  await room.save();
                }
              }
            }
          }
        }
      } else {
        const activeBookings = InMemoryStore.bookings.filter((b) =>
          ['checked_in', 'confirmed'].includes(b.status)
        );

        for (const room of InMemoryStore.rooms) {
          if (['maintenance', 'out_of_service', 'cleaning'].includes(room.status)) {
            continue;
          }
          const matched = activeBookings.find(
            (b) => String(b.roomId || b.room) === String(room._id) || b.roomNumber === room.roomNumber
          );
          if (matched) {
            if (matched.status === 'checked_in') {
              room.status = 'occupied';
              room.currentBookingId = matched._id;
            } else if (matched.status === 'confirmed') {
              const checkIn = new Date(matched.checkInDate);
              const checkOut = new Date(matched.checkOutDate);
              if (now >= checkIn && now <= checkOut) {
                room.status = 'reserved';
                room.currentBookingId = matched._id;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[StorageService] Error syncing room availability with reservations:', err);
    }
  }

  // Check dynamic availability for a specific room or date range with strict double-booking prevention
  static async checkRoomAvailability(
    roomId: string,
    checkInDate?: string | Date,
    checkOutDate?: string | Date,
    excludeBookingId?: string
  ) {
    await this.ensureReady();
    const room = await this.getRoomById(roomId);
    if (!room) return { available: false, reason: 'Room not found' };

    const roomStat = (room.status || '').toLowerCase();
    if (roomStat === 'maintenance' || roomStat === 'out_of_service') {
      return {
        available: false,
        reason: `Room ${room.roomNumber} is currently under ${roomStat.replace('_', ' ')}`,
      };
    }

    if (roomStat === 'reserved' || roomStat === 'occupied' || roomStat === 'in_house') {
      return {
        available: false,
        reason: `Room ${room.roomNumber} is currently ${roomStat === 'occupied' ? 'Occupied by in-house guest' : 'Reserved'}`,
      };
    }

    if (!checkInDate || !checkOutDate) {
      return {
        available: roomStat === 'available',
        currentStatus: room.status,
      };
    }

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return {
        available: false,
        reason: 'Invalid date range: Check-out must be after Check-in date',
      };
    }

    if (isMongo()) {
      const roomNumStr = String(room.roomNumber);
      const roomNumInt = parseInt(room.roomNumber, 10);
      const roomObjId = mongoose.Types.ObjectId.isValid(String(room._id))
        ? new mongoose.Types.ObjectId(String(room._id))
        : null;

      const roomOrConditions: any[] = [
        { roomId: String(room._id) },
        { room: String(room._id) },
        { roomNumber: roomNumStr },
      ];
      if (!isNaN(roomNumInt)) {
        roomOrConditions.push({ roomNumber: roomNumInt });
      }
      if (roomObjId) {
        roomOrConditions.push({ roomId: roomObjId }, { room: roomObjId });
      }

      const startISO = start.toISOString();
      const endISO = end.toISOString();
      const startDateStr = startISO.split('T')[0];
      const endDateStr = endISO.split('T')[0];

      const conflictQuery: any = {
        $or: roomOrConditions,
        status: {
          $in: [
            'pending', 'confirmed', 'checked_in', 'reserved', 'in_house', 'booked',
            'PENDING', 'CONFIRMED', 'CHECKED_IN', 'RESERVED', 'IN_HOUSE', 'BOOKED',
          ],
        },
        $and: [
          {
            $or: [
              { checkInDate: { $lt: end } },
              { checkInDate: { $lt: endISO } },
              { checkInDate: { $lt: endDateStr } },
            ],
          },
          {
            $or: [
              { checkOutDate: { $gt: start } },
              { checkOutDate: { $gt: startISO } },
              { checkOutDate: { $gt: startDateStr } },
            ],
          },
        ],
      };

      if (excludeBookingId) {
        conflictQuery._id = { $ne: excludeBookingId };
      }

      const conflict = await (Booking as any).findOne(conflictQuery).exec();

      if (conflict) {
        const confStart = new Date(conflict.checkInDate).toLocaleDateString();
        const confEnd = new Date(conflict.checkOutDate).toLocaleDateString();
        return {
          available: false,
          reason: `Reserved: Room ${room.roomNumber} is booked from ${confStart} to ${confEnd} (Ref: ${conflict.bookingNumber || conflict.reservationNumber || 'N/A'}) for ${conflict.guestName || 'Guest'}.`,
          conflictingBooking: conflict,
        };
      }

      return {
        available: true,
        reason: `Room ${room.roomNumber} is available for the selected dates`,
      };
    }

    const conflict = InMemoryStore.bookings.find((b) => {
      if (excludeBookingId && String(b._id) === String(excludeBookingId)) return false;
      const bStat = (b.status || '').toLowerCase();
      if (!['pending', 'confirmed', 'checked_in', 'reserved', 'in_house', 'booked'].includes(bStat)) return false;
      if (
        String(b.roomId || b.room) !== String(room._id) &&
        String(b.roomNumber) !== String(room.roomNumber)
      ) {
        return false;
      }
      const bStart = new Date(b.checkInDate);
      const bEnd = new Date(b.checkOutDate);
      return bStart < end && bEnd > start;
    });

    if (conflict) {
      const confStart = new Date(conflict.checkInDate).toLocaleDateString();
      const confEnd = new Date(conflict.checkOutDate).toLocaleDateString();
      return {
        available: false,
        reason: `Reserved: Room ${room.roomNumber} is booked from ${confStart} to ${confEnd} (Ref: ${conflict.bookingNumber || conflict.reservationNumber || 'N/A'}) for ${conflict.guestName || 'Guest'}.`,
        conflictingBooking: conflict,
      };
    }

    return {
      available: true,
      reason: `Room ${room.roomNumber} is available for the selected dates`,
    };
  }

  // Search available rooms for a given criteria
  static async searchAvailableRooms(params: {
    checkInDate: string | Date;
    checkOutDate: string | Date;
    guests?: number;
    roomType?: string;
    floor?: string | number;
  }) {
    await this.ensureReady();
    const { checkInDate, checkOutDate, guests = 1, roomType = 'all', floor = 'all' } = params;

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    const nights = Math.max(
      1,
      Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );

    const allRooms = await this.getAllRooms();
    const availableRooms: any[] = [];
    const reservedRooms: any[] = [];

    for (const room of allRooms) {
      if (room.status === 'maintenance' || room.status === 'out_of_service') {
        continue;
      }
      if (roomType !== 'all' && room.type.toLowerCase() !== roomType.toLowerCase()) {
        continue;
      }
      if (floor !== 'all' && String(room.floor) !== String(floor)) {
        continue;
      }
      if (guests > 0 && room.capacity < Number(guests)) {
        continue;
      }

      const availCheck = await this.checkRoomAvailability(room._id, start, end);
      const subtotal = room.pricePerNight * nights;
      const estimatedTax = Math.round(subtotal * 0.1 * 100) / 100; // 10% standard hotel tax
      const estimatedTotal = subtotal + estimatedTax;

      const roomData = {
        ...(room.toObject ? room.toObject() : room),
        totalNights: nights,
        roomRate: room.pricePerNight,
        subtotal,
        estimatedTax,
        estimatedTotal,
      };

      if (availCheck.available) {
        availableRooms.push(roomData);
      } else {
        reservedRooms.push({
          ...roomData,
          reason: availCheck.reason,
          conflictingBooking: availCheck.conflictingBooking,
          reservedGuestName: availCheck.conflictingBooking?.guestName || 'Reserved Guest',
          reservedDates: `${new Date(availCheck.conflictingBooking?.checkInDate || start).toLocaleDateString()} - ${new Date(availCheck.conflictingBooking?.checkOutDate || end).toLocaleDateString()}`,
          reservationNumber: availCheck.conflictingBooking?.bookingNumber || availCheck.conflictingBooking?.reservationNumber || 'N/A',
        });
      }
    }

    return { availableRooms, reservedRooms };
  }

  static async getRoomById(id: string) {
    await this.ensureReady();
    if (!id) return null;
    const cleanId = String(id).trim();
    const cleanLower = cleanId.toLowerCase();
    const digits = cleanId.replace(/\D/g, '');

    if (isMongo()) {
      let room = null;
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        try {
          room = await (Room as any).findById(cleanId).exec();
        } catch (e) {
          // Ignore invalid ObjectId cast error
        }
      }

      if (!room) {
        const searchConditions: any[] = [
          { roomNumber: cleanId },
          { slug: cleanLower },
        ];
        if (digits) {
          searchConditions.push({ roomNumber: digits });
        }
        try {
          room = await (Room as any).findOne({ $or: searchConditions }).exec();
        } catch (e) {
          // Ignore query error
        }
      }

      if (room) return room;
    }

    return (
      (InMemoryStore.rooms || []).find(
        (r: any) =>
          String(r._id) === cleanId ||
          r.id === cleanId ||
          r.roomNumber === cleanId ||
          (digits && r.roomNumber === digits) ||
          (r.slug && r.slug.toLowerCase() === cleanLower) ||
          (r.name && r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').includes(cleanLower))
      ) || null
    );
  }

  static async createRoom(roomData: any) {
    await this.ensureReady();
    const { _id, ...cleanData } = roomData;
    if (isMongo()) {
      const room = new Room(cleanData);
      const saved = await room.save();
      const obj = saved.toObject ? saved.toObject() : saved;
      InMemoryStore.rooms = InMemoryStore.rooms || [];
      const idx = InMemoryStore.rooms.findIndex((r) => String(r._id) === String(obj._id));
      if (idx === -1) InMemoryStore.rooms.unshift(obj);
      else InMemoryStore.rooms[idx] = obj;
      return obj;
    }

    const newRoom = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...cleanData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    InMemoryStore.rooms.unshift(newRoom);
    return newRoom;
  }

  static async updateRoom(id: string, updateData: any) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Room as any).findByIdAndUpdate(id, updateData, { new: true }).exec();
    }

    const index = InMemoryStore.rooms.findIndex((r) => r._id === id);
    if (index === -1) return null;
    InMemoryStore.rooms[index] = {
      ...InMemoryStore.rooms[index],
      ...updateData,
      updatedAt: new Date(),
    };
    return InMemoryStore.rooms[index];
  }

  static async deleteRoom(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Room as any).findByIdAndDelete(id).exec();
    }
    const index = InMemoryStore.rooms.findIndex((r) => r._id === id);
    if (index === -1) return null;
    return InMemoryStore.rooms.splice(index, 1)[0];
  }

  // ================= BOOKINGS =================
  static async getAllBookings(filter: any = {}) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (filter.status && filter.status !== 'all') query.status = filter.status.toLowerCase();
      if (filter.paymentStatus && filter.paymentStatus !== 'all') query.paymentStatus = filter.paymentStatus.toLowerCase();
      if (filter.guestId) query.guest = filter.guestId;
      if (filter.roomId) query.$or = [{ room: filter.roomId }, { roomId: filter.roomId }];
      const activeBookings = await (Booking as any).find(query).populate('guest').populate('room').sort({ createdAt: -1 }).exec();

      // Include all preserved historical/deleted guest Invoices in Billing Ledger so receipts are NEVER lost
      if (!filter.roomId && (!filter.status || filter.status === 'all')) {
        try {
          const invoices = await (Invoice as any).find({}).sort({ issuedAt: -1 }).exec();
          const existingBookingNums = new Set(activeBookings.map((b: any) => String(b.bookingNumber || b._id)));

          for (const inv of invoices) {
            const num = String(inv.bookingNumber || inv.invoiceNumber?.replace('INV-', ''));
            if (!existingBookingNums.has(num)) {
              existingBookingNums.add(num);
              activeBookings.push({
                _id: inv._id,
                bookingNumber: num,
                reservationNumber: num,
                guestName: inv.guestName || 'Valued Patron',
                guestPhone: inv.guestPhone || '',
                guestEmail: inv.guestEmail || '',
                roomNumber: inv.roomNumber || 'N/A',
                roomType: inv.roomType || 'Suite',
                checkInDate: inv.checkInDate || inv.issuedAt,
                checkOutDate: inv.checkOutDate || inv.issuedAt,
                totalNights: inv.totalNights || 1,
                pricePerNight: (inv.totalAmount || 0) / Math.max(1, inv.totalNights || 1),
                subtotal: inv.subtotal || inv.totalAmount || 0,
                tax: inv.tax || 0,
                totalAmount: inv.totalAmount || 0,
                paidAmount: inv.paidAmount || (inv.status === 'paid' ? inv.totalAmount : 0),
                paymentStatus: inv.status === 'paid' ? 'paid' : (inv.paidAmount > 0 ? 'partially_paid' : 'pending'),
                status: 'settled',
                isArchivedReceipt: true,
                createdAt: inv.issuedAt || inv.createdAt || new Date(),
                updatedAt: inv.updatedAt || new Date(),
              });
            }
          }
        } catch (e) {
          // ignore error
        }
      }

      return activeBookings;
    }

    return InMemoryStore.bookings
      .filter((b) => {
        if (filter.status && filter.status !== 'all' && b.status.toLowerCase() !== filter.status.toLowerCase())
          return false;
        if (
          filter.paymentStatus &&
          filter.paymentStatus !== 'all' &&
          b.paymentStatus.toLowerCase() !== filter.paymentStatus.toLowerCase()
        )
          return false;
        if (filter.guestId && String(b.guest) !== String(filter.guestId)) return false;
        if (filter.roomId && String(b.roomId || b.room) !== String(filter.roomId)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async getBookingById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Booking as any).findById(id).populate('guest').populate('room').exec();
    }
    return InMemoryStore.bookings.find((b) => b._id === id) || null;
  }

  static async createBooking(bookingData: any) {
    await this.ensureReady();

    const checkIn = new Date(bookingData.checkInDate);
    const checkOut = new Date(bookingData.checkOutDate);

    // 1. Strict Server-Side Double-Booking Prevention Check
    const availability = await this.checkRoomAvailability(
      bookingData.roomId,
      checkIn,
      checkOut
    );

    if (!availability.available) {
      const err = new Error(availability.reason || 'Selected room is not available for requested dates.');
      (err as any).statusCode = 409;
      (err as any).conflictingBooking = availability.conflictingBooking;
      throw err;
    }

    // 2. Fetch Room Details
    const room = await this.getRoomById(bookingData.roomId);
    if (!room) {
      const err = new Error('Selected room does not exist in inventory.');
      (err as any).statusCode = 404;
      throw err;
    }

    // 3. Find or Create Guest
    let guestRecord: any = null;
    if (bookingData.guestId) {
      guestRecord = await this.getGuestById(bookingData.guestId);
    }

    if (!guestRecord && (bookingData.guestPhone || bookingData.phone)) {
      const phone = bookingData.guestPhone || bookingData.phone;
      const fullName = bookingData.guestName || bookingData.fullName;
      guestRecord = await this.createOrUpdateGuest({
        fullName,
        phone,
        email: bookingData.guestEmail || bookingData.email || '',
        password: bookingData.password,
        idType: bookingData.guestIdType || bookingData.idType || 'passport',
        idNumber: bookingData.guestIdNumber || bookingData.idNumber || '',
        nationality: bookingData.nationality || 'International',
        idIssuingCountry: bookingData.idIssuingCountry || '',
        spent: Number(bookingData.totalAmount || 0),
      });
    }

    // 4. Calculate Financials
    const nights = Math.max(
      1,
      Number(bookingData.totalNights) ||
        Math.ceil(Math.abs(checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    );
    const rate = Number(bookingData.roomRate ?? bookingData.pricePerNight ?? room.pricePerNight);
    const subtotal = Number(bookingData.subtotal ?? rate * nights);
    const discount = Number(bookingData.discount || 0);
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Number(bookingData.tax ?? Math.round(taxableAmount * 0.1 * 100) / 100);
    const totalAmount = Number(bookingData.totalAmount ?? taxableAmount + tax);
    const paidAmount = Number(bookingData.paidAmount || 0);

    const paymentStatus =
      bookingData.paymentStatus ||
      (paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'pending');

    const status = bookingData.status || 'confirmed';

    // Unique booking / reservation ref
    const randomCode = Math.floor(10000 + Math.random() * 90000);
    const bookingNumber = `RES-${new Date().getFullYear()}-${randomCode}`;

    const completeData: any = {
      ...bookingData,
      reservationNumber: bookingNumber,
      bookingNumber,
      referenceNumber: bookingNumber,
      guest: guestRecord?._id || new mongoose.Types.ObjectId(),
      guestName: guestRecord?.fullName || bookingData.guestName,
      guestEmail: guestRecord?.email || bookingData.guestEmail || '',
      guestPhone: guestRecord?.phone || bookingData.guestPhone,
      guestIdType: guestRecord?.idType || bookingData.guestIdType || 'passport',
      guestIdNumber: guestRecord?.idNumber || bookingData.guestIdNumber || '',
      room: room._id,
      roomId: room._id,
      roomNumber: room.roomNumber,
      roomName: room.name || `Suite ${room.roomNumber}`,
      roomCategory: room.category || room.type,
      roomType: room.type,
      ratePlanName: bookingData.ratePlanName || 'Best Flexible Rate',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      checkIn: checkIn,
      checkOut: checkOut,
      numberOfAdults: Number(bookingData.numberOfAdults || bookingData.numberOfGuests || 1),
      numberOfChildren: Number(bookingData.numberOfChildren || 0),
      totalNights: nights,
      roomRate: rate,
      pricePerNight: rate,
      subtotal,
      discount,
      tax,
      totalAmount,
      paidAmount,
      paymentStatus,
      status,
      source: bookingData.source || bookingData.bookingSource || 'direct',
      bookingSource: bookingData.bookingSource || bookingData.source || 'walk_in',
      specialRequests: bookingData.specialRequests || '',
      notes: bookingData.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { _id, ...cleanBookingData } = completeData;
    if (isMongo()) {
      const booking = new Booking(cleanBookingData);
      const savedBooking: any = await booking.save();

      // Update room status
      if (status === 'checked_in') {
        await (Room as any).findByIdAndUpdate(room._id, {
          status: 'occupied',
          currentBookingId: savedBooking._id,
        });
      } else if (status === 'confirmed') {
        await (Room as any).findByIdAndUpdate(room._id, {
          status: 'reserved',
          currentBookingId: savedBooking._id,
        });
      }

      const obj = savedBooking.toObject ? savedBooking.toObject() : savedBooking;
      InMemoryStore.bookings = InMemoryStore.bookings || [];
      InMemoryStore.bookings.unshift(obj);
      return obj;
    }

    const newBooking = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...completeData,
    };
    InMemoryStore.bookings.unshift(newBooking);

    // Update room status
    const roomIndex = InMemoryStore.rooms.findIndex((r) => String(r._id) === String(room._id));
    if (roomIndex !== -1) {
      if (status === 'checked_in') {
        InMemoryStore.rooms[roomIndex].status = 'occupied';
        InMemoryStore.rooms[roomIndex].currentBookingId = newBooking._id;
      } else if (status === 'confirmed') {
        InMemoryStore.rooms[roomIndex].status = 'reserved';
        InMemoryStore.rooms[roomIndex].currentBookingId = newBooking._id;
      }
    }

    return newBooking;
  }

  static async updateBooking(id: string, updateData: any) {
    await this.ensureReady();
    const existing = await this.getBookingById(id);
    if (!existing) {
      const err = new Error('Reservation not found');
      (err as any).statusCode = 404;
      throw err;
    }

    // If room or dates changed, re-verify double-booking prevention!
    const targetRoomId = updateData.roomId || updateData.room || existing.roomId || existing.room;
    const targetCheckIn = updateData.checkInDate ? new Date(updateData.checkInDate) : new Date(existing.checkInDate);
    const targetCheckOut = updateData.checkOutDate ? new Date(updateData.checkOutDate) : new Date(existing.checkOutDate);

    if (
      updateData.roomId ||
      updateData.checkInDate ||
      updateData.checkOutDate ||
      (updateData.status && ['pending', 'confirmed', 'checked_in'].includes(updateData.status))
    ) {
      const availability = await this.checkRoomAvailability(
        String(targetRoomId),
        targetCheckIn,
        targetCheckOut,
        id
      );

      if (!availability.available) {
        const err = new Error(availability.reason || 'Selected room is not available for the updated date range.');
        (err as any).statusCode = 409;
        (err as any).conflictingBooking = availability.conflictingBooking;
        throw err;
      }
    }

    if (isMongo()) {
      const updated = await (Booking as any).findByIdAndUpdate(id, updateData, { new: true }).exec();
      await this.syncRoomStatusesWithBookings();
      return updated;
    }

    const index = InMemoryStore.bookings.findIndex((b) => b._id === id);
    if (index === -1) return null;
    InMemoryStore.bookings[index] = {
      ...InMemoryStore.bookings[index],
      ...updateData,
      updatedAt: new Date(),
    };
    await this.syncRoomStatusesWithBookings();
    return InMemoryStore.bookings[index];
  }

  static async deleteBooking(id: string) {
    await this.ensureReady();
    const booking = await this.getBookingById(id);
    if (!booking) return null;

    // 1. Permanently Archive the Folio Receipt & Invoice in the database so it is NEVER lost
    try {
      if (isMongo()) {
        const invNum = `INV-${booking.bookingNumber || Math.floor(10000 + Math.random() * 90000)}`;
        const existingInvoice = await (Invoice as any).findOne({
          $or: [
            { bookingNumber: booking.bookingNumber },
            { invoiceNumber: invNum },
            { reservation: booking._id },
          ],
        });

        if (!existingInvoice) {
          await (Invoice as any).create({
            invoiceNumber: invNum,
            bookingNumber: booking.bookingNumber,
            reservation: booking._id,
            guest: booking.guest?._id || booking.guest || new mongoose.Types.ObjectId(),
            guestName: booking.guestName || booking.guest?.fullName || 'Valued Patron',
            guestEmail: booking.guestEmail || booking.guest?.email || '',
            guestPhone: booking.guestPhone || booking.guest?.phone || '',
            roomNumber: booking.roomNumber || booking.room?.roomNumber || 'N/A',
            roomType: booking.roomType || booking.room?.type || 'Suite',
            checkInDate: booking.checkInDate || booking.checkIn || new Date(),
            checkOutDate: booking.checkOutDate || booking.checkOut || new Date(),
            totalNights: booking.totalNights || 1,
            roomCharges: booking.subtotal || booking.totalAmount || 0,
            additionalServicesCharges: 0,
            restaurantCharges: 0,
            otherCharges: 0,
            subtotal: booking.subtotal || booking.totalAmount || 0,
            discount: booking.discount || 0,
            tax: booking.tax || 0,
            taxRate: 8,
            totalAmount: booking.totalAmount || 0,
            paidAmount: booking.paidAmount || (booking.paymentStatus === 'paid' ? booking.totalAmount : 0),
            balance: Math.max(0, (booking.totalAmount || 0) - (booking.paidAmount || 0)),
            paymentMethod: booking.paymentMethod || 'credit_card',
            paymentReceiptNumber: `REC-${booking.bookingNumber}`,
            status: booking.paymentStatus === 'paid' ? 'paid' : (booking.paidAmount > 0 ? 'partially_paid' : 'pending'),
            issuedAt: booking.createdAt || new Date(),
            items: [
              {
                description: `Room Accommodation (${booking.totalNights || 1} nights)`,
                category: 'room_charge',
                quantity: booking.totalNights || 1,
                unitPrice: booking.pricePerNight || booking.roomRate || 0,
                amount: booking.totalAmount || 0,
              },
            ],
            notes: `Preserved Folio Receipt for ${booking.guestName}. Reservation Ref: ${booking.bookingNumber}.`,
          });
        }
      }
    } catch (invErr) {
      console.error('Failed to auto-archive invoice on booking deletion:', invErr);
    }

    if (isMongo()) {
      const deleted = await (Booking as any).findByIdAndDelete(id).exec();
      if (booking.roomId) {
        const room = await (Room as any).findById(booking.roomId);
        if (room && (room.status === 'reserved' || room.status === 'occupied')) {
          room.status = 'available';
          room.currentBookingId = null;
          await room.save();
        }
      }
      return deleted;
    }

    const index = InMemoryStore.bookings.findIndex((b) => b._id === id);
    if (index === -1) return null;
    const [deleted] = InMemoryStore.bookings.splice(index, 1);
    if (booking.roomId) {
      const room = InMemoryStore.rooms.find((r) => r._id === booking.roomId);
      if (room && (room.status === 'reserved' || room.status === 'occupied')) {
        room.status = 'available';
        room.currentBookingId = null;
      }
    }
    return deleted;
  }

  // ================= GUESTS =================
  static async getAllGuests(search?: string) {
    await this.ensureReady();
    let guests: any[] = [];
    if (isMongo()) {
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        guests = await (Guest as any)
          .find({
            $or: [
              { fullName: regex },
              { email: regex },
              { phone: regex },
              { idNumber: regex },
              { nationality: regex },
            ],
          })
          .sort({ updatedAt: -1 })
          .exec();
      } else {
        guests = await (Guest as any).find().sort({ updatedAt: -1 }).exec();
      }
      return guests;
    }

    guests = InMemoryStore.guests;
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      guests = guests.filter(
        (g) =>
          g.fullName.toLowerCase().includes(q) ||
          (g.email && g.email.toLowerCase().includes(q)) ||
          g.phone.includes(q) ||
          (g.idNumber && g.idNumber.toLowerCase().includes(q)) ||
          (g.nationality && g.nationality.toLowerCase().includes(q))
      );
    }
    return guests;
  }

  static async getGuestById(id: string) {
    await this.ensureReady();
    let guest: any = null;
    let bookings: any[] = [];

    if (isMongo()) {
      guest = await (Guest as any).findById(id).exec();
      if (!guest) return null;

      bookings = await (Booking as any)
        .find({
          $or: [{ guest: guest._id }, { guestPhone: guest.phone }],
        })
        .sort({ checkInDate: -1 })
        .exec();
    } else {
      guest = InMemoryStore.guests.find((g) => g._id === id);
      if (!guest) return null;

      bookings = InMemoryStore.bookings.filter(
        (b) => String(b.guest) === String(guest._id) || b.guestPhone === guest.phone
      );
    }

    const totalSpent = bookings.reduce((sum, b) => sum + (Number(b.paidAmount) || Number(b.totalAmount) || 0), 0);
    const totalVisits = Math.max(guest.totalVisits || 1, bookings.length);

    return {
      ...(guest.toObject ? guest.toObject() : guest),
      totalSpent,
      totalVisits,
      bookings,
    };
  }

  static async createGuest(guestData: any) {
    await this.ensureReady();
    if (!guestData.fullName || !guestData.phone) {
      const err = new Error('Full Name and Phone Number are required.');
      (err as any).statusCode = 400;
      throw err;
    }

    const { _id, ...cleanGuestData } = guestData;
    if (isMongo()) {
      // Check existing by phone
      const existing = await (Guest as any).findOne({ phone: guestData.phone });
      if (existing) {
        Object.assign(existing, cleanGuestData);
        existing.totalVisits = (existing.totalVisits || 1) + 1;
        if (guestData.spent) existing.totalSpent += Number(guestData.spent);
        const saved = await existing.save();
        const obj = saved.toObject ? saved.toObject() : saved;
        return obj;
      }
      const newGuest = new Guest(cleanGuestData);
      const saved = await newGuest.save();
      const obj = saved.toObject ? saved.toObject() : saved;
      InMemoryStore.guests = InMemoryStore.guests || [];
      InMemoryStore.guests.unshift(obj);
      return obj;
    }

    const index = InMemoryStore.guests.findIndex((g) => g.phone === guestData.phone);
    if (index !== -1) {
      InMemoryStore.guests[index] = {
        ...InMemoryStore.guests[index],
        ...guestData,
        totalVisits: (InMemoryStore.guests[index].totalVisits || 1) + 1,
        totalSpent: (InMemoryStore.guests[index].totalSpent || 0) + Number(guestData.spent || 0),
        updatedAt: new Date(),
      };
      return InMemoryStore.guests[index];
    }

    const newGuest = {
      _id: new mongoose.Types.ObjectId().toString(),
      fullName: guestData.fullName,
      email: guestData.email || '',
      phone: guestData.phone,
      alternatePhone: guestData.alternatePhone || '',
      emergencyContact: guestData.emergencyContact || { name: '', phone: '', relationship: '' },
      idType: guestData.idType || 'passport',
      idNumber: guestData.idNumber || '',
      idIssuingCountry: guestData.idIssuingCountry || '',
      idExpiryDate: guestData.idExpiryDate ? new Date(guestData.idExpiryDate) : undefined,
      nationality: guestData.nationality || 'International',
      dateOfBirth: guestData.dateOfBirth ? new Date(guestData.dateOfBirth) : undefined,
      gender: guestData.gender || '',
      address: guestData.address || '',
      addressDetails: guestData.addressDetails || { street: '', city: '', state: '', zipCode: '', country: '' },
      vipStatus: Boolean(guestData.vipStatus),
      preferences: guestData.preferences || [],
      notes: guestData.notes || '',
      totalVisits: Number(guestData.totalVisits) || 1,
      totalSpent: Number(guestData.totalSpent || guestData.spent || 0),
      lastVisit: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    InMemoryStore.guests.unshift(newGuest);
    return newGuest;
  }

  static async syncUserToGuest(user: any) {
    if (!user) return null;
    await this.ensureReady();

    const normalizedEmail = (user.email || '').toLowerCase().trim();
    const fullName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`).trim() || 'VIP Patron';
    const phone = user.phone && user.phone.trim() ? user.phone.trim() : `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const addressObj = typeof user.address === 'object' && user.address !== null ? user.address : {};
    const street = addressObj.street || (typeof user.address === 'string' ? user.address : '');
    const city = addressObj.city || '';
    const state = addressObj.state || '';
    const zipCode = addressObj.postalCode || addressObj.zipCode || '';
    const country = addressObj.country || user.nationality || '';

    const stayPrefs = user.stayPreferences || {};
    const prefsList: string[] = [];
    if (stayPrefs.pillowPreference) prefsList.push(`Pillow: ${stayPrefs.pillowPreference}`);
    if (Array.isArray(stayPrefs.dietaryRestrictions)) prefsList.push(...stayPrefs.dietaryRestrictions);
    if (stayPrefs.specialRequests) prefsList.push(`Requests: ${stayPrefs.specialRequests}`);

    // EXACT user nationality and identification details:
    const nationality = (user.nationality || addressObj.country || country || 'International').trim();
    const idType = (user.idType || 'passport').trim().toLowerCase();
    const idNumber = (user.idNumber && user.idNumber.trim())
      ? user.idNumber.trim()
      : `PATRON-${(user._id || user.id || Date.now()).toString().slice(-6).toUpperCase()}`;

    const guestPayload: any = {
      fullName,
      firstName: user.firstName || fullName.split(' ')[0] || '',
      lastName: user.lastName || fullName.split(' ').slice(1).join(' ') || '',
      email: normalizedEmail,
      phone,
      address: street ? `${street}${city ? `, ${city}` : ''}` : (city || country || nationality || ''),
      addressDetails: {
        street,
        city,
        state,
        zipCode,
        country: country || nationality
      },
      vipStatus: true,
      preferences: prefsList,
      notes: `VIP Patron registered via Web Portal. Title: ${user.title || 'Mr'}`,
      idType,
      idNumber,
      nationality,
      totalVisits: user.totalVisits || 0,
      totalSpent: user.totalSpent || 0,
      lastVisit: new Date(),
    };

    if (isMongo()) {
      let guest: any = null;
      if (normalizedEmail) {
        guest = await (Guest as any).findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i') });
      }
      if (!guest && user.phone) {
        guest = await (Guest as any).findOne({ phone: user.phone });
      }

      if (guest) {
        guest.fullName = fullName;
        if (guestPayload.firstName) guest.firstName = guestPayload.firstName;
        if (guestPayload.lastName) guest.lastName = guestPayload.lastName;
        if (normalizedEmail) guest.email = normalizedEmail;
        if (user.phone) guest.phone = user.phone;
        if (guestPayload.address) guest.address = guestPayload.address;
        if (street || city || country || nationality) guest.addressDetails = guestPayload.addressDetails;
        if (guestPayload.nationality) guest.nationality = guestPayload.nationality;
        if (guestPayload.idType) guest.idType = guestPayload.idType;
        if (guestPayload.idNumber) guest.idNumber = guestPayload.idNumber;
        guest.vipStatus = true;
        if (prefsList.length > 0) guest.preferences = prefsList;
        const saved = await guest.save();
        return saved.toObject ? saved.toObject() : saved;
      } else {
        const newGuest = new Guest(guestPayload);
        const saved = await newGuest.save();
        const obj = saved.toObject ? saved.toObject() : saved;
        InMemoryStore.guests = InMemoryStore.guests || [];
        InMemoryStore.guests.unshift(obj);
        return obj;
      }
    }

    const index = InMemoryStore.guests.findIndex((g) => (normalizedEmail && g.email === normalizedEmail) || g.phone === phone);
    if (index !== -1) {
      InMemoryStore.guests[index] = { ...InMemoryStore.guests[index], ...guestPayload, updatedAt: new Date() };
      return InMemoryStore.guests[index];
    }
    const newGuest = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...guestPayload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    InMemoryStore.guests.unshift(newGuest);
    return newGuest;
  }

  static async syncAllUsersToGuests() {
    await this.ensureReady();
    try {
      if (isMongo()) {
        const users = await (User as any).find({
          role: { $in: ['guest', 'patron', 'customer'] },
          isDeleted: { $ne: true }
        }).exec();

        for (const u of users) {
          await this.syncUserToGuest(u);
        }
      } else {
        const users = InMemoryStore.users.filter((u) => ['guest', 'patron', 'customer'].includes(u.role));
        for (const u of users) {
          await this.syncUserToGuest(u);
        }
      }
    } catch (e: any) {
      console.warn('[Sync Users to Guests Warning]:', e.message);
    }
  }

  static async createOrUpdateGuest(guestData: any) {
    return await this.createGuest(guestData);
  }

  static async updateGuest(id: string, updateData: any) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Guest as any).findByIdAndUpdate(id, updateData, { new: true }).exec();
    }

    const index = InMemoryStore.guests.findIndex((g) => g._id === id);
    if (index === -1) return null;
    InMemoryStore.guests[index] = {
      ...InMemoryStore.guests[index],
      ...updateData,
      updatedAt: new Date(),
    };
    return InMemoryStore.guests[index];
  }

  static async deleteGuest(id: string) {
    await this.ensureReady();
    // Check if guest has active checked_in reservations
    const bookings = await this.getAllBookings({ guestId: id });
    const hasActiveStay = bookings.some((b: any) => ['checked_in', 'confirmed'].includes(b.status));
    if (hasActiveStay) {
      const err = new Error('Cannot delete guest with active or confirmed reservations.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (isMongo()) {
      return await (Guest as any).findByIdAndDelete(id).exec();
    }

    const index = InMemoryStore.guests.findIndex((g) => g._id === id);
    if (index === -1) return null;
    return InMemoryStore.guests.splice(index, 1)[0];
  }

  static async getGuestHistory(guestId: string) {
    return await this.getGuestById(guestId);
  }

  // ================= PAYMENTS =================
  static async getAllPayments() {
    await this.ensureReady();
    if (isMongo()) {
      return await (Payment as any).find().sort({ createdAt: -1 }).exec();
    }
    return InMemoryStore.payments;
  }

  static async recordPayment(paymentData: any) {
    await this.ensureReady();
    const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const completeData = {
      ...paymentData,
      receiptNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const payment = new Payment(completeData);
      const savedPayment = await payment.save();

      // Update booking paid amount
      if (paymentData.bookingId) {
        const booking: any = await (Booking as any).findById(paymentData.bookingId);
        if (booking) {
          booking.paidAmount = (booking.paidAmount || 0) + Number(paymentData.amount);
          if (booking.paidAmount >= booking.totalAmount) {
            booking.paymentStatus = 'paid';
          } else if (booking.paidAmount > 0) {
            booking.paymentStatus = 'partial';
          }
          await booking.save();
        }
      }
      return savedPayment;
    }

    const newPayment = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...completeData,
    };
    InMemoryStore.payments.unshift(newPayment);

    // Update in-memory booking
    if (paymentData.bookingId) {
      const booking = InMemoryStore.bookings.find((b) => b._id === paymentData.bookingId);
      if (booking) {
        booking.paidAmount = (booking.paidAmount || 0) + Number(paymentData.amount);
        if (booking.paidAmount >= booking.totalAmount) {
          booking.paymentStatus = 'paid';
        } else if (booking.paidAmount > 0) {
          booking.paymentStatus = 'partial';
        }
      }
    }

    return newPayment;
  }

  static async createPayment(paymentData: any) {
    return await this.recordPayment(paymentData);
  }

  // ================= AUDIT LOGS =================
  static async recordAudit(logData: {
    userName: string;
    userRole: string;
    module: string;
    action: string;
    details: string;
  }) {
    await this.ensureReady();
    const logItem = {
      ...logData,
      timestamp: new Date(),
    };

    if (isMongo()) {
      try {
        const log = new AuditLog(logItem);
        return await log.save();
      } catch (err) {
        console.error('Audit log failed:', err);
      }
    }

    const inMemoryLog = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...logItem,
    };
    InMemoryStore.auditLogs.unshift(inMemoryLog);
    // Keep max 300 logs
    if (InMemoryStore.auditLogs.length > 300) {
      InMemoryStore.auditLogs.pop();
    }
    return inMemoryLog;
  }

  static async logAction(
    arg1: any,
    userRole?: string,
    module?: string,
    action?: string,
    details?: string
  ) {
    if (typeof arg1 === 'object' && arg1 !== null) {
      return await this.recordAudit(arg1);
    }
    return await this.recordAudit({
      userName: arg1 || 'System Admin',
      userRole: userRole || 'admin',
      module: module || 'system',
      action: action || 'Action',
      details: details || '',
    });
  }

  static async getAuditLogs(limit = 100) {
    await this.ensureReady();
    if (isMongo()) {
      return await (AuditLog as any).find().sort({ timestamp: -1 }).limit(limit).exec();
    }
    return InMemoryStore.auditLogs.slice(0, limit);
  }

  static async getAllAuditLogs(limit = 100) {
    return await this.getAuditLogs(limit);
  }

  // ================= FOLIOS =================
  static async getFolioByBookingId(bookingId: string) {
    await this.ensureReady();
    if (isMongo()) {
      let folio = await (Folio as any).findOne({ reservation: bookingId }).populate('guest').populate('room').exec();
      if (!folio) {
        folio = await this.createOrGetFolioForBooking(bookingId);
      }
      return folio;
    }

    let folio = InMemoryStore.folios.find(
      (f) => String(f.reservation) === String(bookingId) || String(f.bookingNumber) === String(bookingId)
    );
    if (!folio) {
      folio = await this.createOrGetFolioForBooking(bookingId);
    }
    return folio;
  }

  static async createOrGetFolioForBooking(bookingId: string) {
    await this.ensureReady();
    const booking = await this.getBookingById(bookingId);
    if (!booking) {
      const err = new Error('Reservation not found for folio generation');
      (err as any).statusCode = 404;
      throw err;
    }

    if (isMongo()) {
      let existing = await (Folio as any).findOne({
        $or: [
          { reservation: booking._id },
          { reservation: String(booking._id) },
          { bookingNumber: booking.bookingNumber },
          { bookingNumber: booking.reservationNumber },
        ],
      }).exec();
      if (existing) return existing;

      const folioNumber = `FOL-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const nights = Number(booking.totalNights) || 1;
      const rate = Number(booking.roomRate || booking.pricePerNight || 100);
      const roomCharge = nights * rate;
      const tax = Number(booking.tax ?? Math.round(roomCharge * 0.1 * 100) / 100);
      const totalAmount = Number(booking.totalAmount ?? (roomCharge + tax));

      const newFolio = new Folio({
        folioNumber,
        guest: booking.guest?._id || booking.guest,
        reservation: booking._id,
        bookingNumber: booking.bookingNumber || booking.reservationNumber,
        room: booking.room?._id || booking.room || booking.roomId,
        items: [
          {
            description: `Room Accommodation - ${booking.roomNumber ? `Room ${booking.roomNumber}` : 'Stay'} (${nights} Nights @ ${rate}/night)`,
            category: 'room_charge',
            quantity: nights,
            unitPrice: rate,
            amount: roomCharge,
            taxAmount: tax,
            date: new Date(booking.checkInDate || Date.now()),
          },
        ],
        totalCharges: totalAmount,
        totalPayments: Number(booking.paidAmount || 0),
        balance: Math.max(0, totalAmount - Number(booking.paidAmount || 0)),
        status: Number(booking.paidAmount || 0) >= totalAmount ? 'settled' : 'open',
      });

      const saved = await newFolio.save();
      await (Booking as any).findByIdAndUpdate(booking._id, { folio: saved._id });
      return saved;
    }

    let existing = InMemoryStore.folios.find(
      (f) =>
        String(f.reservation) === String(booking._id) ||
        String(f.bookingNumber) === String(booking.bookingNumber) ||
        String(f.bookingNumber) === String(booking.reservationNumber)
    );
    if (existing) return existing;

    const folioId = new mongoose.Types.ObjectId().toString();
    const folioNumber = `FOL-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const nights = Number(booking.totalNights) || 1;
    const rate = Number(booking.roomRate || booking.pricePerNight || 100);
    const roomCharge = nights * rate;
    const tax = Number(booking.tax ?? Math.round(roomCharge * 0.1 * 100) / 100);
    const totalAmount = Number(booking.totalAmount ?? (roomCharge + tax));

    const newFolio = {
      _id: folioId,
      folioNumber,
      guest: booking.guest || booking.guestId,
      guestName: booking.guestName,
      reservation: booking._id,
      bookingNumber: booking.bookingNumber || booking.reservationNumber,
      room: booking.room || booking.roomId,
      roomNumber: booking.roomNumber,
      items: [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          description: `Room Accommodation - ${booking.roomNumber ? `Room ${booking.roomNumber}` : 'Stay'} (${nights} Nights @ ${rate}/night)`,
          category: 'room_charge',
          quantity: nights,
          unitPrice: rate,
          amount: roomCharge,
          taxAmount: tax,
          date: new Date(booking.checkInDate || Date.now()),
        },
      ],
      totalCharges: totalAmount,
      totalPayments: Number(booking.paidAmount || 0),
      balance: Math.max(0, totalAmount - Number(booking.paidAmount || 0)),
      status: Number(booking.paidAmount || 0) >= totalAmount ? 'settled' : 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    InMemoryStore.folios.push(newFolio);
    booking.folio = folioId;
    return newFolio;
  }

  static async addFolioItem(bookingId: string, itemData: {
    description: string;
    category?: string;
    quantity?: number;
    unitPrice: number;
    taxAmount?: number;
    serviceId?: string;
    addedBy?: string;
  }) {
    await this.ensureReady();
    const folio: any = await this.getFolioByBookingId(bookingId);
    if (!folio) {
      const err = new Error('Folio not found for reservation');
      (err as any).statusCode = 404;
      throw err;
    }

    const qty = Math.max(1, Number(itemData.quantity) || 1);
    const unitPrice = Number(itemData.unitPrice);
    const amount = qty * unitPrice;
    const taxAmount = Number(itemData.taxAmount ?? Math.round(amount * 0.1 * 100) / 100);

    const newItem = {
      _id: new mongoose.Types.ObjectId().toString(),
      description: itemData.description,
      category: itemData.category || 'service',
      quantity: qty,
      unitPrice,
      amount,
      taxAmount,
      date: new Date(),
    };

    if (isMongo()) {
      folio.items.push(newItem);
      folio.totalCharges = folio.items.reduce(
        (sum: number, item: any) => sum + (Number(item.amount) || 0) + (Number(item.taxAmount) || 0),
        0
      );
      folio.balance = Math.max(0, folio.totalCharges - (folio.totalPayments || 0));
      folio.status = folio.balance <= 0 ? 'settled' : 'open';
      const updatedFolio = await folio.save();

      // Sync booking total amount
      await (Booking as any).findByIdAndUpdate(bookingId, {
        totalAmount: folio.totalCharges,
      });

      return updatedFolio;
    }

    const index = InMemoryStore.folios.findIndex((f) => String(f._id) === String(folio._id));
    if (index !== -1) {
      InMemoryStore.folios[index].items.push(newItem);
      InMemoryStore.folios[index].totalCharges = InMemoryStore.folios[index].items.reduce(
        (sum: number, item: any) => sum + (Number(item.amount) || 0) + (Number(item.taxAmount) || 0),
        0
      );
      InMemoryStore.folios[index].balance = Math.max(
        0,
        InMemoryStore.folios[index].totalCharges - (InMemoryStore.folios[index].totalPayments || 0)
      );
      InMemoryStore.folios[index].status = InMemoryStore.folios[index].balance <= 0 ? 'settled' : 'open';
      InMemoryStore.folios[index].updatedAt = new Date();

      // Sync booking total amount
      const bIndex = InMemoryStore.bookings.findIndex((b) => String(b._id) === String(bookingId));
      if (bIndex !== -1) {
        InMemoryStore.bookings[bIndex].totalAmount = InMemoryStore.folios[index].totalCharges;
      }

      return InMemoryStore.folios[index];
    }

    return folio;
  }

  // ================= SERVICES =================
  static async getAllServices(category?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = { isAvailable: true };
      if (category && category !== 'all') query.category = category;
      return await (Service as any).find(query).sort({ category: 1, name: 1 }).exec();
    }

    return InMemoryStore.services.filter((s) => {
      if (category && category !== 'all' && s.category !== category) return false;
      return s.isAvailable !== false;
    });
  }

  static async getServiceById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Service as any).findById(id).exec();
    }
    return InMemoryStore.services.find((s) => s._id === id) || null;
  }

  // ================= INVOICES =================
  static async getAllInvoices(filter: any = {}) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (filter.guestId) query.guest = filter.guestId;
      if (filter.reservationId) query.reservation = filter.reservationId;
      return await (Invoice as any).find(query).populate('guest').populate('room').populate('reservation').sort({ issuedAt: -1 }).exec();
    }

    return InMemoryStore.invoices
      .filter((inv) => {
        if (filter.guestId && String(inv.guest) !== String(filter.guestId)) return false;
        if (filter.reservationId && String(inv.reservation) !== String(filter.reservationId)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }

  static async getInvoiceById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Invoice as any).findById(id).populate('guest').populate('room').populate('reservation').exec();
    }
    return InMemoryStore.invoices.find((inv) => inv._id === id || inv.invoiceNumber === id) || null;
  }

  static async createInvoice(invoiceData: any) {
    await this.ensureReady();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const completeData = {
      ...invoiceData,
      invoiceNumber: invoiceData.invoiceNumber || invoiceNumber,
      issuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const invoice = new Invoice(completeData);
      return await invoice.save();
    }

    const newInvoice = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...completeData,
    };
    InMemoryStore.invoices.unshift(newInvoice);
    return newInvoice;
  }

  // ================= HOUSEKEEPING =================
  static async getAllHousekeepingTasks(filter: any = {}) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (filter.status && filter.status !== 'all') query.status = filter.status;
      if (filter.roomId) query.room = filter.roomId;
      return await (Housekeeping as any).find(query).populate('room').sort({ priority: -1, scheduledDate: -1 }).exec();
    }

    return InMemoryStore.housekeeping
      .filter((hk) => {
        if (filter.status && filter.status !== 'all' && hk.status !== filter.status) return false;
        if (filter.roomId && String(hk.room) !== String(filter.roomId)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }

  static async createHousekeepingTask(taskData: any) {
    await this.ensureReady();
    const taskNumber = `HK-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const completeData = {
      ...taskData,
      taskNumber: taskData.taskNumber || taskNumber,
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      scheduledDate: taskData.scheduledDate ? new Date(taskData.scheduledDate) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const task = new Housekeeping(completeData);
      return await task.save();
    }

    const newTask = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...completeData,
    };
    InMemoryStore.housekeeping.unshift(newTask);
    return newTask;
  }

  static async completeRoomCleaning(roomId: string, staffName?: string, notes?: string) {
    await this.ensureReady();
    const room = await this.getRoomById(roomId);
    if (!room) {
      const err = new Error('Room not found');
      (err as any).statusCode = 404;
      throw err;
    }

    // Update Room Status to available
    const updatedRoom = await this.updateRoom(roomId, {
      status: 'available',
      lastCleaned: new Date(),
      currentBookingId: null,
      currentGuestId: null,
    });

    // Update any pending housekeeping tasks for this room
    if (isMongo()) {
      await (Housekeeping as any).updateMany(
        { room: room._id, status: { $in: ['pending', 'in_progress'] } },
        {
          status: 'completed',
          completedAt: new Date(),
          notes: notes ? `Cleaned by ${staffName || 'Housekeeping staff'}: ${notes}` : `Completed by ${staffName || 'Housekeeping'}`,
        }
      );
    } else {
      InMemoryStore.housekeeping.forEach((hk) => {
        if (String(hk.room) === String(roomId) && ['pending', 'in_progress'].includes(hk.status)) {
          hk.status = 'completed';
          hk.completedAt = new Date();
          hk.notes = notes ? `Cleaned by ${staffName || 'Housekeeping staff'}: ${notes}` : `Completed by ${staffName || 'Housekeeping'}`;
        }
      });
    }

    await this.logAction({
      userName: staffName || 'Housekeeping Lead',
      userRole: 'housekeeping',
      module: 'housekeeping',
      action: 'ROOM_CLEANING_COMPLETED',
      details: `Housekeeping cleaning completed for Room ${room.roomNumber}. Status updated to [AVAILABLE]. Ready for guest check-in.`,
    });

    return updatedRoom;
  }

  // ================= END-TO-END CHECK-IN WORKFLOW =================
  static async processCheckIn(bookingId: string, payload: {
    roomId?: string;
    keyCardNumber?: string;
    guestIdType?: string;
    guestIdNumber?: string;
    guestPhone?: string;
    guestEmail?: string;
    initialPaymentAmount?: number;
    paymentMethod?: string;
    staffId?: string;
    staffName?: string;
    notes?: string;
  }) {
    await this.ensureReady();

    // 1. Verify Reservation
    const booking = await this.getBookingById(bookingId);
    if (!booking) {
      const err = new Error('Reservation record could not be found.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (booking.status === 'checked_in') {
      const err = new Error(`Guest ${booking.guestName} is already checked in to Room ${booking.roomNumber}.`);
      (err as any).statusCode = 400;
      throw err;
    }

    if (booking.status === 'checked_out') {
      const err = new Error('This reservation has already been checked out and finalized.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      const err = new Error(`Cannot check in a reservation with status [${booking.status.toUpperCase()}]. Please create a new booking.`);
      (err as any).statusCode = 400;
      throw err;
    }

    // 2. Verify / Assign Room
    const targetRoomId = payload.roomId || booking.roomId || booking.room;
    const room = await this.getRoomById(String(targetRoomId));
    if (!room) {
      const err = new Error('Assigned room does not exist in inventory.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (room.status === 'maintenance' || room.status === 'out_of_service') {
      const err = new Error(`Room ${room.roomNumber} is currently under ${room.status.replace('_', ' ')}. Please reassign another room.`);
      (err as any).statusCode = 400;
      throw err;
    }

    if (room.status === 'occupied' && String(room.currentBookingId) !== String(booking._id)) {
      const err = new Error(`Room ${room.roomNumber} is currently occupied by another guest. Please reassign a different available room.`);
      (err as any).statusCode = 400;
      throw err;
    }

    // Verify room availability for dates
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const availability = await this.checkRoomAvailability(String(room._id), checkIn, checkOut, String(booking._id));
    if (!availability.available && room.status !== 'reserved') {
      const err = new Error(availability.reason || 'Room date availability conflict.');
      (err as any).statusCode = 409;
      throw err;
    }

    // 3. Verify Guest Profile & Update Identification
    let guestRecord: any = null;
    if (booking.guest) {
      guestRecord = await this.getGuestById(String(booking.guest._id || booking.guest));
    }
    if (!guestRecord && booking.guestPhone) {
      guestRecord = await this.createOrUpdateGuest({
        fullName: booking.guestName,
        phone: payload.guestPhone || booking.guestPhone,
        email: payload.guestEmail || booking.guestEmail || '',
        idType: payload.guestIdType || booking.guestIdType || 'passport',
        idNumber: payload.guestIdNumber || booking.guestIdNumber || '',
      });
    } else if (guestRecord) {
      await this.updateGuest(String(guestRecord._id), {
        ...(payload.guestIdType && { idType: payload.guestIdType }),
        ...(payload.guestIdNumber && { idNumber: payload.guestIdNumber }),
        ...(payload.guestPhone && { phone: payload.guestPhone }),
        ...(payload.guestEmail && { email: payload.guestEmail }),
        lastVisit: new Date(),
      });
    }

    // 4. Process Advance Payment / Deposit if provided
    let updatedPaidAmount = Number(booking.paidAmount || 0);
    const depositAmount = Number(payload.initialPaymentAmount || 0);
    let paymentRecord: any = null;

    if (depositAmount > 0) {
      updatedPaidAmount += depositAmount;
      paymentRecord = await this.createPayment({
        bookingId: booking._id,
        guestName: booking.guestName,
        roomNumber: room.roomNumber,
        amount: depositAmount,
        paymentMethod: payload.paymentMethod || 'credit_card',
        status: 'completed',
        notes: 'Deposit / Payment recorded during Check-In',
        recordedBy: `${payload.staffName || 'Receptionist'}`,
      });
    }

    const paymentStatus =
      updatedPaidAmount >= Number(booking.totalAmount)
        ? 'paid'
        : updatedPaidAmount > 0
        ? 'partial'
        : 'pending';

    const keyCard = payload.keyCardNumber || room.keyCardNumber || `KC-${room.roomNumber}`;

    // 5. Update Reservation Status -> 'checked_in'
    const updatedBooking = await this.updateBooking(bookingId, {
      status: 'checked_in',
      actualCheckIn: new Date(),
      room: room._id,
      roomId: room._id,
      roomNumber: room.roomNumber,
      roomType: room.type,
      paidAmount: updatedPaidAmount,
      paymentStatus,
      guestIdType: payload.guestIdType || booking.guestIdType || 'passport',
      guestIdNumber: payload.guestIdNumber || booking.guestIdNumber || '',
      notes: payload.notes ? (booking.notes ? `${booking.notes} | ${payload.notes}` : payload.notes) : booking.notes,
    });

    // 6. Update Room Status to OCCUPIED
    await this.updateRoom(String(room._id), {
      status: 'occupied',
      currentBookingId: booking._id,
      currentGuestId: guestRecord?._id || booking.guest,
      keyCardNumber: keyCard,
    });

    // 7. Create/Update Guest Folio
    const folio: any = await this.createOrGetFolioForBooking(bookingId);
    if (depositAmount > 0 && folio) {
      if (isMongo()) {
        folio.totalPayments = (folio.totalPayments || 0) + depositAmount;
        folio.balance = Math.max(0, (folio.totalCharges || 0) - folio.totalPayments);
        folio.status = folio.balance <= 0 ? 'settled' : 'open';
        await folio.save();
      } else {
        const fIdx = InMemoryStore.folios.findIndex((f) => String(f._id) === String(folio._id));
        if (fIdx !== -1) {
          InMemoryStore.folios[fIdx].totalPayments = (InMemoryStore.folios[fIdx].totalPayments || 0) + depositAmount;
          InMemoryStore.folios[fIdx].balance = Math.max(
            0,
            (InMemoryStore.folios[fIdx].totalCharges || 0) - InMemoryStore.folios[fIdx].totalPayments
          );
          InMemoryStore.folios[fIdx].status = InMemoryStore.folios[fIdx].balance <= 0 ? 'settled' : 'open';
        }
      }
    }

    // 8. Audit Logging
    await this.logAction({
      userName: payload.staffName || 'Receptionist',
      userRole: 'receptionist',
      module: 'reception',
      action: 'GUEST_CHECK_IN',
      details: `Checked in guest ${booking.guestName} to Room ${room.roomNumber} (${room.type}). Keycard: ${keyCard}. Folio #${folio?.folioNumber || 'N/A'}. Deposit: ${depositAmount}.`,
    });

    return {
      success: true,
      message: `Guest ${booking.guestName} successfully checked into Room ${room.roomNumber}`,
      booking: updatedBooking,
      room,
      folio,
      payment: paymentRecord,
    };
  }

  // ================= END-TO-END CHECK-OUT WORKFLOW =================
  static async processCheckOut(bookingId: string, payload: {
    settlementAmount?: number;
    paymentMethod?: string;
    discount?: number;
    discountReason?: string;
    notes?: string;
    damageCharges?: number;
    staffId?: string;
    staffName?: string;
  }) {
    await this.ensureReady();

    // 1. Verify Booking
    const booking = await this.getBookingById(bookingId);
    if (!booking) {
      const err = new Error('Reservation record could not be found.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (booking.status === 'checked_out') {
      const err = new Error(`Guest ${booking.guestName} has already checked out.`);
      (err as any).statusCode = 400;
      throw err;
    }

    const room = await this.getRoomById(String(booking.roomId || booking.room));

    // 2. Retrieve / Construct Guest Folio
    const folio: any = await this.getFolioByBookingId(bookingId);

    // If damage or other extra charges added at checkout
    if (payload.damageCharges && Number(payload.damageCharges) > 0) {
      await this.addFolioItem(bookingId, {
        description: 'Room Damage / Incidentals Charge',
        category: 'damage',
        unitPrice: Number(payload.damageCharges),
        quantity: 1,
        taxAmount: 0,
      });
    }

    // Re-fetch updated folio items
    const refreshedFolio: any = await this.getFolioByBookingId(bookingId);
    const folioItems: any[] = refreshedFolio?.items || [];

    // 3. Accurate Financial Calculations:
    // Categorize charges:
    // - Room Charges
    // - Additional Services (spa, laundry, transport, minibar, service)
    // - Restaurant Charges (food_beverage)
    // - Other / Damage
    const roomCharges = folioItems
      .filter((i) => i.category === 'room_charge')
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const additionalServicesCharges = folioItems
      .filter((i) => ['service', 'laundry', 'spa', 'mini_bar', 'transportation', 'facilities'].includes(i.category))
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const restaurantCharges = folioItems
      .filter((i) => i.category === 'food_beverage')
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const otherCharges = folioItems
      .filter((i) => ['damage', 'other'].includes(i.category))
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const grossCharges = roomCharges + additionalServicesCharges + restaurantCharges + otherCharges;
    const discount = Number(payload.discount ?? booking.discount ?? 0);
    const taxableSubtotal = Math.max(0, grossCharges - discount);
    const taxRate = 10; // 10% standard hotel tax
    const tax = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100;
    const finalTotalAmount = taxableSubtotal + tax;

    const previousPayments = Number(booking.paidAmount || 0);
    const initialDue = Math.max(0, finalTotalAmount - previousPayments);
    const settlementPaid = payload.settlementAmount !== undefined ? Number(payload.settlementAmount) : initialDue;
    const totalPayments = previousPayments + settlementPaid;
    const finalBalance = Math.max(0, finalTotalAmount - totalPayments);

    // 4. Record Settlement Payment
    let settlementPaymentRecord: any = null;
    if (settlementPaid > 0) {
      settlementPaymentRecord = await this.createPayment({
        bookingId: booking._id,
        guestName: booking.guestName,
        roomNumber: room?.roomNumber || booking.roomNumber,
        amount: settlementPaid,
        paymentMethod: payload.paymentMethod || 'credit_card',
        status: 'completed',
        notes: `Check-Out final settlement payment. ${payload.notes ? `Remarks: ${payload.notes}` : ''}`,
        recordedBy: payload.staffName || 'Receptionist',
      });
    }

    // 5. Generate Official Invoice
    const invoice = await this.createInvoice({
      reservation: booking._id,
      bookingNumber: booking.bookingNumber || booking.reservationNumber,
      folio: refreshedFolio?._id,
      folioNumber: refreshedFolio?.folioNumber || `FOL-${booking.roomNumber}`,
      guest: booking.guest?._id || booking.guest,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      room: room?._id || booking.roomId || booking.room,
      roomNumber: room?.roomNumber || booking.roomNumber,
      roomType: room?.type || booking.roomType,
      checkInDate: new Date(booking.checkInDate),
      checkOutDate: new Date(),
      totalNights: booking.totalNights || 1,
      roomCharges,
      additionalServicesCharges,
      restaurantCharges,
      otherCharges,
      subtotal: taxableSubtotal,
      discount,
      discountReason: payload.discountReason || '',
      tax,
      taxRate,
      totalAmount: finalTotalAmount,
      paidAmount: totalPayments,
      balance: finalBalance,
      paymentMethod: payload.paymentMethod || 'credit_card',
      paymentReceiptNumber: settlementPaymentRecord?.receiptNumber || 'N/A',
      status: finalBalance <= 0.01 ? 'paid' : 'partially_paid',
      issuedByName: payload.staffName || 'Receptionist',
      items: folioItems,
      notes: payload.notes || 'Check-Out completed. Keycard returned.',
    });

    // 6. Close and Settle Folio
    if (isMongo() && refreshedFolio) {
      refreshedFolio.totalCharges = finalTotalAmount;
      refreshedFolio.totalPayments = totalPayments;
      refreshedFolio.balance = finalBalance;
      refreshedFolio.status = finalBalance <= 0.01 ? 'settled' : 'closed';
      refreshedFolio.closedAt = new Date();
      await refreshedFolio.save();
    } else if (refreshedFolio) {
      const fIdx = InMemoryStore.folios.findIndex((f) => String(f._id) === String(refreshedFolio._id));
      if (fIdx !== -1) {
        InMemoryStore.folios[fIdx].totalCharges = finalTotalAmount;
        InMemoryStore.folios[fIdx].totalPayments = totalPayments;
        InMemoryStore.folios[fIdx].balance = finalBalance;
        InMemoryStore.folios[fIdx].status = finalBalance <= 0.01 ? 'settled' : 'closed';
        InMemoryStore.folios[fIdx].closedAt = new Date();
      }
    }

    // 7. Update Reservation Status -> 'checked_out'
    const updatedBooking = await this.updateBooking(bookingId, {
      status: 'checked_out',
      actualCheckOut: new Date(),
      totalAmount: finalTotalAmount,
      paidAmount: totalPayments,
      paymentStatus: finalBalance <= 0.01 ? 'paid' : 'partial',
      notes: payload.notes ? (booking.notes ? `${booking.notes} | ${payload.notes}` : payload.notes) : booking.notes,
    });

    // 8. Update Room Status to CLEANING & Create Housekeeping task
    if (room) {
      await this.updateRoom(String(room._id), {
        status: 'cleaning',
        currentBookingId: null,
        currentGuestId: null,
        lastCleaned: new Date(),
      });

      // Automatically queue Housekeeping task
      await this.createHousekeepingTask({
        room: room._id,
        roomNumber: room.roomNumber,
        employee: new mongoose.Types.ObjectId().toString(),
        assignedStaffName: 'Housekeeping Duty Team',
        taskType: 'checkout_clean',
        priority: 'high',
        status: 'pending',
        scheduledDate: new Date(),
        notes: `Post-checkout turnover cleaning for Room ${room.roomNumber} after stay of ${booking.guestName}.`,
      });
    }

    // 9. Update Guest Profile History
    if (booking.guest) {
      await this.updateGuest(String(booking.guest._id || booking.guest), {
        lastVisit: new Date(),
        spent: settlementPaid,
      });
    }

    // 10. Audit Logging
    await this.logAction({
      userName: payload.staffName || 'Receptionist',
      userRole: 'receptionist',
      module: 'reception',
      action: 'GUEST_CHECK_OUT',
      details: `Checked out guest ${booking.guestName} from Room ${room?.roomNumber || 'N/A'}. Invoice: #${invoice.invoiceNumber}. Settled: ${settlementPaid}. Room moved to [CLEANING].`,
    });

    return {
      success: true,
      message: `Guest ${booking.guestName} successfully checked out. Room ${room?.roomNumber} queued for Cleaning.`,
      booking: updatedBooking,
      invoice,
      folio: refreshedFolio,
      room,
      payment: settlementPaymentRecord,
    };
  }

  // ================= RESTAURANT / POS MODULE =================

  // --- Categories ---
  static async getAllRestaurantCategories() {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantCategory as any).find({ isActive: true }).sort({ displayOrder: 1, name: 1 }).exec();
    }
    return (InMemoryStore.restaurantCategories || [])
      .filter((c) => c.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  static async createRestaurantCategory(data: any) {
    await this.ensureReady();
    const categoryData = {
      ...data,
      code: (data.code || data.name.substring(0, 4)).toUpperCase().replace(/\s+/g, '_'),
      displayOrder: Number(data.displayOrder) || 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const category = new RestaurantCategory(categoryData);
      return await category.save();
    }

    const newCategory = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...categoryData,
    };
    InMemoryStore.restaurantCategories.push(newCategory);
    return newCategory;
  }

  static async updateRestaurantCategory(id: string, data: any) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantCategory as any).findByIdAndUpdate(id, data, { new: true }).exec();
    }
    const idx = InMemoryStore.restaurantCategories.findIndex((c) => String(c._id) === String(id));
    if (idx === -1) return null;
    InMemoryStore.restaurantCategories[idx] = {
      ...InMemoryStore.restaurantCategories[idx],
      ...data,
      updatedAt: new Date(),
    };
    return InMemoryStore.restaurantCategories[idx];
  }

  static async deleteRestaurantCategory(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantCategory as any).findByIdAndDelete(id).exec();
    }
    const idx = InMemoryStore.restaurantCategories.findIndex((c) => String(c._id) === String(id));
    if (idx === -1) return null;
    return InMemoryStore.restaurantCategories.splice(idx, 1)[0];
  }

  // --- Menu Items ---
  static async getAllRestaurantMenuItems(categoryId?: string, search?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (categoryId && categoryId !== 'all') {
        query.category = categoryId;
      }
      if (search && search.trim()) {
        query.$or = [
          { name: { $regex: search.trim(), $options: 'i' } },
          { description: { $regex: search.trim(), $options: 'i' } },
          { code: { $regex: search.trim(), $options: 'i' } },
        ];
      }
      return await (RestaurantMenuItem as any).find(query).sort({ categoryName: 1, name: 1 }).exec();
    }

    return (InMemoryStore.restaurantMenuItems || []).filter((item) => {
      if (categoryId && categoryId !== 'all') {
        const matchesCat =
          String(item.category) === String(categoryId) ||
          item.categoryName?.toLowerCase() === categoryId.toLowerCase();
        if (!matchesCat) return false;
      }
      if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        const matchesSearch =
          item.name?.toLowerCase().includes(s) ||
          item.description?.toLowerCase().includes(s) ||
          item.code?.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }

  static async getRestaurantMenuItemById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantMenuItem as any).findById(id).exec();
    }
    return (InMemoryStore.restaurantMenuItems || []).find((item) => String(item._id) === String(id)) || null;
  }

  static async createRestaurantMenuItem(data: any) {
    await this.ensureReady();
    const itemData = {
      ...data,
      price: Number(data.price) || 0,
      spicyLevel: Number(data.spicyLevel) || 0,
      preparationTime: Number(data.preparationTime) || 15,
      dietary: Array.isArray(data.dietary) ? data.dietary : [],
      isAvailable: data.isAvailable !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const menuItem = new RestaurantMenuItem(itemData);
      return await menuItem.save();
    }

    const newItem = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...itemData,
    };
    InMemoryStore.restaurantMenuItems.push(newItem);
    return newItem;
  }

  static async updateRestaurantMenuItem(id: string, data: any) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantMenuItem as any).findByIdAndUpdate(id, data, { new: true }).exec();
    }
    const idx = InMemoryStore.restaurantMenuItems.findIndex((item) => String(item._id) === String(id));
    if (idx === -1) return null;
    InMemoryStore.restaurantMenuItems[idx] = {
      ...InMemoryStore.restaurantMenuItems[idx],
      ...data,
      updatedAt: new Date(),
    };
    return InMemoryStore.restaurantMenuItems[idx];
  }

  static async toggleRestaurantMenuItemAvailability(id: string) {
    await this.ensureReady();
    const item = await this.getRestaurantMenuItemById(id);
    if (!item) return null;
    return await this.updateRestaurantMenuItem(id, { isAvailable: !item.isAvailable });
  }

  static async deleteRestaurantMenuItem(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantMenuItem as any).findByIdAndDelete(id).exec();
    }
    const idx = InMemoryStore.restaurantMenuItems.findIndex((item) => String(item._id) === String(id));
    if (idx === -1) return null;
    return InMemoryStore.restaurantMenuItems.splice(idx, 1)[0];
  }

  // --- Tables ---
  static async getAllRestaurantTables(location?: string, status?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = { isActive: true };
      if (location && location !== 'all') query.location = location;
      if (status && status !== 'all') query.status = status;
      return await (RestaurantTable as any).find(query).sort({ tableNumber: 1 }).exec();
    }

    return (InMemoryStore.restaurantTables || []).filter((table) => {
      if (table.isActive === false) return false;
      if (location && location !== 'all' && table.location !== location) return false;
      if (status && status !== 'all' && table.status !== status) return false;
      return true;
    });
  }

  static async getRestaurantTableById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantTable as any).findById(id).exec();
    }
    return (InMemoryStore.restaurantTables || []).find((t) => String(t._id) === String(id)) || null;
  }

  static async createRestaurantTable(data: any) {
    await this.ensureReady();
    const tableData = {
      ...data,
      capacity: Number(data.capacity) || 4,
      status: data.status || 'AVAILABLE',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const table = new RestaurantTable(tableData);
      return await table.save();
    }

    const newTable = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...tableData,
    };
    InMemoryStore.restaurantTables.push(newTable);
    return newTable;
  }

  static async updateRestaurantTable(id: string, data: any) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantTable as any).findByIdAndUpdate(id, data, { new: true }).exec();
    }
    const idx = InMemoryStore.restaurantTables.findIndex((t) => String(t._id) === String(id));
    if (idx === -1) return null;
    InMemoryStore.restaurantTables[idx] = {
      ...InMemoryStore.restaurantTables[idx],
      ...data,
      updatedAt: new Date(),
    };
    return InMemoryStore.restaurantTables[idx];
  }

  static async updateRestaurantTableStatus(id: string, status: string, details?: any) {
    await this.ensureReady();
    const updatePayload: any = { status, updatedAt: new Date() };
    if (status === 'AVAILABLE') {
      updatePayload.currentOrderId = null;
      updatePayload.currentOrderNumber = null;
      updatePayload.currentGuestName = '';
    } else if (details) {
      if (details.currentOrderId) updatePayload.currentOrderId = details.currentOrderId;
      if (details.currentOrderNumber) updatePayload.currentOrderNumber = details.currentOrderNumber;
      if (details.currentGuestName) updatePayload.currentGuestName = details.currentGuestName;
    }
    return await this.updateRestaurantTable(id, updatePayload);
  }

  static async deleteRestaurantTable(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantTable as any).findByIdAndDelete(id).exec();
    }
    const idx = InMemoryStore.restaurantTables.findIndex((t) => String(t._id) === String(id));
    if (idx === -1) return null;
    return InMemoryStore.restaurantTables.splice(idx, 1)[0];
  }

  // --- Orders & Kitchen & Room Folio Billing ---
  static async getAllRestaurantOrders(filter: any = {}) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (filter.status && filter.status !== 'all') query.status = filter.status;
      if (filter.orderType && filter.orderType !== 'all') query.orderType = filter.orderType;
      if (filter.tableNumber) query.tableNumber = filter.tableNumber;
      if (filter.roomNumber) query.roomNumber = filter.roomNumber;
      if (filter.paymentStatus && filter.paymentStatus !== 'all') query.paymentStatus = filter.paymentStatus;
      return await (RestaurantOrder as any).find(query).sort({ createdAt: -1 }).exec();
    }

    return (InMemoryStore.restaurantOrders || [])
      .filter((o) => {
        if (filter.status && filter.status !== 'all' && o.status !== filter.status) return false;
        if (filter.orderType && filter.orderType !== 'all' && o.orderType !== filter.orderType) return false;
        if (filter.tableNumber && o.tableNumber !== filter.tableNumber) return false;
        if (filter.roomNumber && o.roomNumber !== filter.roomNumber) return false;
        if (filter.paymentStatus && filter.paymentStatus !== 'all' && o.paymentStatus !== filter.paymentStatus) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || b.placedAt).getTime() - new Date(a.createdAt || a.placedAt).getTime());
  }

  static async getRestaurantOrderById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (RestaurantOrder as any).findById(id).exec();
    }
    return (InMemoryStore.restaurantOrders || []).find((o) => String(o._id) === String(id) || o.orderNumber === id) || null;
  }

  static async createRestaurantOrder(orderData: any, staffName: string = 'Staff') {
    await this.ensureReady();
    
    // Process items & calculations
    const items = (orderData.items || []).map((item: any) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Number(item.price) || 0;
      return {
        _id: new mongoose.Types.ObjectId().toString(),
        menuItem: item.menuItem || item._id,
        name: item.name || 'Custom Dish',
        categoryName: item.categoryName || 'General',
        price,
        quantity: qty,
        amount: Number((qty * price).toFixed(2)),
        specialInstructions: item.specialInstructions || '',
        status: 'NEW',
      };
    });

    if (items.length === 0) {
      const err = new Error('Order must contain at least one item.');
      (err as any).statusCode = 400;
      throw err;
    }

    const subtotal = Number(items.reduce((sum: number, it: any) => sum + it.amount, 0).toFixed(2));
    const taxRate = Number(orderData.taxRate ?? 5);
    const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
    const serviceCharge = Number(orderData.serviceCharge ?? (orderData.orderType === 'room_service' ? 3.0 : 0));
    const discount = Number(orderData.discount || 0);
    const totalAmount = Math.max(0, Number((subtotal + tax + serviceCharge - discount).toFixed(2)));

    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newOrderPayload = {
      ...orderData,
      orderNumber,
      items,
      subtotal,
      tax,
      taxRate,
      serviceCharge,
      discount,
      totalAmount,
      status: orderData.status || 'NEW',
      paymentStatus: orderData.paymentStatus || (orderData.chargedToRoom || orderData.paymentMethod === 'room_charge' ? 'charged_to_room' : 'unpaid'),
      paymentMethod: orderData.paymentMethod || (orderData.chargedToRoom ? 'room_charge' : null),
      chargedToRoom: Boolean(orderData.chargedToRoom || orderData.paymentMethod === 'room_charge'),
      waiterStaffName: orderData.waiterStaffName || staffName,
      placedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let savedOrder: any = null;

    if (isMongo()) {
      const order = new RestaurantOrder(newOrderPayload);
      savedOrder = await order.save();
    } else {
      savedOrder = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...newOrderPayload,
      };
      InMemoryStore.restaurantOrders.unshift(savedOrder);
    }

    // 1. If Dine-In with table, mark table as OCCUPIED
    if (savedOrder.tableNumber && savedOrder.orderType === 'dine_in') {
      const tables = await this.getAllRestaurantTables();
      const table = tables.find((t: any) => t.tableNumber === savedOrder.tableNumber);
      if (table) {
        await this.updateRestaurantTableStatus(String(table._id), 'OCCUPIED', {
          currentOrderId: savedOrder._id,
          currentOrderNumber: savedOrder.orderNumber,
          currentGuestName: savedOrder.guestName || `Order #${savedOrder.orderNumber}`,
        });
      }
    }

    // 2. If CHARGE TO ROOM was requested immediately upon ordering
    if (savedOrder.chargedToRoom || savedOrder.paymentMethod === 'room_charge') {
      if (savedOrder.roomNumber) {
        await this.chargeRestaurantOrderToRoom(
          String(savedOrder._id),
          savedOrder.roomNumber,
          staffName
        );
      }
    }

    // Audit log
    await this.logAction({
      userName: staffName,
      userRole: 'restaurant_staff',
      module: 'restaurant',
      action: 'CREATE_ORDER',
      details: `Placed ${savedOrder.orderType} order #${savedOrder.orderNumber} for ${savedOrder.guestName} (${savedOrder.roomNumber ? `Room ${savedOrder.roomNumber}` : savedOrder.tableNumber ? `Table ${savedOrder.tableNumber}` : 'Takeaway'}). Total: ${savedOrder.totalAmount}`,
    });

    return savedOrder;
  }

  static async updateRestaurantOrderStatus(
    orderId: string,
    status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED',
    staffName: string = 'Kitchen Staff',
    cancellationReason?: string
  ) {
    await this.ensureReady();
    const order = await this.getRestaurantOrderById(orderId);
    if (!order) {
      const err = new Error('Restaurant order not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const updatePayload: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'READY') {
      updatePayload.preparedAt = new Date();
    } else if (status === 'SERVED') {
      updatePayload.servedAt = new Date();
    } else if (status === 'CANCELLED') {
      updatePayload.cancelledAt = new Date();
      if (cancellationReason) updatePayload.cancellationReason = cancellationReason;

      // Free table if occupied by this order
      if (order.tableNumber) {
        const tables = await this.getAllRestaurantTables();
        const table = tables.find((t: any) => t.tableNumber === order.tableNumber);
        if (table) {
          await this.updateRestaurantTableStatus(String(table._id), 'AVAILABLE');
        }
      }
    }

    // Also update sub-item statuses if all prepared/served
    if (order.items && order.items.length > 0) {
      updatePayload.items = order.items.map((it: any) => ({
        ...it,
        status: status === 'CANCELLED' ? it.status : status,
      }));
    }

    let updatedOrder: any = null;
    if (isMongo()) {
      updatedOrder = await (RestaurantOrder as any).findByIdAndUpdate(orderId, updatePayload, { new: true }).exec();
    } else {
      const idx = InMemoryStore.restaurantOrders.findIndex((o) => String(o._id) === String(orderId));
      if (idx !== -1) {
        InMemoryStore.restaurantOrders[idx] = {
          ...InMemoryStore.restaurantOrders[idx],
          ...updatePayload,
        };
        updatedOrder = InMemoryStore.restaurantOrders[idx];
      }
    }

    await this.logAction({
      userName: staffName,
      userRole: 'restaurant_staff',
      module: 'restaurant',
      action: 'UPDATE_ORDER_STATUS',
      details: `Order #${order.orderNumber} status transitioned to [${status}]. Staff: ${staffName}`,
    });

    return updatedOrder || order;
  }

  /**
   * CRUCIAL REQUIREMENT: CHARGE TO ROOM
   * Attaches the restaurant order total and breakdown to the guest's folio in their active stay.
   */
  static async chargeRestaurantOrderToRoom(
    orderId: string,
    roomNumberOrBookingId: string,
    staffName: string = 'Staff'
  ) {
    await this.ensureReady();
    const order: any = await this.getRestaurantOrderById(orderId);
    if (!order) {
      const err = new Error('Restaurant order not found');
      (err as any).statusCode = 404;
      throw err;
    }

    // Find active checked-in booking for this room or booking ID
    const allBookings = await this.getAllBookings();
    let booking = allBookings.find((b: any) => {
      const isMatch =
        String(b._id) === String(roomNumberOrBookingId) ||
        b.bookingNumber === roomNumberOrBookingId ||
        (String(b.roomNumber) === String(roomNumberOrBookingId) && b.status === 'checked_in');
      return isMatch;
    });

    // Fallback: if not found with checked_in, check any matching roomNumber
    if (!booking) {
      booking = allBookings.find(
        (b: any) => String(b.roomNumber) === String(roomNumberOrBookingId)
      );
    }

    if (!booking) {
      const err = new Error(
        `No active check-in or reservation found for Room ${roomNumberOrBookingId}. Cannot charge to room folio.`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    // Create item description
    const itemSummary = order.items
      ? order.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')
      : `Restaurant Dining (${order.orderType})`;

    // Inject into Folio as Food & Beverage charge
    const folio = await this.addFolioItem(String(booking._id), {
      description: `Restaurant Order #${order.orderNumber} [${order.orderType.toUpperCase()}] - ${itemSummary}`,
      category: 'food_beverage',
      quantity: 1,
      unitPrice: order.totalAmount,
      taxAmount: 0, // Total amount already includes calculated tax & service charge
      addedBy: staffName,
    });

    // Update order record
    const updatePayload = {
      chargedToRoom: true,
      paymentStatus: 'charged_to_room',
      paymentMethod: 'room_charge',
      roomNumber: booking.roomNumber || order.roomNumber || roomNumberOrBookingId,
      reservation: booking._id,
      bookingNumber: booking.bookingNumber,
      guest: booking.guest?._id || booking.guest,
      guestName: booking.guestName || order.guestName,
      folio: folio?._id,
      folioNumber: folio?.folioNumber || `FOL-${booking.roomNumber}`,
      updatedAt: new Date(),
    };

    let updatedOrder: any = null;
    if (isMongo()) {
      updatedOrder = await (RestaurantOrder as any).findByIdAndUpdate(orderId, updatePayload, { new: true }).exec();
    } else {
      const idx = InMemoryStore.restaurantOrders.findIndex((o) => String(o._id) === String(orderId));
      if (idx !== -1) {
        InMemoryStore.restaurantOrders[idx] = {
          ...InMemoryStore.restaurantOrders[idx],
          ...updatePayload,
        };
        updatedOrder = InMemoryStore.restaurantOrders[idx];
      }
    }

    // Record Audit Log
    await this.logAction({
      userName: staffName,
      userRole: 'restaurant_staff',
      module: 'restaurant',
      action: 'CHARGE_TO_ROOM',
      details: `Charged Restaurant Order #${order.orderNumber} (${order.totalAmount}) to Room ${booking.roomNumber} (Folio: ${folio?.folioNumber || 'Active Folio'}). Guest: ${booking.guestName}.`,
    });

    return {
      success: true,
      message: `Order #${order.orderNumber} successfully charged to Room ${booking.roomNumber} folio.`,
      order: updatedOrder || order,
      folio,
    };
  }

  static async settleRestaurantOrderPayment(
    orderId: string,
    paymentData: {
      paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'upi' | 'room_charge' | 'other';
      amountPaid?: number;
      staffName?: string;
    }
  ) {
    await this.ensureReady();
    const order: any = await this.getRestaurantOrderById(orderId);
    if (!order) {
      const err = new Error('Restaurant order not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (paymentData.paymentMethod === 'room_charge') {
      return await this.chargeRestaurantOrderToRoom(
        orderId,
        order.roomNumber || '',
        paymentData.staffName || 'Cashier'
      );
    }

    const updatePayload: any = {
      paymentStatus: 'paid',
      paymentMethod: paymentData.paymentMethod,
      updatedAt: new Date(),
    };

    // Release table if occupied
    if (order.tableNumber) {
      const tables = await this.getAllRestaurantTables();
      const table = tables.find((t: any) => t.tableNumber === order.tableNumber);
      if (table) {
        await this.updateRestaurantTableStatus(String(table._id), 'AVAILABLE');
      }
    }

    let updatedOrder: any = null;
    if (isMongo()) {
      updatedOrder = await (RestaurantOrder as any).findByIdAndUpdate(orderId, updatePayload, { new: true }).exec();
    } else {
      const idx = InMemoryStore.restaurantOrders.findIndex((o) => String(o._id) === String(orderId));
      if (idx !== -1) {
        InMemoryStore.restaurantOrders[idx] = {
          ...InMemoryStore.restaurantOrders[idx],
          ...updatePayload,
        };
        updatedOrder = InMemoryStore.restaurantOrders[idx];
      }
    }

    await this.logAction({
      userName: paymentData.staffName || 'Cashier',
      userRole: 'restaurant_staff',
      module: 'restaurant',
      action: 'SETTLE_ORDER_PAYMENT',
      details: `Settled payment for Order #${order.orderNumber} via ${paymentData.paymentMethod.toUpperCase()}. Total: ${order.totalAmount}`,
    });

    return {
      success: true,
      message: `Order #${order.orderNumber} payment settled successfully.`,
      order: updatedOrder || order,
    };
  }

  static async getRestaurantStats() {
    await this.ensureReady();
    const orders = await this.getAllRestaurantOrders();
    const tables = await this.getAllRestaurantTables();
    const menuItems = await this.getAllRestaurantMenuItems();

    const activeOrders = orders.filter((o: any) => ['NEW', 'PREPARING', 'READY'].includes(o.status));
    const servedOrders = orders.filter((o: any) => o.status === 'SERVED');
    const chargedToRoomOrders = orders.filter((o: any) => o.chargedToRoom || o.paymentStatus === 'charged_to_room');

    const totalRevenue = orders
      .filter((o: any) => o.status !== 'CANCELLED' && (o.paymentStatus === 'paid' || o.chargedToRoom))
      .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

    const roomServiceRevenue = chargedToRoomOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

    const occupiedTables = tables.filter((t: any) => t.status === 'OCCUPIED');
    const availableTables = tables.filter((t: any) => t.status === 'AVAILABLE');

    return {
      totalOrders: orders.length,
      activeOrdersCount: activeOrders.length,
      newOrdersCount: orders.filter((o: any) => o.status === 'NEW').length,
      preparingOrdersCount: orders.filter((o: any) => o.status === 'PREPARING').length,
      readyOrdersCount: orders.filter((o: any) => o.status === 'READY').length,
      servedOrdersCount: servedOrders.length,
      cancelledOrdersCount: orders.filter((o: any) => o.status === 'CANCELLED').length,
      chargedToRoomCount: chargedToRoomOrders.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      roomServiceRevenue: Number(roomServiceRevenue.toFixed(2)),
      totalTables: tables.length,
      occupiedTablesCount: occupiedTables.length,
      availableTablesCount: availableTables.length,
      totalMenuItems: menuItems.length,
      availableMenuItems: menuItems.filter((m: any) => m.isAvailable !== false).length,
    };
  }

  // ================= INVENTORY MODULE =================
  static async getAllInventoryItems(category?: string, lowStockOnly?: boolean) {
    await this.ensureReady();
    let items: any[] = [];
    if (isMongo()) {
      const query: any = { isActive: true };
      if (category && category !== 'All') query.category = category;
      items = await (InventoryItem as any).find(query).sort({ category: 1, name: 1 }).exec();
    } else {
      items = [...InMemoryStore.inventoryItems].filter((i: any) => i.isActive !== false);
      if (category && category !== 'All') {
        items = items.filter((i: any) => i.category === category);
      }
    }
    if (lowStockOnly) {
      items = items.filter((i: any) => i.currentStock <= i.minStockLevel);
    }
    return items;
  }

  static async getInventoryItemById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (InventoryItem as any).findById(id).exec();
    }
    return InMemoryStore.inventoryItems.find((i: any) => i._id === id) || null;
  }

  static async createInventoryItem(data: any) {
    await this.ensureReady();
    const itemData = {
      _id: data._id || new mongoose.Types.ObjectId().toString(),
      sku: data.sku || `SKU-${Date.now().toString().slice(-6)}`,
      name: data.name,
      category: data.category,
      unit: data.unit || 'pcs',
      currentStock: Number(data.initialStock || data.currentStock || 0),
      minStockLevel: Number(data.minStockLevel || 10),
      unitCost: Number(data.unitCost || 0),
      storageLocation: data.storageLocation || 'Main Store',
      description: data.description || '',
      supplierId: data.supplierId || '',
      supplierName: data.supplierName || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const created = await (InventoryItem as any).create(itemData);
      // Log initial stock creation if > 0
      if (itemData.currentStock > 0) {
        await (InventoryLog as any).create({
          itemId: created._id.toString(),
          sku: created.sku,
          itemName: created.name,
          category: created.category,
          actionType: 'STOCK_IN',
          quantityChange: created.currentStock,
          previousStock: 0,
          newStock: created.currentStock,
          unitCost: created.unitCost,
          totalCostValue: created.currentStock * created.unitCost,
          reason: 'Initial Stock Creation',
          performedBy: data.performedBy || 'Admin',
          notes: 'Item created in inventory',
        });
      }
      return created;
    }

    InMemoryStore.inventoryItems.unshift(itemData);
    if (itemData.currentStock > 0) {
      InMemoryStore.inventoryLogs.unshift({
        _id: new mongoose.Types.ObjectId().toString(),
        itemId: itemData._id,
        sku: itemData.sku,
        itemName: itemData.name,
        category: itemData.category,
        actionType: 'STOCK_IN',
        quantityChange: itemData.currentStock,
        previousStock: 0,
        newStock: itemData.currentStock,
        unitCost: itemData.unitCost,
        totalCostValue: itemData.currentStock * itemData.unitCost,
        reason: 'Initial Stock Creation',
        performedBy: data.performedBy || 'Admin',
        notes: 'Item created in inventory',
        createdAt: new Date(),
      });
    }
    return itemData;
  }

  static async updateInventoryItem(id: string, updates: any) {
    await this.ensureReady();
    if (isMongo()) {
      return await (InventoryItem as any).findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).exec();
    }
    const idx = InMemoryStore.inventoryItems.findIndex((i: any) => i._id === id);
    if (idx !== -1) {
      InMemoryStore.inventoryItems[idx] = {
        ...InMemoryStore.inventoryItems[idx],
        ...updates,
        updatedAt: new Date(),
      };
      return InMemoryStore.inventoryItems[idx];
    }
    return null;
  }

  static async deleteInventoryItem(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (InventoryItem as any).findByIdAndUpdate(id, { isActive: false, updatedAt: new Date() }).exec();
    }
    const idx = InMemoryStore.inventoryItems.findIndex((i: any) => i._id === id);
    if (idx !== -1) {
      InMemoryStore.inventoryItems[idx].isActive = false;
      return true;
    }
    return false;
  }

  static async performStockAction(params: {
    itemId: string;
    actionType: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'WASTAGE' | 'DAMAGED';
    quantity: number;
    reason?: string;
    referenceNumber?: string;
    performedBy?: string;
    notes?: string;
  }) {
    await this.ensureReady();
    const item = await this.getInventoryItemById(params.itemId);
    if (!item) throw new Error('Inventory item not found');

    const previousStock = Number(item.currentStock || 0);
    let quantityChange = 0;
    let newStock = previousStock;

    if (params.actionType === 'STOCK_IN') {
      quantityChange = Math.abs(params.quantity);
      newStock = previousStock + quantityChange;
    } else if (params.actionType === 'STOCK_OUT' || params.actionType === 'WASTAGE' || params.actionType === 'DAMAGED') {
      quantityChange = -Math.abs(params.quantity);
      newStock = Math.max(0, previousStock + quantityChange);
    } else if (params.actionType === 'ADJUSTMENT') {
      newStock = Math.max(0, Number(params.quantity));
      quantityChange = newStock - previousStock;
    }

    const logData = {
      _id: new mongoose.Types.ObjectId().toString(),
      itemId: item._id.toString(),
      sku: item.sku,
      itemName: item.name,
      category: item.category,
      actionType: params.actionType,
      quantityChange,
      previousStock,
      newStock,
      unitCost: item.unitCost || 0,
      totalCostValue: Math.abs(quantityChange) * (item.unitCost || 0),
      reason: params.reason || '',
      referenceNumber: params.referenceNumber || '',
      performedBy: params.performedBy || 'Admin Staff',
      notes: params.notes || '',
      createdAt: new Date(),
    };

    if (isMongo()) {
      await (InventoryItem as any).findByIdAndUpdate(params.itemId, {
        currentStock: newStock,
        lastRestockedAt: params.actionType === 'STOCK_IN' ? new Date() : item.lastRestockedAt,
        updatedAt: new Date(),
      }).exec();
      const createdLog = await (InventoryLog as any).create(logData);
      return { item: await this.getInventoryItemById(params.itemId), log: createdLog };
    }

    item.currentStock = newStock;
    if (params.actionType === 'STOCK_IN') item.lastRestockedAt = new Date();
    item.updatedAt = new Date();
    InMemoryStore.inventoryLogs.unshift(logData);

    return { item, log: logData };
  }

  static async getInventoryLogs(itemId?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (itemId) query.itemId = itemId;
      return await (InventoryLog as any).find(query).sort({ createdAt: -1 }).limit(100).exec();
    }
    let logs = [...InMemoryStore.inventoryLogs];
    if (itemId) {
      logs = logs.filter((l: any) => l.itemId === itemId);
    }
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ================= SUPPLIER MODULE =================
  static async getAllSuppliers() {
    await this.ensureReady();
    if (isMongo()) {
      return await (Supplier as any).find({ isActive: true }).sort({ name: 1 }).exec();
    }
    return InMemoryStore.suppliers.filter((s: any) => s.isActive !== false);
  }

  static async getSupplierById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Supplier as any).findById(id).exec();
    }
    return InMemoryStore.suppliers.find((s: any) => s._id === id) || null;
  }

  static async createSupplier(data: any) {
    await this.ensureReady();
    const supplierData = {
      _id: data._id || new mongoose.Types.ObjectId().toString(),
      supplierCode: data.supplierCode || `SUP-${Date.now().toString().slice(-5)}`,
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city || '',
      taxId: data.taxId || '',
      categoriesSupplied: data.categoriesSupplied || [],
      paymentTerms: data.paymentTerms || 'Net 30',
      rating: Number(data.rating || 5),
      totalOrders: 0,
      totalSpent: 0,
      outstandingBalance: 0,
      isActive: true,
      notes: data.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      return await (Supplier as any).create(supplierData);
    }

    InMemoryStore.suppliers.unshift(supplierData);
    return supplierData;
  }

  static async updateSupplier(id: string, updates: any) {
    await this.ensureReady();
    if (isMongo()) {
      return await (Supplier as any).findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).exec();
    }
    const idx = InMemoryStore.suppliers.findIndex((s: any) => s._id === id);
    if (idx !== -1) {
      InMemoryStore.suppliers[idx] = {
        ...InMemoryStore.suppliers[idx],
        ...updates,
        updatedAt: new Date(),
      };
      return InMemoryStore.suppliers[idx];
    }
    return null;
  }

  static async getSupplierHistory(supplierId: string) {
    await this.ensureReady();
    const pos = await this.getAllPurchaseOrders(supplierId);
    let payments: any[] = [];
    if (isMongo()) {
      payments = await (SupplierPayment as any).find({ supplierId }).sort({ createdAt: -1 }).exec();
    } else {
      payments = InMemoryStore.supplierPayments.filter((p: any) => p.supplierId === supplierId);
    }
    return { purchaseOrders: pos, payments };
  }

  // ================= PURCHASING MODULE =================
  static async getAllPurchaseOrders(supplierId?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (supplierId) query.supplierId = supplierId;
      return await (PurchaseOrder as any).find(query).sort({ createdAt: -1 }).exec();
    }
    let pos = [...InMemoryStore.purchaseOrders];
    if (supplierId) {
      pos = pos.filter((p: any) => p.supplierId === supplierId);
    }
    return pos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async getPurchaseOrderById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (PurchaseOrder as any).findById(id).exec();
    }
    return InMemoryStore.purchaseOrders.find((p: any) => p._id === id) || null;
  }

  static async createPurchaseOrder(data: any) {
    await this.ensureReady();
    const supplier = await this.getSupplierById(data.supplierId);
    if (!supplier) throw new Error('Selected supplier not found');

    const poNumber = data.poNumber || `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const items = (data.items || []).map((it: any) => ({
      itemId: it.itemId || '',
      sku: it.sku || 'SKU-GEN',
      name: it.name,
      category: it.category || 'Other hotel supplies',
      unit: it.unit || 'pcs',
      quantityOrdered: Number(it.quantityOrdered || 1),
      quantityReceived: 0,
      unitCost: Number(it.unitCost || 0),
      taxRate: Number(it.taxRate || 5),
      totalAmount: Number(it.quantityOrdered || 1) * Number(it.unitCost || 0) * 1.05,
    }));

    const subtotal = items.reduce((sum: number, it: any) => sum + (it.quantityOrdered * it.unitCost), 0);
    const taxAmount = subtotal * 0.05;
    const shippingCost = Number(data.shippingCost || 0);
    const totalAmount = Number((subtotal + taxAmount + shippingCost).toFixed(2));

    const poData = {
      _id: data._id || new mongoose.Types.ObjectId().toString(),
      poNumber,
      supplierId: supplier._id.toString(),
      supplierName: supplier.name,
      orderDate: new Date(),
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : new Date(Date.now() + 7 * 86400000),
      status: 'SENT',
      paymentStatus: 'UNPAID',
      items,
      subtotal,
      taxAmount,
      shippingCost,
      totalAmount,
      paidAmount: 0,
      balanceDue: totalAmount,
      createdByName: data.createdByName || 'Admin',
      notes: data.notes || '',
      invoiceNumber: data.invoiceNumber || `INV-${poNumber}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      const created = await (PurchaseOrder as any).create(poData);
      // Update supplier order count & outstanding balance
      await (Supplier as any).findByIdAndUpdate(supplier._id, {
        $inc: { totalOrders: 1, totalSpent: totalAmount, outstandingBalance: totalAmount },
      }).exec();
      return created;
    }

    InMemoryStore.purchaseOrders.unshift(poData);
    supplier.totalOrders = (supplier.totalOrders || 0) + 1;
    supplier.totalSpent = (supplier.totalSpent || 0) + totalAmount;
    supplier.outstandingBalance = (supplier.outstandingBalance || 0) + totalAmount;
    return poData;
  }

  // CORE AUTOMATION: Receive Stock on Purchase Order -> Increases Inventory Stock Level
  static async receivePurchaseOrderStock(params: {
    poId: string;
    receivedItems: Array<{ sku: string; quantityReceivedNow: number }>;
    receivedByName?: string;
    notes?: string;
  }) {
    await this.ensureReady();
    const po = await this.getPurchaseOrderById(params.poId);
    if (!po) throw new Error('Purchase Order not found');

    let allFulfilled = true;
    let anyReceived = false;

    for (const recv of params.receivedItems) {
      const lineItem = po.items.find((it: any) => it.sku === recv.sku);
      if (lineItem && recv.quantityReceivedNow > 0) {
        anyReceived = true;
        const nowQty = Number(recv.quantityReceivedNow);
        lineItem.quantityReceived = Number(lineItem.quantityReceived || 0) + nowQty;

        // Find inventory item by SKU or create if missing
        let invItems = await this.getAllInventoryItems('All');
        let invItem = invItems.find((i: any) => i.sku === lineItem.sku);

        if (!invItem) {
          // Auto-create inventory item if not pre-existing
          invItem = await this.createInventoryItem({
            sku: lineItem.sku,
            name: lineItem.name,
            category: lineItem.category,
            unit: lineItem.unit,
            initialStock: 0,
            unitCost: lineItem.unitCost,
            supplierId: po.supplierId,
            supplierName: po.supplierName,
          });
        }

        // Perform Stock In transaction -> Real-time Inventory Increase!
        await this.performStockAction({
          itemId: invItem._id.toString(),
          actionType: 'STOCK_IN',
          quantity: nowQty,
          reason: `Received PO ${po.poNumber}`,
          referenceNumber: po.poNumber,
          performedBy: (params as any).performedBy || params.receivedByName || 'Admin Staff',
          notes: params.notes || `Stock received from supplier ${po.supplierName}`,
        });
      }

      if (lineItem && lineItem.quantityReceived < lineItem.quantityOrdered) {
        allFulfilled = false;
      }
    }

    const newStatus = allFulfilled ? 'RECEIVED' : (anyReceived ? 'PARTIAL' : po.status);
    const updates = {
      items: po.items,
      status: newStatus,
      actualDeliveryDate: new Date(),
      updatedAt: new Date(),
    };

    if (isMongo()) {
      return await (PurchaseOrder as any).findByIdAndUpdate(params.poId, updates, { new: true }).exec();
    }

    const idx = InMemoryStore.purchaseOrders.findIndex((p: any) => p._id === params.poId);
    if (idx !== -1) {
      InMemoryStore.purchaseOrders[idx] = { ...InMemoryStore.purchaseOrders[idx], ...updates };
      return InMemoryStore.purchaseOrders[idx];
    }
    return po;
  }

  // Purchase Return -> Decreases Inventory Stock Level
  static async processPurchaseReturn(params: {
    poId: string;
    returnedItems: Array<{ sku: string; quantityReturned: number; reason?: string }>;
    performedBy?: string;
    notes?: string;
  }) {
    await this.ensureReady();
    const po = await this.getPurchaseOrderById(params.poId);
    if (!po) throw new Error('Purchase Order not found');

    let totalReturnCredit = 0;

    for (const ret of params.returnedItems) {
      const lineItem = po.items.find((it: any) => it.sku === ret.sku);
      if (lineItem && ret.quantityReturned > 0) {
        const qtyRet = Number(ret.quantityReturned);
        const creditAmount = qtyRet * lineItem.unitCost * 1.05;
        totalReturnCredit += creditAmount;

        let invItems = await this.getAllInventoryItems('All');
        let invItem = invItems.find((i: any) => i.sku === lineItem.sku);

        if (invItem) {
          // Perform Stock Out transaction -> Real-time Inventory Decrease!
          await this.performStockAction({
            itemId: invItem._id.toString(),
            actionType: 'STOCK_OUT',
            quantity: qtyRet,
            reason: `Purchase Return for PO ${po.poNumber}: ${ret.reason || 'Defective/Incorrect Item'}`,
            referenceNumber: `RET-${po.poNumber}`,
            performedBy: params.performedBy || 'Admin Staff',
            notes: params.notes || `Returned to supplier ${po.supplierName}`,
          });
        }
      }
    }

    // Record Supplier Return Credit Payment
    if (totalReturnCredit > 0) {
      await this.recordSupplierPayment({
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        poId: po._id.toString(),
        poNumber: po.poNumber,
        paymentType: 'RETURN_CREDIT',
        amount: totalReturnCredit,
        paymentMethod: 'bank_transfer',
        referenceNumber: `CREDIT-${po.poNumber}`,
        recordedByName: params.performedBy || 'Admin',
        notes: `Credit adjustment for returned goods on PO ${po.poNumber}`,
      });
    }

    return await this.getPurchaseOrderById(params.poId);
  }

  // Supplier Payment Settlement
  static async recordSupplierPayment(params: {
    supplierId: string;
    supplierName?: string;
    poId?: string;
    poNumber?: string;
    paymentType?: 'PAYMENT' | 'RETURN_CREDIT';
    amount: number;
    paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'credit_card';
    referenceNumber?: string;
    recordedByName?: string;
    notes?: string;
  }) {
    await this.ensureReady();
    const supplier = await this.getSupplierById(params.supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;
    const amount = Number(params.amount);

    const paymentData = {
      _id: new mongoose.Types.ObjectId().toString(),
      paymentNumber,
      supplierId: supplier._id.toString(),
      supplierName: supplier.name,
      poId: params.poId || '',
      poNumber: params.poNumber || '',
      paymentType: params.paymentType || 'PAYMENT',
      amount,
      paymentMethod: params.paymentMethod || 'bank_transfer',
      paymentDate: new Date(),
      referenceNumber: params.referenceNumber || '',
      recordedByName: params.recordedByName || 'Admin',
      notes: params.notes || '',
      createdAt: new Date(),
    };

    // Update Supplier Balance
    const newBalance = Math.max(0, Number(supplier.outstandingBalance || 0) - amount);

    if (isMongo()) {
      await (Supplier as any).findByIdAndUpdate(supplier._id, { outstandingBalance: newBalance }).exec();
      if (params.poId) {
        const po = await this.getPurchaseOrderById(params.poId);
        if (po) {
          const newPaid = Number(po.paidAmount || 0) + amount;
          const newDue = Math.max(0, Number(po.totalAmount) - newPaid);
          const pStatus = newDue === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
          await (PurchaseOrder as any).findByIdAndUpdate(params.poId, {
            paidAmount: newPaid,
            balanceDue: newDue,
            paymentStatus: pStatus,
          }).exec();
        }
      }
      return await (SupplierPayment as any).create(paymentData);
    }

    supplier.outstandingBalance = newBalance;
    if (params.poId) {
      const po = InMemoryStore.purchaseOrders.find((p: any) => p._id === params.poId);
      if (po) {
        po.paidAmount = Number(po.paidAmount || 0) + amount;
        po.balanceDue = Math.max(0, Number(po.totalAmount) - po.paidAmount);
        po.paymentStatus = po.balanceDue === 0 ? 'PAID' : (po.paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
      }
    }
    InMemoryStore.supplierPayments.unshift(paymentData);
    return paymentData;
  }

  static async getInventoryStats() {
    await this.ensureReady();
    const items = await this.getAllInventoryItems('All');
    const suppliers = await this.getAllSuppliers();
    const pos = await this.getAllPurchaseOrders();

    const lowStockItemsCount = items.filter((i: any) => i.currentStock <= i.minStockLevel).length;
    const categoriesSet = new Set(items.map((i: any) => i.category));
    const totalInventoryValue = items.reduce((sum: number, i: any) => sum + (i.currentStock * i.unitCost), 0);
    const activePurchaseOrdersCount = pos.filter((p: any) => p.status === 'SENT' || p.status === 'PARTIAL').length;
    const pendingReceivingCount = pos.filter((p: any) => p.status !== 'RECEIVED' && p.status !== 'CANCELLED').length;
    const totalOutstandingSupplierBalance = suppliers.reduce((sum: number, s: any) => sum + Number(s.outstandingBalance || 0), 0);

    return {
      totalItems: items.length,
      lowStockItemsCount,
      totalCategoriesCount: categoriesSet.size,
      totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
      totalSuppliersCount: suppliers.length,
      activePurchaseOrdersCount,
      pendingReceivingCount,
      totalOutstandingSupplierBalance: Number(totalOutstandingSupplierBalance.toFixed(2)),
    };
  }

  // ================= EMPLOYEES =================
  static async getAllEmployees(filterDepartment?: string, filterStatus?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (filterDepartment && filterDepartment !== 'All') query.department = filterDepartment;
      if (filterStatus && filterStatus !== 'All') query.status = filterStatus;
      return await (EmployeeModel as any).find(query).sort({ createdAt: -1 }).exec();
    }
    let emps = [...(InMemoryStore.employees || [])];
    if (filterDepartment && filterDepartment !== 'All') {
      emps = emps.filter((e) => e.department === filterDepartment);
    }
    if (filterStatus && filterStatus !== 'All') {
      emps = emps.filter((e) => e.status === filterStatus);
    }
    return emps;
  }

  static async getEmployeeById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (EmployeeModel as any).findById(id).exec();
    }
    return (InMemoryStore.employees || []).find((e: any) => e._id === id || e.employeeId === id) || null;
  }

  static async findEmployeeByEmail(email: string) {
    await this.ensureReady();
    if (!email) return null;
    if (isMongo()) {
      return await (EmployeeModel as any).findOne({ email: email.toLowerCase().trim() }).exec();
    }
    return (InMemoryStore.employees || []).find((e: any) => e.email?.toLowerCase() === email.toLowerCase().trim()) || null;
  }

  static async createEmployee(data: any) {
    await this.ensureReady();
    const { _id, ...cleanData } = data;
    const empData: any = {
      employeeId: cleanData.employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      joiningDate: cleanData.joiningDate ? new Date(cleanData.joiningDate) : new Date(),
      status: cleanData.status || 'Active',
      shift: cleanData.shift || 'General (09:00 - 17:00)',
      salary: Number(cleanData.salary) || 0,
      emergencyContact: cleanData.emergencyContact || { name: '', phone: '', relationship: '' },
      ...cleanData,
    };

    let created: any = null;
    if (isMongo()) {
      const doc = new EmployeeModel(empData);
      const saved = await doc.save();
      created = saved.toObject ? saved.toObject() : saved;
    } else {
      created = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...empData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    InMemoryStore.employees = InMemoryStore.employees || [];
    const idx = InMemoryStore.employees.findIndex((e: any) => String(e._id) === String(created._id) || e.employeeId === created.employeeId);
    if (idx === -1) {
      InMemoryStore.employees.unshift(created);
    } else {
      InMemoryStore.employees[idx] = created;
    }
    return created;
  }

  static async updateEmployee(id: string, updatePayload: any) {
    await this.ensureReady();
    let updated: any = null;
    if (isMongo()) {
      try {
        let queryFilter: any = { _id: id };
        if (!mongoose.Types.ObjectId.isValid(id)) {
          queryFilter = { $or: [{ _id: id }, { employeeId: id }] };
          if (updatePayload.email) queryFilter.$or.push({ email: updatePayload.email.toLowerCase().trim() });
        }
        updated = await (EmployeeModel as any).findOneAndUpdate(queryFilter, updatePayload, { new: true }).exec();
      } catch (err: any) {
        console.error('[StorageService] Error updating employee in Mongo:', err.message);
      }
    }
    const idx = (InMemoryStore.employees || []).findIndex((e: any) => e._id === id || e.employeeId === id);
    if (idx !== -1) {
      InMemoryStore.employees[idx] = {
        ...InMemoryStore.employees[idx],
        ...updatePayload,
        updatedAt: new Date(),
      };
      if (!updated) updated = InMemoryStore.employees[idx];
    }
    return updated;
  }

  static async deleteEmployee(id: string) {
    await this.ensureReady();
    let emp: any = null;
    if (isMongo()) {
      emp = await (EmployeeModel as any).findByIdAndDelete(id).exec();
      if (!emp) {
        emp = await (EmployeeModel as any).findOneAndDelete({ employeeId: id }).exec();
      }
    } else {
      const idx = (InMemoryStore.employees || []).findIndex((e: any) => e._id === id || e.employeeId === id);
      if (idx !== -1) {
        emp = InMemoryStore.employees.splice(idx, 1)[0];
      }
    }
    if (emp && emp.email) {
      await this.deleteUserByEmail(emp.email);
    }
    return true;
  }

  // ================= ATTENDANCE =================
  static async getAllAttendance(dateStr?: string, department?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (department && department !== 'All') query.department = department;
      if (dateStr) {
        const d = new Date(dateStr);
        const start = new Date(d.setHours(0, 0, 0, 0));
        const end = new Date(d.setHours(23, 59, 59, 999));
        query.date = { $gte: start, $lte: end };
      }
      return await (AttendanceModel as any).find(query).sort({ date: -1 }).exec();
    }
    let list = [...(InMemoryStore.attendance || [])];
    if (department && department !== 'All') {
      list = list.filter((a) => a.department === department);
    }
    return list;
  }

  static async recordAttendance(data: any) {
    await this.ensureReady();
    const attData = {
      _id: new mongoose.Types.ObjectId().toString(),
      date: data.date ? new Date(data.date) : new Date(),
      status: data.status || 'Present',
      overtimeHours: Number(data.overtimeHours) || 0,
      checkInTime: data.checkInTime || '09:00 AM',
      checkOutTime: data.checkOutTime || '05:00 PM',
      notes: data.notes || '',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (data._id && !mongoose.Types.ObjectId.isValid(data._id)) {
      attData._id = new mongoose.Types.ObjectId().toString();
    }

    if (isMongo()) {
      return await (AttendanceModel as any).create(attData);
    }

    InMemoryStore.attendance = InMemoryStore.attendance || [];
    InMemoryStore.attendance.unshift(attData);
    return attData;
  }

  // ================= LEAVES =================
  static async getAllLeaves(statusFilter?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (statusFilter && statusFilter !== 'All') query.status = statusFilter;
      return await (EmployeeLeaveModel as any).find(query).sort({ createdAt: -1 }).exec();
    }
    let list = [...(InMemoryStore.leaves || [])];
    if (statusFilter && statusFilter !== 'All') {
      list = list.filter((l) => l.status === statusFilter);
    }
    return list;
  }

  static async requestLeave(data: any) {
    await this.ensureReady();
    const leaveData = {
      _id: new mongoose.Types.ObjectId().toString(),
      leaveCode: data.leaveCode || `LV-${Math.floor(1000 + Math.random() * 9000)}`,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      totalDays: Number(data.totalDays) || 1,
      status: 'Pending',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (data._id && !mongoose.Types.ObjectId.isValid(data._id)) {
      leaveData._id = new mongoose.Types.ObjectId().toString();
    }

    if (isMongo()) {
      return await (EmployeeLeaveModel as any).create(leaveData);
    }

    InMemoryStore.leaves = InMemoryStore.leaves || [];
    InMemoryStore.leaves.unshift(leaveData);
    return leaveData;
  }

  static async updateLeaveStatus(id: string, status: 'Approved' | 'Rejected', approvedBy: string) {
    await this.ensureReady();
    if (isMongo()) {
      return await (EmployeeLeaveModel as any).findByIdAndUpdate(id, { status, approvedBy }, { new: true }).exec();
    }
    const idx = (InMemoryStore.leaves || []).findIndex((l: any) => l._id === id);
    if (idx !== -1) {
      InMemoryStore.leaves[idx].status = status;
      InMemoryStore.leaves[idx].approvedBy = approvedBy;
      InMemoryStore.leaves[idx].updatedAt = new Date();
      return InMemoryStore.leaves[idx];
    }
    return null;
  }

  // ================= EXPENSES =================
  static async getAllExpenses(categoryFilter?: string) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (categoryFilter && categoryFilter !== 'All') query.category = categoryFilter;
      return await (ExpenseModel as any).find(query).sort({ expenseDate: -1 }).exec();
    }
    let exps = [...(InMemoryStore.expenses || [])];
    if (categoryFilter && categoryFilter !== 'All') {
      exps = exps.filter((e) => e.category === categoryFilter);
    }
    return exps;
  }

  static async createExpense(data: any) {
    await this.ensureReady();
    const { _id, ...cleanData } = data;
    const expData = {
      expenseNumber: cleanData.expenseNumber || `EXP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      expenseDate: cleanData.expenseDate ? new Date(cleanData.expenseDate) : new Date(),
      amount: Number(cleanData.amount) || 0,
      paymentMethod: cleanData.paymentMethod || 'Bank Transfer',
      createdBy: cleanData.createdBy || 'Admin Staff',
      status: cleanData.status || 'Paid',
      ...cleanData,
    };

    if (isMongo()) {
      const doc = new ExpenseModel(expData);
      const saved = await doc.save();
      const created = saved.toObject ? saved.toObject() : saved;
      InMemoryStore.expenses = InMemoryStore.expenses || [];
      InMemoryStore.expenses.unshift(created);
      return created;
    }

    const newExp = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...expData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    InMemoryStore.expenses = InMemoryStore.expenses || [];
    InMemoryStore.expenses.unshift(newExp);
    return newExp;
  }

  static async deleteExpense(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      await (ExpenseModel as any).findByIdAndDelete(id).exec();
      return true;
    }
    InMemoryStore.expenses = (InMemoryStore.expenses || []).filter((e: any) => e._id !== id);
    return true;
  }

  // ================= CENTRALIZED FINANCIAL ENGINE =================
  static async calculateFinancialSummary() {
    await this.ensureReady();

    // 1. Gather Revenues
    const bookings = await this.getAllBookings();
    const folios = await this.getAllFolios();
    const posOrders = await this.getAllRestaurantOrders();
    const serviceReqs = await this.getAllGuestServiceRequests();

    // Room Revenue
    const roomRevenue = bookings.reduce((sum: number, b: any) => sum + Number(b.paidAmount || b.totalAmount || 0), 0);

    // Restaurant Revenue
    const restaurantRevenue = posOrders
      .filter((o: any) => o.paymentStatus === 'PAID')
      .reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);

    // Service Revenue (Laundry, Spa, Concierge, Room Service)
    const serviceRevenue = serviceReqs
      .filter((s: any) => s.paymentStatus === 'PAID' || s.status === 'COMPLETED')
      .reduce((sum: number, s: any) => sum + Number(s.price || s.totalAmount || 0), 0);

    const totalRevenue = roomRevenue + restaurantRevenue + serviceRevenue;

    // 2. Gather Expenses
    const expenses = await this.getAllExpenses('All');
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    // Expense Breakdown by Category
    const expenseBreakdown: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const cat = e.category || 'Other';
      expenseBreakdown[cat] = (expenseBreakdown[cat] || 0) + Number(e.amount || 0);
    });

    // 3. Supplier Payments & Balances
    const suppliers = await this.getAllSuppliers();
    const pos = await this.getAllPurchaseOrders();

    const supplierOutstandingBalance = suppliers.reduce((sum: number, s: any) => sum + Number(s.outstandingBalance || 0), 0);

    // Guest Unpaid Balances
    const guestOutstandingBalance = folios
      .filter((f: any) => f.status === 'OPEN')
      .reduce((sum: number, f: any) => sum + Math.max(0, Number(f.balance || 0)), 0);

    const totalOutstandingBalance = supplierOutstandingBalance + guestOutstandingBalance;

    // 4. Net Profit / Loss Calculation
    const netProfitOrLoss = totalRevenue - totalExpenses;

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      roomRevenue: Number(roomRevenue.toFixed(2)),
      restaurantRevenue: Number(restaurantRevenue.toFixed(2)),
      serviceRevenue: Number(serviceRevenue.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      expenseBreakdown,
      supplierOutstandingBalance: Number(supplierOutstandingBalance.toFixed(2)),
      guestOutstandingBalance: Number(guestOutstandingBalance.toFixed(2)),
      totalOutstandingBalance: Number(totalOutstandingBalance.toFixed(2)),
      netProfitOrLoss: Number(netProfitOrLoss.toFixed(2)),
      isProfitable: netProfitOrLoss >= 0,
      totalExpensesCount: expenses.length,
      activeBookingsCount: bookings.length,
      completedOrdersCount: posOrders.length,
    };
  }

  // ================= SYSTEM SETTINGS =================
  static async getSystemSettings() {
    await this.ensureReady();
    if (isMongo()) {
      let settings = await (SystemSettingsModel as any).findOne().exec();
      if (!settings) {
        settings = await (SystemSettingsModel as any).create({});
      }
      return settings;
    }

    if (!InMemoryStore.systemSettings) {
      InMemoryStore.systemSettings = {
        hotelInfo: {
          name: 'Aethelgard Luxury Resort & Sanctuary',
          tagline: 'Premium Hotel Operations & Guest Experience Platform',
          email: 't02407446@gmail.com',
          phone: '+1 (555) 789-0000',
          address: '100 Ocean Promenade, Suite 500',
          city: 'Miami Beach, FL',
          country: 'United States',
          website: 'https://grandhorizonhotel.com',
          logoUrl: '',
          checkInTime: '14:00',
          checkOutTime: '11:00',
        },
        taxSettings: {
          taxName: 'VAT / Occupancy Tax',
          taxRate: 10,
          taxRegistrationNumber: 'TAX-99887766-US',
          isTaxInclusive: false,
        },
        currency: {
          code: 'USD',
          symbol: '$',
          name: 'US Dollar',
        },
        invoiceSettings: {
          invoicePrefix: 'INV-2026-',
          termsAndConditions: 'Payment is due upon invoice receipt. Thank you for staying with Grand Horizon Hotel.',
          footerNotes: 'Grand Horizon Hotel & Resort - Customer Support: support@grandhorizonhotel.com',
          showLogo: true,
        },
        roomSettings: {
          defaultCheckoutStatus: 'cleaning',
          earlyCheckInFeePerHour: 25,
          lateCheckOutFeePerHour: 35,
          autoReleaseReservedMinutes: 120,
        },
        userSettings: {
          allowSelfRegistration: false,
          sessionTimeoutMinutes: 120,
          requireTwoFactor: false,
        },
        systemPreferences: {
          theme: 'dark',
          dateFormat: 'YYYY-MM-DD',
          autoSeedFallback: true,
          enableEmailNotifications: true,
        },
      };
    }
    return InMemoryStore.systemSettings;
  }

  static async updateSystemSettings(updatePayload: any) {
    await this.ensureReady();
    if (isMongo()) {
      let settings = await (SystemSettingsModel as any).findOne().exec();
      if (!settings) {
        return await (SystemSettingsModel as any).create(updatePayload);
      }
      return await (SystemSettingsModel as any).findByIdAndUpdate(settings._id, updatePayload, { new: true }).exec();
    }

    const current = await this.getSystemSettings();
    InMemoryStore.systemSettings = {
      ...current,
      ...updatePayload,
      updatedAt: new Date(),
    };
    return InMemoryStore.systemSettings;
  }

  // ================= MISSING REPORT HELPERS =================
  static async getAllFolios() {
    await this.ensureReady();
    if (isMongo()) {
      return await (Folio as any).find().sort({ createdAt: -1 }).exec();
    }
    return InMemoryStore.folios || [];
  }

  static async getAllGuestServiceRequests() {
    await this.ensureReady();
    if (isMongo()) {
      return await (GuestServiceRequest as any).find().sort({ createdAt: -1 }).exec();
    }
    return (InMemoryStore as any).guestServices || [];
  }

  static async getAllInventoryLogs() {
    await this.ensureReady();
    if (isMongo()) {
      return await (InventoryLog as any).find().sort({ createdAt: -1 }).exec();
    }
    return (InMemoryStore as any).inventoryLogs || [];
  }

  static async getAllMaintenanceRequests() {
    await this.ensureReady();
    if (isMongo()) {
      return await (MaintenanceRequest as any).find().sort({ createdAt: -1 }).exec();
    }
    return (InMemoryStore as any).maintenanceRequests || [];
  }

  // ================= CONTACT INQUIRIES & WEBSITE LEADS =================
  static async createContactInquiry(inquiryData: Partial<IContactInquiry> | any) {
    await this.ensureReady();
    const ticketId = inquiryData.ticketId || `INQ-${Math.floor(100000 + Math.random() * 900000)}`;

    const payload: any = {
      ticketId,
      name: inquiryData.name?.trim(),
      email: inquiryData.email?.toLowerCase().trim(),
      phone: inquiryData.phone?.trim() || '',
      subject: inquiryData.subject?.trim() || 'General Sanctuary Inquiry',
      message: inquiryData.message?.trim(),
      travelDates: inquiryData.travelDates?.trim() || '',
      status: inquiryData.status || 'new',
      priority: inquiryData.priority || 'normal',
      source: inquiryData.source || 'website',
      staffNotes: inquiryData.staffNotes || '',
      responseMessage: inquiryData.responseMessage || '',
      ipAddress: inquiryData.ipAddress || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let resultObj: any = null;
    if (isMongo()) {
      try {
        const item = new ContactInquiry(payload);
        const saved = await item.save();
        resultObj = saved.toObject ? saved.toObject() : saved;
      } catch (err: any) {
        console.warn('[StorageService] Error saving ContactInquiry to Mongo:', err.message);
      }
    }

    if (!resultObj) {
      resultObj = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...payload,
      };
    }

    (InMemoryStore as any).contactInquiries = (InMemoryStore as any).contactInquiries || [];
    (InMemoryStore as any).contactInquiries.unshift(resultObj);

    return resultObj;
  }

  static async getAllContactInquiries(filters?: { status?: string; search?: string }) {
    await this.ensureReady();
    if (isMongo()) {
      const query: any = {};
      if (filters?.status && filters.status !== 'all') {
        query.status = filters.status;
      }
      if (filters?.search) {
        const regex = new RegExp(filters.search.trim(), 'i');
        query.$or = [
          { name: regex },
          { email: regex },
          { phone: regex },
          { ticketId: regex },
          { subject: regex },
          { message: regex },
        ];
      }
      const mongoResults = await (ContactInquiry as any).find(query).sort({ createdAt: -1 }).lean().exec();

      // Check if any in-memory items need to be merged / persisted to Mongo
      const inMemoryList = (InMemoryStore as any).contactInquiries || [];
      if (inMemoryList.length > 0) {
        const existingKeys = new Set(mongoResults.map((m: any) => m.ticketId || m._id?.toString()));
        for (const item of inMemoryList) {
          if (!existingKeys.has(item.ticketId) && !existingKeys.has(item._id?.toString())) {
            try {
              const { _id, ...rest } = item;
              const saved = await new ContactInquiry(rest).save();
              mongoResults.unshift(saved.toObject ? saved.toObject() : saved);
            } catch (e) {
              mongoResults.unshift(item);
            }
          }
        }
      }

      return mongoResults;
    }

    let list = (InMemoryStore as any).contactInquiries || [];
    if (filters?.status && filters.status !== 'all') {
      list = list.filter((item: any) => item.status === filters.status);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(
        (item: any) =>
          item.name?.toLowerCase().includes(s) ||
          item.email?.toLowerCase().includes(s) ||
          item.phone?.toLowerCase().includes(s) ||
          item.ticketId?.toLowerCase().includes(s) ||
          item.subject?.toLowerCase().includes(s) ||
          item.message?.toLowerCase().includes(s)
      );
    }
    return list;
  }

  static async getContactInquiryById(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        return await (ContactInquiry as any).findById(id).exec();
      }
      return await (ContactInquiry as any).findOne({ ticketId: id }).exec();
    }
    return ((InMemoryStore as any).contactInquiries || []).find(
      (item: any) => item._id === id || item.ticketId === id
    );
  }

  static async updateContactInquiry(id: string, updateData: any) {
    await this.ensureReady();
    const updatePayload = {
      ...updateData,
      updatedAt: new Date(),
    };

    if (isMongo()) {
      let updated: any = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        updated = await (ContactInquiry as any).findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).exec();
      } else {
        updated = await (ContactInquiry as any).findOneAndUpdate({ ticketId: id }, { $set: updatePayload }, { new: true }).exec();
      }
      if (updated) {
        return updated.toObject ? updated.toObject() : updated;
      }
    }

    (InMemoryStore as any).contactInquiries = (InMemoryStore as any).contactInquiries || [];
    const idx = (InMemoryStore as any).contactInquiries.findIndex(
      (item: any) => item._id === id || item.ticketId === id
    );
    if (idx !== -1) {
      (InMemoryStore as any).contactInquiries[idx] = {
        ...(InMemoryStore as any).contactInquiries[idx],
        ...updatePayload,
      };
      return (InMemoryStore as any).contactInquiries[idx];
    }
    return null;
  }

  static async deleteContactInquiry(id: string) {
    await this.ensureReady();
    if (isMongo()) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        await (ContactInquiry as any).findByIdAndDelete(id).exec();
      } else {
        await (ContactInquiry as any).findOneAndDelete({ ticketId: id }).exec();
      }
    }
    (InMemoryStore as any).contactInquiries = ((InMemoryStore as any).contactInquiries || []).filter(
      (item: any) => item._id !== id && item.ticketId !== id
    );
    return true;
  }
}

