import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getEmployees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { department, status } = req.query;
    const employees = await StorageService.getAllEmployees(department as string, status as string);
    res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await StorageService.getEmployeeById(id);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee profile not found' });
      return;
    }
    res.status(200).json({ success: true, employee });
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, department, position, joiningDate, shift, salary, emergencyContact, address, notes, password } = req.body;

    if (!name || !email || !phone || !department || !position) {
      res.status(400).json({
        success: false,
        message: 'Name, email, phone, department, and position are required.',
      });
      return;
    }

    const newEmp = await StorageService.createEmployee({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department,
      position: position.trim(),
      joiningDate: joiningDate || new Date().toISOString().split('T')[0],
      shift: shift || 'Morning (07:00 - 15:00)',
      salary: Number(salary || 0),
      emergencyContact,
      address,
      notes,
    });

    // Synchronize system user account & login password for portal login
    const userRole = 'receptionist';
    const userPassword = password || 'reception123';
    const userDept = department === 'Reception' ? 'Front Desk' : department;
    
    const existingUser = await StorageService.findUserByEmail(email);
    if (existingUser) {
      await StorageService.updateUser(existingUser._id, {
        name,
        role: userRole,
        department: userDept,
        phone,
        password: userPassword,
      });
    } else {
      await StorageService.createUser({
        name,
        email,
        password: userPassword,
        role: userRole,
        phone,
        department: userDept,
        status: 'active',
      });
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'EMPLOYEE_CREATED',
      details: `Created staff profile for ${name} (${position}, Department: ${department}).`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Employee profile created for ${name}`,
      employee: newEmp,
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await StorageService.updateEmployee(id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'EMPLOYEE_UPDATED',
      details: `Updated staff profile for ${updated.name}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Employee updated', employee: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const emp = await StorageService.getEmployeeById(id);
    if (!emp) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }
    await StorageService.deleteEmployee(id);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'EMPLOYEE_DELETED',
      details: `Removed employee profile ${emp.name} (${emp.employeeId}).`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Employee record deleted' });
  } catch (error) {
    next(error);
  }
};

// Attendance
export const getAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { date, department } = req.query;
    const records = await StorageService.getAllAttendance(date as string, department as string);
    res.status(200).json({ success: true, count: records.length, attendance: records });
  } catch (error) {
    next(error);
  }
};

export const recordAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const record = await StorageService.recordAttendance(req.body);
    res.status(201).json({ success: true, message: 'Attendance recorded', attendance: record });
  } catch (error) {
    next(error);
  }
};

// Leaves
export const getLeaves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.query;
    const leaves = await StorageService.getAllLeaves(status as string);
    res.status(200).json({ success: true, count: leaves.length, leaves });
  } catch (error) {
    next(error);
  }
};

export const requestLeave = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leave = await StorageService.requestLeave(req.body);
    res.status(201).json({ success: true, message: 'Leave request submitted', leave });
  } catch (error) {
    next(error);
  }
};

export const updateLeaveStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await StorageService.updateLeaveStatus(id, status, req.user?.name || 'Admin');
    if (!updated) {
      res.status(404).json({ success: false, message: 'Leave request not found' });
      return;
    }
    res.status(200).json({ success: true, message: `Leave request ${status}`, leave: updated });
  } catch (error) {
    next(error);
  }
};
