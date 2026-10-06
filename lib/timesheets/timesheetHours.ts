/**
 * iOS parity: Booking.paidBookedHours / overtimeHoursBeyondPaidStandard (simplified).
 */
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { londonIsoWeekday, parseHhMm } from '@/lib/ios-parity/londonTime'
import { orgDayHours } from '@/lib/timesheets/payBasis'
import { hoursFromSlot } from '@/lib/timesheets/timesheetWeekUtils'

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

export function paidBookedHours(
  timeSlot: string,
  workStartTime: string | undefined,
  workEndTime: string | undefined,
  payrollPolicy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY,
  isBreakRemoved?: boolean
): number {
  if (workStartTime && workEndTime) {
    const start = parseHhMm(workStartTime)
    const end = parseHhMm(workEndTime)
    if (start != null && end != null && end > start) {
      let minutes = end - start
      const breakMinutes = isBreakRemoved ? 0 : payrollPolicy.unpaidBreakMinutes ?? 0
      if (breakMinutes > 0) minutes = Math.max(0, minutes - breakMinutes)
      return minutes / 60
    }
  }
  return hoursFromSlot(timeSlot, workStartTime, workEndTime, payrollPolicy)
}

export function overtimeHoursBeyondPaidStandard(
  date: Date,
  timeSlot: string,
  workStartTime: string | undefined,
  workEndTime: string | undefined,
  payrollPolicy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY,
  isBreakRemoved?: boolean
): number {
  const paid = paidBookedHours(timeSlot, workStartTime, workEndTime, payrollPolicy, isBreakRemoved)
  const weekday = londonIsoWeekday(date)
  if (weekday >= 6) {
    const weekend = weekday === 6 ? payrollPolicy.saturday : payrollPolicy.sunday
    if (weekend?.allHoursAtMultiplierMode) return paid
    const standard = orgDayHours(weekend?.countsAsStandardHours ?? payrollPolicy.standardPaidHours)
    return Math.max(0, paid - standard)
  }
  const standard = orgDayHours(payrollPolicy.standardPaidHours)
  return Math.max(0, paid - standard)
}

export function weekdayOtMultiplier(date: Date, payrollPolicy: OrgPayrollTimePolicy): number {
  const weekday = londonIsoWeekday(date)
  if (weekday === 6) return payrollPolicy.saturday?.outsideWindowMultiplier ?? payrollPolicy.weekdayOutsideStandardMultiplier
  if (weekday === 7) {
    const sunday = payrollPolicy.sunday
    if (sunday?.sameAsSaturday) {
      return payrollPolicy.saturday?.outsideWindowMultiplier ?? payrollPolicy.weekdayOutsideStandardMultiplier
    }
    return sunday?.outsideWindowMultiplier ?? payrollPolicy.weekdayOutsideStandardMultiplier
  }
  return payrollPolicy.weekdayOutsideStandardMultiplier || 1.5
}

export function formatTimesheetHours(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded))
  return rounded.toFixed(2)
}
