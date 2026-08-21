import mongoose, { Schema, Document, Model } from 'mongoose';

export type ServiceCategory =
  | 'food_beverage'
  | 'spa_wellness'
  | 'transportation'
  | 'laundry'
  | 'business_center'
  | 'facilities'
  | 'mini_bar'
  | 'other';

export interface IService extends Document {
  name: string;
  code: string;
  category: ServiceCategory;
  description?: string;
  price: number;
  taxRate: number; // Percentage, e.g. 10 for 10%
  isAvailable: boolean;
  department?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema: Schema<IService> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Service code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'food_beverage',
        'spa_wellness',
        'transportation',
        'laundry',
        'business_center',
        'facilities',
        'mini_bar',
        'other',
      ],
      default: 'other',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Service price is required'],
      min: [0, 'Service price cannot be negative'],
    },
    taxRate: {
      type: Number,
      min: [0, 'Tax rate cannot be negative'],
      default: 10,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ServiceSchema.index({ category: 1, isAvailable: 1 });
ServiceSchema.index({ name: 'text', description: 'text' });

export const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>('Service', ServiceSchema);

export default Service;
