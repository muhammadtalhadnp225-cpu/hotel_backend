import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  userName: string;
  userRole: string;
  module: 'admin' | 'reception' | 'billing' | 'system' | 'housekeeping' | 'inventory' | 'maintenance' | 'guest_services' | 'restaurant';
  action: string;
  details: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema: Schema<IAuditLog> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      default: 'System Operator',
    },
    userRole: {
      type: String,
      required: true,
      default: 'admin',
    },
    module: {
      type: String,
      enum: ['admin', 'reception', 'billing', 'system', 'housekeeping', 'inventory', 'maintenance', 'guest_services', 'restaurant'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    details: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ module: 1, timestamp: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
