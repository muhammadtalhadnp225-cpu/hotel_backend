import mongoose, { Schema, Document, Model } from 'mongoose';

export type RoomType = 'single' | 'double' | 'deluxe' | 'suite' | 'family' | 'presidential' | string;
export type RoomStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'cleaning'
  | 'maintenance'
  | 'out_of_service'
  | 'dirty'
  | 'clean'
  | 'inspected';

export type RoomCleaningStatus = 'DIRTY' | 'CLEANING' | 'CLEAN' | 'INSPECTED' | 'MAINTENANCE';

export interface IRoom extends Document {
  roomNumber: string;
  floor: number;
  type: RoomType;
  roomType?: mongoose.Types.ObjectId;
  pricePerNight: number;
  capacity: number;
  amenities: string[];
  status: RoomStatus;
  cleaningStatus: RoomCleaningStatus;
  currentBookingId?: mongoose.Types.ObjectId;
  currentReservation?: mongoose.Types.ObjectId;
  currentGuestId?: mongoose.Types.ObjectId;
  lastCleaned?: Date;
  keyCardNumber?: string;
  isSmokingAllowed: boolean;
  description?: string;
  images?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema: Schema<IRoom> = new Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
    },
    floor: {
      type: Number,
      required: [true, 'Floor number is required'],
      min: [1, 'Floor must be at least 1'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Room type is required'],
      default: 'deluxe',
      index: true,
    },
    roomType: {
      type: Schema.Types.ObjectId,
      ref: 'RoomType',
      default: null,
      index: true,
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price cannot be negative'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1 person'],
      default: 2,
    },
    amenities: {
      type: [String],
      default: ['High-speed Wi-Fi', 'Smart TV', 'Air Conditioning', 'En-suite Bathroom', 'Mini Fridge'],
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'cleaning', 'maintenance', 'out_of_service', 'dirty', 'clean', 'inspected'],
      default: 'available',
      index: true,
    },
    cleaningStatus: {
      type: String,
      enum: ['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'MAINTENANCE'],
      default: 'CLEAN',
      index: true,
    },
    currentBookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    currentReservation: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null,
    },
    currentGuestId: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
      default: null,
    },
    lastCleaned: {
      type: Date,
      default: Date.now,
    },
    keyCardNumber: {
      type: String,
      trim: true,
    },
    isSmokingAllowed: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Helpful Compound Indexes
RoomSchema.index({ status: 1, floor: 1 });
RoomSchema.index({ type: 1, status: 1 });
RoomSchema.index({ pricePerNight: 1, capacity: 1 });

export const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);

export default Room;
