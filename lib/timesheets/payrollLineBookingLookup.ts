/**
 * iOS parity: Views/TimesheetManagerReviewSupport.swift
 * TimesheetPayrollLineBookingLookup + TimesheetPayrollLineEditHoursSheet.
 *
 * Line ids are `{op|mgr}-{bookingId}-{normal|ot}`. iOS `bookingId(from:)` splits on `-`
 * and only keeps the first UUID segment, which fails for hyphenated ids. Web parses
 * the suffix so the live booking can pre-fill Edit Hours.
 */
import type { Booking } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { overtimeHoursBeyondPaidStandard, paidBookedHours } from '@/lib/timesheets/timesheetHours'
import type { TimesheetPayrollLineItem } from '@/lib/timesheets/timesheetPayrollCollector'

export type PayrollHoursChoice = {
  startTime: string
  endTime: string
  breakRemoved: boolean
  otMultiplierOverride?: number | null
}

export function bookingIdFromLineId(lineId: string): string | null {
  const match = lineId.match(/^(?:op|mgr)-(.+)-(?:normal|ot)$/)
  return match?.[1] ?? null
}

export function timesFromPayrollLineDetails(
  details: string
): { startTime: string; endTime: string; breakRemoved: boolean } | null {
  const match = details.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
  if (!match) return null
  return {
    startTime: match[1],
    endTime: match[2],
    breakRemoved: /no break/i.test(details),
  }
}

export function initialHoursChoice(input: {
  row: TimesheetPayrollLineItem
  operativeBooking?: Booking | null
  managerBooking?: ManagerSiteBooking | null
  policy: OrgPayrollTimePolicy
}): PayrollHoursChoice | null {
  const { row, operativeBooking, managerBooking, policy } = input
  if (operativeBooking?.workStartTime && operativeBooking.workEndTime) {
    return {
      startTime: operativeBooking.workStartTime,
      endTime: operativeBooking.workEndTime,
      breakRemoved: Boolean(operativeBooking.isBreakRemoved),
    }
  }
  if (managerBooking?.workStartTime && managerBooking.workEndTime) {
    return {
      startTime: managerBooking.workStartTime,
      endTime: managerBooking.workEndTime,
      breakRemoved: Boolean(managerBooking.isBreakRemoved),
    }
  }
  const parsed = timesFromPayrollLineDetails(row.details)
  if (parsed) return parsed
  if (row.details.includes(':')) {
    return {
      startTime: policy.standardDayStart,
      endTime: policy.standardDayEnd,
      breakRemoved: false,
    }
  }
  return null
}

export function revisedPayrollAmount(input: {
  row: TimesheetPayrollLineItem
  startTime: string
  endTime: string
  breakRemoved: boolean
  policy: OrgPayrollTimePolicy
}): number {
  const { row, startTime, endTime, breakRemoved, policy } = input
  const paid = paidBookedHours('customHours', startTime, endTime, policy, breakRemoved)
  const ot = overtimeHoursBeyondPaidStandard(
    row.date,
    'customHours',
    startTime,
    endTime,
    policy,
    breakRemoved
  )
  const relevantHours = row.isOvertimeLine ? ot : Math.max(0, paid - ot)
  if (row.paidHours <= 0.01) return row.amount
  return row.amount * (relevantHours / row.paidHours)
}
