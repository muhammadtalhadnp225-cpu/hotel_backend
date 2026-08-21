import mongoose, { Schema, Document, Model } from 'mongoose';

export type IdType = 'passport' | 'national_id' | 'driver_license' | 'drivers_license' | 'other';

export interface IGuest extends Document {
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  password?: string;
  phone: string;
  alternatePhone?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  idType: IdType;
  idNumber: string;
  idIssuingCountry?: string;
  idExpiryDate?: Date;
  nationality?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  addressDetails?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  vipStatus: boolean;
  preferences?: string[];
  notes?: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GuestSchema: Schema<IGuest> = new Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      relationship: { type: String, trim: true, default: '' },
    },
    idType: {
      type: String,
      enum: ['passport', 'national_id', 'driver_license', 'drivers_license', 'other'],
      default: 'passport',
    },
    idNumber: {
      type: String,
      default: '',
      trim: true,
    },
    idIssuingCountry: {
      type: String,
      default: '',
      trim: true,
    },
    idExpiryDate: {
      type: Date,
    },
    nationality: {
      type: String,
      default: 'International',
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'unspecified', ''],
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    addressDetails: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      zipCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
    },
    vipStatus: {
      type: Boolean,
      default: false,
      index: true,
    },
    preferences: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    totalVisits: {
      type: Number,
      default: 1,
      min: [0, 'Total visits cannot be negative'],
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, 'Total spent cannot be negative'],
    },
    lastVisit: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save to synchronize fullName if firstName and lastName are present
GuestSchema.pre('save', function () {
  if (!this.fullName && (this.firstName || this.lastName)) {
    this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }
});

// Indexes for fast lookup by phone, email, and name
GuestSchema.index({ phone: 1 });
GuestSchema.index({ email: 1 });
GuestSchema.index({ fullName: 'text' });
GuestSchema.index({ vipStatus: 1, totalSpent: -1 });

export const Guest: Model<IGuest> =
  mongoose.models.Guest || mongoose.model<IGuest>('Guest', GuestSchema);

export default Guest;
