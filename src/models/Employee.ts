import mongoose, { Schema, Document } from 'mongoose';

export type EmployeeDepartment =
  | 'Reception'
  | 'Housekeeping'
  | 'Maintenance'
  | 'Management';

export type EmployeeShift =
  | 'Morning (07:00 - 15:00)'
  | 'Evening (15:00 - 23:00)'
  | 'Night (23:00 - 07:00)'
  | 'General (09:00 - 17:00)';

export type EmployeeStatus = 'Active' | 'On Leave' | 'Terminated';

export interface IEmployee extends Document {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: EmployeeDepartment;
  position: string;
  joiningDate: Date;
  shift: EmployeeShift;
  status: EmployeeStatus;
  salary: number;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  address?: string;
  notes?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema: Schema = new Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    department: {
      type: String,
      required: true,
      index: true,
    },
    position: { type: String, required: true, trim: true },
    joiningDate: { type: Date, default: Date.now },
    shift: {
      type: String,
      default: 'General (09:00 - 17:00)',
    },
    status: {
      type: String,
      enum: ['Active', 'On Leave', 'Terminated'],
      default: 'Active',
      index: true,
    },
    salary: { type: Number, required: true, min: 0 },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' },
    },
    address: { type: String, default: '' },
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const EmployeeModel = mongoose.model<IEmployee>('Employee', EmployeeSchema);
