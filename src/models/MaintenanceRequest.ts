import mongoose, { Schema, Document, Model } from 'mongoose';

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac_ac'
  | 'carpentry'
  | 'appliances'
  | 'door_lock'
  | 'tv_network'
  | 'general';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'reported' | 'in_progress' | 'waiting_parts' | 'resolved' | 'cancelled';

export interface IMaintenanceRequest extends Document {
  ticketNumber: string; // e.g. 'MNT-2026-001'
  room: mongoose.Types.ObjectId;
  roomNumber: string;
  category: MaintenanceCategory;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedBy: string;
  assignedStaff?: mongoose.Types.ObjectId;
  assignedStaffName?: string;
  estimatedCost: number;
  actualCost: number;
  resolutionNotes?: string;
  reportedAt: Date;
  scheduledDate?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceRequestSchema: Schema<IMaintenanceRequest> = new Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'plumbing',
        'electrical',
        'hvac_ac',
        'carpentry',
        'appliances',
        'door_lock',
        'tv_network',
        'general',
      ],
      default: 'general',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Maintenance issue title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Issue description is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['reported', 'in_progress', 'waiting_parts', 'resolved', 'cancelled'],
      default: 'reported',
      index: true,
    },
    reportedBy: {
      type: String,
      trim: true,
      default: 'Front Desk / Housekeeping Staff',
    },
    assignedStaff: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    assignedStaffName: {
      type: String,
      trim: true,
      default: 'Duty Maintenance Engineer',
    },
    estimatedCost: {
      type: Number,
      default: 0,
      min: [0, 'Estimated cost cannot be negative'],
    },
    actualCost: {
      type: Number,
      default: 0,
      min: [0, 'Actual cost cannot be negative'],
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
    },
    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

MaintenanceRequestSchema.index({ roomNumber: 1, status: 1 });
MaintenanceRequestSchema.index({ category: 1, status: 1 });

export const MaintenanceRequest: Model<IMaintenanceRequest> =
  mongoose.models.MaintenanceRequest ||
  mongoose.model<IMaintenanceRequest>('MaintenanceRequest', MaintenanceRequestSchema);

export default MaintenanceRequest;
