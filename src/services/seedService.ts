import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { RoomTypeModel } from '../models/RoomType.js';
import { Booking } from '../models/Booking.js';
import { Guest } from '../models/Guest.js';
import { Payment } from '../models/Payment.js';
import { AuditLog } from '../models/AuditLog.js';
import { Folio } from '../models/Folio.js';
import { Invoice } from '../models/Invoice.js';
import { Service } from '../models/Service.js';
import { Housekeeping } from '../models/Housekeeping.js';
import { MaintenanceRequest } from '../models/MaintenanceRequest.js';
import { GuestServiceRequest } from '../models/GuestServiceRequest.js';
import { EmployeeModel } from '../models/Employee.js';
import { AttendanceModel } from '../models/Attendance.js';
import { EmployeeLeaveModel } from '../models/EmployeeLeave.js';
import { ExpenseModel } from '../models/Expense.js';
import { RestaurantCategory, RestaurantMenuItem, RestaurantTable, RestaurantOrder } from '../models/RestaurantModels.js';
import { InventoryItem, InventoryLog, Supplier, PurchaseOrder, SupplierPayment } from '../models/InventoryModels.js';

// In-memory store initialized completely clean
export class InMemoryStore {
  public static users: any[] = [];
  public static rooms: any[] = [];
  public static roomTypes: any[] = [];
  public static bookings: any[] = [];
  public static guests: any[] = [];
  public static payments: any[] = [];
  public static folios: any[] = [];
  public static invoices: any[] = [];
  public static services: any[] = [];
  public static housekeeping: any[] = [];
  public static guestServices: any[] = [];
  public static maintenance: any[] = [];
  public static employees: any[] = [];
  public static attendance: any[] = [];
  public static leaves: any[] = [];
  public static expenses: any[] = [];
  public static restaurantCategories: any[] = [];
  public static restaurantMenuItems: any[] = [];
  public static restaurantTables: any[] = [];
  public static restaurantOrders: any[] = [];
  public static inventoryItems: any[] = [];
  public static inventoryLogs: any[] = [];
  public static suppliers: any[] = [];
  public static purchaseOrders: any[] = [];
  public static supplierPayments: any[] = [];
  public static contactInquiries: any[] = [];
  public static systemSettings: any = null;
  public static auditLogs: any[] = [];
  public static isInitialized = false;
}

export const seedDatabase = async (force: boolean = false) => {
  const isMongoConnected = mongoose.connection.readyState === 1;

  // Clear in-memory arrays completely - no automatic user or room seeding
  InMemoryStore.users = [];
  InMemoryStore.rooms = [];
  InMemoryStore.roomTypes = [];
  InMemoryStore.bookings = [];
  InMemoryStore.guests = [];
  InMemoryStore.folios = [];
  InMemoryStore.invoices = [];
  InMemoryStore.payments = [];
  InMemoryStore.services = [];
  InMemoryStore.housekeeping = [];
  InMemoryStore.guestServices = [];
  InMemoryStore.maintenance = [];
  InMemoryStore.employees = [];
  InMemoryStore.attendance = [];
  InMemoryStore.leaves = [];
  InMemoryStore.expenses = [];
  InMemoryStore.restaurantCategories = [];
  InMemoryStore.restaurantMenuItems = [];
  InMemoryStore.restaurantTables = [];
  InMemoryStore.restaurantOrders = [];
  InMemoryStore.inventoryItems = [];
  InMemoryStore.inventoryLogs = [];
  InMemoryStore.suppliers = [];
  InMemoryStore.purchaseOrders = [];
  InMemoryStore.supplierPayments = [];
  InMemoryStore.auditLogs = [];
  InMemoryStore.contactInquiries = InMemoryStore.contactInquiries || [];

  InMemoryStore.isInitialized = true;

  if (isMongoConnected) {
    try {
      const adminExists = await User.findOne({ role: 'admin' });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const staffPassword = await bcrypt.hash('reception123', 10);
        await User.insertMany([
          {
            name: 'System Admin',
            email: 'admin@hotelerp.com',
            password: hashedPassword,
            role: 'admin',
            department: 'Administration',
            status: 'active',
          },
          {
            name: 'Front Desk Receptionist',
            email: 'reception@hotelerp.com',
            password: staffPassword,
            role: 'receptionist',
            department: 'Front Desk',
            status: 'active',
          },
        ] as any);
        console.log('[SeedService] Essential system accounts initialized in MongoDB Atlas.');
      }
    } catch (err: any) {
      console.error('[SeedService] Warning during account verification:', err.message);
    }
  } else {
    // In-memory fallback: Ensure essential admin & reception accounts exist in InMemoryStore
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const staffPassword = await bcrypt.hash('reception123', 10);
    if (!InMemoryStore.users.some(u => u.role === 'admin')) {
      InMemoryStore.users.push({
        _id: 'admin_mem_001',
        id: 'admin_mem_001',
        name: 'System Admin',
        email: 'admin@hotelerp.com',
        password: hashedPassword,
        role: 'admin',
        department: 'Administration',
        status: 'active',
        createdAt: new Date(),
      });
    }
    if (!InMemoryStore.users.some(u => u.role === 'receptionist')) {
      InMemoryStore.users.push({
        _id: 'reception_mem_002',
        id: 'reception_mem_002',
        name: 'Front Desk Receptionist',
        email: 'reception@hotelerp.com',
        password: staffPassword,
        role: 'receptionist',
        department: 'Front Desk',
        status: 'active',
        createdAt: new Date(),
      });
    }
    console.log('[SeedService] Essential system accounts initialized in Memory Store.');
  }

  return {
    success: true,
    message: isMongoConnected
      ? 'MongoDB Atlas initialized with clean database'
      : 'In-memory engine initialized cleanly',
    counts: {
      rooms: 0,
      bookings: 0,
      guests: 0,
    },
  };
};

export const dropExtraCollections = async () => {
  let waitCount = 0;
  while (mongoose.connection.readyState === 2 && waitCount < 20) {
    await new Promise((res) => setTimeout(res, 250));
    waitCount++;
  }

  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return;
  }

  const validCollections = new Set([
    'users',
    'rooms',
    'roomtypes',
    'reservations',
    'guests',
    'folios',
    'invoices',
    'payments',
    'services',
    'housekeepings',
    'maintenancerequests',
    'guestservicerequests',
    'employees',
    'attendances',
    'employeeleaves',
    'expenses',
    'departments',
    'roles',
    'systemsettings',
    'auditlogs',
    'restaurantcategories',
    'restaurantmenuitems',
    'restauranttables',
    'restaurantorders',
    'inventoryitems',
    'inventorylogs',
    'suppliers',
    'purchaseorders',
    'supplierpayments',
    'contactinquiries',
    'inquiries',
    'bookings',
  ]);

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const colName = col.name;
      if (!validCollections.has(colName.toLowerCase())) {
        console.log(`[Database Cleanup] Dropping extra collection: ${colName}`);
        await db.collection(colName).drop().catch((err: any) => {
          console.error(`[Database Cleanup] Failed to drop collection ${colName}:`, err.message);
        });
      }
    }
  } catch (err: any) {
    console.error('[Database Cleanup] Error listing or dropping extra collections:', err.message);
  }
};

export const clearAllDummyData = async () => {
  let waitCount = 0;
  while (mongoose.connection.readyState === 2 && waitCount < 20) {
    await new Promise((res) => setTimeout(res, 250));
    waitCount++;
  }

  const isMongoConnected = mongoose.connection.readyState === 1;

  // Clear in-memory store completely
  InMemoryStore.users = [];
  InMemoryStore.rooms = [];
  InMemoryStore.roomTypes = [];
  InMemoryStore.bookings = [];
  InMemoryStore.guests = [];
  InMemoryStore.folios = [];
  InMemoryStore.invoices = [];
  InMemoryStore.payments = [];
  InMemoryStore.services = [];
  InMemoryStore.housekeeping = [];
  InMemoryStore.maintenance = [];
  InMemoryStore.guestServices = [];
  InMemoryStore.employees = [];
  InMemoryStore.attendance = [];
  InMemoryStore.leaves = [];
  InMemoryStore.expenses = [];
  InMemoryStore.restaurantCategories = [];
  InMemoryStore.restaurantMenuItems = [];
  InMemoryStore.restaurantTables = [];
  InMemoryStore.restaurantOrders = [];
  InMemoryStore.inventoryItems = [];
  InMemoryStore.inventoryLogs = [];
  InMemoryStore.suppliers = [];
  InMemoryStore.purchaseOrders = [];
  InMemoryStore.supplierPayments = [];
  InMemoryStore.auditLogs = [];

  if (isMongoConnected) {
    try {
      await Room.deleteMany({});
      await RoomTypeModel.deleteMany({});
      await Booking.deleteMany({});
      await Guest.deleteMany({});
      await Folio.deleteMany({});
      await Invoice.deleteMany({});
      await Payment.deleteMany({});
      await Service.deleteMany({});
      await Housekeeping.deleteMany({});
      await MaintenanceRequest.deleteMany({});
      await GuestServiceRequest.deleteMany({});
      await EmployeeModel.deleteMany({});
      await AttendanceModel.deleteMany({});
      await EmployeeLeaveModel.deleteMany({});
      await ExpenseModel.deleteMany({});
      await RestaurantCategory.deleteMany({});
      await RestaurantMenuItem.deleteMany({});
      await RestaurantTable.deleteMany({});
      await RestaurantOrder.deleteMany({});
      await InventoryItem.deleteMany({});
      await InventoryLog.deleteMany({});
      await Supplier.deleteMany({});
      await PurchaseOrder.deleteMany({});
      await SupplierPayment.deleteMany({});
      await AuditLog.deleteMany({});

      // Remove all users on cleanup
      await User.deleteMany({});

      console.log('[SeedService] All dummy data and initial seed accounts purged from MongoDB Atlas.');
    } catch (err: any) {
      console.error('[SeedService] Error purging data from MongoDB Atlas:', err.message);
    }
  }

  // Also drop any extra collections
  await dropExtraCollections();

  return {
    success: true,
    message: 'All dummy records, seed accounts, and extra collections completely wiped.',
  };
};
