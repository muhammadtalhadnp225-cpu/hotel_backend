import { Router } from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getAttendance,
  recordAttendance,
  getLeaves,
  requestLeave,
  updateLeaveStatus,
} from '../controllers/employeeController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Employee Profiles
router.get('/', protect, authorize('admin', 'receptionist'), getEmployees);
router.get('/:id', protect, authorize('admin', 'receptionist'), getEmployeeById);
router.post('/', protect, authorize('admin'), createEmployee);
router.put('/:id', protect, authorize('admin'), updateEmployee);
router.delete('/:id', protect, authorize('admin'), deleteEmployee);

// Attendance
router.get('/attendance/log', protect, authorize('admin', 'receptionist'), getAttendance);
router.post('/attendance/record', protect, authorize('admin'), recordAttendance);

// Leaves
router.get('/leaves/list', protect, authorize('admin', 'receptionist'), getLeaves);
router.post('/leaves/request', protect, authorize('admin', 'receptionist'), requestLeave);
router.patch('/leaves/:id/status', protect, authorize('admin'), updateLeaveStatus);

export default router;
