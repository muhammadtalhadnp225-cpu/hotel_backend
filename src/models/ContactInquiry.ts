import mongoose, { Schema, Document, Model } from 'mongoose';

export type InquiryStatus = 'new' | 'read' | 'in_progress' | 'responded' | 'archived';
export type InquiryPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface IContactInquiry extends Document {
  ticketId: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  travelDates?: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  source: string;
  staffNotes?: string;
  responseMessage?: string;
  respondedAt?: Date;
  respondedBy?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactInquirySchema: Schema<IContactInquiry> = new Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: String,
      trim: true,
      default: 'General Sanctuary Inquiry',
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    travelDates: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'read', 'in_progress', 'responded', 'archived'],
      default: 'new',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    source: {
      type: String,
      default: 'website',
    },
    staffNotes: {
      type: String,
      default: '',
    },
    responseMessage: {
      type: String,
      default: '',
    },
    respondedAt: {
      type: Date,
    },
    respondedBy: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'contactinquiries',
  }
);

// Search indexing
ContactInquirySchema.index({ name: 'text', email: 'text', subject: 'text', message: 'text', ticketId: 'text' });
ContactInquirySchema.index({ status: 1, createdAt: -1 });

export const ContactInquiry: Model<IContactInquiry> =
  mongoose.models.ContactInquiry || mongoose.model<IContactInquiry>('ContactInquiry', ContactInquirySchema);

export default ContactInquiry;
