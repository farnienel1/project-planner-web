/**
 * Rulebook 1.39.0 §4.3 (owner request, 11 Nov): the words that explain a booking's hours on every booking picker.
 *
 * The owner could not tell why "Saturday 07:30–10:30 = 3.69h". Every picker now shows, for each booked day, the day's
 * rule (`rule`: what a full day counts as, the unpaid break, the rate outside it) and how this booking is priced
 * (`steps`), one line per part — the part of the day / set window it covers (pro rata on a set-window weekend day), the
 * hours outside it at the multiplier, the unpaid break as its own deduction, and the total:
 *
 *   Saturday full day: 07:30–14:00 counts as 8h, hours outside it at 2×
 *   Booked 07:30–10:30 = 3h of the 6.5h window → 8h × 3 ÷ 6.5 = 3.69h
 *
 *   Saturday full day: 07:30–14:00 counts as 8h, hours outside it at 2×
 *   07:30–14:00 = 8h (full day)
 *   + 14:00–16:00 = 2h × 2 = 4h
 *   → 12h
 *
 *   Sunday every hour at 2×
 *   07:30–10:30 = 3h × 2 = 6h
 *
 * Wording only: every figure is read from `payrollHoursResult` (the timesheet pay rule) for that day under the working
 * hours in effect on it; nothing is priced here. `bookingShortfall` names what "missing hours" compare against
 * ("Short of a full Saturday (8h)"), the day's own full day — none on a day paid every hour at a multiplier.
 */

import { formatClockMinutes, parseClockMinutes } from './engine'
import { weekdayPaidHours, type OrgPayrollTimePolicy } from './organizationSettings'
import {
  payrollBreakOnDay,
  payrollHoursResult,
  payrollOutsideMultiplier,
  unpaidBreakAppliesOnDay,
  weekendFullDayWindow,
  weekendRuleForIsoWeekday,
  type PayrollHoursSegment,
} from './payrollHours'
import { isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import { payrollTimePolicyForDayFromState, type PayrollTimePolicyState } from './payrollPolicySchedule'

export type BookingHoursExplanationKind = 'weekday' | 'weekendWindow' | 'weekendAllHours'

export type BookingHoursExplanation = {
  dayKey: string
  /** 'Monday' … 'Sunday'. */
  weekdayLabel: string
  kind: BookingHoursExplanationKind
  /** The day's rule, e.g. "Saturday full day: 07:30–14:00 counts as 8h, hours outside it at 2×". */
  rule: string
  /** How this booking is priced, one line per part, e.g. ["07:30–14:00 = 8h (full day)", "+ 14:00–16:00 = 2h × 2 = 4h", "→ 12h"]. */
  steps: string[]
  /** `payrollHoursResult.totalPaidHours`, rounded to hundredths. */
  totalPaidHours: number
  /** What a full day of this day pays (weekday paid day, a weekend day's "counts as" hours), null on an every-hour day. */
  fullDayHours: number | null
}

export type BookingHoursExplanationBooking = {
  workStartTime?: string | null
  workEndTime?: string | null
  /** Missing = custom hours. */
  timeSlot?: string | null
  isBreakRemoved?: boolean | null
  otMultiplierOverride?: number | null
}

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function round(hours: number): number {
  return Math.round((Number(hours) || 0) * 100) / 100
}

function h(hours: number): string {
  return `${round(hours)}h`
}

function times(multiplier: number): string {
  return `${round(multiplier)}`
}

function isPolicyState(value: unknown): value is PayrollTimePolicyState {
  return Boolean(value && typeof value === 'object' && 'current' in (value as object) && 'scheduled' in (value as object))
}

function dayPolicyOf(policy: OrgPayrollTimePolicy | PayrollTimePolicyState, dayKey: string): OrgPayrollTimePolicy {
  return isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, dayKey) : policy
}

function validDayKey(dayKey: string | null | undefined): string | null {
  const key = String(dayKey ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null
}

function clockSpanHours(row: PayrollHoursSegment): number | null {
  const start = parseClockMinutes(row.clockStart ?? null)
  const end = parseClockMinutes(row.clockEnd ?? null)
  if (start == null || end == null) return null
  const minutes = end > start ? end - start : end + 24 * 60 - start
  return minutes > 0 ? minutes / 60 : null
}

function rangeOf(row: PayrollHoursSegment): string | null {
  return row.clockStart && row.clockEnd ? `${row.clockStart}–${row.clockEnd}` : null
}

function breakSuffix(policy: OrgPayrollTimePolicy, dayKey: string, zone: string): string {
  const dayBreak = payrollBreakOnDay(policy, dayKey, zone)
  if (!dayBreak || !(dayBreak.minutes > 0)) return ''
  const window = `${formatClockMinutes(dayBreak.start)}–${formatClockMinutes(dayBreak.end)}`
  return unpaidBreakAppliesOnDay(policy, dayKey, zone)
    ? `, unpaid break ${window} (${dayBreak.minutes} min)`
    : `, paid break ${window} (${dayBreak.minutes} min)`
}

/** Monday–Friday: the break as part of the paid-day sum — " − 30 min unpaid break (12:00–12:30)" or ", 30 min break paid (…)". */
function weekdayBreakText(policy: OrgPayrollTimePolicy, dayKey: string, zone: string): string {
  const dayBreak = payrollBreakOnDay(policy, dayKey, zone)
  if (!dayBreak || !(dayBreak.minutes > 0)) return ''
  const window = `${formatClockMinutes(dayBreak.start)}–${formatClockMinutes(dayBreak.end)}`
  return unpaidBreakAppliesOnDay(policy, dayKey, zone)
    ? ` − ${dayBreak.minutes} min unpaid break (${window})`
    : `, ${dayBreak.minutes} min break paid (${window})`
}

/** The day's rule line and what a full day pays (`BookingHoursExplanation.rule` / `fullDayHours`). */
function dayRule(
  policy: OrgPayrollTimePolicy,
  dayKey: string,
  zone: string
): { kind: BookingHoursExplanationKind; rule: string; fullDayHours: number | null; windowHours: number | null } {
  const iso = isoWeekdayOfDayKey(dayKey, zone)
  const label = WEEKDAY_NAMES[iso] || dayKey
  const rate = payrollOutsideMultiplier({}, iso, policy)
  const weekend = weekendRuleForIsoWeekday(iso, policy)
  const brk = weekend ? breakSuffix(policy, dayKey, zone) : ''
  if (weekend) {
    const window = weekend.allHoursAtMultiplierMode ? null : weekendFullDayWindow(policy, weekend)
    if (!window) return { kind: 'weekendAllHours', rule: `${label} every hour at ${times(rate)}×${brk}`, fullDayHours: null, windowHours: null }
    const countsAs = Number(weekend.countsAsStandardHours ?? policy.standardPaidHours) || 0
    return {
      kind: 'weekendWindow',
      rule: `${label} full day: ${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)} counts as ${h(countsAs)}, hours outside it at ${times(rate)}×${brk}`,
      fullDayHours: round(countsAs),
      windowHours: (window.end - window.start) / 60,
    }
  }
  const paidDay = Number(weekdayPaidHours(policy)) || 0
  const start = parseClockMinutes(policy.standardDayStart)
  const end = parseClockMinutes(policy.standardDayEnd)
  const span = start != null && end != null && end > start ? `${formatClockMinutes(start)}–${formatClockMinutes(end)}` : 'the working day'
  return {
    kind: 'weekday',
    rule: `${label} full day: ${span}${weekdayBreakText(policy, dayKey, zone)} = ${h(paidDay)}, hours outside it at ${times(rate)}×`,
    fullDayHours: round(paidDay),
    windowHours: start != null && end != null && end > start ? (end - start) / 60 : null,
  }
}

/**
 * Rulebook 1.39.0 §4.3: the explanation of one booking's hours on one day — the day's rule and one step per part of
 * the booking, read from `payrollHoursResult` under the policy in effect that day (`policy` may be the policy state).
 * Null with no policy, an invalid day key, or custom hours with no valid times.
 */
export function bookingHoursExplanation(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined,
  booking: BookingHoursExplanationBooking | null | undefined,
  timeZone?: string | null
): BookingHoursExplanation | null {
  const key = validDayKey(dayKey)
  if (!policy || !key || !booking) return null
  const zone = zoneOrLondon(timeZone)
  const startMinutes = parseClockMinutes(booking.workStartTime ?? null)
  const endMinutes = parseClockMinutes(booking.workEndTime ?? null)
  const slot = String(booking.timeSlot ?? '').trim() || 'CUSTOM_HOURS'
  const custom = /custom/i.test(slot)
  if (custom && (startMinutes == null || endMinutes == null || startMinutes === endMinutes)) return null
  const dayPolicy = dayPolicyOf(policy, key)
  const paid = payrollHoursResult({
    booking: {
      timeSlot: slot,
      workStartTime: startMinutes == null ? booking.workStartTime : formatClockMinutes(startMinutes),
      workEndTime: endMinutes == null ? booking.workEndTime : formatClockMinutes(endMinutes),
      isBreakRemoved: booking.isBreakRemoved === true,
      otMultiplierOverride: booking.otMultiplierOverride ?? null,
    },
    dayKey: key,
    policy: dayPolicy,
    timeZone: zone,
  })
  const iso = isoWeekdayOfDayKey(key, zone)
  const label = WEEKDAY_NAMES[iso] || key
  const { kind, rule, fullDayHours, windowHours } = dayRule(dayPolicy, key, zone)
  const total = round(paid.totalPaidHours)
  const steps: string[] = []
  let parts = 0
  let breaks = 0
  const segments = [...paid.segments].sort((a, b) => {
    const sa = parseClockMinutes(a.clockStart ?? null)
    const sb = parseClockMinutes(b.clockStart ?? null)
    return sa == null || sb == null ? 0 : sa - sb
  })
  if (total <= 0.001 && segments.every((row) => !(row.paidHours > 0.001))) {
    const range =
      startMinutes != null && endMinutes != null ? `${formatClockMinutes(startMinutes)}–${formatClockMinutes(endMinutes)}` : label
    const insideBreak = unpaidBreakAppliesOnDay(dayPolicy, key, zone) && booking.isBreakRemoved !== true
    steps.push(insideBreak ? `${range} is inside the unpaid break = 0h` : `${range} = 0h`)
    return { dayKey: key, weekdayLabel: label, kind, rule, steps, totalPaidHours: 0, fullDayHours }
  }
  for (const row of segments) {
    const brk = round(row.unpaidBreakHours ?? 0)
    const range = rangeOf(row)
    const prefix = parts > 0 ? '+ ' : ''
    if (row.kind === 'standardWindow') {
      const clock = clockSpanHours(row) ?? row.workedHours + (row.unpaidBreakHours ?? 0)
      if (kind === 'weekendWindow') {
        // A set window credits its "counts as" hours, pro rata for the part of the window worked; the break comes off them.
        const credited = row.baseHours + (row.unpaidBreakHours ?? 0)
        const full = fullDayHours != null && Math.abs(round(credited) - fullDayHours) < 0.001
        if (full) steps.push(`${prefix}${range ?? label} = ${h(credited)} (full day)`)
        else if (windowHours && fullDayHours != null && range) {
          steps.push(
            `${prefix}Booked ${range} = ${h(clock)} of the ${h(windowHours)} window → ${h(fullDayHours)} × ${round(clock)} ÷ ${round(windowHours)} = ${h(credited)}`
          )
        } else steps.push(`${prefix}${range ?? label} = ${h(credited)}`)
      } else {
        steps.push(`${prefix}${range ?? label} = ${h(clock)}`)
      }
      parts += 1
    } else {
      const clock = clockSpanHours(row) ?? row.baseHours + (row.multiplier > 0 ? (row.unpaidBreakHours ?? 0) / row.multiplier : 0)
      const multiplied = clock * row.multiplier
      steps.push(`${prefix}${range ?? label} = ${h(clock)} × ${times(row.multiplier)} = ${h(multiplied)}`)
      parts += 1
    }
    if (brk > 0) {
      steps.push(`− ${h(brk)} unpaid break`)
      breaks += 1
    }
  }
  if (parts > 1 || breaks > 0) steps.push(`→ ${h(total)}`)
  return { dayKey: key, weekdayLabel: label, kind, rule, steps, totalPaidHours: total, fullDayHours }
}

export type BookingShortfall = {
  /** e.g. "Short of a full Saturday (8h)". */
  label: string
  /** The hours the day's full day pays, e.g. 8. */
  fullDayHours: number
  /** Full day − booked, rounded to hundredths; always above 0. */
  missingHours: number
  /** `missingHours` as text, e.g. "4.31h". */
  value: string
}

/**
 * Rulebook 1.39.0 §4.3: the "missing hours" line under a picker's booked total, naming what it compares against — the
 * day's own full day (`bookingHoursExplanation.fullDayHours`: the weekday paid day, or a set-window weekend day's
 * "counts as" hours). `bookedHours` is what the picker already shows as booked that day (existing + new). Null when
 * nothing is short, or on a day paid every hour at a multiplier (it has no full day).
 */
export function bookingShortfall(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined,
  bookedHours: number | null | undefined,
  timeZone?: string | null
): BookingShortfall | null {
  const key = validDayKey(dayKey)
  if (!policy || !key) return null
  const zone = zoneOrLondon(timeZone)
  const dayPolicy = dayPolicyOf(policy, key)
  const { fullDayHours } = dayRule(dayPolicy, key, zone)
  if (fullDayHours == null || !(fullDayHours > 0)) return null
  const missing = round(Math.max(0, fullDayHours - Math.max(0, Number(bookedHours) || 0)))
  if (!(missing > 0)) return null
  const label = WEEKDAY_NAMES[isoWeekdayOfDayKey(key, zone)] || key
  return { label: `Short of a full ${label} (${h(fullDayHours)})`, fullDayHours, missingHours: missing, value: h(missing) }
}
