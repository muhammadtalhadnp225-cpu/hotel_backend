import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'upi'
  | 'corporate_billing'
  | 'other';

export type PaymentRecordStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export interface IPayment extends Document {
  receiptNumber: string; // e.g. 'REC-2026-10492'
  folio?: mongoose.Types.ObjectId;
  folioId?: mongoose.Types.ObjectId;
  reservation?: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  guest?: mongoose.Types.ObjectId;
  guestName: string;
  roomNumber?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentRecordStatus;
  transactionReference?: string;
  notes?: string;
  recordedBy?: string;
  collectedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema<IPayment> = new Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    folio: {
      type: Schema.Types.ObjectId,
      ref: 'Folio',
      index: true,
    },
    folioId: {
      type: Schema.Types.ObjectId,
      ref: 'Folio',
    },
    reservation: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    guest: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
      index: true,
    },
    guestName: {
      type: String,
      required: [true, 'Guest name is required'],
      trim: true,
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'upi', 'corporate_billing', 'other'],
      default: 'credit_card',
      index: true,
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'refunded'],
      default: 'completed',
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: String,
      trim: true,
    },
    collectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save alias sync
PaymentSchema.pre('save', function () {
  if (!this.reservation && this.bookingId) {
    this.reservation = this.bookingId;
  }
  if (!this.bookingId && this.reservation) {
    this.bookingId = this.reservation;
  }
  if (!this.folio && this.folioId) {
    this.folio = this.folioId;
  }
  if (!this.folioId && this.folio) {
    this.folioId = this.folio;
  }
});

PaymentSchema.index({ bookingId: 1, createdAt: -1 });
PaymentSchema.index({ folio: 1, createdAt: -1 });
PaymentSchema.index({ paymentMethod: 1, status: 1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);

export default Payment;
