/**
 * Booking hours for timesheets, the weekly report, and active users. Every
 * figure is the rulebook's `payrollHoursResult` (`lib/canonical/payrollHours.ts`),
 * the same calculation iOS runs: standard-window hours, hours outside it, the
 * multiplier, and the weighted total.
 */
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { payrollMultipliedHours, payrollOutsideMultiplier, type PayrollHoursResult } from '@/lib/canonical'
import { londonIsoWeekday } from '@/lib/ios-parity/londonTime'
import { bookingPayrollHours } from '@/lib/scheduling/paidHours'

export function scheduleLabel(
  timeSlot: string,
  workStartTime?: string,
  workEndTime?: string,
  isBreakRemoved?: boolean
): string {
  if (workStartTime && workEndTime) {
    return isBreakRemoved ? `${workStartTime}–${workEndTime} · no break` : `${workStartTime}–${workEndTime}`
  }
  const slot = String(timeSlot || '').replace(/_/g, ' ')
  return slot || 'Booking'
}

/** The full rulebook result for one booking on its day. */
export function bookingHoursOnDay(
  date: Date | undefined,
  timeSlot: string,
  workStartTime: string | undefined,
  workEndTime: string | undefined,
  payrollPolicy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY,
  isBreakRemoved?: boolean,
  otMultiplierOverride?: number | null,
  timeZone?: string
): PayrollHoursResult {
  return bookingPayrollHours({
    timeSlot,
    workStartTime,
    workEndTime,
    isBreakRemoved,
    otMultiplierOverride,
    policy: payrollPolicy,
    date,
    timeZone,
  })
}

/** Weighted paid hours (`totalPaidHours`). Pass the booking date so weekends use their own rule. */
export function paidBookedHours(
  timeSlot: string,
  workStartTime: string | undefined,
  workEndTime: string | undefined,
  payrollPolicy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY,
  isBreakRemoved?: boolean,
  date?: Date
): number {
  return bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, payrollPolicy, isBreakRemoved).totalPaidHours
}

/**
 * Clock hours at the multiplier, before it (display only). 1.20.3: with an unpaid break worked in them, the clock
 * hours (`payrollMultipliedHours`), never the back-calculated base; `overtimeHoursText` gives the full text.
 */
export function overtimeHoursBeyondPaidStandard(
  date: Date,
  timeSlot: string,
  workStartTime: string | undefined,
  workEndTime: string | undefined,
  payrollPolicy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY,
  isBreakRemoved?: boolean
): number {
  const result = bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, payrollPolicy, isBreakRemoved)
  return payrollMultipliedHours(result)?.clockHours ?? result.outsideHours
}

/** 1.20.3: "6.5h × 2 − 0.5h break = 12.5h" (`multipliedHoursText`) when an unpaid break comes off overtime; else null. */
export function overtimeHoursText(
  date: Date,
  timeSlot: string,
  workStartTime: string | undefined,
  workEndTime: string | undefined,
  payrollPolicy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY,
  isBreakRemoved?: boolean
): string | null {
  const multiplied = payrollMultipliedHours(bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, payrollPolicy, isBreakRemoved))
  return multiplied && multiplied.breakHours > 0 ? multiplied.text : null
}

/** Multiplier for outside hours on that day (`payrollOutsideMultiplier`). */
export function weekdayOtMultiplier(date: Date, payrollPolicy: OrgPayrollTimePolicy): number {
  return payrollOutsideMultiplier({}, londonIsoWeekday(date), payrollPolicy)
}

export function formatTimesheetHours(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded))
  return rounded.toFixed(2)
}
