/**
 * Day keys and warning input for a loaded `HolidayBooking` (rulebook §9).
 *
 * The holiday store reads every `holidayBookings` document through `parseHolidayDocument` and keeps its
 * organisation-zone day keys on the row. Warnings, Daily Overview, leave coverage, timesheets and My Schedule
 * use those keys through these helpers instead of recomputing them from `startDate` / `endDate`. A row built
 * in memory without keys, or read in a different zone, falls back to the same rulebook conversion
 * (`holidayDocumentDayKey`), so there is still one rule.
 */
import { holidayDocumentDayKey, labourHolidayInput, normalizeHolidayTimeSlot } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type { HolidayBooking } from '@/types'

type DayKeyed = Pick<HolidayBooking, 'startDate' | 'endDate' | 'startDayKey' | 'endDayKey' | 'dayKeyTimeZone'>

export function holidayBookingDayKeys(booking: DayKeyed, timeZone?: string | null): { startDayKey: string; endDayKey: string } {
  const zone = organizationZoneOr(timeZone)
  if (booking.startDayKey && booking.endDayKey && (!booking.dayKeyTimeZone || booking.dayKeyTimeZone === zone)) {
    return { startDayKey: booking.startDayKey, endDayKey: booking.endDayKey }
  }
  const start = holidayDocumentDayKey(booking.startDate, zone)
  const end = holidayDocumentDayKey(booking.endDate, zone) || start
  return end < start ? { startDayKey: end, endDayKey: start } : { startDayKey: start, endDayKey: end }
}

/** The `unbookedLabourRows` / leave coverage holiday input (`labourHolidayInput`) for a loaded booking. */
export function holidayBookingLabourInput(booking: HolidayBooking, timeZone?: string | null) {
  const { startDayKey, endDayKey } = holidayBookingDayKeys(booking, timeZone)
  return labourHolidayInput({
    id: booking.id,
    userId: booking.userId ?? null,
    operativeId: booking.operativeId ?? null,
    startDayKey,
    endDayKey,
    timeSlot: normalizeHolidayTimeSlot(booking.timeSlot),
    approved: String(booking.status).toLowerCase() === 'approved',
  })
}
