/**
 * Rulebook 1.13.0 (owner decisions round 4): which booking slots a day offers, what FULL DAY means at the weekend,
 * and the custom-hours lunch-break warning. Screens call these; none keeps its own slot list or break test.
 *
 * - Q2 weekends (owner decision, revised in 1.13.0): Saturday and Sunday bookings are custom hours only, on every
 *   platform and whatever the organisation's weekend setup — no FULL DAY, AM or PM (`allowedTimeSlotsOnDay`). When the
 *   day's rule is a set window ("standard window + overtime"), the custom-hours editor opens prefilled with that window
 *   (`weekendCustomHoursDefault`); the person can change it. Pay is the custom hours under that day's rule
 *   (`payrollHoursResult`). Stored weekend FULL DAY / AM / PM bookings are never rewritten and keep their pay.
 *   `weekendBookingNote` is the line shown under the picker; for a selection of days, `weekendBookingNotes` (1.17.0:
 *   one "Saturday/Sunday" line when both days follow the same rule, else Saturday then Sunday). A booking request never
 *   mixes weekdays and weekend days (`bookingDaysMixWeekdayAndWeekend`, `WEEKEND_WEEKDAY_MIX_MESSAGE`).
 * - Lunch warning: `customHoursBreakWarning` is the message shown before a custom-hours booking is saved when the
 *   organisation break is unpaid, the booking's "Unpaid break" toggle is on and the hours cover the break window. Pay
 *   is unchanged (§8: break minutes come off only while the toggle is on).
 */

import { formatClockMinutes, halfDayWindows, intervalsOverlap, namedSlotKind, parseClockMinutes, slotInterval } from './engine'
import { weekdayPaidHours, weekendBreakFor, type OrgPayrollTimePolicy } from './organizationSettings'
import { payrollBreakOnDay, payrollHoursResult, payrollOutsideClockHours, type PayrollHoursResult, unpaidBreakAppliesOnDay, weekendFullDayWindow, weekendRuleForIsoWeekday } from './payrollHours'
import { isoWeekdayOfDayKey, zoneOrLondon } from './dayKeys'
import { payrollTimePolicyForDayFromState, type PayrollTimePolicyState } from './payrollPolicySchedule'
import { bookingHoursExplanation } from './bookingHoursExplanation'

/** The slot values a booking picker may offer, in picker order. Stored spellings stay each collection's own. */
export type BookingSlotChoice = 'FULL DAY' | 'AM' | 'PM' | 'CUSTOM'

/** Rulebook 1.20.0 §4.3: Monday–Friday bookings are Full day or Custom; AM / PM are no longer offered. */
export const WEEKDAY_TIME_SLOTS: readonly BookingSlotChoice[] = ['FULL DAY', 'CUSTOM']
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
 * The slots a booking picker offers on a day: CUSTOM only on Saturday and Sunday; FULL DAY and CUSTOM Monday–Friday
 * (1.20.0: no AM / PM — a stored AM / PM booking is kept, shown and paid as stored, never offered anew). Not affected by
 * the organisation's weekend setup; `policy` is accepted so every platform passes the same inputs.
 */
export function allowedTimeSlotsOnDay(
  dayKey: string,
  _policy?: OrgPayrollTimePolicy | null,
  timeZone?: string | null
): BookingSlotChoice[] {
  return [...(isWeekendDayKey(dayKey, timeZone) ? WEEKEND_TIME_SLOTS : WEEKDAY_TIME_SLOTS)]
}

/**
 * Whether a slot may be booked anew on that day: on Saturday and Sunday only custom hours; Monday–Friday FULL DAY or
 * custom hours (1.20.0). A stored FULL DAY / AM / PM is kept, shown and paid as stored, never offered anew and never
 * rewritten.
 */
export function timeSlotAllowedOnDay(timeSlot: string | null | undefined, dayKey: string, timeZone?: string | null): boolean {
  const kind = namedSlotKind(timeSlot)
  if (!isWeekendDayKey(dayKey, timeZone)) return kind === 'FULL_DAY' || kind === 'CUSTOM'
  return kind === 'CUSTOM'
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

/** The part of a weekend note after the day name, e.g. " is paid on the hours you enter, every hour at 2×. …". */
function weekendNoteBody(policy: OrgPayrollTimePolicy | null | undefined, iso: number): string | null {
  if (!policy || (iso !== 6 && iso !== 7)) return null
  const weekend = weekendRuleForIsoWeekday(iso, policy)
  if (!weekend) return null
  if (weekend.allHoursAtMultiplierMode) {
    return ` is paid on the hours you enter, every hour at ${multiplierText(weekend.allHoursMultiplier)}. Change it in Working hours.`
  }
  const window = weekendFullDayWindow(policy, weekend)
  if (!window) return null
  const range = `${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)}`
  const countsAs = Number(weekend.countsAsStandardHours ?? weekdayPaidHours(policy))
  const outside = Number(weekend.outsideWindowMultiplier ?? 1.5)
  return ` is paid on the hours you enter: ${range} counts as ${hoursText(Number.isFinite(countsAs) ? countsAs : 0)}, hours outside it at ${multiplierText(outside)}. Change it in Working hours.`
}

/**
 * The line under a weekend booking picker. Set window: "Saturday is paid on the hours you enter: 07:30–13:00 counts as
 * 8h, hours outside it at 2×. Change it in Working hours." Every hour at one rate: "Sunday is paid on the hours you
 * enter, every hour at 2×. Change it in Working hours." `weekday` is an ISO weekday (6, 7), "saturday" / "sunday" or a
 * day key. Null on a weekday or when the window is not set. A picker whose selection can hold several days uses
 * `weekendBookingNotes`.
 */
export function weekendBookingNote(
  policy: OrgPayrollTimePolicy | null | undefined,
  weekday: string | number,
  timeZone?: string | null
): string | null {
  const iso = isoWeekdayOf(weekday, timeZone)
  const body = weekendNoteBody(policy, iso)
  if (!body) return null
  return `${iso === 6 ? 'Saturday' : 'Sunday'}${body}`
}

function isPolicyState(value: unknown): value is PayrollTimePolicyState {
  return Boolean(value && typeof value === 'object' && 'current' in (value as object) && 'scheduled' in (value as object))
}

/**
 * Rulebook 1.17.0: the lines under a weekend booking picker for the whole selection (`dayKeys`, organisation-zone day
 * keys; weekdays are ignored). Only Saturdays or only Sundays: that day's `weekendBookingNote`. Saturday and Sunday
 * with the same rule (same window, counts-as hours and rate outside it, or both every hour at the same rate): one line,
 * "Saturday/Sunday is paid on the hours you enter: …". Different rules: the Saturday line, then the Sunday line. No
 * weekend day (or no rule set): `[]`.
 *
 * `policy` is the working-hours policy in effect for the request, or the organisation's policy state
 * (`parsePayrollTimePolicyState` / `payrollTimePolicyTimeline`), in which case each day uses the policy in effect on
 * that day (`effectivePayrollTimePolicy`). Lines are never repeated.
 */
export function weekendBookingNotes(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKeys: ReadonlyArray<string> | null | undefined,
  timeZone?: string | null
): string[] {
  if (!policy) return []
  const keys = Array.from(
    new Set(
      (dayKeys || []).map((key) => String(key || '').trim()).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    )
  ).sort()
  const bodies: Record<6 | 7, string[]> = { 6: [], 7: [] }
  for (const key of keys) {
    const iso = isoWeekdayOf(key, timeZone)
    if (iso !== 6 && iso !== 7) continue
    const dayPolicy = isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, key) : policy
    const body = weekendNoteBody(dayPolicy, iso)
    if (body && !bodies[iso].includes(body)) bodies[iso].push(body)
  }
  if (bodies[6].length === 1 && bodies[7].length === 1 && bodies[6][0] === bodies[7][0]) {
    return [`Saturday/Sunday${bodies[6][0]}`]
  }
  return [...bodies[6].map((body) => `Saturday${body}`), ...bodies[7].map((body) => `Sunday${body}`)]
}

/** What a selection of booking days is for the custom-hours prefill (`customHoursPrefillForDays`). */
export type CustomHoursPrefillKind = 'weekday' | 'weekend' | 'none'

export type CustomHoursPrefill = { start: string; end: string; kind: CustomHoursPrefillKind }

/**
 * Rulebook 1.18.0: the one time pair a booking picker's custom-hours editor opens with for the whole selection
 * (`dayKeys`, organisation-zone day keys), and what kind of selection it is.
 *
 * - `kind: 'weekend'` (only Saturdays and Sundays): the first selected weekend day that has a set window
 *   (`weekendCustomHoursDefault`), Saturdays first — so with Saturday "every hour at N×" and Sunday on a window,
 *   Sunday's window. Neither has a window: the editor's usual times (the standard day in effect on the first Saturday,
 *   else the first Sunday).
 * - `kind: 'weekday'` (only Monday–Friday): the organisation's standard day (`halfDayWindows(...).day`) in effect on the
 *   first selected day.
 * - `kind: 'none'`: the selection mixes weekdays and weekend days, which every picker refuses
 *   (`WEEKEND_WEEKDAY_MIX_MESSAGE`); the times are the first day's standard day and a picker does not apply them.
 * - `null`: no valid day selected.
 *
 * `policy` is the working-hours policy for the request, or the organisation's policy state, in which case each day is
 * read under the policy in effect on that day (`effectivePayrollTimePolicy`). A picker applies the result whenever
 * `kind` changes (weekend-only ↔ weekday-only), not on every change within the same kind, so the person's own edit
 * survives adding another day of the same kind. Never a computed midpoint.
 */
export function customHoursPrefillForDays(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKeys: ReadonlyArray<string> | null | undefined,
  timeZone?: string | null
): CustomHoursPrefill | null {
  const keys = Array.from(
    new Set((dayKeys || []).map((key) => String(key || '').trim()).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)))
  ).sort()
  if (keys.length === 0) return null
  const policyOn = (key: string): OrgPayrollTimePolicy | null =>
    !policy ? null : isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, key) : policy
  const standardDay = (key: string): { start: string; end: string } => {
    const day = halfDayWindows(policyOn(key)).day
    return { start: formatClockMinutes(day.start), end: formatClockMinutes(day.end) }
  }
  const weekendKeys = keys.filter((key) => isWeekendDayKey(key, timeZone))
  if (weekendKeys.length === 0) return { ...standardDay(keys[0]), kind: 'weekday' }
  if (weekendKeys.length !== keys.length) return { ...standardDay(keys[0]), kind: 'none' }
  const ordered = [
    ...weekendKeys.filter((key) => isoWeekdayOf(key, timeZone) === 6),
    ...weekendKeys.filter((key) => isoWeekdayOf(key, timeZone) === 7),
  ]
  for (const key of ordered) {
    const window = weekendCustomHoursDefault(policyOn(key), key, timeZone)
    if (window) return { ...window, kind: 'weekend' }
  }
  return { ...standardDay(ordered[0]), kind: 'weekend' }
}

/** One selected day of a booking request priced under that day's rule (`weekendBookingBreakdown`). */
export type BookingDayBreakdownRow = {
  dayKey: string
  /** 'Saturday', 'Sunday', or the weekday's name. */
  weekdayLabel: string
  start: string
  end: string
  /** Clock hours worked (`payrollHoursResult.workedHours`), never multiplied. */
  workedHours: number
  /** A set-window weekend day: the hours the worked part of the window counts as; else null. */
  countsAsHours: number | null
  /** Hours paid at the normal rate (`standardHours`). */
  standardHours: number
  /**
   * Clock hours paid at `multiplier`: outside the window, or every hour on an all-hours day. 1.20.3: before the unpaid
   * break, which comes off after the multiplier as plain hours (`payrollOutsideClockHours`).
   */
  overtimeHours: number
  multiplier: number
  /** `totalPaidHours`: standard hours plus overtime hours × multiplier, less any break worked in them (1.20.3). */
  paidHoursEquivalent: number
  /** Rulebook 1.19.0: the unpaid break taken off (`payrollHoursResult.unpaidBreakHours`), 0 when none. */
  unpaidBreakHours: number
  /** The row text, e.g. "Saturday 07:30–14:00 = 8h (counts as a full day)" or "… = 8h − 0.5h unpaid break = 7.5h". */
  line: string
  /**
   * Rulebook 1.19.0: the row as the Mon–Fri hours breakdown shows it — set hours (or hours / every hour), unpaid
   * break, outside hours with the multiplier, total. Values only; screens lay them out.
   */
  lines: BookingDayBreakdownLine[]
  /**
   * Rulebook 1.39.0: the words that explain the figure (`bookingHoursExplanation`) — the day's rule, e.g. "Saturday full
   * day: 07:30–14:00 counts as 8h, hours outside it at 2×", and one step per part, e.g. "Booked 07:30–10:30 = 3h of the
   * 6.5h window → 8h × 3 ÷ 6.5 = 3.69h". Screens show these under `line`; no figure changes.
   */
  explanation: { rule: string; steps: string[] }
}

export type BookingDayBreakdownLine = {
  kind: 'standard' | 'break' | 'outside' | 'total'
  label: string
  value: string
}

const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100
}

/**
 * Rulebook 1.18.0 (owner decision): the per-day hours a booking request's one custom-hours pair pays, one row per
 * selected day (`dayKeys`, organisation-zone, de-duplicated and in date order), each computed ONLY by the pay rule
 * timesheets use — `payrollHoursResult` for that day under the policy in effect on it (`policy` may be the policy
 * state) — so a Saturday on a set window and a Sunday at every hour × 2 show their own figures. Break handling is
 * exactly pay's: a day takes the covered part of the unpaid break unless `isBreakRemoved` or that day's break is paid
 * (1.19.0: Saturday / Sunday by their own `breakPaid`, missing = paid; the break is the weekday window and length),
 * and the row shows it ("Saturday 07:30–14:00 = 8h − 0.5h unpaid break = 7.5h", `lines`). Booking screens show these rows (collapsing identical weekend rows
 * into one "Saturday/Sunday" row is allowed) instead of a generic standard-day summary. Invalid times or no days: [].
 *
 * Example: Saturday window 07:30–14:00 counts as 8h, Sunday every hour at 2×, booked 07:30–14:00 →
 * "Saturday 07:30–14:00 = 8h (counts as a full day)" and "Sunday 07:30–14:00 = 6.5h × 2 = 13h".
 */
export function weekendBookingBreakdown(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKeys: ReadonlyArray<string> | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
  isBreakRemoved: boolean | null | undefined,
  timeZone?: string | null,
  otMultiplierOverride?: number | null
): BookingDayBreakdownRow[] {
  if (!policy) return []
  // 1.43.0 §25: a booking's own overtime rate prices its hours at the multiplier (missing = the organisation's).
  const ownRate = Number(otMultiplierOverride) > 0 ? Number(otMultiplierOverride) : null
  const startMinutes = parseClockMinutes(start)
  const endMinutes = parseClockMinutes(end)
  if (startMinutes == null || endMinutes == null || startMinutes === endMinutes) return []
  const startText = formatClockMinutes(startMinutes)
  const endText = formatClockMinutes(endMinutes)
  const keys = Array.from(
    new Set((dayKeys || []).map((key) => String(key || '').trim()).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)))
  ).sort()
  return keys.map((dayKey) => {
    const dayPolicy = isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, dayKey) : policy
    const iso = isoWeekdayOf(dayKey, timeZone)
    const paid = payrollHoursResult({
      booking: {
        timeSlot: 'CUSTOM_HOURS',
        workStartTime: startText,
        workEndTime: endText,
        isBreakRemoved: isBreakRemoved === true,
        ...(ownRate != null ? { otMultiplierOverride: ownRate } : {}),
      },
      dayKey,
      policy: dayPolicy,
      timeZone,
    })
    const weekend = iso === 6 || iso === 7 ? weekendRuleForIsoWeekday(iso, dayPolicy) : null
    const windowDay = Boolean(weekend && !weekend.allHoursAtMultiplierMode)
    const allHoursDay = Boolean(weekend && weekend.allHoursAtMultiplierMode)
    const standardHours = roundHours(paid.standardHours)
    // 1.20.3: hours at the multiplier are shown as clock hours; a break worked in them comes off after the multiplier.
    const outside = payrollOutsideClockHours(paid)
    const overtimeHours = roundHours(outside.outsideClockHours)
    const multiplier = roundHours(paid.outsideMultiplier)
    const total = roundHours(paid.totalPaidHours)
    const unpaidBreakHours = roundHours(paid.unpaidBreakHours)
    const breakOutside = roundHours(outside.outsideBreakHours)
    const breakInStandard = roundHours(Math.max(0, paid.unpaidBreakHours - outside.outsideBreakHours))
    const credit = weekend ? Number(weekend.countsAsStandardHours ?? weekdayPaidHours(dayPolicy)) : NaN
    const fullDay = windowDay && standardHours > 0 && Math.abs(standardHours - roundHours(credit)) < 0.001
    const label = WEEKDAY_NAMES[iso] || dayKey
    let line = `${label} ${startText}–${endText} = `
    if (unpaidBreakHours > 0) {
      // 1.19.0 / 1.20.3: the break shown as Monday–Friday shows it. In the standard / set hours it comes off them; in
      // hours at a multiplier it comes off after the multiplier, as plain hours: "6.5h × 2 = 13h − 0.5h unpaid break = 12.5h".
      const parts: string[] = []
      const standardBefore = roundHours(standardHours + breakInStandard)
      if (standardBefore > 0) {
        parts.push(breakInStandard > 0 ? `${hoursText(standardBefore)} − ${hoursText(breakInStandard)} unpaid break` : hoursText(standardHours))
      }
      if (overtimeHours > 0) parts.push(`${hoursText(overtimeHours)} × ${multiplier}`)
      if (parts.length === 0) line += '0h'
      else if (breakOutside > 0 && standardBefore <= 0) {
        line += `${parts.join(' + ')} = ${hoursText(roundHours(overtimeHours * multiplier))} − ${hoursText(breakOutside)} unpaid break = ${hoursText(total)}`
      } else if (breakOutside > 0) {
        line += `${parts.join(' + ')} − ${hoursText(breakOutside)} unpaid break = ${hoursText(total)}`
      } else {
        line += `${parts.join(' + ')} = ${hoursText(total)}`
      }
    } else {
      const parts: string[] = []
      if (standardHours > 0) parts.push(hoursText(standardHours))
      if (overtimeHours > 0) parts.push(`${hoursText(overtimeHours)} × ${roundHours(multiplier)}`)
      if (parts.length === 0) line += '0h'
      else if (overtimeHours > 0) line += `${parts.join(' + ')} = ${hoursText(total)}`
      else line += `${parts[0]}${fullDay ? ' (counts as a full day)' : ''}`
    }
    const lines: BookingDayBreakdownLine[] = []
    if (allHoursDay) {
      lines.push({ kind: 'outside', label: 'Every hour', value: `${hoursText(overtimeHours)} × ${multiplier}` })
    } else if (standardHours > 0 || breakInStandard > 0) {
      lines.push({
        kind: 'standard',
        label: windowDay ? 'Set hours' : 'Standard hours',
        value: hoursText(roundHours(standardHours + breakInStandard)),
      })
    }
    if (unpaidBreakHours > 0) {
      lines.push({ kind: 'break', label: 'Unpaid break', value: `−${hoursText(unpaidBreakHours)}` })
    }
    if (!allHoursDay && overtimeHours > 0) {
      lines.push({ kind: 'outside', label: 'Outside hours', value: `${hoursText(overtimeHours)} × ${multiplier}` })
    }
    lines.push({ kind: 'total', label: 'Total paid hours', value: hoursText(total) })
    const explained = bookingHoursExplanation(
      dayPolicy,
      dayKey,
      { timeSlot: 'CUSTOM_HOURS', workStartTime: startText, workEndTime: endText, isBreakRemoved: isBreakRemoved === true, otMultiplierOverride: ownRate },
      timeZone
    )
    return {
      dayKey,
      weekdayLabel: label,
      start: startText,
      end: endText,
      workedHours: roundHours(paid.workedHours),
      countsAsHours: windowDay ? standardHours : null,
      standardHours,
      overtimeHours,
      multiplier,
      paidHoursEquivalent: total,
      unpaidBreakHours,
      line,
      lines,
      explanation: { rule: explained?.rule ?? '', steps: explained?.steps ?? [] },
    }
  })
}

/** One example Saturday / Sunday the Working hours preview prices (any one works: only the weekday matters). */
export const WEEKEND_PREVIEW_DAY_KEYS = { saturday: '2026-01-03', sunday: '2026-01-04' } as const

export type WeekendDayPreview = {
  dayKey: string
  /** The example hours priced: the day's set window, or the standard day on an every-hour day. */
  start: string
  end: string
  /** e.g. "07:30–14:00 counts as 8h · Unpaid break 12:00–12:30, 30 min — 30 min taken off · 7.5h paid". */
  summary: string
  /** `weekendBookingBreakdown` for the example hours. */
  rows: BookingDayBreakdownRow[]
}

/**
 * Rulebook 1.19.0 / 1.20.3 §4.3: the live calculation Working hours shows under Saturday and under Sunday, from the
 * policy being edited (the draft — never the saved policy), so it changes as soon as that day's break is switched
 * Paid / Unpaid or its length or times change. Sunday "same as Saturday" prices Saturday's rule. Every figure is the
 * pay rule's (`weekendBookingBreakdown` → `payrollHoursResult`); the summary says the break, the minutes the pay rule
 * takes off (the covered part of the break window, up to the length) and the paid hours. Null when the day is invalid.
 */
export function weekendDayPreview(
  policy: OrgPayrollTimePolicy | null | undefined,
  weekday: 'saturday' | 'sunday',
  timeZone?: string | null
): WeekendDayPreview | null {
  if (!policy) return null
  const dayKey = WEEKEND_PREVIEW_DAY_KEYS[weekday]
  const zone = timeZone || 'Europe/London'
  const window = weekendCustomHoursDefault(policy, dayKey, zone)
  const standard = halfDayWindows(policy).day
  const span = window ?? { start: formatClockMinutes(standard.start), end: formatClockMinutes(standard.end) }
  const rows = weekendBookingBreakdown(policy, [dayKey], span.start, span.end, false, zone)
  if (rows.length === 0) return null
  const row = rows[0]
  const iso = weekday === 'saturday' ? 6 : 7
  const rule = weekendRuleForIsoWeekday(iso, policy)
  const dayBreak = payrollBreakOnDay(policy, dayKey, zone)
  const parts: string[] = []
  if (rule?.allHoursAtMultiplierMode) parts.push(`Every hour at ×${roundHours(rule.allHoursMultiplier)}`)
  else parts.push(`${span.start}–${span.end} counts as ${hoursText(Number(rule?.countsAsStandardHours ?? weekdayPaidHours(policy)))}`)
  if (dayBreak) {
    const window = `${formatClockMinutes(dayBreak.start)}–${formatClockMinutes(dayBreak.end)}, ${dayBreak.minutes} min`
    if (dayBreak.paid) parts.push(`Paid break ${window}`)
    else parts.push(`Unpaid break ${window} — ${Math.round(row.unpaidBreakHours * 60)} min taken off`)
  }
  parts.push(`${hoursText(row.paidHoursEquivalent)} paid`)
  return { dayKey, start: span.start, end: span.end, summary: parts.join(' · '), rows }
}

/**
 * Rulebook 1.19.0: the Working hours copy for a weekend day's lunch break, e.g.
 * `{ title: 'Lunch break on Saturday', detail: '12:00–12:30, 30 min — the same as your weekday lunch.' }`. Each weekend
 * day has its own Paid / Unpaid, length and window; a day that has not set them shows (and is prefilled with) the
 * weekday break (`weekendBreakFor`).
 */
export function weekendLunchBreakCopy(
  policy: OrgPayrollTimePolicy | null | undefined,
  weekday: 'saturday' | 'sunday'
): { title: string; detail: string } {
  const name = weekday === 'saturday' ? 'Saturday' : 'Sunday'
  if (!policy) return { title: `Lunch break on ${name}`, detail: '' }
  const settings = weekday === 'sunday' && policy.sunday?.sameAsSaturday ? policy.saturday : policy[weekday]
  const own = weekendBreakFor(policy, settings)
  const sameAsWeekday =
    own.minutes === Math.max(0, Number(policy.unpaidBreakMinutes) || 0) &&
    own.start === policy.breakWindowStart &&
    own.end === policy.breakWindowEnd
  return {
    title: `Lunch break on ${name}`,
    detail: `${own.start}–${own.end}, ${own.minutes} min${sameAsWeekday ? ' — the same as your weekday lunch.' : '.'}`,
  }
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
 * and its clock interval overlaps the break window on that day; else null. 1.19.0: on Saturday or Sunday only when that
 * day's break is unpaid (`unpaidBreakAppliesOnDay`). `policy` is the policy in effect that day (`effectivePayrollTimePolicy`).
 */
export function customHoursBreakWarning(
  policy: OrgPayrollTimePolicy | null | undefined,
  dayKey: string,
  booking: CustomHoursBreakBooking | null | undefined,
  timeZone?: string | null
): string | null {
  if (!policy || !booking) return null
  if (namedSlotKind(booking.timeSlot) !== 'CUSTOM') return null
  if (booking.isBreakRemoved === true) return null
  // 1.19.0: an unpaid break on that day — Monday–Friday the organisation break, Saturday / Sunday that day's
  // `breakPaid === false` (`unpaidBreakAppliesOnDay`). A day whose break is paid never warns.
  const day = dayKey || '2026-01-07'
  if (!unpaidBreakAppliesOnDay(policy, day, timeZone)) return null
  // 1.19.0: that day's break window (a weekend day's own, else the weekday one).
  const dayBreak = payrollBreakOnDay(policy, day, timeZone)
  if (!dayBreak) return null
  const { start, end } = dayBreak
  const span = slotInterval(
    { timeSlot: booking.timeSlot, workStartTime: booking.workStartTime, workEndTime: booking.workEndTime },
    policy
  )
  if (!span) return null
  return intervalsOverlap(span, { start, end }) ? CUSTOM_HOURS_BREAK_WARNING : null
}

/**
 * Rulebook 1.20.2 §2 (owner bug, 3 Nov): what makes a new booking "already booked". A booking request is skipped as a
 * duplicate only when it is the same person, day, slot, place AND — for custom hours — the same start, finish and
 * break toggle. Weekend bookings are all custom hours, so a check that ignored the times treated a second Saturday
 * booking at the same job (other times) as already booked and silently dropped it after the double-booking row had
 * been ticked. Ids and place names compare without case (`normalizeDocumentId`); clock times compare as minutes.
 * A screen never keeps its own identity string for this.
 */
export type BookingRequestIdentityInput = {
  personId: string | null | undefined
  dayKey: string
  timeSlot: string | null | undefined
  /** Manager bookings: `project` | `small_work` | `office` | …; operative bookings leave it out. */
  locationType?: string | null
  /** The job id (operative `projectId`, manager `locationId`). */
  locationId?: string | null
  customLocationName?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
}

function identityPart(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

export function bookingRequestIdentity(input: BookingRequestIdentityInput): string {
  const kind = namedSlotKind(input.timeSlot)
  const slot = kind === 'UNKNOWN' ? identityPart(input.timeSlot) : kind
  const custom = kind === 'CUSTOM'
  const clock = (value: string | null | undefined): string => {
    const minutes = parseClockMinutes(value ?? null)
    return minutes === null ? identityPart(value) : String(minutes)
  }
  return [
    identityPart(input.personId),
    String(input.dayKey || '').trim(),
    slot,
    identityPart(input.locationType),
    identityPart(input.locationId),
    identityPart(input.customLocationName),
    custom ? clock(input.workStartTime) : '',
    custom ? clock(input.workEndTime) : '',
    input.isBreakRemoved === true ? 'break-off' : '',
  ].join('|')
}

/** True when two booking requests are the same booking (`bookingRequestIdentity`). */
export function isSameBookingRequest(a: BookingRequestIdentityInput, b: BookingRequestIdentityInput): boolean {
  return bookingRequestIdentity(a) === bookingRequestIdentity(b)
}

/**
 * Rulebook 1.20.2 §6 / §10 (owner decision, 3 Nov): the hours a booking row shows on every list — My Schedule,
 * Schedule, the project / small works week, Daily Overview — are the pay rule's hours for that day
 * (`payrollHoursResult` under the working hours in effect that day), never the clock duration. With hours at a
 * multiplier the label carries the sum: a Saturday 07:30–14:00 on an 8h set window → "8h"; a Sunday 07:30–14:00 at
 * every hour × 2 → "13h (6.5h × 2)"; a weekday 07:30–18:00 with 8h standard and 2h at 1.5 → "11h (8h + 2h × 1.5)".
 */
export type BookingHoursLabel = { hours: number; label: string }

export function bookingHoursLabel(
  result:
    | {
        totalPaidHours: number
        standardHours: number
        outsideHours: number
        outsideMultiplier: number
        segments?: ReadonlyArray<{ kind: string; baseHours: number; multiplier: number; unpaidBreakHours?: number }>
      }
    | null
    | undefined
): BookingHoursLabel {
  if (!result) return { hours: 0, label: '0h' }
  const total = roundHours(Number(result.totalPaidHours) || 0)
  const standard = roundHours(Number(result.standardHours) || 0)
  // 1.20.3: hours at the multiplier as clock hours; an unpaid break worked in them comes off after the multiplier, as
  // plain hours — Sunday 07:30–14:00 every hour × 2, 30 min unpaid → "12.5h (6.5h × 2 − 0.5h break)".
  const clock = result.segments ? payrollOutsideClockHours({ segments: result.segments as PayrollHoursResult['segments'] }) : null
  const outside = roundHours(clock ? clock.outsideClockHours : Number(result.outsideHours) || 0)
  const outsideBreak = roundHours(clock ? clock.outsideBreakHours : 0)
  const multiplier = roundHours(Number(result.outsideMultiplier) || 1)
  if (outside > 0 && Math.abs(multiplier - 1) > 0.001) {
    const multiplied = standard > 0 ? `${hoursText(standard)} + ${hoursText(outside)} × ${multiplier}` : `${hoursText(outside)} × ${multiplier}`
    const parts = outsideBreak > 0 ? `${multiplied} − ${hoursText(outsideBreak)} break` : multiplied
    return { hours: total, label: `${hoursText(total)} (${parts})` }
  }
  return { hours: total, label: hoursText(total) }
}
