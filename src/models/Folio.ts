import mongoose, { Schema, Document, Model } from 'mongoose';

export type FolioItemCategory =
  | 'room_charge'
  | 'service'
  | 'food_beverage'
  | 'laundry'
  | 'spa'
  | 'mini_bar'
  | 'transportation'
  | 'tax'
  | 'damage'
  | 'discount'
  | 'other';

export type FolioStatus = 'open' | 'closed' | 'settled' | 'void';

export interface IFolioItem {
  _id?: mongoose.Types.ObjectId;
  description: string;
  category: FolioItemCategory;
  service?: mongoose.Types.ObjectId;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
  date: Date;
  addedBy?: mongoose.Types.ObjectId;
}

export interface IFolio extends Document {
  folioNumber: string; // e.g. 'FOL-2026-10492'
  guest: mongoose.Types.ObjectId;
  reservation: mongoose.Types.ObjectId;
  room?: mongoose.Types.ObjectId;
  items: IFolioItem[];
  totalCharges: number;
  totalPayments: number;
  balance: number;
  status: FolioStatus;
  closedAt?: Date;
  settledBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FolioItemSchema = new Schema(
  {
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'room_charge',
        'service',
        'food_beverage',
        'laundry',
        'spa',
        'mini_bar',
        'transportation',
        'tax',
        'damage',
        'discount',
        'other',
      ],
      default: 'service',
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Total amount is required'],
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: true }
);

const FolioSchema: Schema<IFolio> = new Schema(
  {
    folioNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    guest: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
      required: [true, 'Guest reference is required'],
      index: true,
    },
    reservation: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: [true, 'Reservation reference is required'],
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      index: true,
    },
    items: {
      type: [FolioItemSchema],
      default: [],
    },
    totalCharges: {
      type: Number,
      default: 0,
      min: [0, 'Charges cannot be negative'],
    },
    totalPayments: {
      type: Number,
      default: 0,
      min: [0, 'Payments cannot be negative'],
    },
    balance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'settled', 'void'],
      default: 'open',
    },
    closedAt: {
      type: Date,
    },
    settledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

// Pre-save calculate totals
FolioSchema.pre('save', function () {
  if (this.items && this.items.length > 0) {
    this.totalCharges = this.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }
  this.balance = Math.max(0, (this.totalCharges || 0) - (this.totalPayments || 0));
  if (this.balance === 0 && this.totalCharges > 0 && this.status === 'open') {
    this.status = 'settled';
  }
});

FolioSchema.index({ guest: 1, status: 1 });
FolioSchema.index({ reservation: 1 });
FolioSchema.index({ status: 1 });

export const Folio: Model<IFolio> =
  mongoose.models.Folio || mongoose.model<IFolio>('Folio', FolioSchema);

export default Folio;
