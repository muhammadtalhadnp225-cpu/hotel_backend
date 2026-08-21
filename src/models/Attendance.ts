import mongoose, { Schema, Document } from 'mongoose';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave';

export interface IAttendance extends Document {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: Date;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  overtimeHours: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema: Schema = new Schema(
  {
    employeeId: { type: String, required: true, index: true },
    employeeCode: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    department: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Half Day', 'On Leave'],
      required: true,
      default: 'Present',
    },
    checkInTime: { type: String, default: '' },
    checkOutTime: { type: String, default: '' },
    overtimeHours: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const AttendanceModel = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
