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

import { formatClockMinutes, parseClockMinutes, standardDayCoverage, windowCoverage } from './engine'
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
  /**
   * The same in one line (owner answer 11 Nov), e.g. "07:00–22:00 = 8.5h (day, less 30 min unpaid break) + 6h × 1.5 =
   * 9h → 17.5h" or "07:30–16:00 = 8h (full day) + 2h × 2 = 4h → 12h".
   */
  summary: string
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
    const countsAs = Number(weekend.countsAsStandardHours ?? weekdayPaidHours(policy)) || 0
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
  const ruleOfDay = dayRule(dayPolicy, key, zone)
  const { kind, fullDayHours, windowHours } = ruleOfDay
  // Review (11 Nov): a booking with its own overtime rate (`otMultiplierOverride`, §25) says so — the steps already
  // price at it (`payrollHoursResult`), so the day's rule line must not read as if the organisation's rate applied.
  const own = Number(booking.otMultiplierOverride)
  const orgRate = payrollOutsideMultiplier({}, isoWeekdayOfDayKey(key, zone), dayPolicy)
  const rule =
    Number.isFinite(own) && own > 0 && Math.abs(own - orgRate) > 0.0001
      ? `${ruleOfDay.rule}; this booking's own overtime rate is ${times(own)}×`
      : ruleOfDay.rule
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
    return { dayKey: key, weekdayLabel: label, kind, rule, steps, summary: steps[0], totalPaidHours: 0, fullDayHours }
  }
  // Rulebook 1.39.0 (owner answer 11 Nov): every break word comes from the working hours in effect that day — the
  // minutes the pay rule took off, a paid break the booking covers, or "no unpaid break" on the booking.
  const dayBreak = payrollBreakOnDay(dayPolicy, key, zone)
  const unpaidApplies = unpaidBreakAppliesOnDay(dayPolicy, key, zone)
  const breakNote = (row: PayrollHoursSegment, brk: number): string => {
    if (brk > 0) return `less ${Math.round(brk * 60)} min unpaid break`
    const start = parseClockMinutes(row.clockStart ?? null)
    const end = parseClockMinutes(row.clockEnd ?? null)
    if (!dayBreak || !(dayBreak.minutes > 0) || start == null || end == null) return ''
    const covers = Math.min(end > start ? end : end + 24 * 60, dayBreak.end) > Math.max(start, dayBreak.start)
    if (!covers) return ''
    if (!unpaidApplies) return `${dayBreak.minutes} min paid break, not deducted`
    return booking.isBreakRemoved === true ? 'no unpaid break on this booking' : ''
  }
  const summaryParts: string[] = []
  let multipliedBreak = false
  for (const row of segments) {
    const brk = round(row.unpaidBreakHours ?? 0)
    const range = rangeOf(row)
    const prefix = parts > 0 ? '+ ' : ''
    if (row.kind === 'standardWindow') {
      const clock = clockSpanHours(row) ?? row.workedHours + (row.unpaidBreakHours ?? 0)
      const note = breakNote(row, brk)
      if (kind === 'weekendWindow') {
        // A set window credits its "counts as" hours, pro rata for the part of the window worked; the break comes off them.
        const credited = row.baseHours + (row.unpaidBreakHours ?? 0)
        const full = fullDayHours != null && Math.abs(round(credited) - fullDayHours) < 0.001
        if (full) {
          const why = brk > 0 ? `full day ${h(credited)}, ${note}` : note ? `full day, ${note}` : 'full day'
          steps.push(`${prefix}${range ?? label} = ${h(row.baseHours)} (${why})`)
          summaryParts.push(`${h(row.baseHours)} (${why})`)
        } else if (windowHours && fullDayHours != null && range) {
          const proRata = `${h(fullDayHours)} × ${round(clock)} ÷ ${round(windowHours)} = ${h(credited)}`
          const tail = brk > 0 ? `, ${note} = ${h(row.baseHours)}` : note ? ` (${note})` : ''
          steps.push(`${prefix}Booked ${range} = ${h(clock)} of the ${h(windowHours)} window → ${proRata}${tail}`)
          summaryParts.push(`${proRata}${tail} (part of the ${h(windowHours)} window)`)
        } else {
          steps.push(`${prefix}${range ?? label} = ${h(row.baseHours)}${note ? ` (${note})` : ''}`)
          summaryParts.push(`${h(row.baseHours)}${note ? ` (${note})` : ''}`)
        }
      } else {
        const why = note ? `day, ${note}` : 'day'
        steps.push(`${prefix}${range ?? label} = ${h(row.baseHours)} (${why})`)
        summaryParts.push(`${h(row.baseHours)} (${why})`)
      }
      parts += 1
    } else {
      const clock = clockSpanHours(row) ?? row.baseHours + (row.multiplier > 0 ? (row.unpaidBreakHours ?? 0) / row.multiplier : 0)
      const multiplied = clock * row.multiplier
      steps.push(`${prefix}${range ?? label} = ${h(clock)} × ${times(row.multiplier)} = ${h(multiplied)}`)
      // An unpaid break in hours at a multiplier is plain hours, taken off after the multiplier (1.20.3).
      if (brk > 0) {
        steps.push(`− ${h(brk)} unpaid break`)
        multipliedBreak = true
      }
      summaryParts.push(`${h(clock)} × ${times(row.multiplier)} = ${h(multiplied)}${brk > 0 ? ` − ${h(brk)} unpaid break` : ''}`)
      parts += 1
    }
  }
  if (parts > 1 || multipliedBreak) steps.push(`→ ${h(total)}`)
  const whole =
    startMinutes != null && endMinutes != null ? `${formatClockMinutes(startMinutes)}–${formatClockMinutes(endMinutes)}` : label
  const summary = `${whole} = ${summaryParts.join(' + ')}${parts > 1 || multipliedBreak ? ` → ${h(total)}` : ''}`
  return { dayKey: key, weekdayLabel: label, kind, rule, steps, summary, totalPaidHours: total, fullDayHours }
}

export type BookingShortfall = {
  /** e.g. "Short of a full Saturday (07:30–14:00)". */
  label: string
  /**
   * The hours of the day that must be booked (`standardDayCoverage.requiredHours` / `windowCoverage.requiredHours`:
   * the working day or a set-window weekend day's window, lunch-break window excluded). Kept under its 1.39.0 name.
   */
  fullDayHours: number
  /** Clock hours of that day not covered by the bookings (lunch window excluded); always 0.05 or more. */
  missingHours: number
  /** `missingHours` as text, e.g. "5.5h". */
  value: string
}

export type BookingShortfallBooking = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
}

/**
 * Rulebook 1.39.0 §4.3 (review, 11 Nov): the "missing hours" line under a picker's booked total — how much of the
 * day's working time the person's bookings that day (existing + new) leave unbooked, by COVERAGE, never by paid hours
 * (hours at a multiplier never fill the day): Monday–Friday `standardDayCoverage` (the working day, start to finish,
 * lunch window excluded — the Daily Overview and unbooked-labour rule); a set-window Saturday or Sunday
 * `windowCoverage` of that day's window with that day's own lunch window excluded. Null when nothing is short (under
 * 0.05h), on a day paid every hour at a multiplier (no full day), or with no policy / day / bookings list.
 */
export function bookingShortfall(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined,
  bookings: ReadonlyArray<BookingShortfallBooking> | null | undefined,
  timeZone?: string | null
): BookingShortfall | null {
  const key = validDayKey(dayKey)
  if (!policy || !key || !Array.isArray(bookings)) return null
  const zone = zoneOrLondon(timeZone)
  const dayPolicy = dayPolicyOf(policy, key)
  const iso = isoWeekdayOfDayKey(key, zone)
  const label = WEEKDAY_NAMES[iso] || key
  const rows = bookings.filter(Boolean).map((booking) => ({
    timeSlot: booking.timeSlot ?? 'CUSTOM_HOURS',
    workStartTime: booking.workStartTime ?? null,
    workEndTime: booking.workEndTime ?? null,
  }))
  const weekend = weekendRuleForIsoWeekday(iso, dayPolicy)
  let window: { start: number; end: number } | null
  let coverage: { requiredHours: number; missingHours: number }
  if (weekend) {
    if (weekend.allHoursAtMultiplierMode) return null
    window = weekendFullDayWindow(dayPolicy, weekend)
    if (!window) return null
    const lunch = payrollBreakOnDay(dayPolicy, key, zone)
    coverage = windowCoverage(window, dayPolicy, rows, lunch && lunch.end > lunch.start ? { start: lunch.start, end: lunch.end } : null)
  } else {
    const start = parseClockMinutes(dayPolicy.standardDayStart)
    const end = parseClockMinutes(dayPolicy.standardDayEnd)
    window = start != null && end != null && end > start ? { start, end } : null
    coverage = standardDayCoverage(dayPolicy, rows)
  }
  const missing = round(coverage.missingHours)
  if (!(missing >= 0.05)) return null
  const span = window ? ` (${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)})` : ''
  return { label: `Short of a full ${label}${span}`, fullDayHours: round(coverage.requiredHours), missingHours: missing, value: h(missing) }
}
