import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDepartment extends Document {
  name: string; // e.g. 'Front Desk', 'Housekeeping', 'Food & Beverage', 'Maintenance', 'Administration', 'Finance'
  code: string; // e.g. 'FD', 'HK', 'FB', 'MNT', 'ADM', 'FIN'
  description?: string;
  headOfDepartment?: mongoose.Types.ObjectId;
  budget?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema: Schema<IDepartment> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [10, 'Department code cannot exceed 10 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    headOfDepartment: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    budget: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
      default: 0,
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

DepartmentSchema.index({ isActive: 1 });

export const Department: Model<IDepartment> =
  mongoose.models.Department || mongoose.model<IDepartment>('Department', DepartmentSchema);

export default Department;
