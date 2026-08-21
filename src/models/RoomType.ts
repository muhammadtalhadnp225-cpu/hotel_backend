import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoomType extends Document {
  name: string; // e.g. 'Single Room', 'Double Room', 'Deluxe Suite', 'Executive Suite', 'Presidential Penthouse'
  code: string; // e.g. 'SGL', 'DBL', 'DLX', 'STE', 'PRZ'
  description?: string;
  basePrice: number;
  capacity: number;
  bedConfiguration: string;
  amenities: string[];
  maxExtraBeds: number;
  sizeSqFt?: number;
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomTypeSchema: Schema<IRoomType> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Room type name is required'],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Room type code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [10, 'Code cannot exceed 10 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price per night is required'],
      min: [0, 'Base price cannot be negative'],
    },
    capacity: {
      type: Number,
      required: [true, 'Standard capacity is required'],
      min: [1, 'Capacity must be at least 1 guest'],
      default: 2,
    },
    bedConfiguration: {
      type: String,
      required: [true, 'Bed configuration is required'],
      default: '1 King Bed',
    },
    amenities: {
      type: [String],
      default: ['High-speed Wi-Fi', 'Smart TV', 'Air Conditioning', 'En-suite Bathroom', 'Mini Fridge'],
    },
    maxExtraBeds: {
      type: Number,
      min: [0, 'Cannot be negative'],
      default: 1,
    },
    sizeSqFt: {
      type: Number,
      min: [0, 'Cannot be negative'],
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

RoomTypeSchema.index({ basePrice: 1, capacity: 1 });
RoomTypeSchema.index({ isActive: 1 });

export const RoomTypeModel: Model<IRoomType> =
  mongoose.models.RoomType || mongoose.model<IRoomType>('RoomType', RoomTypeSchema);

export default RoomTypeModel;
