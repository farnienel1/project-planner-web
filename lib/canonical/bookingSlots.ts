/**
 * Rulebook 1.13.0 (owner decisions round 4): which booking slots a day offers, what FULL DAY means at the weekend,
 * and the custom-hours lunch-break warning. Screens call these; none keeps its own slot list or break test.
 *
 * - Q2 weekends: Saturday and Sunday have no AM or PM. `allowedTimeSlotsOnDay` gives FULL DAY and CUSTOM only on
 *   those days. FULL DAY is that day's set window, paid at its "counts as" hours (`weekendFullDayWindow`,
 *   `payrollHoursResult`); custom hours outside it are paid at that day's outside multiplier. Existing weekend AM / PM
 *   bookings keep their stored slot and their pay (`payrollHoursResult` still pays them half the day).
 *   `weekendFullDayNote` is the line shown under the picker.
 * - Lunch warning: `customHoursBreakWarning` is the message shown before a custom-hours booking is saved when the
 *   organisation break is unpaid, the booking's "Unpaid break" toggle is on and the hours cover the break window. Pay
 *   is unchanged (§8: break minutes come off only while the toggle is on).
 */

import { formatClockMinutes, intervalsOverlap, namedSlotKind, parseClockMinutes, slotInterval } from './engine'
import type { OrgPayrollTimePolicy } from './organizationSettings'
import { weekendFullDayWindow, weekendRuleForIsoWeekday } from './payrollHours'
import { isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'

/** The slot values a booking picker may offer, in picker order. Stored spellings stay each collection's own. */
export type BookingSlotChoice = 'FULL DAY' | 'AM' | 'PM' | 'CUSTOM'

export const WEEKDAY_TIME_SLOTS: readonly BookingSlotChoice[] = ['FULL DAY', 'AM', 'PM', 'CUSTOM']
export const WEEKEND_TIME_SLOTS: readonly BookingSlotChoice[] = ['FULL DAY', 'CUSTOM']

function isoWeekdayOf(day: string | number, timeZone?: string | null): number {
  if (typeof day === 'number') return day
  const text = String(day || '').trim().toLowerCase()
  if (text === 'saturday') return 6
  if (text === 'sunday') return 7
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isoWeekdayOfDayKey(text, zoneOrLondon(timeZone))
  return 0
}

/** Whether a day key (organisation zone) is a Saturday or Sunday. */
export function isWeekendDayKey(dayKey: string, timeZone?: string | null): boolean {
  const iso = isoWeekdayOf(dayKey, timeZone)
  return iso === 6 || iso === 7
}

/**
 * The slots a booking picker offers on a day: FULL DAY and CUSTOM on Saturday and Sunday, FULL DAY, AM, PM and
 * CUSTOM otherwise. `policy` is accepted so every platform passes the same inputs; the week is fixed (§1).
 */
export function allowedTimeSlotsOnDay(
  dayKey: string,
  _policy?: OrgPayrollTimePolicy | null,
  timeZone?: string | null
): BookingSlotChoice[] {
  return [...(isWeekendDayKey(dayKey, timeZone) ? WEEKEND_TIME_SLOTS : WEEKDAY_TIME_SLOTS)]
}

/** Whether a stored slot is offered on that day (a stored weekend AM / PM is kept and shown, never offered anew). */
export function timeSlotAllowedOnDay(timeSlot: string | null | undefined, dayKey: string, timeZone?: string | null): boolean {
  const kind = namedSlotKind(timeSlot)
  if (kind !== 'AM' && kind !== 'PM') return true
  return !isWeekendDayKey(dayKey, timeZone)
}

function hoursText(hours: number): string {
  const rounded = Math.round(hours * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toString()}h`
}

function multiplierText(multiplier: number): string {
  const rounded = Math.round(Number(multiplier) * 100) / 100
  return `${rounded}×`
}

/**
 * The line under a weekend booking picker, e.g. "Full day = Saturday 07:30–13:00 (counts as 8h). Change it in
 * Working hours." When that day pays every hour at its multiplier: "Full day = Saturday 07:30–16:00, every hour at
 * 1.5×. Change it in Working hours." `weekday` is an ISO weekday (6, 7), "saturday" / "sunday" or a day key. Null on
 * a weekday or when the window is not set.
 */
export function weekendFullDayNote(
  policy: OrgPayrollTimePolicy | null | undefined,
  weekday: string | number,
  timeZone?: string | null
): string | null {
  if (!policy) return null
  const iso = isoWeekdayOf(weekday, timeZone)
  if (iso !== 6 && iso !== 7) return null
  const weekend = weekendRuleForIsoWeekday(iso, policy)
  if (!weekend) return null
  const window = weekendFullDayWindow(policy, weekend)
  if (!window) return null
  const dayName = iso === 6 ? 'Saturday' : 'Sunday'
  const range = `${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)}`
  if (weekend.allHoursAtMultiplierMode) {
    return `Full day = ${dayName} ${range}, every hour at ${multiplierText(weekend.allHoursMultiplier)}. Change it in Working hours.`
  }
  const countsAs = Number(weekend.countsAsStandardHours ?? policy.standardPaidHours)
  return `Full day = ${dayName} ${range} (counts as ${hoursText(Number.isFinite(countsAs) ? countsAs : 0)}). Change it in Working hours.`
}

export const CUSTOM_HOURS_BREAK_WARNING =
  'You are booking custom hours that cover the unpaid lunch break. Turn off Unpaid break to make sure they are paid for this time.'

export type CustomHoursBreakBooking = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  /** The booking's "Unpaid break" toggle is on while this is not true. */
  isBreakRemoved?: boolean | null
}

/**
 * `CUSTOM_HOURS_BREAK_WARNING` when the booking is custom hours, the organisation break is unpaid
 * (`breakPaid !== true`, an unpaid length above 0), the booking's Unpaid break toggle is on (`isBreakRemoved !== true`)
 * and its clock interval overlaps the break window on that day; else null. Saturday and Sunday take no break off
 * (§8), so they never warn. `policy` is the policy in effect that day (`effectivePayrollTimePolicy`).
 */
export function customHoursBreakWarning(
  policy: OrgPayrollTimePolicy | null | undefined,
  dayKey: string,
  booking: CustomHoursBreakBooking | null | undefined,
  timeZone?: string | null
): string | null {
  if (!policy || !booking) return null
  if (namedSlotKind(booking.timeSlot) !== 'CUSTOM') return null
  if (policy.breakPaid === true || booking.isBreakRemoved === true) return null
  if (!(Number(policy.unpaidBreakMinutes) > 0)) return null
  if (dayKey && isWeekendDayKey(dayKey, timeZone)) return null
  const start = parseClockMinutes(policy.breakWindowStart)
  const end = parseClockMinutes(policy.breakWindowEnd)
  if (start == null || end == null || end <= start) return null
  const span = slotInterval(
    { timeSlot: booking.timeSlot, workStartTime: booking.workStartTime, workEndTime: booking.workEndTime },
    policy
  )
  if (!span) return null
  return intervalsOverlap(span, { start, end }) ? CUSTOM_HOURS_BREAK_WARNING : null
}
