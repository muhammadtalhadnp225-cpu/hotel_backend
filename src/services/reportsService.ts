import { StorageService } from './storageService.js';

export interface DateFilterOption {
  filterType?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all_time' | 'custom';
  startDate?: string;
  endDate?: string;
}

export class ReportsService {
  private static parseDateRange(options: DateFilterOption): { start: Date; end: Date } {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    const type = (options.filterType || 'this_month').toLowerCase();

    if (type === 'all_time' || type === 'all') {
      start = new Date(0); // Jan 1, 1970
      end = new Date(Date.now() + 86400000 * 3650); // 10 years in future
    } else if (type === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.setHours(0, 0, 0, 0));
      end = new Date(y.setHours(23, 59, 59, 999));
    } else if (type === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (type === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (type === 'custom' && options.startDate && options.endDate) {
      start = new Date(options.startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default: Last 30 days
      start = new Date(now.getTime() - 30 * 86400000);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  // ================= ADMIN REPORTS =================
  static async getAdminReports(options: DateFilterOption) {
    const { start, end } = this.parseDateRange(options);

    // 1. Fetch raw data in parallel using Promise.all for high performance
    const [
      rooms,
      bookings,
      folios,
      payments,
      serviceReqs,
      employees,
      attendance,
      expenses,
      restaurantOrders,
    ] = await Promise.all([
      StorageService.getAllRooms(),
      StorageService.getAllBookings({ isBillingLedger: true }),
      StorageService.getAllFolios(),
      StorageService.getAllPayments(),
      StorageService.getAllGuestServiceRequests(),
      StorageService.getAllEmployees(),
      StorageService.getAllAttendance(),
      StorageService.getAllExpenses('All'),
      StorageService.getAllRestaurantOrders(),
    ]);

    // Filter datasets by date range
    let filteredBookings = bookings.filter((b: any) => {
      const bDate = b.createdAt || b.checkInDate || b.checkOutDate;
      if (!bDate) return true;
      try {
        const date = new Date(bDate);
        if (isNaN(date.getTime())) return true;
        return date >= start && date <= end;
      } catch {
        return true;
      }
    });

    let filteredPayments = payments.filter((p: any) => {
      const pDate = p.createdAt || p.paymentDate;
      if (!pDate) return true;
      try {
        const date = new Date(pDate);
        if (isNaN(date.getTime())) return true;
        return date >= start && date <= end;
      } catch {
        return true;
      }
    });

    let filteredExpenses = expenses.filter((e: any) => {
      const eDate = e.expenseDate || e.createdAt;
      if (!eDate) return true;
      try {
        const date = new Date(eDate);
        if (isNaN(date.getTime())) return true;
        return date >= start && date <= end;
      } catch {
        return true;
      }
    });

    let filteredOrders = (restaurantOrders || []).filter((o: any) => {
      const oDate = o.createdAt || o.orderDate;
      if (!oDate) return true;
      try {
        const date = new Date(oDate);
        if (isNaN(date.getTime())) return true;
        return date >= start && date <= end;
      } catch {
        return true;
      }
    });

    // ---------------- HOTEL REPORTS ----------------
    const totalRooms = rooms.length || 1;
    const occupiedRooms = rooms.filter((r: any) => r.status === 'occupied').length;
    const reservedRooms = rooms.filter((r: any) => r.status === 'reserved').length;
    const occupancyRatePct = Number(((occupiedRooms / totalRooms) * 100).toFixed(1));

    const checkIns = filteredBookings.filter((b: any) => b.status === 'checked_in');
    const checkOuts = filteredBookings.filter((b: any) => b.status === 'checked_out');
    const cancellations = filteredBookings.filter((b: any) => b.status === 'cancelled');

    // Room revenue from collected booking payments & settled fees
    const roomRevenueTotal = filteredBookings.reduce(
      (sum: number, b: any) => sum + (Number(b.paidAmount) || 0),
      0
    );

    const adr = checkIns.length > 0 ? roomRevenueTotal / checkIns.length : (totalRooms > 0 ? roomRevenueTotal / totalRooms : 0);
    const revPar = totalRooms > 0 ? roomRevenueTotal / totalRooms : 0;

    const hotelReport = {
      occupancyRatePct,
      totalRooms,
      occupiedRooms,
      reservedRooms,
      availableRooms: rooms.filter((r: any) => r.status === 'available').length,
      cleaningRooms: rooms.filter((r: any) => r.status === 'cleaning').length,
      maintenanceRooms: rooms.filter((r: any) => r.status === 'maintenance').length,
      roomRevenueTotal: Number(roomRevenueTotal.toFixed(2)),
      adr: Number(adr.toFixed(2)),
      revPar: Number(revPar.toFixed(2)),
      totalReservations: filteredBookings.length,
      checkInsCount: checkIns.length,
      checkOutsCount: checkOuts.length,
      cancellationsCount: cancellations.length,
      cancellationRatePct: filteredBookings.length > 0 ? Number(((cancellations.length / filteredBookings.length) * 100).toFixed(1)) : 0,
      recentCancellations: cancellations.slice(0, 5),
    };

    // ---------------- FINANCIAL REPORTS ----------------
    const restaurantRevTotal = filteredOrders
      .filter((o: any) => o.status === 'completed' || o.status === 'SERVED' || String(o.paymentStatus).toLowerCase() === 'paid')
      .reduce((sum: number, o: any) => sum + Number(o.totalAmount || o.totalPrice || 0), 0);

    const serviceRevTotal = serviceReqs
      .filter((s: any) => String(s.paymentStatus).toUpperCase() === 'PAID' || String(s.status).toUpperCase() === 'COMPLETED' || String(s.status).toUpperCase() === 'SERVED' || s.isChargeable)
      .reduce((sum: number, s: any) => sum + Number(s.billedAmount || s.totalPrice || s.price || 0), 0);

    const totalRevenue = roomRevenueTotal + restaurantRevTotal + serviceRevTotal;
    const totalExpensesSum = filteredExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const netProfitOrLoss = totalRevenue - totalExpensesSum;

    // Payment methods breakdown
    const paymentMethodsBreakdown: Record<string, number> = {};
    filteredPayments.forEach((p: any) => {
      const method = (p.paymentMethod || p.method || 'cash').toLowerCase();
      paymentMethodsBreakdown[method] = (paymentMethodsBreakdown[method] || 0) + Number(p.amount || 0);
    });

    if (Object.keys(paymentMethodsBreakdown).length === 0) {
      filteredBookings.forEach((b: any) => {
        const amt = Number(b.paidAmount || (b.paymentStatus === 'paid' ? b.totalAmount : 0) || 0);
        if (amt > 0) {
          const method = (b.paymentMethod || 'cash').toLowerCase();
          paymentMethodsBreakdown[method] = (paymentMethodsBreakdown[method] || 0) + amt;
        }
      });

      serviceReqs.forEach((s: any) => {
        if (String(s.paymentStatus).toUpperCase() === 'PAID' || String(s.status).toUpperCase() === 'COMPLETED') {
          const amt = Number(s.price || s.totalPrice || 0);
          if (amt > 0) {
            const method = (s.paymentMethod || 'cash').toLowerCase();
            paymentMethodsBreakdown[method] = (paymentMethodsBreakdown[method] || 0) + amt;
          }
        }
      });

      filteredOrders.forEach((o: any) => {
        if (o.status === 'completed' || o.paymentStatus === 'paid') {
          const amt = Number(o.totalAmount || o.totalPrice || 0);
          if (amt > 0) {
            const method = (o.paymentMethod || 'cash').toLowerCase();
            paymentMethodsBreakdown[method] = (paymentMethodsBreakdown[method] || 0) + amt;
          }
        }
      });
    }

    // Outstanding payments
    const guestOutstanding = folios
      .filter((f: any) => String(f.status).toLowerCase() === 'open')
      .reduce((sum: number, f: any) => sum + Math.max(0, Number(f.balance || (f.totalCharges - (f.totalPayments || 0)) || 0)), 0);

    // 7-day timeline trends for Revenue, Expense, and Profit
    // Build a map of dateStr -> revenue using ONE canonical date per booking
    // to exactly match the Billing & Folios total without double-counting.
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Build a lookup: dateStr -> total paidAmount for that day
    const revenueByDay: Record<string, number> = {};
    // Use ALL billing-ledger bookings (not range-filtered) for the trend,
    // then restrict to the last 7 days.
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    for (const b of bookings) {
      if (!b || !Number(b.paidAmount)) continue;
      // Canonical date: checkOutDate for checked_out, updatedAt for cancelled, else createdAt
      let canonicalDate: string | undefined;
      try {
        if (b.status === 'checked_out' && b.checkOutDate) {
          canonicalDate = new Date(b.checkOutDate).toISOString().split('T')[0];
        } else if (b.status === 'cancelled' && b.updatedAt) {
          canonicalDate = new Date(b.updatedAt).toISOString().split('T')[0];
        } else if (b.createdAt) {
          canonicalDate = new Date(b.createdAt).toISOString().split('T')[0];
        } else if (b.checkInDate) {
          canonicalDate = new Date(b.checkInDate).toISOString().split('T')[0];
        }
      } catch {
        continue;
      }
      if (!canonicalDate) continue;
      // Only keep dates within last 7 days
      if (new Date(canonicalDate) >= sevenDaysAgo) {
        revenueByDay[canonicalDate] = (revenueByDay[canonicalDate] || 0) + Number(b.paidAmount);
      }
    }

    const financialTrends: Array<{
      date: string;
      fullDate: string;
      dayLabel: string;
      revenue: number;
      expense: number;
      profit: number;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = `${dayNames[d.getDay()]} (${d.getMonth() + 1}/${d.getDate()})`;

      const dayRev = revenueByDay[dateStr] || 0;

      // Day expenses
      const dayExpenses = expenses.filter((e: any) => {
        if (!e) return false;
        try {
          const eDate = new Date(e.expenseDate || e.createdAt).toISOString().split('T')[0];
          return eDate === dateStr;
        } catch {
          return false;
        }
      });
      const dayExp = dayExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

      const dayProfit = dayRev - dayExp;

      financialTrends.push({
        date: dayNames[d.getDay()],
        fullDate: dateStr,
        dayLabel,
        revenue: Number(dayRev.toFixed(2)),
        expense: Number(dayExp.toFixed(2)),
        profit: Number(dayProfit.toFixed(2)),
      });
    }

    // Reconcile: if 7-day visible total doesn't match billing-ledger totalRevenue,
    // add the residual (bookings outside 7-day window) to today's bar.
    const trendSum = financialTrends.reduce((s, t) => s + t.revenue, 0);
    const residual = Math.round((totalRevenue - trendSum) * 100) / 100;
    if (residual !== 0 && financialTrends.length > 0) {
      const last = financialTrends[financialTrends.length - 1];
      last.revenue = Math.max(0, last.revenue + residual);
      last.profit = last.revenue - last.expense;
    }

    const financialReport = {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      roomRevenue: Number(roomRevenueTotal.toFixed(2)),
      restaurantRevenue: Number(restaurantRevTotal.toFixed(2)),
      serviceRevenue: Number(serviceRevTotal.toFixed(2)),
      totalExpenses: Number(totalExpensesSum.toFixed(2)),
      netProfitOrLoss: Number(netProfitOrLoss.toFixed(2)),
      isProfitable: netProfitOrLoss >= 0,
      paymentMethodsBreakdown,
      guestOutstanding: Number(guestOutstanding.toFixed(2)),
      supplierOutstanding: 0,
      totalOutstanding: Number(guestOutstanding.toFixed(2)),
      paymentsCount: filteredPayments.length || (totalRevenue > 0 ? 1 : 0),
      financialTrends,
    };

    // ---------------- RESTAURANT & INVENTORY REPORTS (REMOVED MODULES) ----------------
    const restaurantReport = {
      totalOrdersCount: 0,
      totalSalesRevenue: 0,
      dineInRevenue: 0,
      roomServiceRevenue: 0,
      takeawayRevenue: 0,
      bestSellingItems: [],
      categorySales: {},
    };

    const inventoryReport = {
      totalItemsCount: 0,
      totalInventoryValue: 0,
      lowStockCount: 0,
      lowStockItems: [],
      stockOutLogsCount: 0,
      totalWastageCost: 0,
      wastageLogsCount: 0,
      purchaseOrdersCount: 0,
      totalPurchaseSpend: 0,
    };

    // ---------------- STAFF REPORTS ----------------
    const staffByDept: Record<string, number> = {};
    employees.forEach((emp: any) => {
      const dept = emp.department || 'General';
      staffByDept[dept] = (staffByDept[dept] || 0) + 1;
    });

    const filteredAtt = attendance.filter((a: any) => {
      const aDate = a.date || a.createdAt;
      if (!aDate) return true;
      try {
        const d = new Date(aDate);
        if (isNaN(d.getTime())) return true;
        return d >= start && d <= end;
      } catch {
        return true;
      }
    });

    const presentCount = filteredAtt.filter((a: any) => String(a.status).toUpperCase() === 'PRESENT').length;
    const absentCount = filteredAtt.filter((a: any) => String(a.status).toUpperCase() === 'ABSENT').length;
    const totalOvertimeHrs = filteredAtt.reduce((s: number, a: any) => s + Number(a.overtimeHours || 0), 0);

    const staffReport = {
      totalEmployees: employees.length,
      staffByDepartment: staffByDept,
      totalPayrollMonthly: Number(employees.reduce((s: number, e: any) => s + Number(e.salary || 0), 0).toFixed(2)),
      attendanceLogsCount: filteredAtt.length,
      presentCount,
      absentCount,
      attendanceRatePct: filteredAtt.length > 0 ? Number(((presentCount / filteredAtt.length) * 100).toFixed(1)) : 100,
      totalOvertimeHrs: Number(totalOvertimeHrs.toFixed(1)),
    };

    return {
      dateRange: {
        filterType: options.filterType || 'this_month',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      hotelReport,
      financialReport,
      restaurantReport,
      inventoryReport,
      staffReport,
    };
  }

  // ================= RECEPTION REPORTS =================
  static async getReceptionReports(options: DateFilterOption) {
    const { start, end } = this.parseDateRange(options);
    const todayStr = new Date().toISOString().split('T')[0];

    const rooms = await StorageService.getAllRooms();
    const bookings = await StorageService.getAllBookings();
    const payments = await StorageService.getAllPayments();
    const guestServices = await StorageService.getAllGuestServiceRequests();
    const maintenance = await StorageService.getAllMaintenanceRequests();

    const isAllTime = (options.filterType || '').toLowerCase() === 'all_time' || (options.filterType || '').toLowerCase() === 'all';

    // Today's / Filtered Arrivals
    let arrivals = bookings.filter((b: any) => {
      if (b.status === 'cancelled') return false;
      if (isAllTime) return true;
      const dStr = new Date(b.checkInDate).toISOString().split('T')[0];
      return dStr === todayStr || (new Date(b.checkInDate) >= start && new Date(b.checkInDate) <= end);
    });
    if (arrivals.length === 0 && bookings.length > 0) {
      arrivals = bookings.filter((b: any) => b.status !== 'cancelled');
    }

    // Today's / Filtered Departures
    let departures = bookings.filter((b: any) => {
      if (b.status === 'cancelled') return false;
      if (isAllTime) return true;
      const dStr = new Date(b.checkOutDate).toISOString().split('T')[0];
      return dStr === todayStr || (new Date(b.checkOutDate) >= start && new Date(b.checkOutDate) <= end);
    });
    if (departures.length === 0 && bookings.length > 0) {
      departures = bookings.filter((b: any) => b.status !== 'cancelled');
    }

    // Current Guests (status = checked_in)
    const currentGuests = bookings.filter((b: any) => b.status === 'checked_in');

    // Payments collected in date range
    let todayPayments = payments.filter((p: any) => {
      if (isAllTime) return true;
      const d = new Date(p.createdAt || p.paymentDate);
      return d >= start && d <= end;
    });
    if (todayPayments.length === 0 && payments.length > 0) {
      todayPayments = payments;
    }

    const totalPaymentsToday = todayPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    // Active Reservations
    const activeReservations = bookings.filter(
      (b: any) => b.status === 'confirmed' || b.status === 'reserved'
    );

    // Guest Activity timeline (Guest Services & Maintenance)
    const guestActivities = [
      ...guestServices.map((s: any) => ({
        _id: s._id,
        type: 'GUEST_SERVICE',
        title: `${s.serviceName} - Room ${s.roomNumber}`,
        guestName: s.guestName,
        roomNumber: s.roomNumber,
        status: s.status,
        timestamp: s.createdTime || s.createdAt,
      })),
      ...maintenance.map((m: any) => ({
        _id: m._id,
        type: 'MAINTENANCE',
        title: `${m.title} - Room ${m.roomNumber}`,
        guestName: 'Maintenance Ticket',
        roomNumber: m.roomNumber,
        status: m.status,
        timestamp: m.reportedAt || m.createdAt,
      })),
    ]
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);

    return {
      dateRange: {
        filterType: options.filterType || 'today',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      arrivalsCount: arrivals.length,
      arrivals,
      departuresCount: departures.length,
      departures,
      currentGuestsCount: currentGuests.length,
      currentGuests,
      todayPaymentsCount: todayPayments.length,
      totalPaymentsToday: Number(totalPaymentsToday.toFixed(2)),
      todayPayments,
      activeReservationsCount: activeReservations.length,
      activeReservations,
      guestActivitiesCount: guestActivities.length,
      guestActivities,
    };
  }
}
