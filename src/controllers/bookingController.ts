import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { EmailService } from '../services/emailService.js';

export const getBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, paymentStatus, search, guestId, roomId } = req.query;
    let bookings = await StorageService.getAllBookings({
      status,
      paymentStatus,
      guestId: typeof guestId === 'string' ? guestId : undefined,
      roomId: typeof roomId === 'string' ? roomId : undefined,
    });

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      bookings = bookings.filter(
        (b: any) =>
          (b.guestName && b.guestName.toLowerCase().includes(q)) ||
          (b.bookingNumber && b.bookingNumber.toLowerCase().includes(q)) ||
          (b.reservationNumber && b.reservationNumber.toLowerCase().includes(q)) ||
          (b.roomNumber && b.roomNumber.toLowerCase().includes(q)) ||
          (b.guestPhone && b.guestPhone.includes(q))
      );
    }

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    let booking = await StorageService.getBookingById(id);

    if (!booking) {
      const allBookings = await StorageService.getAllBookings();
      const ref = (id || '').toLowerCase().trim();
      booking = allBookings.find(
        (b: any) =>
          (b.bookingNumber && b.bookingNumber.toLowerCase() === ref) ||
          (b.reservationNumber && b.reservationNumber.toLowerCase() === ref) ||
          (b._id && String(b._id) === ref)
      );
    }

    if (!booking) {
      res.status(404).json({ success: false, message: 'Reservation not found' });
      return;
    }
    res.status(200).json({
      success: true,
      booking,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

export const searchAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { checkInDate, checkOutDate, checkIn, checkOut, guests, roomType, floor } = req.query;
    const start = (checkInDate || checkIn) as string;
    const end = (checkOutDate || checkOut) as string;

    if (!start || !end) {
      res.status(400).json({
        success: false,
        message: 'Check-in date and check-out date are required for availability search.',
      });
      return;
    }

    const result = await StorageService.searchAvailableRooms({
      checkInDate: start,
      checkOutDate: end,
      guests: guests ? Number(guests) : undefined,
      roomType: roomType as string,
      floor: floor as string,
    });

    const availableRooms = Array.isArray(result) ? result : result.availableRooms || [];
    const reservedRooms = !Array.isArray(result) ? result.reservedRooms || [] : [];

    res.status(200).json({
      success: true,
      count: availableRooms.length,
      availableRooms,
      reservedRooms,
      reservedCount: reservedRooms.length,
    });
  } catch (error) {
    next(error);
  }
};

export const checkRoomAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roomId, checkInDate, checkOutDate, checkIn, checkOut, excludeBookingId, adults, children, promoCode } = req.body;
    const start = checkInDate || checkIn || new Date().toISOString().split('T')[0];
    const end = checkOutDate || checkOut || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    if (!roomId) {
      const allRooms = await StorageService.getAllRooms();
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.max(1, endDate.getTime() - startDate.getTime());
      const nights = Math.ceil(diffTime / (1000 * 3600 * 24));

      const results = [];
      for (const r of allRooms) {
        const roomIdStr = String(r._id || r.id || r.roomNumber);
        const availCheck = await StorageService.checkRoomAvailability(
          roomIdStr,
          start,
          end,
          excludeBookingId
        );
        const isStatusAvailable = (r.status || 'available').toLowerCase() === 'available';
        const isAvail = Boolean(availCheck.available && isStatusAvailable);

        results.push({
          roomId: roomIdStr,
          roomNumber: r.roomNumber,
          roomName: r.name || `Room ${r.roomNumber}`,
          category: r.type || r.category || 'Deluxe',
          isAvailable: isAvail,
          availableInventory: isAvail ? 1 : 0,
          reason: availCheck.reason,
          nights,
          pricing: {
            basePricePerNight: r.pricePerNight || 150,
            rawTotal: (r.pricePerNight || 150) * nights,
            discountAmount: 0,
            subtotal: (r.pricePerNight || 150) * nights,
            taxesAndServiceFees: Math.round((r.pricePerNight || 150) * nights * 0.12),
            resortFee: 0,
            estimatedTotal: Math.round((r.pricePerNight || 150) * nights * 1.12),
            currency: 'RS',
          },
          ratePlans: [],
        });
      }

      res.status(200).json({
        success: true,
        checkIn: start,
        checkOut: end,
        nights,
        adults: adults || 1,
        children: children || 0,
        roomsCount: 1,
        promoApplied: promoCode || null,
        discountPercent: 0,
        results,
      });
      return;
    }

    const result = await StorageService.checkRoomAvailability(
      roomId,
      start,
      end,
      excludeBookingId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRoomSelection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roomId, checkIn, checkOut, checkInDate, checkOutDate, roomsCount } = req.body;
    const start = checkIn || checkInDate;
    const end = checkOut || checkOutDate;

    if (!roomId || !start || !end) {
      res.status(400).json({
        success: false,
        isAvailable: false,
        availableInventory: 0,
        requestedRooms: roomsCount || 1,
        message: 'Room selection, check-in date, and check-out date are required.',
      });
      return;
    }

    const check = await StorageService.checkRoomAvailability(roomId, start, end);
    res.status(200).json({
      success: true,
      isAvailable: check.available,
      availableInventory: check.available ? 1 : 0,
      requestedRooms: roomsCount || 1,
      message: check.available ? 'Suite available for selected dates' : check.reason || 'Suite is unavailable for selected dates.',
    });
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guestObj = req.body.guest || {};
    const guestName =
      req.body.guestName ||
      (guestObj.firstName || guestObj.lastName
        ? `${guestObj.firstName || ''} ${guestObj.lastName || ''}`.trim()
        : undefined);
    const guestEmail = req.body.guestEmail || guestObj.email;
    const guestPhone = req.body.guestPhone || guestObj.phone || 'N/A';
    const guestIdType = req.body.guestIdType || guestObj.idType || 'passport';
    const guestIdNumber = req.body.guestIdNumber || guestObj.idNumber || '';
    const nationality = req.body.nationality || guestObj.nationality || guestObj.country || 'International';

    const roomId = req.body.roomId;
    const checkInDate = req.body.checkInDate || req.body.checkIn;
    const checkOutDate = req.body.checkOutDate || req.body.checkOut;

    const numberOfAdults = Number(req.body.numberOfAdults || req.body.adults || req.body.numberOfGuests || 1);
    const numberOfChildren = Number(req.body.numberOfChildren || req.body.children || 0);

    const roomRate = req.body.roomRate ?? req.body.pricePerNight;
    const discount = Number(req.body.discount || 0);
    const tax = req.body.tax !== undefined ? Number(req.body.tax) : undefined;
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount) : undefined;
    const paidAmount = Number(req.body.paidAmount || 0);
    const paymentStatus = req.body.paymentStatus;
    const status = req.body.status || 'confirmed';
    const bookingSource = req.body.bookingSource || req.body.source || (req.user ? 'walk_in' : 'website');
    const source = req.body.source || req.body.bookingSource || (req.user ? 'direct' : 'website');
    const specialRequests = req.body.specialRequests || guestObj.specialRequests || '';
    const notes = req.body.notes || '';

    if (!roomId || !checkInDate || !checkOutDate) {
      res.status(400).json({
        success: false,
        message: 'Room selection, Check-in date, and Check-out date are required.',
      });
      return;
    }

    if (!req.body.guestId && (!guestName || (!guestPhone && !guestEmail))) {
      res.status(400).json({
        success: false,
        message: 'Please provide either an existing Guest selection or Guest Name and Contact info (Phone or Email).',
      });
      return;
    }

    const booking = await StorageService.createBooking({
      guestId: req.body.guestId,
      guestName,
      guestEmail,
      guestPhone,
      guestIdType,
      guestIdNumber,
      nationality,
      idIssuingCountry: req.body.idIssuingCountry,
      password: req.body.password,
      roomId,
      checkInDate,
      checkOutDate,
      numberOfAdults,
      numberOfChildren,
      roomRate,
      pricePerNight: roomRate,
      subtotal: req.body.subtotal !== undefined ? Number(req.body.subtotal) : undefined,
      discount,
      tax,
      totalAmount,
      paidAmount,
      paymentStatus,
      status: (status || 'confirmed').toLowerCase(),
      bookingSource,
      source,
      specialRequests,
      notes,
      assignedStaffId: req.user?.id,
    });

    if (Number(paidAmount) > 0) {
      await StorageService.createPayment({
        bookingId: booking._id,
        guestName: booking.guestName,
        roomNumber: booking.roomNumber,
        amount: Number(paidAmount),
        paymentMethod: req.body.paymentMethod || 'credit_card',
        status: 'completed',
        notes: 'Initial reservation advance deposit',
        recordedBy: `${req.user?.name || 'Website Portal'} (${req.user?.role || 'Guest'})`,
      });
    }

    await StorageService.logAction({
      userName: req.user?.name || booking.guestName || 'Guest User',
      userRole: req.user?.role || 'guest',
      module: 'reception',
      action: 'RESERVATION_CREATED',
      details: `Created reservation ${booking.bookingNumber} for ${booking.guestName} in Room ${booking.roomNumber}. Channel: [${bookingSource.toUpperCase()}]. Status: [${booking.status.toUpperCase()}]. Total: $${booking.totalAmount}.`,
      ipAddress: req.ip,
    });

    // Automatically dispatch booking confirmation email with Total Bill, Total Persons & Total Stay Duration
    const recipientEmail =
      guestEmail ||
      guestObj?.email ||
      req.body.email ||
      booking.guestEmail ||
      booking.email ||
      (typeof booking.guest === 'object' ? booking.guest?.email : undefined);

    if (recipientEmail) {
      EmailService.sendBookingConfirmationEmail(booking, recipientEmail).catch((mailErr) => {
        console.error(`[BookingController] Booking confirmation email notice for [${recipientEmail}]:`, mailErr.message);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      booking,
      data: booking,
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        conflictingBooking: error.conflictingBooking,
      });
      return;
    }
    next(error);
  }
};

export const updateBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await StorageService.getBookingById(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Reservation not found' });
      return;
    }

    const updated = await StorageService.updateBooking(id, updateData);

    await StorageService.logAction({
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'receptionist',
      module: 'reception',
      action: 'RESERVATION_UPDATED',
      details: `Updated reservation ${existing.bookingNumber || existing.reservationNumber} for ${existing.guestName}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Reservation updated successfully',
      booking: updated,
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        conflictingBooking: error.conflictingBooking,
      });
      return;
    }
    next(error);
  }
};

export const updateBookingStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      status,
      cancellationReason,
      roomId,
      keyCardNumber,
      guestIdType,
      guestIdNumber,
      guestPhone,
      guestEmail,
      initialPaymentAmount,
      paymentMethod,
      notes,
    } = req.body;

    const booking = await StorageService.getBookingById(id);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Reservation not found' });
      return;
    }

    const normalizedStatus = (status || '').toLowerCase();
    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
    if (!validStatuses.includes(normalizedStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid reservation status. Allowed values: ${validStatuses.join(', ')}`,
      });
      return;
    }

    if (booking.status === 'checked_in' && (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show')) {
      res.status(400).json({
        success: false,
        message: 'Cannot cancel an active in-house reservation. The guest is currently checked in. Please perform check-out instead.',
      });
      return;
    }

    const updatePayload: any = {
      status: normalizedStatus,
    };

    if (roomId) updatePayload.roomId = roomId;
    if (keyCardNumber) updatePayload.keyCardNumber = keyCardNumber;
    if (guestIdType) updatePayload.guestIdType = guestIdType;
    if (guestIdNumber) updatePayload.guestIdNumber = guestIdNumber;
    if (guestPhone) updatePayload.guestPhone = guestPhone;
    if (guestEmail) updatePayload.guestEmail = guestEmail;
    if (notes) updatePayload.notes = notes;

    if (normalizedStatus === 'checked_in') {
      updatePayload.actualCheckIn = new Date();
      if (initialPaymentAmount && Number(initialPaymentAmount) > 0) {
        updatePayload.paidAmount = (booking.paidAmount || 0) + Number(initialPaymentAmount);
        const due = Math.max(0, booking.totalAmount - updatePayload.paidAmount);
        updatePayload.paymentStatus = due === 0 ? 'paid' : 'partial';
      }
    } else if (normalizedStatus === 'checked_out') {
      updatePayload.actualCheckOut = new Date();
    } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show') {
      updatePayload.cancelledAt = new Date();
      if (cancellationReason) {
        updatePayload.cancellationReason = cancellationReason;
      }

      // 10% fee and 90% refund calculation before check-in
      const initialPaid = Number(booking.paidAmount || 0);
      const fee10Percent = Number((initialPaid * 0.10).toFixed(2));
      const refund90Percent = Number((initialPaid * 0.90).toFixed(2));

      if (initialPaid > 0 && refund90Percent > 0) {
        try {
          await StorageService.createPayment({
            bookingId: booking._id,
            guestName: booking.guestName || 'Valued Patron',
            roomNumber: booking.roomNumber || 'N/A',
            amount: -refund90Percent,
            paymentMethod: booking.paymentMethod || 'credit_card',
            status: 'completed',
            notes: `90% Refund issued on cancellation (10% fee retained: Rs. ${fee10Percent.toFixed(2)})`,
            recordedBy: `${req.user?.name || 'Staff'} (${req.user?.role || 'Staff'})`,
          });
        } catch (payErr) {
          console.error('Error creating refund payment record:', payErr);
        }

        updatePayload.paidAmount = fee10Percent;
        updatePayload.totalAmount = fee10Percent;
        updatePayload.paymentStatus = 'refunded';
      }
    }

    const updated = await StorageService.updateBooking(id, updatePayload);

    // Sync assigned room status
    const targetRoomId = roomId || booking.roomId;
    if (targetRoomId) {
      if (normalizedStatus === 'checked_in') {
        await StorageService.updateRoom(targetRoomId, { status: 'occupied' });
      } else if (normalizedStatus === 'checked_out') {
        await StorageService.updateRoom(targetRoomId, { status: 'available', cleaningStatus: 'CLEAN', currentBookingId: null });
      } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show') {
        await StorageService.updateRoom(targetRoomId, { status: 'available', currentBookingId: null });
      }
    }
    await StorageService.syncRoomStatusesWithBookings();

    await StorageService.logAction({
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'receptionist',
      module: 'reception',
      action: 'RESERVATION_STATUS_UPDATE',
      details: `Updated reservation ${booking.bookingNumber || booking.reservationNumber} status to [${normalizedStatus.toUpperCase()}].`,
      ipAddress: req.ip,
    });

    // If status became confirmed, send confirmation email
    if (normalizedStatus === 'confirmed' && (booking.status !== 'confirmed' || req.body.sendConfirmationEmail === true)) {
      const recipientEmail = guestEmail || updated?.guestEmail || updated?.email || booking.guestEmail || booking.email;
      if (recipientEmail) {
        EmailService.sendBookingConfirmationEmail(updated, recipientEmail).catch((mailErr) => {
          console.error(`[BookingController] Booking status confirmation email notice for [${recipientEmail}]:`, mailErr.message);
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Reservation status updated to ${normalizedStatus.toUpperCase()}`,
      booking: updated,
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

export const addPaymentToBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, notes } = req.body;

    const booking = await StorageService.getBookingById(id);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Reservation not found' });
      return;
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      res.status(400).json({ success: false, message: 'Please enter a valid payment amount.' });
      return;
    }

    const newPaidTotal = (Number(booking.paidAmount) || 0) + payAmount;
    const paymentStatus =
      newPaidTotal >= Number(booking.totalAmount) ? 'paid' : 'partial';

    const payment = await StorageService.createPayment({
      bookingId: booking._id,
      guestName: booking.guestName,
      roomNumber: booking.roomNumber,
      amount: payAmount,
      paymentMethod: paymentMethod || 'credit_card',
      status: 'completed',
      notes: notes || 'Folio payment addition',
      recordedBy: `${req.user?.name || 'Staff'} (${req.user?.role || 'Receptionist'})`,
    });

    const updatedBooking = await StorageService.updateBooking(id, {
      paidAmount: newPaidTotal,
      paymentStatus,
    });

    await StorageService.logAction({
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'receptionist',
      module: 'billing',
      action: 'PAYMENT_RECORDED',
      details: `Recorded payment of $${payAmount} for reservation ${booking.bookingNumber || booking.reservationNumber} (${booking.guestName}). Receipt: ${payment.receiptNumber}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Payment of $${payAmount} processed successfully`,
      payment,
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const booking = await StorageService.getBookingById(id);
    if (!booking) {
      res.status(404).json({ success: false, message: 'Reservation not found' });
      return;
    }

    await StorageService.deleteBooking(id);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'reception',
      action: 'RESERVATION_DELETED',
      details: `Deleted reservation ${booking.bookingNumber || booking.reservationNumber} for ${booking.guestName}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Reservation removed successfully',
    });
  } catch (error) {
    next(error);
  }
};
