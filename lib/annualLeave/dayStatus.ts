import { dueDayKey, leaveDayKind, normalizeHolidayStatus } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
// One document can cover several days (one per request). Its slot applies to every day in it.
import type { HolidayBooking } from '@/types'
import { bookingMatchesPerson, type AnnualLeavePerson } from './annualLeavePerson'

export type AnnualLeaveDayKind =
  | 'none'
  | 'approvedFull'
  | 'approvedHalf'
  | 'pendingFull'
  | 'pendingHalf'

function calendarRecords(bookings: HolidayBooking[], zone: string) {
  return bookings.map((booking) => ({
    id: booking.id,
    ...holidayBookingDayKeys(booking, zone),
    timeSlot: booking.timeSlot,
    status: booking.status,
  }))
}

/**
 * Rulebook 1.23.0 §9 `leaveDayKind`: the record's leave days (`leaveRecordDayKeys`) on the organisation day; full day
 * beats half day and, at the same length, pending beats approved — never the list order.
 */
export function getDayKindForBookings(day: Date, bookings: HolidayBooking[]): AnnualLeaveDayKind {
  const zone = organizationZoneOr()
  return leaveDayKind(calendarRecords(bookings, zone), dueDayKey(day, zone), zone).kind
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
  const zone = organizationZoneOr()
  const ofKind = bookings.filter((booking) => normalizeHolidayStatus(booking.status) === kind)
  const { recordId } = leaveDayKind(calendarRecords(ofKind, zone), dueDayKey(day, zone), zone)
  return recordId ? ofKind.find((booking) => booking.id === recordId) ?? null : null
}

export function isDayLocked(kind: AnnualLeaveDayKind): boolean {
  return kind === 'approvedFull' || kind === 'pendingFull'
}
