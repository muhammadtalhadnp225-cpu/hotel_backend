import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category } = req.query;
    const expenses = await StorageService.getAllExpenses(category as string);
    const totalAmount = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    res.status(200).json({
      success: true,
      count: expenses.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

export const createExpense = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category, description, amount, expenseDate, paymentMethod, receiptUrl, department } = req.body;

    if (!category || !description || amount === undefined || Number(amount) <= 0) {
      res.status(400).json({
        success: false,
        message: 'Valid expense category, description, and positive amount are required.',
      });
      return;
    }

    const newExpense = await StorageService.createExpense({
      category,
      description,
      amount: Number(amount),
      expenseDate,
      paymentMethod: paymentMethod || 'Bank Transfer',
      receiptUrl,
      department: department || 'Management',
      createdBy: req.user?.name || 'Admin Staff',
    });

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'EXPENSE_CREATED',
      details: `Logged operational expense: ${category} - Rs. ${amount} (${description}).`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Expense of Rs. ${amount} logged successfully`,
      expense: newExpense,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await StorageService.deleteExpense(id);
    res.status(200).json({ success: true, message: 'Expense record removed' });
  } catch (error) {
    next(error);
  }
};
