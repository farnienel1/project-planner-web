/**
 * Paid hours for one booking: the standard-window hours, the hours outside it,
 * the multiplier those outside hours are paid at, and the weighted total.
 * Daily Overview pills, the weekly report, timesheets and invoicing all read
 * this one result on web and iOS. It is the iOS `PayrollHoursEngine` rule,
 * moved here so neither app keeps its own copy.
 *
 * Weekday: hours inside the standard day count once, less the unpaid break
 * when the booking spans the break window (not for AM/PM, not when the break
 * is paid or removed). Hours before or after the standard day are paid at the
 * weekday multiplier (or the booking's override). AM, PM, and custom hours
 * within 20 minutes of an AM/PM half pay half the standard paid hours.
 * Saturday / Sunday: the weekend day's own rule — every hour at the
 * all-hours multiplier, or a defined window that counts as `countsAsStandardHours`
 * (pro rata when only part of it is worked) with hours outside it at that
 * day's outside multiplier. A finish before the start runs past midnight
 * (22:00–02:00 is 4 hours). The day is the organisation-zone calendar day.
 */

import { formatClockMinutes, halfDayWindows, namedSlotKind, parseClockMinutes, slotInterval, type MinuteInterval } from './engine'
import type { OrgPayrollTimePolicy, WeekendPayrollSettings } from './organizationSettings'
import { dateFromDayKeyInZone, isoWeekdayInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'

export type PayrollHoursSegmentKind = 'standardWindow' | 'outsideWindow' | 'allHoursMultiplier'

export type PayrollHoursSegment = {
  kind: PayrollHoursSegmentKind
  clockStart?: string
  clockEnd?: string
  /** Clock (or credited) hours before the multiplier. */
  baseHours: number
  multiplier: number
  /** `baseHours × multiplier`. */
  paidHours: number
  /** Hours actually worked in this segment, with no multiplier and no weekend credit. */
  workedHours: number
}

export type PayrollHoursBooking = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
  /** Booking-level multiplier for hours outside the standard window. Ignored unless > 0. */
  otMultiplierOverride?: number | null
}

export type PayrollHoursInput = {
  booking: PayrollHoursBooking
  /** `YYYY-MM-DD` in the organisation zone. */
  dayKey: string
  policy: OrgPayrollTimePolicy
  timeZone?: string | null
}

export type PayrollHoursResult = {
  /** Weighted paid hours: standard hours plus outside hours × multiplier. */
  totalPaidHours: number
  /** Hours paid at the normal rate (the standard-window segments). */
  standardHours: number
  /** Clock hours outside the standard window, or every hour on an all-hours weekend day. */
  outsideHours: number
  /** Multiplier for `outsideHours` on this day for this booking. */
  outsideMultiplier: number
  /**
   * Hours worked, never multiplied: what Daily Overview and My Schedule show.
   * Pay screens (Weekly Report, timesheets, invoices) use `totalPaidHours`.
   */
  workedHours: number
  segments: PayrollHoursSegment[]
}

const HALF_WINDOW_TOLERANCE = 20

function weekendFor(isoWeekday: number, policy: OrgPayrollTimePolicy): WeekendPayrollSettings | null {
  if (isoWeekday === 6) return policy.saturday
  if (isoWeekday === 7) return policy.sunday?.sameAsSaturday ? policy.saturday : policy.sunday
  return null
}

function standardPaid(policy: OrgPayrollTimePolicy): number {
  return Math.max(Number(policy.standardPaidHours) || 0, 0)
}

function countsAs(weekend: WeekendPayrollSettings, policy: OrgPayrollTimePolicy): number {
  return weekend.countsAsStandardHours ?? Number(policy.standardPaidHours)
}

function dayInput(policy: OrgPayrollTimePolicy) {
  return {
    standardDayStart: policy.standardDayStart,
    standardDayEnd: policy.standardDayEnd,
    breakWindowStart: policy.breakWindowStart,
    breakWindowEnd: policy.breakWindowEnd,
  }
}

/** Multiplier for outside hours: the booking override, else the weekend day's, else the weekday one. */
/**
 * Hours worked inside and outside the standard window, never multiplied: Daily Overview's
 * Standard and Overtime figures. An all-hours weekend day is all outside. The two add up to `workedHours`.
 */
export function workedHoursSplit(result: Pick<PayrollHoursResult, 'segments'>): {
  standardWorkedHours: number
  outsideWorkedHours: number
} {
  let standard = 0
  let outside = 0
  for (const row of result.segments) {
    if (row.kind === 'standardWindow') standard += row.workedHours
    else outside += row.workedHours
  }
  return { standardWorkedHours: standard, outsideWorkedHours: outside }
}

export function payrollOutsideMultiplier(booking: PayrollHoursBooking, isoWeekday: number, policy: OrgPayrollTimePolicy): number {
  const override = Number(booking.otMultiplierOverride)
  if (Number.isFinite(override) && override > 0) return override
  const weekend = weekendFor(isoWeekday, policy)
  if (weekend) {
    return weekend.allHoursAtMultiplierMode ? weekend.allHoursMultiplier : weekend.outsideWindowMultiplier ?? 1.5
  }
  return policy.weekdayOutsideStandardMultiplier
}

function segment(
  kind: PayrollHoursSegmentKind,
  baseHours: number,
  multiplier: number,
  start?: number | string,
  end?: number | string,
  workedHours: number = baseHours
): PayrollHoursSegment {
  const clock = (value: number | string | undefined) =>
    value == null ? undefined : typeof value === 'number' ? formatClockMinutes(Math.min(value, 24 * 60 - 1)) : value
  return { kind, clockStart: clock(start), clockEnd: clock(end), baseHours, multiplier, paidHours: baseHours * multiplier, workedHours }
}

function result(segments: PayrollHoursSegment[], outsideMultiplier: number): PayrollHoursResult {
  let total = 0
  let standard = 0
  let outside = 0
  let worked = 0
  for (const row of segments) {
    total += row.paidHours
    worked += row.workedHours
    if (row.kind === 'standardWindow') standard += row.baseHours
    else outside += row.baseHours
  }
  return { totalPaidHours: total, standardHours: standard, outsideHours: outside, outsideMultiplier, workedHours: worked, segments }
}

function interval(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy): MinuteInterval | null {
  return slotInterval(
    { timeSlot: booking.timeSlot ?? undefined, workStartTime: booking.workStartTime ?? undefined, workEndTime: booking.workEndTime ?? undefined },
    dayInput(policy)
  )
}

function overnight(booking: PayrollHoursBooking): PayrollHoursSegment | null {
  const start = parseClockMinutes(booking.workStartTime ?? undefined)
  const end = parseClockMinutes(booking.workEndTime ?? undefined)
  if (start == null || end == null || !(end < start)) return null
  return segment('standardWindow', (end + 24 * 60 - start) / 60, 1, booking.workStartTime ?? undefined, booking.workEndTime ?? undefined)
}

function isNamedHalf(booking: PayrollHoursBooking): boolean {
  const kind = namedSlotKind(booking.timeSlot)
  return kind === 'AM' || kind === 'PM'
}

function isHalfDayPaid(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy, allHoursDay: boolean): boolean {
  if (isNamedHalf(booking)) return true
  if (namedSlotKind(booking.timeSlot) !== 'CUSTOM' || allHoursDay) return false
  const span = interval(booking, policy)
  if (!span) return false
  const windows = halfDayWindows(dayInput(policy))
  const near = (a: number, b: number) => Math.abs(a - b) <= HALF_WINDOW_TOLERANCE
  return (near(span.start, windows.am.start) && near(span.end, windows.am.end)) ||
    (near(span.start, windows.pm.start) && near(span.end, windows.pm.end))
}

function halfDayPaid(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy, weekend: WeekendPayrollSettings | null, multiplier: number): PayrollHoursResult {
  const paid = weekend && !weekend.allHoursAtMultiplierMode ? Math.max(countsAs(weekend, policy), 0) / 2 : standardPaid(policy) / 2
  const span = interval(booking, policy)
  return result([segment('standardWindow', paid, 1, span?.start, span?.end)], multiplier)
}

function legacySlot(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy, multiplier: number): PayrollHoursResult {
  const kind = namedSlotKind(booking.timeSlot)
  const paid =
    kind === 'AM' || kind === 'PM'
      ? standardPaid(policy) / 2
      : kind === 'EVENING'
        ? 4
        : kind === 'OVERTIME'
          ? 2
          : standardPaid(policy)
  return result([segment('standardWindow', paid, 1)], multiplier)
}

/** Clock length of the booking (past midnight when the end is earlier), else its slot hours. */
function wallHours(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy): number {
  const start = parseClockMinutes(booking.workStartTime ?? undefined)
  const end = parseClockMinutes(booking.workEndTime ?? undefined)
  if (start != null && end != null && start !== end) return ((end > start ? end : end + 24 * 60) - start) / 60
  const span = interval(booking, policy)
  if (span) return (span.end - span.start) / 60
  const kind = namedSlotKind(booking.timeSlot)
  if (kind === 'AM' || kind === 'PM') return standardPaid(policy) / 2
  if (kind === 'EVENING') return 4
  if (kind === 'OVERTIME') return 2
  return standardPaid(policy)
}

function breakDeductionMinutes(policy: OrgPayrollTimePolicy, span: MinuteInterval): number {
  const start = parseClockMinutes(policy.breakWindowStart)
  const end = parseClockMinutes(policy.breakWindowEnd)
  if (start == null || end == null || end <= start) return 0
  return Math.min(span.end, end) > Math.max(span.start, start) ? Number(policy.unpaidBreakMinutes) || 0 : 0
}

function outsideSegments(span: MinuteInterval, windowStart: number, windowEnd: number, multiplier: number): PayrollHoursSegment[] {
  const rows: PayrollHoursSegment[] = []
  if (span.start < windowStart) {
    const end = Math.min(span.end, windowStart)
    const hours = (end - span.start) / 60
    if (hours > 0.001) rows.push(segment('outsideWindow', hours, multiplier, span.start, end))
  }
  if (span.end > windowEnd) {
    const start = Math.max(span.start, windowEnd)
    const hours = (span.end - start) / 60
    if (hours > 0.001) rows.push(segment('outsideWindow', hours, multiplier, start, span.end))
  }
  return rows
}

function weekday(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy, multiplier: number): PayrollHoursResult {
  const night = overnight(booking)
  if (night) return result([night], multiplier)
  if (isHalfDayPaid(booking, policy, false)) return halfDayPaid(booking, policy, null, multiplier)
  const span = interval(booking, policy)
  if (!span) return legacySlot(booking, policy, multiplier)
  const ds = parseClockMinutes(policy.standardDayStart) ?? 0
  const de = parseClockMinutes(policy.standardDayEnd) ?? 0
  if (!(de > ds)) {
    const wall = wallHours(booking, policy)
    return result([segment('allHoursMultiplier', wall, multiplier, booking.workStartTime ?? undefined, booking.workEndTime ?? undefined)], multiplier)
  }
  const rows: PayrollHoursSegment[] = []
  const insideStart = Math.max(span.start, ds)
  const insideEnd = Math.min(span.end, de)
  if (insideEnd > insideStart) {
    let hours = (insideEnd - insideStart) / 60
    if (!isNamedHalf(booking) && policy.breakPaid !== true && booking.isBreakRemoved !== true) {
      hours = Math.max(0, hours - breakDeductionMinutes(policy, span) / 60)
    }
    if (hours > 0.001) rows.push(segment('standardWindow', hours, 1, insideStart, insideEnd))
  }
  rows.push(...outsideSegments(span, ds, de, multiplier))
  if (rows.length === 0) return legacySlot(booking, policy, multiplier)
  return result(rows, multiplier)
}

function weekendDay(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy, weekend: WeekendPayrollSettings, multiplier: number): PayrollHoursResult {
  const night = overnight(booking)
  if (night) return result([night], multiplier)
  const span = interval(booking, policy)
  if (!span) return legacySlot(booking, policy, multiplier)
  if (weekend.allHoursAtMultiplierMode) {
    if (isNamedHalf(booking)) return halfDayPaid(booking, policy, weekend, multiplier)
    return result([segment('allHoursMultiplier', (span.end - span.start) / 60, multiplier, span.start, span.end)], multiplier)
  }
  const ws = parseClockMinutes(weekend.definedWindowStart ?? policy.standardDayStart) ?? 0
  const we = parseClockMinutes(weekend.definedWindowEnd ?? '13:00') ?? 0
  if (!(we > ws)) {
    const wall = wallHours(booking, policy)
    return result([segment('allHoursMultiplier', wall, multiplier, booking.workStartTime ?? undefined, booking.workEndTime ?? undefined)], multiplier)
  }
  if (isHalfDayPaid(booking, policy, false)) return halfDayPaid(booking, policy, weekend, multiplier)
  const credit = countsAs(weekend, policy)
  const rows: PayrollHoursSegment[] = []
  const overlapStart = Math.max(span.start, ws)
  const overlapEnd = Math.min(span.end, we)
  if (overlapEnd > overlapStart) {
    const credited = overlapStart <= ws && overlapEnd >= we ? credit : credit * ((overlapEnd - overlapStart) / (we - ws))
    // A weekend window credits a set number of hours; the time worked is the clock time.
    rows.push(segment('standardWindow', credited, 1, overlapStart, overlapEnd, (overlapEnd - overlapStart) / 60))
  }
  rows.push(...outsideSegments(span, ws, we, multiplier))
  if (rows.length === 0) return legacySlot(booking, policy, multiplier)
  return result(rows, multiplier)
}

/** Paid hours for one booking on its organisation-zone day. */
export function payrollHoursResult(input: PayrollHoursInput): PayrollHoursResult {
  const zone = zoneOrLondon(input.timeZone)
  const iso = isoWeekdayInZone(dateFromDayKeyInZone(input.dayKey, zone), zone)
  const policy = input.policy
  const booking = input.booking || {}
  const multiplier = payrollOutsideMultiplier(booking, iso, policy)
  const weekend = weekendFor(iso, policy)
  return weekend ? weekendDay(booking, policy, weekend, multiplier) : weekday(booking, policy, multiplier)
}

/**
 * Weekly-report day units for a staff booking: weighted paid hours over the
 * standard paid day, capped at 1.5 (an AM is 0.5, a plain full day is 1).
 */
export function reportDayValue(input: { totalPaidHours: number; standardPaidHours: number }): number {
  const standard = Math.max(Number(input.standardPaidHours) || 0, 0.01)
  return Math.min(1.5, Math.max(0, Number(input.totalPaidHours) || 0) / standard)
}

/** Weekly-report day units for a subcontractor booking: a full day is 1, anything else 0.5. */
export function subcontractorDayValue(timeSlot: string | null | undefined): number {
  return namedSlotKind(timeSlot) === 'FULL_DAY' ? 1 : 0.5
}
