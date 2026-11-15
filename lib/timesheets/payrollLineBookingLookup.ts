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
import {
  PAYROLL_LINE_EDIT_TIMES_MESSAGE,
  revisedPayrollLineAmounts,
  revisedPayrollLineTimesError,
  type PayrollLineEditReviewFields,
  type RevisedPayrollLineAmounts,
} from '@/lib/canonical/timesheetLineEdit'
import type { EmploymentTypeUser } from '@/lib/canonical/userProfile'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { TIMESHEET_OVERTIME_LINE_MIN_HOURS, type TimesheetPayrollLineItem } from '@/lib/timesheets/timesheetPayrollCollector'

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
  // 1.43.0: a line's details show only its own part (standard or overtime times), so the booking's whole times
  // come from the line's booking fields; older lines without them are read from their details as before.
  if (row.bookingStartTime && row.bookingEndTime) {
    return { startTime: row.bookingStartTime, endTime: row.bookingEndTime, breakRemoved: row.bookingBreakRemoved === true }
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

/**
 * Rulebook 1.46.0 (§8): the line manager's "Edit hours" re-prices the whole booking (`revisedPayrollLineAmounts`:
 * `payrollHoursResult` under the policy in effect that day, the booking's own overtime rate, `payForHours`, pennies),
 * never the old hours ratio. Returns the revised amount for each line of that booking on the sheet: its standard line
 * and, when it has one, its overtime line; with no overtime line the standard line carries the overtime too, so a
 * longer day is paid in full on the invoice and in the totals. The rate is the standard line's (an overtime line
 * stores the rate x multiplier for display).
 */
export function payrollLineEdit(input: {
  row: TimesheetPayrollLineItem
  /** Every payroll line of the sheet (to find the booking's other line). */
  lines: ReadonlyArray<TimesheetPayrollLineItem>
  startTime: string
  endTime: string
  breakRemoved: boolean
  /** The overtime rate to price at; missing = the booking's own (`bookingOtMultiplierOverride`), else the organisation's. */
  otMultiplierOverride?: number | null
  /** The policy in effect on the line's day. */
  policy: OrgPayrollTimePolicy
  /** The organisation zone (`organizationTimeZone`). */
  timeZone: string
  /** The person's employment fields: a PAYE day pays 0 (`employmentTypeOnDay`). */
  employment?: EmploymentTypeUser | null
}): {
  /** `revisedPayrollLineTimesError` when the times cannot be priced (Save stays off); else null. */
  error: string | null
  amounts: RevisedPayrollLineAmounts | null
  /** The review fields to store on each line of the booking (`PayrollLineEditReviewFields`), by line id. */
  reviewFieldsByLineId: Record<string, PayrollLineEditReviewFields>
  standardLine: TimesheetPayrollLineItem | null
  overtimeLine: TimesheetPayrollLineItem | null
} {
  const { row, lines } = input
  const base = row.id.replace(/-(?:normal|ot)$/, '')
  const sameBooking = (line: TimesheetPayrollLineItem) => line.id.replace(/-(?:normal|ot)$/, '') === base
  const standardLine = row.isOvertimeLine ? lines.find((line) => !line.isOvertimeLine && sameBooking(line)) ?? null : row
  const overtimeLine = row.isOvertimeLine ? row : lines.find((line) => line.isOvertimeLine && sameBooking(line)) ?? null
  const rateLine = standardLine ?? row
  const multiplier = row.isOvertimeLine && row.otMultiplier && row.otMultiplier > 0 ? row.otMultiplier : 1
  const dayRate = standardLine ? standardLine.dayRate : (row.dayRate ?? 0) / multiplier
  const hourlyRate = standardLine ? standardLine.hourlyRate : row.hourlyRate == null ? null : row.hourlyRate / multiplier
  const timesError = revisedPayrollLineTimesError(input.startTime, input.endTime)
  const amounts = timesError
    ? null
    : revisedPayrollLineAmounts({
        dayKey: row.dayKey ?? dayKeyInZone(row.date, input.timeZone),
        timeZone: input.timeZone,
        policy: input.policy,
        startTime: input.startTime,
        endTime: input.endTime,
        isBreakRemoved: input.breakRemoved,
        otMultiplierOverride: input.otMultiplierOverride ?? rateLine.bookingOtMultiplierOverride ?? null,
        payBasis: rateLine.payrollBasis === 'hourly' ? 'hourly' : 'day',
        dayRate: rateLine.hasRate === false ? null : dayRate,
        hourlyRate: rateLine.hasRate === false ? null : hourlyRate ?? null,
        employment: input.employment ?? null,
        bookingHasOvertimeLine: overtimeLine != null,
        overtimeLineMinHours: TIMESHEET_OVERTIME_LINE_MIN_HOURS,
        bookingFingerprint: rateLine.bookingFingerprint ?? row.bookingFingerprint ?? null,
      })
  const reviewFieldsByLineId: Record<string, PayrollLineEditReviewFields> = {}
  if (amounts && standardLine) reviewFieldsByLineId[standardLine.id] = amounts.reviewFields.standard
  if (amounts && overtimeLine && amounts.reviewFields.overtime) reviewFieldsByLineId[overtimeLine.id] = amounts.reviewFields.overtime
  return {
    error: amounts ? null : timesError ?? PAYROLL_LINE_EDIT_TIMES_MESSAGE,
    amounts,
    reviewFieldsByLineId,
    standardLine,
    overtimeLine,
  }
}
