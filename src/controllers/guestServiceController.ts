import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { GuestServiceRequest, IGuestServiceRequest } from '../models/GuestServiceRequest.js';
import { Guest } from '../models/Guest.js';
import { Room } from '../models/Room.js';
import { Booking } from '../models/Booking.js';
import { Folio } from '../models/Folio.js';
import { AuditLog } from '../models/AuditLog.js';
import { InMemoryStore } from '../services/seedService.js';

// Helper to post completed chargeable service to the active Guest Folio
const billServiceToFolio = async (
  serviceRequest: any,
  userId?: string,
  userName?: string
): Promise<{ billed: boolean; folioId?: string; message?: string }> => {
  if (!serviceRequest.isChargeable || serviceRequest.totalPrice <= 0 || serviceRequest.isBilledToFolio) {
    return { billed: false };
  }

  const isMongo = mongoose.connection.readyState === 1;
  const taxRate = 0.10; // 10% standard hospitality tax
  const taxAmount = Number((serviceRequest.totalPrice * taxRate).toFixed(2));
  const totalBilledItemAmount = Number((serviceRequest.totalPrice + taxAmount).toFixed(2));

  let folioCategory: any = 'service';
  if (serviceRequest.serviceType === 'room_service') {
    folioCategory = 'food_beverage';
  } else if (serviceRequest.serviceType === 'extra_bed') {
    folioCategory = 'service';
  } else if (serviceRequest.serviceType === 'other') {
    folioCategory = 'other';
  }

  if (isMongo) {
    // Look up open folio for this room / reservation / guest
    let folio = await Folio.findOne({
      roomNumber: serviceRequest.roomNumber,
      status: 'open',
    });

    if (!folio && serviceRequest.reservation) {
      folio = await Folio.findOne({
        reservation: serviceRequest.reservation,
        status: 'open',
      });
    }

    if (!folio && serviceRequest.guest) {
      folio = await Folio.findOne({
        guest: serviceRequest.guest,
        status: 'open',
      });
    }

    // If no open folio exists, create one for this active stay
    if (!folio) {
      const activeBooking = await Booking.findOne({
        roomNumber: serviceRequest.roomNumber,
        status: { $in: ['checked_in', 'confirmed'] },
      });

      const folioNumber = `FOL-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      folio = await Folio.create({
        folioNumber,
        guest: serviceRequest.guest || activeBooking?.guest || new mongoose.Types.ObjectId(),
        reservation: serviceRequest.reservation || activeBooking?._id || new mongoose.Types.ObjectId(),
        room: serviceRequest.room || activeBooking?.room || activeBooking?.roomId || new mongoose.Types.ObjectId(),
        items: [],
        totalCharges: 0,
        totalPayments: 0,
        balance: 0,
        status: 'open',
        notes: `Folio auto-initialized for Room ${serviceRequest.roomNumber}`,
      });
    }

    const folioItemId = new mongoose.Types.ObjectId();
    const folioItem = {
      _id: folioItemId,
      description: `Guest Service: ${serviceRequest.serviceName} (Qty: ${serviceRequest.quantity} @ $${serviceRequest.unitPrice})`,
      category: folioCategory,
      quantity: serviceRequest.quantity,
      unitPrice: serviceRequest.unitPrice,
      amount: serviceRequest.totalPrice,
      taxAmount: taxAmount,
      date: new Date(),
      addedBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
    };

    folio.items.push(folioItem as any);
    folio.totalCharges = Number((folio.totalCharges + totalBilledItemAmount).toFixed(2));
    folio.balance = Number((folio.balance + totalBilledItemAmount).toFixed(2));
    await folio.save();

    // Also update the active booking totalAmount to match folio charges
    if (serviceRequest.reservation) {
      const booking = await Booking.findById(serviceRequest.reservation);
      if (booking) {
        booking.totalAmount = Number((booking.totalAmount + totalBilledItemAmount).toFixed(2));
        await booking.save();
      }
    } else {
      const booking = await Booking.findOne({
        roomNumber: serviceRequest.roomNumber,
        status: 'checked_in',
      });
      if (booking) {
        booking.totalAmount = Number((booking.totalAmount + totalBilledItemAmount).toFixed(2));
        await booking.save();
      }
    }

    serviceRequest.isBilledToFolio = true;
    serviceRequest.folioId = folio._id;
    serviceRequest.folioItemId = folioItemId.toString();
    serviceRequest.billedAmount = totalBilledItemAmount;
    serviceRequest.billedAt = new Date();
    await serviceRequest.save();

    return { billed: true, folioId: folio._id.toString() };
  } else {
    // In-Memory store flow
    let folio = InMemoryStore.folios.find(
      (f) => (f.roomNumber === serviceRequest.roomNumber || f.reservation === serviceRequest.reservation) && f.status === 'open'
    );

    if (!folio) {
      const activeBooking = InMemoryStore.bookings.find(
        (b) => b.roomNumber === serviceRequest.roomNumber && b.status === 'checked_in'
      );

      const folioId = new mongoose.Types.ObjectId().toString();
      folio = {
        _id: folioId,
        folioNumber: `FOL-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        guest: serviceRequest.guest || activeBooking?.guestId || new mongoose.Types.ObjectId().toString(),
        guestName: serviceRequest.guestName || activeBooking?.guestName,
        reservation: serviceRequest.reservation || activeBooking?._id || new mongoose.Types.ObjectId().toString(),
        bookingNumber: serviceRequest.bookingNumber || activeBooking?.bookingNumber,
        room: serviceRequest.room || activeBooking?.roomId || new mongoose.Types.ObjectId().toString(),
        roomNumber: serviceRequest.roomNumber,
        items: [],
        totalCharges: 0,
        totalPayments: 0,
        balance: 0,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      InMemoryStore.folios.push(folio);
    }

    const folioItemId = new mongoose.Types.ObjectId().toString();
    const folioItem = {
      _id: folioItemId,
      description: `Guest Service: ${serviceRequest.serviceName} (Qty: ${serviceRequest.quantity} @ $${serviceRequest.unitPrice})`,
      category: folioCategory,
      quantity: serviceRequest.quantity,
      unitPrice: serviceRequest.unitPrice,
      amount: serviceRequest.totalPrice,
      taxAmount: taxAmount,
      date: new Date(),
    };

    folio.items.push(folioItem);
    folio.totalCharges = Number((folio.totalCharges + totalBilledItemAmount).toFixed(2));
    folio.balance = Number((folio.balance + totalBilledItemAmount).toFixed(2));
    folio.updatedAt = new Date();

    const booking = InMemoryStore.bookings.find(
      (b) => b._id === serviceRequest.reservation || (b.roomNumber === serviceRequest.roomNumber && b.status === 'checked_in')
    );
    if (booking) {
      booking.totalAmount = Number((booking.totalAmount + totalBilledItemAmount).toFixed(2));
      booking.updatedAt = new Date();
    }

    serviceRequest.isBilledToFolio = true;
    serviceRequest.folioId = folio._id;
    serviceRequest.folioItemId = folioItemId;
    serviceRequest.billedAmount = totalBilledItemAmount;
    serviceRequest.billedAt = new Date();

    return { billed: true, folioId: folio._id };
  }
};

export const getGuestServicesOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const isMongo = mongoose.connection.readyState === 1;
    let requests: any[] = [];

    if (isMongo) {
      requests = await GuestServiceRequest.find().sort({ createdTime: -1 }).lean();
    } else {
      requests = InMemoryStore.guestServices || [];
    }

    const counts = {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      in_progress: requests.filter((r) => r.status === 'in_progress').length,
      completed: requests.filter((r) => r.status === 'completed').length,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
      chargeable: requests.filter((r) => r.isChargeable).length,
      billedToFolio: requests.filter((r) => r.isBilledToFolio).length,
      totalBilledRevenue: requests
        .filter((r) => r.isBilledToFolio)
        .reduce((acc, r) => acc + (r.billedAmount || r.totalPrice || 0), 0),
    };

    const categoryCounts: Record<string, number> = {
      room_service: requests.filter((r) => r.serviceType === 'room_service').length,
      extra_bed: requests.filter((r) => r.serviceType === 'extra_bed').length,
      towels: requests.filter((r) => r.serviceType === 'towels').length,
      toiletries: requests.filter((r) => r.serviceType === 'toiletries').length,
      wake_up_call: requests.filter((r) => r.serviceType === 'wake_up_call').length,
      cleaning_request: requests.filter((r) => r.serviceType === 'cleaning_request').length,
      other: requests.filter((r) => r.serviceType === 'other').length,
    };

    res.json({
      success: true,
      data: {
        counts,
        categoryCounts,
        recent: requests.slice(0, 10),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGuestServiceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, serviceType, roomNumber, isChargeable, isBilledToFolio } = req.query;
    const isMongo = mongoose.connection.readyState === 1;
    let requests: any[] = [];

    if (isMongo) {
      const filter: any = {};
      if (status && status !== 'all') filter.status = status;
      if (serviceType && serviceType !== 'all') filter.serviceType = serviceType;
      if (roomNumber) filter.roomNumber = roomNumber;
      if (isChargeable !== undefined) filter.isChargeable = isChargeable === 'true';
      if (isBilledToFolio !== undefined) filter.isBilledToFolio = isBilledToFolio === 'true';

      requests = await GuestServiceRequest.find(filter)
        .populate('guest')
        .populate('room')
        .populate('assignedEmployee')
        .sort({ createdTime: -1 })
        .lean();
    } else {
      requests = (InMemoryStore.guestServices || []).filter((r) => {
        if (status && status !== 'all' && r.status !== status) return false;
        if (serviceType && serviceType !== 'all' && r.serviceType !== serviceType) return false;
        if (roomNumber && r.roomNumber !== roomNumber) return false;
        if (isChargeable !== undefined && r.isChargeable !== (isChargeable === 'true')) return false;
        if (isBilledToFolio !== undefined && r.isBilledToFolio !== (isBilledToFolio === 'true')) return false;
        return true;
      });
    }

    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createGuestServiceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      guestId,
      guestName,
      guestPhone,
      roomId,
      roomNumber,
      reservationId,
      bookingNumber,
      serviceType,
      serviceName,
      serviceCode,
      description,
      quantity,
      unitPrice,
      priority,
      assignedEmployeeId,
      assignedStaffName,
      scheduledTime,
      notes,
      status,
    } = req.body;

    if (!roomNumber || !serviceType || !serviceName) {
      res.status(400).json({
        success: false,
        message: 'Room number, service type, and service name are required',
      });
      return;
    }

    const isMongo = mongoose.connection.readyState === 1;
    const requestNumber = `GSR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const qty = Math.max(1, Number(quantity) || 1);
    const uPrice = Math.max(0, Number(unitPrice) || 0);
    const totalPrice = Number((qty * uPrice).toFixed(2));
    const isChargeable = totalPrice > 0;
    const reqStatus = status || 'pending';

    let request: any;

    if (isMongo) {
      // Find active room & guest if not provided
      let guestObj = guestId ? await Guest.findById(guestId) : null;
      let roomObj = await Room.findOne({ roomNumber });
      let activeBooking = null;

      if (!guestObj || !reservationId) {
        activeBooking = await Booking.findOne({
          roomNumber,
          status: { $in: ['checked_in', 'confirmed'] },
        });
        if (activeBooking && !guestObj) {
          guestObj = await Guest.findById(activeBooking.guest);
        }
      }

      request = await GuestServiceRequest.create({
        requestNumber,
        guest: guestObj?._id || guestId || activeBooking?.guest || new mongoose.Types.ObjectId(),
        guestName: guestName || guestObj?.fullName || activeBooking?.guestName || 'In-House Guest',
        guestPhone: guestPhone || guestObj?.phone || activeBooking?.guestPhone || '',
        room: roomObj?._id || roomId || activeBooking?.room || new mongoose.Types.ObjectId(),
        roomNumber,
        reservation: reservationId || activeBooking?._id || null,
        bookingNumber: bookingNumber || activeBooking?.bookingNumber || '',
        serviceType,
        serviceName,
        serviceCode: serviceCode || '',
        description: description || '',
        quantity: qty,
        unitPrice: uPrice,
        totalPrice,
        isChargeable,
        status: reqStatus,
        priority: priority || 'medium',
        assignedEmployee: assignedEmployeeId || null,
        assignedStaffName: assignedStaffName || 'Concierge / Guest Duty Staff',
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        createdTime: new Date(),
        notes: notes || '',
        isBilledToFolio: false,
      });

      // If created directly in completed status, immediately connect to folio if chargeable
      if (reqStatus === 'completed') {
        request.completedTime = new Date();
        await request.save();
        if (isChargeable) {
          await billServiceToFolio(request, (req as any).user?.id, (req as any).user?.name);
        }
      }
    } else {
      const roomObj = InMemoryStore.rooms.find((r) => r.roomNumber === roomNumber);
      const activeBooking = InMemoryStore.bookings.find(
        (b) => b.roomNumber === roomNumber && b.status === 'checked_in'
      );
      const guestObj = InMemoryStore.guests.find((g) => g._id === guestId || g.fullName === guestName);

      request = {
        _id: new mongoose.Types.ObjectId().toString(),
        requestNumber,
        guest: guestObj?._id || guestId || activeBooking?.guestId || new mongoose.Types.ObjectId().toString(),
        guestName: guestName || guestObj?.fullName || activeBooking?.guestName || 'In-House Guest',
        guestPhone: guestPhone || guestObj?.phone || activeBooking?.guestPhone || '',
        room: roomObj?._id || roomId || new mongoose.Types.ObjectId().toString(),
        roomNumber,
        reservation: reservationId || activeBooking?._id || null,
        bookingNumber: bookingNumber || activeBooking?.bookingNumber || '',
        serviceType,
        serviceName,
        serviceCode: serviceCode || '',
        description: description || '',
        quantity: qty,
        unitPrice: uPrice,
        totalPrice,
        isChargeable,
        status: reqStatus,
        priority: priority || 'medium',
        assignedEmployee: assignedEmployeeId || null,
        assignedStaffName: assignedStaffName || 'Concierge / Guest Duty Staff',
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        createdTime: new Date(),
        completedTime: reqStatus === 'completed' ? new Date() : null,
        notes: notes || '',
        isBilledToFolio: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (!InMemoryStore.guestServices) InMemoryStore.guestServices = [];
      InMemoryStore.guestServices.unshift(request);

      if (reqStatus === 'completed' && isChargeable) {
        await billServiceToFolio(request, (req as any).user?.id, (req as any).user?.name);
      }
    }

    // Audit log
    const audit = {
      userName: (req as any).user?.name || 'Concierge Desk',
      userRole: (req as any).user?.role || 'staff',
      module: 'guest_services' as const,
      action: 'CREATE_SERVICE_REQUEST',
      details: `Created guest service ${requestNumber} (${serviceName} x${qty} - $${totalPrice}) for Room ${roomNumber}. Assigned: ${assignedStaffName || 'Duty Staff'}`,
      timestamp: new Date(),
    };

    if (isMongo) {
      await AuditLog.create(audit);
    } else {
      InMemoryStore.auditLogs.unshift(audit);
    }

    res.status(201).json({
      success: true,
      data: request,
      message: `Guest service request ${requestNumber} created successfully.${request.isBilledToFolio ? ' Charge connected to Guest Folio.' : ''}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGuestServiceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, assignedStaffName, notes } = req.body;
    const isMongo = mongoose.connection.readyState === 1;

    let updatedRequest: any;
    let folioBilled = false;

    if (isMongo) {
      const request = await GuestServiceRequest.findById(id);
      if (!request) {
        res.status(404).json({ success: false, message: 'Guest service request not found' });
        return;
      }

      if (status) request.status = status;
      if (assignedStaffName) request.assignedStaffName = assignedStaffName;
      if (notes !== undefined) request.notes = notes;

      if (status === 'completed') {
        if (!request.completedTime) request.completedTime = new Date();
        // CONNECT CHARGEABLE SERVICES TO GUEST FOLIO
        if (request.isChargeable && !request.isBilledToFolio) {
          const billResult = await billServiceToFolio(
            request,
            (req as any).user?.id,
            (req as any).user?.name
          );
          folioBilled = billResult.billed;
        }
      }

      await request.save();
      updatedRequest = request;
    } else {
      if (!InMemoryStore.guestServices) InMemoryStore.guestServices = [];
      const index = InMemoryStore.guestServices.findIndex(
        (r) => r._id === id || r.requestNumber === id
      );

      if (index === -1) {
        res.status(404).json({ success: false, message: 'Guest service request not found' });
        return;
      }

      const request = InMemoryStore.guestServices[index];
      if (status) request.status = status;
      if (assignedStaffName) request.assignedStaffName = assignedStaffName;
      if (notes !== undefined) request.notes = notes;
      request.updatedAt = new Date();

      if (status === 'completed') {
        if (!request.completedTime) request.completedTime = new Date();
        if (request.isChargeable && !request.isBilledToFolio) {
          const billResult = await billServiceToFolio(
            request,
            (req as any).user?.id,
            (req as any).user?.name
          );
          folioBilled = billResult.billed;
        }
      }

      updatedRequest = request;
    }

    // Audit log
    const audit = {
      userName: (req as any).user?.name || 'Staff Member',
      userRole: (req as any).user?.role || 'staff',
      module: 'guest_services' as const,
      action: 'UPDATE_SERVICE_STATUS',
      details: `Guest service ${updatedRequest.requestNumber} status updated to ${status}.${folioBilled ? ' Charged & connected to Guest Folio.' : ''}`,
      timestamp: new Date(),
    };

    if (isMongo) {
      await AuditLog.create(audit);
    } else {
      InMemoryStore.auditLogs.unshift(audit);
    }

    res.json({
      success: true,
      data: updatedRequest,
      message: `Request status updated to ${status}.${folioBilled ? ' Posted to Guest Folio ledger.' : ''}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGuestServiceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isMongo = mongoose.connection.readyState === 1;

    if (isMongo) {
      await GuestServiceRequest.findByIdAndDelete(id);
    } else {
      if (InMemoryStore.guestServices) {
        InMemoryStore.guestServices = InMemoryStore.guestServices.filter(
          (r) => r._id !== id && r.requestNumber !== id
        );
      }
    }

    res.json({ success: true, message: 'Guest service request deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
