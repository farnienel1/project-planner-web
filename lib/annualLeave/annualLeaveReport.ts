/**
 * Web Annual leave report (owner decision 16 Nov, parity with the iOS screen) — rulebook 1.22.0 §9 "Holiday Report".
 *
 * One person's leave in one leave year is the rulebook's `leaveReportRows`; the years offered are
 * `leaveReportYears`. This file only turns loaded `HolidayBooking` rows (already read through
 * `parseHolidayDocument` by the holiday store) into the rulebook's record shape and passes the organisation's leave
 * year (`annualLeaveDefaults.startMonth`), the person's ids and the region's bank holidays. No figure is worked out here.
 */
import { leaveReportRows, leaveReportYears, type LeaveReport, type LeaveReportRecord } from '@/lib/canonical'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type { HolidayBooking } from '@/types'

export type AnnualLeaveReportYear = { startDayKey: string; endDayKey: string; yearKey: string }

/** A loaded booking as the rulebook's `LeaveReportRecord` (its organisation-zone day keys, never recomputed). */
export function leaveReportRecord(booking: HolidayBooking, timeZone?: string | null): LeaveReportRecord {
  const { startDayKey, endDayKey } = holidayBookingDayKeys(booking, organizationZoneOr(timeZone))
  return {
    id: booking.id,
    userId: booking.userId ?? null,
    operativeId: booking.operativeId ?? null,
    startDayKey,
    endDayKey,
    timeSlot: booking.timeSlot,
    status: booking.status,
  }
}

/**
 * The leave years the report offers (`leaveReportYears`), newest first: from the year of the person's start date or
 * their first leave record, whichever is earlier, to this year.
 */
export function annualLeaveReportYears(input: {
  bookings: ReadonlyArray<HolidayBooking>
  employmentStartDayKey?: string | null
  todayDayKey: string
  startMonth?: number | null
  timeZone?: string | null
}): AnnualLeaveReportYear[] {
  const zone = organizationZoneOr(input.timeZone)
  const candidates = [
    String(input.employmentStartDayKey || '').trim(),
    ...input.bookings.map((booking) => holidayBookingDayKeys(booking, zone).startDayKey),
  ].filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
  const firstDayKey = candidates.length > 0 ? [...candidates].sort()[0] : input.todayDayKey
  return leaveReportYears({ firstDayKey, todayDayKey: input.todayDayKey, startMonth: input.startMonth ?? 1 })
}

/** `leaveReportRows` for one person and one leave year (approved leave only, the rulebook default). */
export function annualLeaveReport(input: {
  bookings: ReadonlyArray<HolidayBooking>
  /** Every id the person's leave may be filed under (`personIdSet` plus their operative ids and email). */
  personIds: ReadonlyArray<string>
  /** Any day inside the leave year shown (the year's start day key). */
  onDayKey: string
  startMonth?: number | null
  timeZone?: string | null
  /** The region's bank holidays: not leave days inside a multi-day record. */
  nonWorkingDayKeys?: ReadonlyArray<string>
}): LeaveReport {
  const timeZone = organizationZoneOr(input.timeZone)
  return leaveReportRows({
    records: input.bookings.map((booking) => leaveReportRecord(booking, timeZone)),
    personIds: input.personIds,
    onDayKey: input.onDayKey,
    startMonth: input.startMonth ?? 1,
    timeZone,
    nonWorkingDayKeys: input.nonWorkingDayKeys ?? [],
  })
}

/** "2026" for a calendar leave year, else "2026/27" (the iOS report's year title). */
export function annualLeaveReportYearTitle(year: { startDayKey: string; endDayKey: string }): string {
  const start = year.startDayKey.slice(0, 4)
  if (year.startDayKey.endsWith('-01-01')) return start
  return `${start}/${year.endDayKey.slice(2, 4)}`
}

/** "1 day", "2.5 days" (the iOS report's wording). */
export function annualLeaveReportDaysText(days: number): string {
  const text = Number.isInteger(days) ? String(days) : days.toFixed(1)
  return `${text} day${days === 1 ? '' : 's'}`
}
