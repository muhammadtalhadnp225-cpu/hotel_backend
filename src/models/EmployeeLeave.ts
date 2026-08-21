import mongoose, { Schema, Document } from 'mongoose';

export type LeaveType = 'Annual' | 'Casual' | 'Sick' | 'Maternity/Paternity' | 'Unpaid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface IEmployeeLeave extends Document {
  leaveCode: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeLeaveSchema: Schema = new Schema(
  {
    leaveCode: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    department: { type: String, required: true },
    leaveType: {
      type: String,
      enum: ['Annual', 'Casual', 'Sick', 'Maternity/Paternity', 'Unpaid'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    approvedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const EmployeeLeaveModel = mongoose.model<IEmployeeLeave>('EmployeeLeave', EmployeeLeaveSchema);
