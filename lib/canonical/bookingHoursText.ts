/**
 * Rulebook 1.39.0 §4.3 (owner answers 11 Nov): the short texts booking screens show for hours, overtime and the lunch
 * break — one wording on web and iOS. Wording only: every figure is passed in (from `payrollHoursResult` /
 * `payrollMultipliedHours`) or read from it, never worked out here, and every break word comes from the working hours
 * in effect on that day (`payrollBreakOnDay`, `unpaidBreakAppliesOnDay`; a weekend day's own break).
 *
 *   overtimeTotalText        "12h OT × 1.5 = 18h"                       (Daily Overview top tile)
 *   bookedWithOvertimeText   "60.5h booked (incl. 12h OT × 1.5)"        (a job's booked line)
 *   overtimeIncludedText     "incl. 6h OT × 1.5 = 9h"                   (under My Schedule's total)
 *   bookingHoursCountText / onSiteHoursText   "17.5 hours" · "17.5 hours · 15h on site"  ("hours", never "paid")
 *   saveHoursLabel           "Save · 17.5 hours"
 *   bookingHoursTiles        "9 Standard (−0.5 break)", "6 OT"           (Edit booking tiles, no separate break tile)
 *   bookingBreakText         "30 min unpaid break 11:30–12:00" / "30 mins deducted 11:30–12:00" /
 *                            "30 min paid break 11:30–12:00 (not deducted)"
 */

import { formatClockMinutes, parseClockMinutes } from './engine'
import type { OrgPayrollTimePolicy } from './organizationSettings'
import {
  payrollBreakOnDay,
  payrollHoursResult,
  payrollOutsideClockHours,
  unpaidBreakAppliesOnDay,
  type PayrollHoursBooking,
} from './payrollHours'
import { zoneOrLondon } from './dayKeys'
import { payrollTimePolicyForDayFromState, type PayrollTimePolicyState } from './payrollPolicySchedule'

function round(hours: number): number {
  return Math.round((Number(hours) || 0) * 100) / 100
}

function num(hours: number): string {
  return `${round(hours)}`
}

function h(hours: number): string {
  return `${round(hours)}h`
}

function multiplierOf(value: number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export type OvertimeFigures = {
  /** Clock hours at the multiplier (`payrollMultipliedHours.clockHours`). */
  clockHours: number
  multiplier: number
  /** Unpaid break worked in them, taken off after the multiplier as plain hours. */
  breakHours?: number | null
}

/** "12h OT × 1.5 = 18h" (with a break worked in them "6.5h OT × 2 − 0.5h break = 12.5h"); '' with no overtime. */
export function overtimeTotalText(input: OvertimeFigures | null | undefined): string {
  const clock = Math.max(0, Number(input?.clockHours) || 0)
  if (!(round(clock) > 0)) return ''
  const n = multiplierOf(input?.multiplier)
  const brk = Math.max(0, Number(input?.breakHours) || 0)
  const total = h(Math.max(0, clock * n - brk))
  return round(brk) > 0 ? `${h(clock)} OT × ${round(n)} − ${h(brk)} break = ${total}` : `${h(clock)} OT × ${round(n)} = ${total}`
}

/** "incl. 6h OT × 1.5 = 9h", shown under a total so the overtime reads as part of it (never "+6 overtime"); '' with none. */
export function overtimeIncludedText(input: OvertimeFigures | null | undefined): string {
  const text = overtimeTotalText(input)
  return text ? `incl. ${text}` : ''
}

/**
 * "60.5h booked (incl. 12h OT × 1.5)", or "60.5h booked" with no overtime. `bookedHours` already includes the OT. A
 * null `multiplier` (several rates summed) gives "60.5h booked (incl. 12h OT)".
 */
export function bookedWithOvertimeText(input: { bookedHours: number; clockHours?: number | null; multiplier?: number | null }): string {
  const booked = `${h(Math.max(0, Number(input?.bookedHours) || 0))} booked`
  const clock = Math.max(0, Number(input?.clockHours) || 0)
  if (!(round(clock) > 0)) return booked
  // Different multipliers summed together: the rate is left out rather than one of them shown.
  if (input?.multiplier == null) return `${booked} (incl. ${h(clock)} OT)`
  return `${booked} (incl. ${h(clock)} OT × ${round(multiplierOf(input.multiplier))})`
}

/** "17.5 hours" ("1 hour"). The word is hours, never "paid" (owner answer 11 Nov). */
export function bookingHoursCountText(hours: number): string {
  const value = round(Math.max(0, Number(hours) || 0))
  return `${value} ${value === 1 ? 'hour' : 'hours'}`
}

/** "17.5 hours · 15h on site" (on site = finish − start, clock time). Without on-site hours just "17.5 hours". */
export function onSiteHoursText(input: { hours: number; onSiteHours?: number | null }): string {
  const onSite = Number(input?.onSiteHours)
  return Number.isFinite(onSite) && onSite > 0 ? `${bookingHoursCountText(input.hours)} · ${h(onSite)} on site` : bookingHoursCountText(input?.hours)
}

/** "Save · 17.5 hours". */
export function saveHoursLabel(hours: number): string {
  return `Save · ${bookingHoursCountText(hours)}`
}

function isPolicyState(value: unknown): value is PayrollTimePolicyState {
  return Boolean(value && typeof value === 'object' && 'current' in (value as object) && 'scheduled' in (value as object))
}

function dayPolicyOf(policy: OrgPayrollTimePolicy | PayrollTimePolicyState, dayKey: string): OrgPayrollTimePolicy {
  return isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, dayKey) : policy
}

export type BookingBreakText = {
  /** Minutes and window of that day's break (`payrollBreakOnDay`). */
  minutes: number
  window: string
  /** True when the break is paid that day (nothing deducted). */
  paid: boolean
  /** "30 min unpaid break 11:30–12:00" or "30 min paid break 11:30–12:00 (not deducted)". */
  label: string
  /** "30 mins deducted 11:30–12:00", or the paid label when the break is paid. */
  deducted: string
  /** The booking's "take the break off" control: "Take off unpaid break (30 min, 11:30–12:00)" (review 11 Nov). */
  toggleLabel: string
}

/**
 * Rulebook 1.39.0: the lunch break of the day as booking screens name it, from the working hours in effect that day
 * (a weekend day's own break). Null when the day has no break (0 minutes) or no valid policy / day.
 */
export function bookingBreakText(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined,
  timeZone?: string | null
): BookingBreakText | null {
  const key = String(dayKey ?? '').trim()
  if (!policy || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const zone = zoneOrLondon(timeZone)
  const dayPolicy = dayPolicyOf(policy, key)
  const dayBreak = payrollBreakOnDay(dayPolicy, key, zone)
  if (!dayBreak || !(dayBreak.minutes > 0)) return null
  const window = `${formatClockMinutes(dayBreak.start)}–${formatClockMinutes(dayBreak.end)}`
  const paid = !unpaidBreakAppliesOnDay(dayPolicy, key, zone)
  const label = paid ? `${dayBreak.minutes} min paid break ${window} (not deducted)` : `${dayBreak.minutes} min unpaid break ${window}`
  return {
    minutes: dayBreak.minutes,
    window,
    paid,
    label,
    deducted: paid ? label : `${dayBreak.minutes} mins deducted ${window}`,
    toggleLabel: `Take off unpaid break (${dayBreak.minutes} min, ${window})`,
  }
}

/**
 * Rulebook 1.39.0 (review 11 Nov): what the unpaid break actually takes off THIS booking — the minutes the pay rule took
 * (`payrollHoursResult.unpaidBreakHours`) and the part of that day's break window the booking covers: "30 mins
 * deducted 11:30–12:00" when it covers the whole window, "15 mins deducted (11:30–11:45 covered)" when only part,
 * null when nothing comes off (a paid break, "No unpaid break", or a booking clear of the window).
 */
export function bookingBreakDeductionText(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined,
  booking: PayrollHoursBooking | null | undefined,
  timeZone?: string | null
): string | null {
  const key = String(dayKey ?? '').trim()
  if (!policy || !booking || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const zone = zoneOrLondon(timeZone)
  const dayPolicy = dayPolicyOf(policy, key)
  const result = payrollHoursResult({ booking, dayKey: key, policy: dayPolicy, timeZone: zone })
  const minutes = Math.round((Number(result.unpaidBreakHours) || 0) * 60)
  if (!(minutes > 0)) return null
  const dayBreak = payrollBreakOnDay(dayPolicy, key, zone)
  const start = parseClockMinutes(booking.workStartTime ?? null)
  const end = parseClockMinutes(booking.workEndTime ?? null)
  if (!dayBreak || start == null || end == null) return `${minutes} mins deducted`
  const from = Math.max(start, dayBreak.start)
  const to = Math.min(end > start ? end : end + 24 * 60, dayBreak.end)
  const whole = from <= dayBreak.start && to >= dayBreak.end
  const span = `${formatClockMinutes(Math.min(from, to))}–${formatClockMinutes(to)}`
  return whole ? `${minutes} mins deducted ${span}` : `${minutes} mins deducted (${span} covered)`
}

export type BookingHoursTile = {
  kind: 'standard' | 'overtime'
  /** The hours before any unpaid break, e.g. "9". */
  value: string
  /** "Standard (−0.5 break)", "Standard", "OT" or "OT (−0.5 break)". */
  label: string
  /** Paid hours of the tile after the break (standard) or clock hours × rate − break (overtime). */
  paidHours: number
}

/**
 * Rulebook 1.39.0 (owner option A, 11 Nov): the Edit booking tiles — the standard hours with the unpaid break shown on
 * the same tile ("9 Standard (−0.5 break)") and the hours at the multiplier ("6 OT"); no separate break tile. Read
 * from `payrollHoursResult` for that day under the working hours in effect on it: a paid break, a day without one, or
 * the booking's "No unpaid break" (`isBreakRemoved`) shows no deduction. Tiles with no hours are left out.
 */
export function bookingHoursTiles(
  policy: OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined,
  dayKey: string | null | undefined,
  booking: PayrollHoursBooking | null | undefined,
  timeZone?: string | null
): BookingHoursTile[] {
  const key = String(dayKey ?? '').trim()
  if (!policy || !booking || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return []
  const zone = zoneOrLondon(timeZone)
  const result = payrollHoursResult({ booking, dayKey: key, policy: dayPolicyOf(policy, key), timeZone: zone })
  const outside = payrollOutsideClockHours(result)
  const standardBreak = Math.max(0, result.unpaidBreakHours - outside.outsideBreakHours)
  const tiles: BookingHoursTile[] = []
  const standardBefore = result.standardHours + standardBreak
  if (round(standardBefore) > 0) {
    tiles.push({
      kind: 'standard',
      value: num(standardBefore),
      label: round(standardBreak) > 0 ? `Standard (−${num(standardBreak)} break)` : 'Standard',
      paidHours: round(result.standardHours),
    })
  }
  if (round(outside.outsideClockHours) > 0) {
    tiles.push({
      kind: 'overtime',
      value: num(outside.outsideClockHours),
      label: round(outside.outsideBreakHours) > 0 ? `OT (−${num(outside.outsideBreakHours)} break)` : 'OT',
      paidHours: round(result.outsideHours * result.outsideMultiplier),
    })
  }
  return tiles
}
