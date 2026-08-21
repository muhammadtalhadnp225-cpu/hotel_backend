import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRole extends Document {
  name: string; // e.g. 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'ACCOUNTANT', 'STAFF'
  displayName: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema: Schema<IRole> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, 'Role name must be at least 2 characters'],
      maxlength: [50, 'Role name cannot exceed 50 characters'],
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystemRole: {
      type: Boolean,
      default: false,
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

RoleSchema.index({ isActive: 1 });

export const Role: Model<IRole> =
  mongoose.models.Role || mongoose.model<IRole>('Role', RoleSchema);

export default Role;
