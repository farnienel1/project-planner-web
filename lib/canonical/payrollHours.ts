/**
 * Paid hours for one booking: the standard-window hours, the hours outside it,
 * the multiplier those outside hours are paid at, and the weighted total.
 * Daily Overview pills, the weekly report, timesheets and invoicing all read
 * this one result on web and iOS. It is the iOS `PayrollHoursEngine` rule,
 * moved here so neither app keeps its own copy.
 *
 * Weekday: hours inside the standard day count once, less the part of the unpaid
 * break window the booking covers, up to the unpaid break length (not for AM/PM,
 * not when the break is paid or removed); a booking whose clock time is all in the
 * break pays 0 (1.12.0). Hours before or after the standard day are paid at the
 * weekday multiplier (or the booking's override). AM, PM, and custom hours
 * within 20 minutes of an AM/PM half pay half the standard paid hours.
 * Saturday / Sunday: the weekend day's own rule — every hour at the
 * all-hours multiplier, or a defined window that counts as `countsAsStandardHours`
 * (pro rata when only part of it is worked) with hours outside it at that
 * day's outside multiplier. A finish before the start runs past midnight
 * (22:00–02:00 is 4 hours). 1.13.0 (Q5): an overnight booking is paid wholly at
 * its start day's rules — on a weekday the hours inside that day's standard window
 * count once and every other hour (after midnight too) is at that day's multiplier;
 * on a Saturday or Sunday that day's rule. 1.13.0 (Q2): new weekend bookings are custom
 * hours only; a stored Saturday or Sunday FULL DAY with no clock times is that day's set
 * window (`weekendFullDayWindow`), paid at its "counts as" hours with nothing outside it,
 * or on an all-hours day the standard day at that day's multiplier (as before 1.13.0). The day is the organisation-zone calendar day.
 * 1.19.0: a Saturday or Sunday whose lunch break is unpaid (`saturday.breakPaid` / `sunday.breakPaid === false`; missing
 * = paid) takes that day's break off by the weekday rule (the covered part of its `breakWindowStart`–`breakWindowEnd`,
 * up to its `breakMinutes`, each missing field the weekday one; not when `isBreakRemoved`; not on a named AM / PM): every-hour days pay (clock − break) × N;
 * set-window days take it off the credited window hours, and any part of the break outside the window off the outside
 * hours before the multiplier. Callers pass the policy in effect on the booking day (`effectivePayrollTimePolicy`).
 */

import { formatClockMinutes, halfDayWindows, namedSlotKind, parseClockMinutes, slotInterval, type MinuteInterval } from './engine'
import { weekdayPaidHours, weekendBreakFor, type OrgPayrollTimePolicy, type WeekendPayrollSettings } from './organizationSettings'
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
  /** Rulebook 1.19.0: unpaid break hours already taken off `baseHours` (and `workedHours`) in this segment. */
  unpaidBreakHours?: number
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
  /** Rulebook 1.19.0: the unpaid break taken off this booking (hours, before any multiplier). 0 when none. */
  unpaidBreakHours: number
  segments: PayrollHoursSegment[]
}

const HALF_WINDOW_TOLERANCE = 20

function weekendFor(isoWeekday: number, policy: OrgPayrollTimePolicy): WeekendPayrollSettings | null {
  if (isoWeekday === 6) return policy.saturday
  if (isoWeekday === 7) return policy.sunday?.sameAsSaturday ? policy.saturday : policy.sunday
  return null
}

/** 1.20.0: the weekday paid day (`weekdayPaidHours`: derived for a policy saved from 1.20.0, else stored). */
function standardPaid(policy: OrgPayrollTimePolicy): number {
  return Math.max(Number(weekdayPaidHours(policy)) || 0, 0)
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
  workedHours: number = baseHours,
  unpaidBreakHours = 0
): PayrollHoursSegment {
  const clock = (value: number | string | undefined) =>
    value == null
      ? undefined
      : typeof value === 'number'
        ? formatClockMinutes(value > 24 * 60 ? value - 24 * 60 : Math.min(value, 24 * 60 - 1))
        : value
  const row: PayrollHoursSegment = { kind, clockStart: clock(start), clockEnd: clock(end), baseHours, multiplier, paidHours: baseHours * multiplier, workedHours }
  if (unpaidBreakHours > 0) row.unpaidBreakHours = unpaidBreakHours
  return row
}

/**
 * Rulebook 1.20.3 (owner, final): hours at a multiplier with an unpaid break worked in them. The break comes off as
 * plain hours AFTER the multiplier: paid = clock × N − break. Stored as `baseHours` = clock − break / N, so
 * `baseHours × multiplier` (and every pay figure built on `outsideHours × multiplier`) is exactly clock × N − break;
 * `unpaidBreakHours` is the break, `workedHours` the clock less the break. `payrollOutsideClockHours` gives the clock
 * hours back for display ("6.5h × 2 = 13h − 0.5h unpaid break = 12.5h").
 */
function multipliedLessBreak(
  kind: PayrollHoursSegmentKind,
  clockHours: number,
  breakHours: number,
  multiplier: number,
  start: number,
  end: number
): PayrollHoursSegment {
  const n = Number(multiplier) > 0 ? Number(multiplier) : 1
  const brk = Math.max(0, Math.min(clockHours * n, breakHours))
  const row = segment(kind, Math.max(0, clockHours - brk / n), n, start, end, Math.max(0, clockHours - breakHours), breakHours)
  row.paidHours = Math.max(0, clockHours * n - brk)
  return row
}

/**
 * Rulebook 1.20.3: the clock hours paid at the multiplier before the unpaid break came off (outside-window or
 * every-hour segments), and the break taken off them as plain hours. For display only — pay uses `outsideHours ×
 * outsideMultiplier`, which already equals `outsideClockHours × multiplier − outsideBreakHours`.
 */
export function payrollOutsideClockHours(result: Pick<PayrollHoursResult, 'segments'> | null | undefined): {
  outsideClockHours: number
  outsideBreakHours: number
} {
  let clock = 0
  let brk = 0
  for (const row of result?.segments ?? []) {
    if (row.kind === 'standardWindow') continue
    const b = row.unpaidBreakHours ?? 0
    clock += row.baseHours + (b > 0 && row.multiplier > 0 ? b / row.multiplier : 0)
    brk += b
  }
  return { outsideClockHours: clock, outsideBreakHours: brk }
}

function result(segments: PayrollHoursSegment[], outsideMultiplier: number): PayrollHoursResult {
  let total = 0
  let standard = 0
  let outside = 0
  let worked = 0
  let unpaidBreak = 0
  for (const row of segments) {
    total += row.paidHours
    worked += row.workedHours
    unpaidBreak += row.unpaidBreakHours ?? 0
    if (row.kind === 'standardWindow') standard += row.baseHours
    else outside += row.baseHours
  }
  return {
    totalPaidHours: total,
    standardHours: standard,
    outsideHours: outside,
    outsideMultiplier,
    workedHours: worked,
    unpaidBreakHours: unpaidBreak,
    segments,
  }
}

function interval(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy): MinuteInterval | null {
  return slotInterval(
    { timeSlot: booking.timeSlot ?? undefined, workStartTime: booking.workStartTime ?? undefined, workEndTime: booking.workEndTime ?? undefined },
    dayInput(policy)
  )
}

function isNamedHalf(booking: PayrollHoursBooking): boolean {
  const kind = namedSlotKind(booking.timeSlot)
  return kind === 'AM' || kind === 'PM'
}

function isHalfDayPaid(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy, allHoursDay: boolean, weekdayDay = false): boolean {
  if (isNamedHalf(booking)) return true
  if (namedSlotKind(booking.timeSlot) !== 'CUSTOM' || allHoursDay) return false
  // 1.20.0 §4.3 / §8: Monday–Friday offers Full day or Custom only, so under a policy saved from 1.20.0 custom weekday
  // hours are paid on the clock (inside the day less the unpaid-break overlap, outside at the multiplier) and are never
  // snapped to a half day. A policy saved earlier keeps the 20-minute snap exactly as before.
  if (weekdayDay && policy.paidHoursDerived === true) return false
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

/**
 * Rulebook 1.12.0 §8: the unpaid break taken off a booking is the part of the break window the booking covers, up to
 * the unpaid break length — a booking across the whole window loses the whole break, one that covers 10 minutes of it
 * loses 10 minutes (it used to lose the whole break for any overlap).
 */
function breakDeductionMinutes(policy: OrgPayrollTimePolicy, span: MinuteInterval): number {
  const start = parseClockMinutes(policy.breakWindowStart)
  const end = parseClockMinutes(policy.breakWindowEnd)
  if (start == null || end == null || end <= start) return 0
  const overlap = Math.min(span.end, end) - Math.max(span.start, start)
  if (!(overlap > 0)) return 0
  const unpaid = Math.max(Number(policy.unpaidBreakMinutes) || 0, 0)
  return Math.min(overlap, unpaid)
}

/** A day's break as minutes: the weekday break, or a weekend day's own (`weekendBreakFor`). */
type DayBreak = { start: number; end: number; minutes: number } | null

function dayBreakOf(start: string | undefined, end: string | undefined, minutes: number): DayBreak {
  const s = parseClockMinutes(start)
  const e = parseClockMinutes(end)
  if (s == null || e == null || e <= s) return null
  return { start: s, end: e, minutes: Math.max(Number(minutes) || 0, 0) }
}

function weekendDayBreak(policy: OrgPayrollTimePolicy, weekend: WeekendPayrollSettings): DayBreak {
  const own = weekendBreakFor(policy, weekend)
  return dayBreakOf(own.start, own.end, own.minutes)
}

/** Minutes of the day's break window inside `part` (no cap). */
function breakOverlapMinutes(dayBreak: DayBreak, part: MinuteInterval): number {
  if (!dayBreak) return 0
  return Math.max(0, Math.min(part.end, dayBreak.end) - Math.max(part.start, dayBreak.start))
}

/** The weekday rule with any day's break: the covered part of the break window, up to the break length. */
function dayBreakDeductionMinutes(dayBreak: DayBreak, span: MinuteInterval): number {
  if (!dayBreak) return 0
  return Math.min(breakOverlapMinutes(dayBreak, span), dayBreak.minutes)
}

/**
 * Rulebook 1.19.0 §4.3: whether the weekend day's lunch break is unpaid, with a length above 0. Each weekend day has
 * its own `breakPaid` (missing = paid), `breakMinutes`, `breakWindowStart`, `breakWindowEnd`; a missing length or
 * window is the weekday one (`weekendBreakFor`).
 */
function weekendBreakUnpaid(policy: OrgPayrollTimePolicy, weekend: WeekendPayrollSettings): boolean {
  const own = weekendBreakFor(policy, weekend)
  return !own.paid && own.minutes > 0
}

/**
 * Rulebook 1.19.0: whether an unpaid break is taken off bookings on `dayKey` under `policy` (the policy in effect that
 * day). Monday–Friday: the organisation break is unpaid (`breakPaid !== true`) with a length above 0. Saturday / Sunday:
 * that day's `breakPaid` is `false` (Sunday "same as Saturday" uses Saturday's) with a length above 0. Booking screens
 * offer the "Unpaid break" toggle (`isBreakRemoved`) and `customHoursBreakWarning` only when this is true.
 */
export function unpaidBreakAppliesOnDay(
  policy: OrgPayrollTimePolicy | null | undefined,
  dayKey: string,
  timeZone?: string | null
): boolean {
  if (!policy) return false
  const zone = zoneOrLondon(timeZone)
  const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, zone), zone)
  const weekend = weekendFor(iso, policy)
  // 1.20.3: a weekend day is judged on its own break length (`weekendBreakFor`), not the weekday length — a weekend
  // day with its own unpaid break applies even when the weekday length is 0.
  if (weekend) return weekendBreakUnpaid(policy, weekend)
  return Number(policy.unpaidBreakMinutes) > 0 && policy.breakPaid !== true
}

/**
 * Rulebook 1.19.0: the break window and length that apply on `dayKey` (weekday break, or that weekend day's own with
 * the weekday fallback), whether paid or not. Minutes from midnight; null when the window does not form an interval.
 */
export function payrollBreakOnDay(
  policy: OrgPayrollTimePolicy | null | undefined,
  dayKey: string,
  timeZone?: string | null
): { start: number; end: number; minutes: number; paid: boolean } | null {
  if (!policy) return null
  const zone = zoneOrLondon(timeZone)
  const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, zone), zone)
  const weekend = weekendFor(iso, policy)
  if (weekend) {
    const own = weekendBreakFor(policy, weekend)
    const window = dayBreakOf(own.start, own.end, own.minutes)
    return window ? { ...window, paid: own.paid } : null
  }
  const window = dayBreakOf(policy.breakWindowStart, policy.breakWindowEnd, policy.unpaidBreakMinutes)
  return window ? { ...window, paid: policy.breakPaid === true } : null
}

/**
 * Rulebook 1.19.0: the bands a booking day draws on an hours timeline — the day's paid window (the weekday standard
 * day, or a set-window weekend day's window; null on an every-hour weekend day), and the break window when an unpaid
 * break applies that day (`unpaidBreakAppliesOnDay`), else null. Minutes from midnight.
 */
export function payrollDayWindows(
  policy: OrgPayrollTimePolicy | null | undefined,
  dayKey: string,
  timeZone?: string | null
): { paidWindow: MinuteInterval | null; unpaidBreak: MinuteInterval | null; allHoursMultiplier: number | null } {
  if (!policy) return { paidWindow: null, unpaidBreak: null, allHoursMultiplier: null }
  const zone = zoneOrLondon(timeZone)
  const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, zone), zone)
  const weekend = weekendFor(iso, policy)
  const dayBreak = payrollBreakOnDay(policy, dayKey, zone)
  const unpaidBreak =
    unpaidBreakAppliesOnDay(policy, dayKey, zone) && dayBreak ? { start: dayBreak.start, end: dayBreak.end } : null
  if (weekend) {
    if (weekend.allHoursAtMultiplierMode) return { paidWindow: null, unpaidBreak, allHoursMultiplier: weekend.allHoursMultiplier }
    const ws = parseClockMinutes(weekend.definedWindowStart ?? policy.standardDayStart)
    const we = parseClockMinutes(weekend.definedWindowEnd ?? '13:00')
    return { paidWindow: ws != null && we != null && we > ws ? { start: ws, end: we } : null, unpaidBreak, allHoursMultiplier: null }
  }
  const ds = parseClockMinutes(policy.standardDayStart)
  const de = parseClockMinutes(policy.standardDayEnd)
  return { paidWindow: ds != null && de != null && de > ds ? { start: ds, end: de } : null, unpaidBreak, allHoursMultiplier: null }
}

/** A booking with clock times that pays nothing (all of it inside the unpaid break): 0 hours, never a full day. */
function nothingPaid(span: MinuteInterval, multiplier: number): PayrollHoursResult {
  return result([segment('standardWindow', 0, 1, span.start, span.end, 0)], multiplier)
}

/** The parts of `span` before and after the window. */
function outsideIntervals(span: MinuteInterval, windowStart: number, windowEnd: number): MinuteInterval[] {
  const parts: MinuteInterval[] = []
  if (span.start < windowStart) parts.push({ start: span.start, end: Math.min(span.end, windowStart) })
  if (span.end > windowEnd) parts.push({ start: Math.max(span.start, windowEnd), end: span.end })
  return parts.filter((part) => part.end > part.start)
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
  if (isHalfDayPaid(booking, policy, false, true)) return halfDayPaid(booking, policy, null, multiplier)
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
    let deducted = 0
    if (!isNamedHalf(booking) && policy.breakPaid !== true && booking.isBreakRemoved !== true) {
      deducted = Math.min(hours, breakDeductionMinutes(policy, span) / 60)
      hours = Math.max(0, hours - deducted)
    }
    if (hours > 0.001) rows.push(segment('standardWindow', hours, 1, insideStart, insideEnd, hours, deducted))
  }
  rows.push(...outsideSegments(span, ds, de, multiplier))
  // 1.12.0: clock times are present (a span), so an empty result is 0 hours — never the full standard day.
  if (rows.length === 0) return nothingPaid(span, multiplier)
  return result(rows, multiplier)
}

/** A FULL DAY booking with no clock times of its own. */
function weekendFullDayOnly(booking: PayrollHoursBooking): boolean {
  if (namedSlotKind(booking.timeSlot) !== 'FULL_DAY') return false
  return parseClockMinutes(booking.workStartTime ?? undefined) == null || parseClockMinutes(booking.workEndTime ?? undefined) == null
}

/**
 * Rulebook 1.13.0 §4.3 / §8 (Q2): what FULL DAY means on a Saturday or Sunday — that day's set window
 * (`definedWindowStart`–`definedWindowEnd`, paid at its "counts as" hours), or, when the day pays every hour at the
 * multiplier, the standard day. Null when the window does not form an interval.
 */
export function weekendFullDayWindow(policy: OrgPayrollTimePolicy, weekend: WeekendPayrollSettings): MinuteInterval | null {
  if (weekend.allHoursAtMultiplierMode) {
    const start = parseClockMinutes(policy.standardDayStart)
    const end = parseClockMinutes(policy.standardDayEnd)
    return start != null && end != null && end > start ? { start, end } : null
  }
  const start = parseClockMinutes(weekend.definedWindowStart ?? policy.standardDayStart)
  const end = parseClockMinutes(weekend.definedWindowEnd ?? '13:00')
  return start != null && end != null && end > start ? { start, end } : null
}

/** The weekend rule for an ISO weekday (6 Saturday, 7 Sunday; Sunday "same as Saturday" is Saturday's), else null. */
export function weekendRuleForIsoWeekday(isoWeekday: number, policy: OrgPayrollTimePolicy): WeekendPayrollSettings | null {
  return weekendFor(isoWeekday, policy)
}

function weekendDay(booking: PayrollHoursBooking, policy: OrgPayrollTimePolicy, weekend: WeekendPayrollSettings, multiplier: number): PayrollHoursResult {
  const fullDayWindow = weekendFullDayOnly(booking) ? weekendFullDayWindow(policy, weekend) : null
  const span = fullDayWindow ?? interval(booking, policy)
  if (!span) return legacySlot(booking, policy, multiplier)
  // 1.19.0: the weekday deduction rule (`breakDeductionMinutes`: the part of the break window the booking covers, up to
  // the break length) with THAT day's break (`weekendBreakFor`) when it is unpaid; cancelled by the booking's
  // "No unpaid break" (`isBreakRemoved`); never on a named AM / PM (as Monday–Friday).
  const dayBreak = weekendDayBreak(policy, weekend)
  const deductBreak = weekendBreakUnpaid(policy, weekend) && booking.isBreakRemoved !== true && !isNamedHalf(booking)
  const totalBreak = deductBreak ? dayBreakDeductionMinutes(dayBreak, span) : 0
  if (weekend.allHoursAtMultiplierMode) {
    if (isNamedHalf(booking)) return halfDayPaid(booking, policy, weekend, multiplier)
    // Rulebook 1.20.3 (owner, final): every hour at N×, then the unpaid break off as plain hours — clock × N − break
    // (07:30–14:00 × 2 with 30 min unpaid = 13 − 0.5 = 12.5h). The break is never multiplied.
    const clockHours = (span.end - span.start) / 60
    const deducted = Math.min(clockHours, totalBreak / 60)
    return result([multipliedLessBreak('allHoursMultiplier', clockHours, deducted, multiplier, span.start, span.end)], multiplier)
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
  // The deduction is taken first from the part of the break inside the window (off the credited hours), and the rest
  // from the outside hours the booking works there (hours always match the clock), before the multiplier.
  let breakLeft = totalBreak
  if (overlapEnd > overlapStart) {
    const credited = overlapStart <= ws && overlapEnd >= we ? credit : credit * ((overlapEnd - overlapStart) / (we - ws))
    const inside = Math.min(breakLeft, breakOverlapMinutes(dayBreak, { start: overlapStart, end: overlapEnd }))
    breakLeft -= inside
    const insideHours = inside / 60
    // A weekend window credits a set number of hours; the time worked is the clock time.
    rows.push(
      segment(
        'standardWindow',
        Math.max(0, credited - insideHours),
        1,
        overlapStart,
        overlapEnd,
        Math.max(0, (overlapEnd - overlapStart) / 60 - insideHours),
        insideHours
      )
    )
  }
  for (const part of outsideIntervals(span, ws, we)) {
    const taken = Math.min(breakLeft, breakOverlapMinutes(dayBreak, part))
    breakLeft -= taken
    const clockHours = (part.end - part.start) / 60
    if (clockHours > 0.001) {
      // 1.20.3: outside hours × N, then the break worked in them off as plain hours (never multiplied).
      rows.push(multipliedLessBreak('outsideWindow', clockHours, Math.min(clockHours, taken / 60), multiplier, part.start, part.end))
    }
  }
  if (rows.length === 0) return nothingPaid(span, multiplier)
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
