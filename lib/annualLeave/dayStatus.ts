import { isSameDay, startOfDay } from 'date-fns'
import type { HolidayBooking } from '@/types'
import { bookingMatchesPerson, type AnnualLeavePerson } from './annualLeavePerson'

export type AnnualLeaveDayKind =
  | 'none'
  | 'approvedFull'
  | 'approvedHalf'
  | 'pendingFull'
  | 'pendingHalf'

export function getDayKindForBookings(day: Date, bookings: HolidayBooking[]): AnnualLeaveDayKind {
  const dayStart = startOfDay(day)
  let pendingHalf: HolidayBooking | undefined
  let approvedHalf: HolidayBooking | undefined

  for (const booking of bookings) {
    if (booking.status === 'rejected') continue
    const start = startOfDay(booking.startDate)
    const end = startOfDay(booking.endDate)
    if (dayStart < start || dayStart > end) continue

    if (booking.status === 'pending') {
      if (booking.timeSlot === 'FULL DAY' || !isSameDay(booking.startDate, booking.endDate)) {
        return 'pendingFull'
      }
      pendingHalf = booking
      continue
    }

    if (booking.status === 'approved') {
      if (booking.timeSlot === 'FULL DAY' || !isSameDay(booking.startDate, booking.endDate)) {
        return 'approvedFull'
      }
      approvedHalf = booking
    }
  }

  if (pendingHalf) return 'pendingHalf'
  if (approvedHalf) return 'approvedHalf'
  return 'none'
}

export function getDayKindForPerson(
  day: Date,
  allBookings: HolidayBooking[],
  person: AnnualLeavePerson
): AnnualLeaveDayKind {
  const personBookings = allBookings.filter((b) => bookingMatchesPerson(b, person))
  return getDayKindForBookings(day, personBookings)
}

export function getBookingForDay(
  day: Date,
  bookings: HolidayBooking[],
  kind: 'approved' | 'pending'
): HolidayBooking | null {
  const dayStart = startOfDay(day)
  for (const booking of bookings) {
    if (booking.status !== kind) continue
    const start = startOfDay(booking.startDate)
    const end = startOfDay(booking.endDate)
    if (dayStart < start || dayStart > end) continue
    if (isSameDay(booking.startDate, booking.endDate)) return booking
    return booking
  }
  return null
}

export function isDayLocked(kind: AnnualLeaveDayKind): boolean {
  return kind === 'approvedFull' || kind === 'pendingFull'
}
