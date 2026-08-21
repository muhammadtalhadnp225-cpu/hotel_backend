import mongoose, { Schema, Document, Model } from 'mongoose';

export type GuestServiceType =
  | 'room_service'
  | 'extra_bed'
  | 'towels'
  | 'toiletries'
  | 'wake_up_call'
  | 'cleaning_request'
  | 'other';

export type GuestServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type GuestServicePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IGuestServiceRequest extends Document {
  requestNumber: string; // e.g. 'GSR-2026-1001'
  guest: mongoose.Types.ObjectId;
  guestName: string;
  guestPhone?: string;
  room: mongoose.Types.ObjectId;
  roomNumber: string;
  reservation?: mongoose.Types.ObjectId;
  bookingNumber?: string;
  serviceType: GuestServiceType;
  serviceName: string; // e.g. 'Room Service: Gourmet Breakfast', 'Extra Rollaway Bed', 'Fresh Towel Set'
  serviceCode?: string;
  description?: string;
  quantity: number;
  unitPrice: number; // 0 for complimentary services
  totalPrice: number; // quantity * unitPrice
  isChargeable: boolean; // true if totalPrice > 0
  status: GuestServiceStatus;
  priority: GuestServicePriority;
  assignedEmployee?: mongoose.Types.ObjectId;
  assignedStaffName?: string;
  scheduledTime?: Date; // For wake-up calls or scheduled room delivery
  createdTime: Date;
  completedTime?: Date;
  notes?: string;
  // Folio Connection
  isBilledToFolio: boolean;
  folioId?: mongoose.Types.ObjectId;
  folioItemId?: string;
  billedAmount?: number;
  billedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GuestServiceRequestSchema: Schema<IGuestServiceRequest> = new Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    guest: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
      required: [true, 'Guest reference is required'],
      index: true,
    },
    guestName: {
      type: String,
      required: [true, 'Guest name is required'],
      trim: true,
    },
    guestPhone: {
      type: String,
      trim: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      index: true,
    },
    reservation: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    bookingNumber: {
      type: String,
      trim: true,
    },
    serviceType: {
      type: String,
      enum: [
        'room_service',
        'extra_bed',
        'towels',
        'toiletries',
        'wake_up_call',
        'cleaning_request',
        'other',
      ],
      required: true,
      index: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    serviceCode: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: [0, 'Unit price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: [0, 'Total price cannot be negative'],
    },
    isChargeable: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    assignedEmployee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    assignedStaffName: {
      type: String,
      trim: true,
      default: 'Unassigned',
    },
    scheduledTime: {
      type: Date,
      default: null,
    },
    createdTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedTime: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    // Folio Connection
    isBilledToFolio: {
      type: Boolean,
      default: false,
      index: true,
    },
    folioId: {
      type: Schema.Types.ObjectId,
      ref: 'Folio',
      default: null,
    },
    folioItemId: {
      type: String,
      default: null,
    },
    billedAmount: {
      type: Number,
      default: 0,
    },
    billedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

GuestServiceRequestSchema.index({ roomNumber: 1, status: 1 });
GuestServiceRequestSchema.index({ serviceType: 1, status: 1 });
GuestServiceRequestSchema.index({ createdTime: -1 });

export const GuestServiceRequest: Model<IGuestServiceRequest> =
  mongoose.models.GuestServiceRequest ||
  mongoose.model<IGuestServiceRequest>('GuestServiceRequest', GuestServiceRequestSchema);

export default GuestServiceRequest;
