import mongoose, { Schema, Document, Model } from 'mongoose';

export type InvoiceStatus = 'paid' | 'pending' | 'partially_paid' | 'void';

export interface IInvoiceItem {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string; // e.g. 'INV-2026-10492'
  reservation: mongoose.Types.ObjectId;
  bookingNumber?: string;
  folio?: mongoose.Types.ObjectId;
  folioNumber?: string;
  guest: mongoose.Types.ObjectId;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestAddress?: string;
  room?: mongoose.Types.ObjectId;
  roomNumber?: string;
  roomType?: string;
  checkInDate: Date;
  checkOutDate: Date;
  totalNights: number;
  roomCharges: number;
  additionalServicesCharges: number;
  restaurantCharges: number;
  otherCharges: number;
  subtotal: number;
  discount: number;
  discountReason?: string;
  tax: number;
  taxRate: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentMethod: string;
  paymentReceiptNumber?: string;
  status: InvoiceStatus;
  isArchived?: boolean;
  isDeleted?: boolean;
  issuedAt: Date;
  issuedBy?: mongoose.Types.ObjectId;
  issuedByName?: string;
  items: IInvoiceItem[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'room_charge',
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const InvoiceSchema: Schema<IInvoice> = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    reservation: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
    },
    bookingNumber: {
      type: String,
      trim: true,
    },
    folio: {
      type: Schema.Types.ObjectId,
      ref: 'Folio',
      index: true,
    },
    folioNumber: {
      type: String,
      trim: true,
    },
    guest: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
      required: true,
      index: true,
    },
    guestName: {
      type: String,
      required: true,
      trim: true,
    },
    guestEmail: {
      type: String,
      trim: true,
    },
    guestPhone: {
      type: String,
      trim: true,
    },
    guestAddress: {
      type: String,
      trim: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      index: true,
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
      required: true,
    },
    checkOutDate: {
      type: Date,
      required: true,
    },
    totalNights: {
      type: Number,
      default: 1,
      min: 1,
    },
    roomCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    additionalServicesCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    restaurantCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountReason: {
      type: String,
      trim: true,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 10,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      default: 'credit_card',
    },
    paymentReceiptNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'partially_paid', 'void'],
      default: 'paid',
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    issuedByName: {
      type: String,
      trim: true,
    },
    items: {
      type: [InvoiceItemSchema],
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

InvoiceSchema.index({ guest: 1, issuedAt: -1 });
InvoiceSchema.index({ reservation: 1 });

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);

export default Invoice;
