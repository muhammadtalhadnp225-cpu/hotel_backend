import mongoose, { Schema, Document, Model } from 'mongoose';

export type HousekeepingTaskType =
  | 'daily_cleaning'
  | 'deep_cleaning'
  | 'turn_down'
  | 'inspection'
  | 'sanitization'
  | 'checkout_clean';

export type HousekeepingPriority = 'low' | 'medium' | 'high' | 'urgent';
export type HousekeepingStatus = 'pending' | 'in_progress' | 'completed' | 'verified' | 'cancelled';

export interface IHousekeepingChecklistItem {
  task: string;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface IHousekeeping extends Document {
  taskNumber: string; // e.g. 'HK-2026-10492'
  room: mongoose.Types.ObjectId;
  roomNumber?: string;
  employee: mongoose.Types.ObjectId;
  assignedStaffName?: string;
  taskType: HousekeepingTaskType;
  priority: HousekeepingPriority;
  status: HousekeepingStatus;
  scheduledDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  checklist: IHousekeepingChecklistItem[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistItemSchema = new Schema(
  {
    task: {
      type: String,
      required: true,
      trim: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const HousekeepingSchema: Schema<IHousekeeping> = new Schema(
  {
    taskNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
      index: true,
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    assignedStaffName: {
      type: String,
      trim: true,
    },
    taskType: {
      type: String,
      enum: [
        'daily_cleaning',
        'deep_cleaning',
        'turn_down',
        'inspection',
        'sanitization',
        'checkout_clean',
      ],
      default: 'daily_cleaning',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'verified', 'cancelled'],
      default: 'pending',
      index: true,
    },
    scheduledDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    checklist: {
      type: [ChecklistItemSchema],
      default: [
        { task: 'Change bed linen and pillowcases', isCompleted: false },
        { task: 'Clean and sanitize bathroom & amenities', isCompleted: false },
        { task: 'Vacuum carpet / mop floors', isCompleted: false },
        { task: 'Dust furniture and sanitize surfaces', isCompleted: false },
        { task: 'Restock minibar, towels, toiletries', isCompleted: false },
      ],
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

HousekeepingSchema.index({ room: 1, status: 1 });
HousekeepingSchema.index({ employee: 1, scheduledDate: 1 });
HousekeepingSchema.index({ status: 1, priority: 1 });

export const Housekeeping: Model<IHousekeeping> =
  mongoose.models.Housekeeping || mongoose.model<IHousekeeping>('Housekeeping', HousekeepingSchema);

export default Housekeeping;
