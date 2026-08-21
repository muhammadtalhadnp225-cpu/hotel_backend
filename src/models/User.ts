import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'receptionist' | 'guest' | 'patron';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  roleRef?: mongoose.Types.ObjectId;
  employee?: mongoose.Types.ObjectId;
  departmentRef?: mongoose.Types.ObjectId;
  phone?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  stayPreferences?: {
    pillowPreference?: string;
    dietaryRestrictions?: string[];
    specialRequests?: string;
  };
  membershipTier?: string;
  department: 'Administration' | 'Front Desk' | 'Housekeeping' | string;
  status: 'active' | 'inactive' | 'suspended';
  avatarUrl?: string;
  isDeleted?: boolean;
  lastLogin?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide user name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide user email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'receptionist', 'guest', 'patron'],
      default: 'guest',
      index: true,
    },
    roleRef: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    departmentRef: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    phone: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'Mr',
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    nationality: {
      type: String,
      trim: true,
      default: '',
    },
    idType: {
      type: String,
      enum: ['passport', 'national_id', 'driver_license', 'drivers_license', 'other', ''],
      default: 'passport',
    },
    idNumber: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
    },
    stayPreferences: {
      pillowPreference: { type: String, default: '' },
      dietaryRestrictions: { type: [String], default: [] },
      specialRequests: { type: String, default: '' },
    },
    membershipTier: {
      type: String,
      default: 'Patron Circle',
    },
    department: {
      type: String,
      default: 'Front Desk',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },
    lastLogin: {
      type: Date,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Hash password securely with bcrypt before persisting
UserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  // Avoid double-hashing if already a bcrypt hash
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.index({ role: 1, status: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
