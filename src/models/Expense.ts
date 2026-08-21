import mongoose, { Schema, Document } from 'mongoose';

export type ExpenseCategory =
  | 'Rent'
  | 'Electricity'
  | 'Gas'
  | 'Water'
  | 'Salary'
  | 'Maintenance'
  | 'Cleaning'
  | 'Internet'
  | 'Supplies'
  | 'Other';

export type ExpensePaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'Corporate Credit Card'
  | 'Cheque'
  | 'Petty Cash';

export interface IExpense extends Document {
  expenseNumber: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: Date;
  paymentMethod: ExpensePaymentMethod;
  receiptUrl?: string;
  createdBy: string;
  department?: string;
  status: 'Approved' | 'Pending' | 'Paid';
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema: Schema = new Schema(
  {
    expenseNumber: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: [
        'Rent',
        'Electricity',
        'Gas',
        'Water',
        'Salary',
        'Maintenance',
        'Cleaning',
        'Internet',
        'Supplies',
        'Other',
      ],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, default: Date.now, index: true },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Corporate Credit Card', 'Cheque', 'Petty Cash'],
      required: true,
      default: 'Bank Transfer',
    },
    receiptUrl: { type: String, default: '' },
    createdBy: { type: String, required: true, default: 'Admin Staff' },
    department: { type: String, default: 'Management' },
    status: {
      type: String,
      enum: ['Approved', 'Pending', 'Paid'],
      default: 'Paid',
    },
  },
  { timestamps: true }
);

export const ExpenseModel = mongoose.model<IExpense>('Expense', ExpenseSchema);
