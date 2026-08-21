import mongoose from 'mongoose';
import { Reservation, IReservation } from './Reservation.js';

export type BookingStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export type PaymentStatus = 'paid' | 'partial' | 'pending';

export type IBooking = IReservation;

export const Booking = Reservation;
export default Booking;
