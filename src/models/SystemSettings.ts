import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSettings extends Document {
  hotelInfo: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    website: string;
    logoUrl?: string;
    checkInTime: string;
    checkOutTime: string;
  };
  taxSettings: {
    taxName: string;
    taxRate: number; // e.g. 10 for 10%
    taxRegistrationNumber: string;
    isTaxInclusive: boolean;
  };
  currency: {
    code: string; // e.g. USD, EUR, PKR, INR, AED
    symbol: string; // e.g. $, €, Rs, AED
    name: string;
  };
  invoiceSettings: {
    invoicePrefix: string;
    termsAndConditions: string;
    footerNotes: string;
    showLogo: boolean;
  };
  roomSettings: {
    defaultCheckoutStatus: 'cleaning' | 'available';
    earlyCheckInFeePerHour: number;
    lateCheckOutFeePerHour: number;
    autoReleaseReservedMinutes: number;
  };
  userSettings: {
    allowSelfRegistration: boolean;
    sessionTimeoutMinutes: number;
    requireTwoFactor: boolean;
  };
  systemPreferences: {
    theme: 'dark' | 'light';
    dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
    autoSeedFallback: boolean;
    enableEmailNotifications: boolean;
  };
  updatedAt: Date;
}

const SystemSettingsSchema: Schema = new Schema(
  {
    hotelInfo: {
      name: { type: String, default: 'Grand Horizon Luxury Hotel & Resort' },
      tagline: { type: String, default: 'Premium Hotel Operations & Guest Experience Platform' },
      email: { type: String, default: 't02407446@gmail.com' },
      phone: { type: String, default: '+1 (555) 789-0000' },
      address: { type: String, default: '100 Ocean Promenade, Suite 500' },
      city: { type: String, default: 'Miami Beach, FL' },
      country: { type: String, default: 'United States' },
      website: { type: String, default: 'https://grandhorizonhotel.com' },
      logoUrl: { type: String, default: '' },
      checkInTime: { type: String, default: '14:00' },
      checkOutTime: { type: String, default: '11:00' },
    },
    taxSettings: {
      taxName: { type: String, default: 'VAT / Occupancy Tax' },
      taxRate: { type: Number, default: 10 },
      taxRegistrationNumber: { type: String, default: 'TAX-99887766-US' },
      isTaxInclusive: { type: Boolean, default: false },
    },
    currency: {
      code: { type: String, default: 'USD' },
      symbol: { type: String, default: '$' },
      name: { type: String, default: 'US Dollar' },
    },
    invoiceSettings: {
      invoicePrefix: { type: String, default: 'INV-2026-' },
      termsAndConditions: {
        type: String,
        default: 'Payment is due upon invoice receipt. Thank you for staying with Grand Horizon Hotel.',
      },
      footerNotes: { type: String, default: 'Grand Horizon Hotel & Resort - Customer Support: support@grandhorizonhotel.com' },
      showLogo: { type: Boolean, default: true },
    },
    roomSettings: {
      defaultCheckoutStatus: { type: String, enum: ['cleaning', 'available'], default: 'cleaning' },
      earlyCheckInFeePerHour: { type: Number, default: 25 },
      lateCheckOutFeePerHour: { type: Number, default: 35 },
      autoReleaseReservedMinutes: { type: Number, default: 120 },
    },
    userSettings: {
      allowSelfRegistration: { type: Boolean, default: false },
      sessionTimeoutMinutes: { type: Number, default: 120 },
      requireTwoFactor: { type: Boolean, default: false },
    },
    systemPreferences: {
      theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
      dateFormat: { type: String, enum: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'], default: 'YYYY-MM-DD' },
      autoSeedFallback: { type: Boolean, default: true },
      enableEmailNotifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const SystemSettingsModel = mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
