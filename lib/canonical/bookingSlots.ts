/**
 * Rulebook 1.13.0 (owner decisions round 4): which booking slots a day offers, what FULL DAY means at the weekend,
 * and the custom-hours lunch-break warning. Screens call these; none keeps its own slot list or break test.
 *
 * - Q2 weekends (owner decision, revised in 1.13.0): Saturday and Sunday bookings are custom hours only, on every
 *   platform and whatever the organisation's weekend setup — no FULL DAY, AM or PM (`allowedTimeSlotsOnDay`). When the
 *   day's rule is a set window ("standard window + overtime"), the custom-hours editor opens prefilled with that window
 *   (`weekendCustomHoursDefault`); the person can change it. Pay is the custom hours under that day's rule
 *   (`payrollHoursResult`). Stored weekend FULL DAY / AM / PM bookings are never rewritten and keep their pay.
 *   `weekendBookingNote` is the line shown under the picker. A booking request never mixes weekdays and weekend days
 *   (`bookingDaysMixWeekdayAndWeekend`, `WEEKEND_WEEKDAY_MIX_MESSAGE`).
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
export const WEEKEND_TIME_SLOTS: readonly BookingSlotChoice[] = ['CUSTOM']

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
 * The slots a booking picker offers on a day: CUSTOM only on Saturday and Sunday, FULL DAY, AM, PM and CUSTOM
 * otherwise. Not affected by the organisation's weekend setup; `policy` is accepted so every platform passes the same
 * inputs.
 */
export function allowedTimeSlotsOnDay(
  dayKey: string,
  _policy?: OrgPayrollTimePolicy | null,
  timeZone?: string | null
): BookingSlotChoice[] {
  return [...(isWeekendDayKey(dayKey, timeZone) ? WEEKEND_TIME_SLOTS : WEEKDAY_TIME_SLOTS)]
}

/**
 * Whether a slot may be booked anew on that day: on Saturday and Sunday only custom hours. A stored weekend FULL DAY /
 * AM / PM is kept, shown and paid as stored, never offered anew and never rewritten.
 */
export function timeSlotAllowedOnDay(timeSlot: string | null | undefined, dayKey: string, timeZone?: string | null): boolean {
  if (!isWeekendDayKey(dayKey, timeZone)) return true
  return namedSlotKind(timeSlot) === 'CUSTOM'
}

/** iOS `ScheduleDateSelectionPolicy.weekdayWeekendMixMessage`, word for word. */
export const WEEKEND_WEEKDAY_MIX_MESSAGE =
  'Weekends cannot be booked alongside Weekdays. Make your weekday booking first then weekend separately.'

/**
 * True when one booking request holds both a weekday and a Saturday or Sunday. Every multi-day booking picker refuses
 * that request with `WEEKEND_WEEKDAY_MIX_MESSAGE` (weekends are custom hours only, so they are booked on their own).
 */
export function bookingDaysMixWeekdayAndWeekend(dayKeys: ReadonlyArray<string> | null | undefined, timeZone?: string | null): boolean {
  let weekday = false
  let weekend = false
  for (const key of dayKeys || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || '').trim())) continue
    if (isWeekendDayKey(String(key).trim(), timeZone)) weekend = true
    else weekday = true
    if (weekday && weekend) return true
  }
  return false
}

/**
 * The custom-hours editor's starting times on a Saturday or Sunday whose rule is a set window ("standard window +
 * overtime"): that window, e.g. `{ start: '07:30', end: '13:00' }`. Null on a weekday, when the day pays every hour at
 * one rate, or when the window is not set — then the editor opens with its usual times. A prefill only; the person may
 * change it.
 */
export function weekendCustomHoursDefault(
  policy: OrgPayrollTimePolicy | null | undefined,
  weekday: string | number,
  timeZone?: string | null
): { start: string; end: string } | null {
  if (!policy) return null
  const iso = isoWeekdayOf(weekday, timeZone)
  if (iso !== 6 && iso !== 7) return null
  const weekend = weekendRuleForIsoWeekday(iso, policy)
  if (!weekend || weekend.allHoursAtMultiplierMode) return null
  const window = weekendFullDayWindow(policy, weekend)
  return window ? { start: formatClockMinutes(window.start), end: formatClockMinutes(window.end) } : null
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
 * The line under a weekend booking picker. Set window: "Saturday is paid on the hours you enter: 07:30–13:00 counts as
 * 8h, hours outside it at 2×. Change it in Working hours." Every hour at one rate: "Sunday is paid on the hours you
 * enter, every hour at 2×. Change it in Working hours." `weekday` is an ISO weekday (6, 7), "saturday" / "sunday" or a
 * day key. Null on a weekday or when the window is not set.
 */
export function weekendBookingNote(
  policy: OrgPayrollTimePolicy | null | undefined,
  weekday: string | number,
  timeZone?: string | null
): string | null {
  if (!policy) return null
  const iso = isoWeekdayOf(weekday, timeZone)
  if (iso !== 6 && iso !== 7) return null
  const weekend = weekendRuleForIsoWeekday(iso, policy)
  if (!weekend) return null
  const dayName = iso === 6 ? 'Saturday' : 'Sunday'
  if (weekend.allHoursAtMultiplierMode) {
    return `${dayName} is paid on the hours you enter, every hour at ${multiplierText(weekend.allHoursMultiplier)}. Change it in Working hours.`
  }
  const window = weekendFullDayWindow(policy, weekend)
  if (!window) return null
  const range = `${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)}`
  const countsAs = Number(weekend.countsAsStandardHours ?? policy.standardPaidHours)
  const outside = Number(weekend.outsideWindowMultiplier ?? 1.5)
  return `${dayName} is paid on the hours you enter: ${range} counts as ${hoursText(Number.isFinite(countsAs) ? countsAs : 0)}, hours outside it at ${multiplierText(outside)}. Change it in Working hours.`
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
