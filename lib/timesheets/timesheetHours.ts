/**
 * Booking hours for timesheets, the weekly report, and active users. Every
 * figure is the rulebook's `payrollHoursResult` (`lib/canonical/payrollHours.ts`),
 * the same calculation iOS runs: standard-window hours, hours outside it, the
 * multiplier, and the weighted total.
 */
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { payrollOutsideMultiplier, type PayrollHoursResult } from '@/lib/canonical'
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
  otMultiplierOverride?: number | null
): PayrollHoursResult {
  return bookingPayrollHours({
    timeSlot,
    workStartTime,
    workEndTime,
    isBreakRemoved,
    otMultiplierOverride,
    policy: payrollPolicy,
    date,
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

/** Hours outside the standard window (`outsideHours`), before the multiplier. */
export function overtimeHoursBeyondPaidStandard(
  date: Date,
  timeSlot: string,
  workStartTime: string | undefined,
  workEndTime: string | undefined,
  payrollPolicy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY,
  isBreakRemoved?: boolean
): number {
  return bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, payrollPolicy, isBreakRemoved).outsideHours
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
