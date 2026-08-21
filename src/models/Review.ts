import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReview extends Document {
  author: string;
  country?: string;
  rating: number;
  title: string;
  comment: string;
  roomStayed?: string;
  stayDate?: string;
  verified: boolean;
  status: 'published' | 'pending' | 'featured' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema(
  {
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: 'International',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 5,
    },
    title: {
      type: String,
      trim: true,
      default: 'Exceptional Stay',
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
    },
    roomStayed: {
      type: String,
      trim: true,
      default: 'Sanctuary Suite',
    },
    stayDate: {
      type: String,
      trim: true,
      default: 'Recent Stay',
    },
    verified: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['published', 'pending', 'featured', 'archived'],
      default: 'published',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);

export default Review;
