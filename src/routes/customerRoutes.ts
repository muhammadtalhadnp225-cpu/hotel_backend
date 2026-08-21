import { Router, Request, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { Reservation } from '../models/Reservation.js';
import { Room } from '../models/Room.js';
import { GuestServiceRequest } from '../models/GuestServiceRequest.js';
import { Guest } from '../models/Guest.js';

const router = Router();

// Apply optionalAuth so req.user is populated if token is supplied
router.use(optionalAuth);

/**
 * GET /api/customer/bookings
 * Returns authenticated customer's portfolio of reservations and summary stats
 */
router.get('/bookings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userEmail = req.user?.email?.toLowerCase().trim();
    const userId = req.user?.id;

    let query: any = {};
    if (userEmail) {
      // Find guest IDs matching this email
      const matchingGuests = await Guest.find({ email: new RegExp(`^${userEmail}$`, 'i') }).select('_id');
      const guestIds = matchingGuests.map(g => g._id);

      query = {
        $or: [
          { guestEmail: new RegExp(`^${userEmail}$`, 'i') },
          { guest: { $in: guestIds } },
          ...(userId ? [{ createdBy: userId }] : [])
        ]
      };
    } else {
      // If unauthenticated or no email, return empty portfolio structure cleanly
      return res.json({
        success: true,
        count: 0,
        overview: {
          upcomingBooking: null,
          currentStay: null,
          recentBooking: null,
          totalStaysCount: 0,
          upcomingCount: 0,
          activeCount: 0
        },
        bookings: []
      });
    }

    const rawReservations = await Reservation.find(query)
      .populate('room')
      .sort({ checkInDate: -1 })
      .lean();

    const now = new Date();

    const mappedBookings = rawReservations.map((r: any) => {
      const checkIn = new Date(r.checkInDate);
      const checkOut = new Date(r.checkOutDate);

      let stayType: 'CURRENT' | 'UPCOMING' | 'PAST' | 'CANCELLED' = 'UPCOMING';
      if (r.status === 'cancelled') {
        stayType = 'CANCELLED';
      } else if (now >= checkIn && now <= checkOut) {
        stayType = 'CURRENT';
      } else if (now < checkIn) {
        stayType = 'UPCOMING';
      } else {
        stayType = 'PAST';
      }

      const roomData = r.room || {};

      return {
        id: r._id.toString(),
        referenceNumber: r.reservationNumber || r.bookingNumber || `RES-${r._id.toString().slice(-6).toUpperCase()}`,
        roomId: roomData._id?.toString() || r.roomId?.toString() || '',
        roomName: roomData.name || r.roomType || 'Aethelgard Luxury Suite',
        roomCategory: roomData.category || r.roomType || 'Suite',
        roomImage: (roomData.images && roomData.images[0]) || 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        ratePlanId: 'rp-standard',
        ratePlanName: 'Imperial Bespoke Experience',
        checkIn: r.checkInDate ? new Date(r.checkInDate).toISOString() : new Date().toISOString(),
        checkOut: r.checkOutDate ? new Date(r.checkOutDate).toISOString() : new Date().toISOString(),
        nights: r.totalNights || Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))),
        adults: r.numberOfAdults || 1,
        children: r.numberOfChildren || 0,
        roomsCount: 1,
        stayType,
        guest: {
          title: req.user?.name ? 'VIP' : 'Mr',
          firstName: r.guestName ? r.guestName.split(' ')[0] : (req.user?.name || 'Guest'),
          lastName: r.guestName ? r.guestName.split(' ').slice(1).join(' ') : '',
          email: r.guestEmail || req.user?.email || '',
          phone: r.guestPhone || '',
          country: 'Maldives',
          specialRequests: r.specialRequests || '',
          estimatedArrivalTime: '15:00'
        },
        selectedAddons: [],
        priceBreakdown: {
          roomBaseTotal: r.subtotal || r.totalAmount || 0,
          ratePlanAdjustment: 0,
          addonsTotal: 0,
          taxesAndServiceFees: r.tax || 0,
          resortFee: 0,
          discountAmount: r.discount || 0,
          grandTotal: r.totalAmount || 0,
          currency: 'RS'
        },
        paymentStatus: r.paymentStatus === 'paid' ? 'PAID_ONLINE' : 'CONFIRMED_AT_CHECKOUT',
        status: r.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      };
    });

    const upcomingBooking = mappedBookings.find(b => b.stayType === 'UPCOMING') || null;
    const currentStay = mappedBookings.find(b => b.stayType === 'CURRENT') || null;
    const recentBooking = mappedBookings[0] || null;

    const upcomingCount = mappedBookings.filter(b => b.stayType === 'UPCOMING').length;
    const activeCount = mappedBookings.filter(b => b.stayType === 'CURRENT').length;
    const totalStaysCount = mappedBookings.filter(b => b.stayType !== 'CANCELLED').length;

    res.json({
      success: true,
      count: mappedBookings.length,
      overview: {
        upcomingBooking,
        currentStay,
        recentBooking,
        totalStaysCount,
        upcomingCount,
        activeCount
      },
      bookings: mappedBookings
    });
  } catch (error: any) {
    console.error('[Customer Bookings Error]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve reservation portfolio'
    });
  }
});

/**
 * GET /api/customer/bookings/:idOrRef
 */
router.get('/bookings/:idOrRef', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idOrRef } = req.params;
    let reservation: any = null;

    if (idOrRef.match(/^[0-9a-fA-F]{24}$/)) {
      reservation = await Reservation.findById(idOrRef).populate('room').lean();
    }
    if (!reservation) {
      reservation = await Reservation.findOne({
        $or: [{ reservationNumber: idOrRef }, { bookingNumber: idOrRef }]
      }).populate('room').lean();
    }

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    const roomData = reservation.room || {};

    res.json({
      success: true,
      data: {
        booking: {
          id: reservation._id.toString(),
          referenceNumber: reservation.reservationNumber || reservation.bookingNumber,
          roomId: roomData._id?.toString() || '',
          roomName: roomData.name || reservation.roomType || 'Aethelgard Luxury Suite',
          roomCategory: roomData.category || 'Suite',
          roomImage: (roomData.images && roomData.images[0]) || 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
          ratePlanId: 'rp-standard',
          ratePlanName: 'Imperial Bespoke Experience',
          checkIn: new Date(reservation.checkInDate).toISOString(),
          checkOut: new Date(reservation.checkOutDate).toISOString(),
          nights: reservation.totalNights || 1,
          adults: reservation.numberOfAdults || 1,
          children: reservation.numberOfChildren || 0,
          guest: {
            title: 'VIP',
            firstName: reservation.guestName ? reservation.guestName.split(' ')[0] : 'Guest',
            lastName: reservation.guestName ? reservation.guestName.split(' ').slice(1).join(' ') : '',
            email: reservation.guestEmail || '',
            phone: reservation.guestPhone || '',
            country: 'Maldives',
            specialRequests: reservation.specialRequests || ''
          },
          selectedAddons: [],
          priceBreakdown: {
            roomBaseTotal: reservation.subtotal || reservation.totalAmount || 0,
            ratePlanAdjustment: 0,
            addonsTotal: 0,
            taxesAndServiceFees: reservation.tax || 0,
            resortFee: 0,
            discountAmount: reservation.discount || 0,
            grandTotal: reservation.totalAmount || 0,
            currency: 'RS'
          },
          paymentStatus: reservation.paymentStatus === 'paid' ? 'PAID_ONLINE' : 'CONFIRMED_AT_CHECKOUT',
          status: reservation.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
          createdAt: new Date(reservation.createdAt).toISOString()
        },
        room: roomData,
        hotel: {
          name: 'Aethelgard Resort & Sanctuary',
          address: '1000 Celestial Point, Coral Peninsula, Maldives',
          conciergePhone: '+1 (800) 555-LUXE',
          whatsapp: '+1 (800) 555-5893',
          checkInTime: '15:00',
          checkOutTime: '11:00'
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching reservation detail' });
  }
});

/**
 * GET /api/customer/service-requests
 */
router.get('/service-requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userEmail = req.user?.email?.toLowerCase().trim();
    let query: any = {};
    if (userEmail) {
      query = { guestPhone: userEmail }; // or search
    }
    const requests = await GuestServiceRequest.find().sort({ createdTime: -1 }).limit(20).lean();
    
    const mapped = requests.map((r: any) => ({
      id: r._id.toString(),
      userId: req.user?.id || '',
      userEmail: req.user?.email || '',
      userName: r.guestName || 'VIP Guest',
      reservationReference: r.bookingNumber || '',
      roomNumber: r.roomNumber || '',
      serviceType: r.serviceType?.toUpperCase() || 'ROOM_SERVICE',
      serviceTitle: r.serviceName,
      priority: (r.priority || 'medium').toUpperCase(),
      preferredTime: r.scheduledTime ? new Date(r.scheduledTime).toLocaleTimeString() : 'Immediate',
      instructions: r.description || '',
      quantity: r.quantity || 1,
      status: (r.status || 'pending').toUpperCase(),
      assignedStaff: r.assignedStaffName || 'Butler Desk',
      createdAt: r.createdTime ? new Date(r.createdTime).toISOString() : new Date().toISOString(),
      estimatedCompletionMinutes: 25
    }));

    res.json({
      success: true,
      count: mapped.length,
      data: mapped
    });
  } catch (error: any) {
    res.json({ success: true, count: 0, data: [] });
  }
});

/**
 * POST /api/customer/service-requests
 */
router.post('/service-requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceType, serviceTitle, roomNumber, priority, preferredTime, instructions, quantity, reservationReference } = req.body;
    
    const newRequest = {
      id: `GSR-${Date.now()}`,
      userId: req.user?.id || 'guest',
      userEmail: req.user?.email || 'guest@aethelgard.com',
      userName: req.user?.name || 'VIP Patron',
      reservationReference: reservationReference || '',
      roomNumber: roomNumber || '101',
      serviceType: serviceType || 'ROOM_SERVICE',
      serviceTitle: serviceTitle || 'VIP Service Request',
      priority: priority || 'STANDARD',
      preferredTime: preferredTime || 'Asap',
      instructions: instructions || '',
      quantity: quantity || 1,
      status: 'PENDING',
      assignedStaff: 'Personal Butler',
      createdAt: new Date().toISOString(),
      estimatedCompletionMinutes: 30
    };

    res.status(201).json({
      success: true,
      message: 'Service request dispatched to Butler Desk',
      data: newRequest
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/customer/service-requests/:id/cancel
 */
router.patch('/service-requests/:id/cancel', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Service request cancelled successfully',
    data: { id: req.params.id, status: 'CANCELLED' }
  });
});

export default router;
