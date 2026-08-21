import { Request, Response, NextFunction } from 'express';
import { ReportsService, DateFilterOption } from '../services/reportsService.js';

export const getAdminReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { filterType, startDate, endDate } = req.query;
    const options: DateFilterOption = {
      filterType: filterType as any,
      startDate: startDate as string,
      endDate: endDate as string,
    };
    const reportData = await ReportsService.getAdminReports(options);
    res.status(200).json({
      success: true,
      reports: reportData,
    });
  } catch (error) {
    next(error);
  }
};

export const getReceptionReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { filterType, startDate, endDate } = req.query;
    const options: DateFilterOption = {
      filterType: filterType as any,
      startDate: startDate as string,
      endDate: endDate as string,
    };
    const reportData = await ReportsService.getReceptionReports(options);
    res.status(200).json({
      success: true,
      reports: reportData,
    });
  } catch (error) {
    next(error);
  }
};
