import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type ReservationPaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';

export type BookingSource =
  | 'walk_in'
  | 'direct_website'
  | 'phone'
  | 'ota_booking'
  | 'corporate'
  | 'travel_agent'
  | 'direct'
  | 'online_portal'
  | 'website';

export interface IReservation extends Document {
  reservationNumber: string; // e.g. 'RES-2026-10492'
  bookingNumber?: string; // alias for reservationNumber
  guest: mongoose.Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  room: mongoose.Types.ObjectId;
  roomId?: mongoose.Types.ObjectId; // alias for room
  roomNumber?: string;
  roomType?: string;
  checkInDate: Date;
  checkOutDate: Date;
  actualCheckIn?: Date;
  actualCheckOut?: Date;
  numberOfAdults: number;
  numberOfChildren: number;
  status: ReservationStatus;
  bookingSource: BookingSource;
  source?: string;
  totalNights: number;
  roomRate?: number;
  pricePerNight: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: ReservationPaymentStatus;
  guestIdType?: string;
  guestIdNumber?: string;
  specialRequests?: string;
  notes?: string;
  folio?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  assignedStaffId?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema: Schema<IReservation> = new Schema(
  {
    reservationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    bookingNumber: {
      type: String,
      trim: true,
    },
    guest: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
      required: [true, 'Guest reference is required'],
      index: true,
    },
    guestName: {
      type: String,
      trim: true,
    },
    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
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
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    roomType: {
      type: String,
      trim: true,
    },
    checkInDate: {
      type: Date,
      required: [true, 'Check-in date is required'],
      index: true,
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Check-out date is required'],
      index: true,
    },
    actualCheckIn: {
      type: Date,
    },
    actualCheckOut: {
      type: Date,
    },
    numberOfAdults: {
      type: Number,
      default: 1,
      min: [1, 'Must have at least 1 adult'],
    },
    numberOfChildren: {
      type: Number,
      default: 0,
      min: [0, 'Cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
      default: 'confirmed',
      index: true,
    },
    bookingSource: {
      type: String,
      enum: [
        'walk_in',
        'direct_website',
        'phone',
        'ota_booking',
        'corporate',
        'travel_agent',
        'direct',
        'online_portal',
        'website',
      ],
      default: 'website',
    },
    source: {
      type: String,
      default: 'direct',
    },
    totalNights: {
      type: Number,
      default: 1,
      min: [1, 'Stay must be at least 1 night'],
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price cannot be negative'],
    },
    roomRate: {
      type: Number,
      default: 0,
      min: [0, 'Room rate cannot be negative'],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: [0, 'Subtotal cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded'],
      default: 'pending',
    },
    guestIdType: {
      type: String,
      default: 'passport',
    },
    guestIdNumber: {
      type: String,
      default: '',
    },
    specialRequests: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    folio: {
      type: Schema.Types.ObjectId,
      ref: 'Folio',
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save to synchronize aliases
ReservationSchema.pre('save', function () {
  if (!this.reservationNumber && this.bookingNumber) {
    this.reservationNumber = this.bookingNumber;
  }
  if (!this.bookingNumber && this.reservationNumber) {
    this.bookingNumber = this.reservationNumber;
  }
  if (!this.room && this.roomId) {
    this.room = this.roomId;
  }
  if (!this.roomId && this.room) {
    this.roomId = this.room;
  }
});

// Indexes
ReservationSchema.index({ room: 1, checkInDate: 1, checkOutDate: 1 });
ReservationSchema.index({ guest: 1, status: 1 });
ReservationSchema.index({ status: 1, checkInDate: 1 });
ReservationSchema.index({ paymentStatus: 1 });

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation || mongoose.model<IReservation>('Reservation', ReservationSchema);

export default Reservation;
