/**
 * Rulebook 1.46.0 (§8, rates audit): pricing a timesheet line the line manager edits, and pricing a booking for the
 * weekly report — one rule for web and iOS.
 *
 * Before 1.46.0 both apps priced an "Edit hours" change by scaling the line's own amount by the ratio of new to old
 * hours (web `revisedPayrollAmount`, iOS `TimesheetManagerReviewSupport.revisedAmount`). The standard line of a booking
 * never has more than the working day in it, so editing 07:00–16:00 to 07:00–19:00 left the line at the day rate and
 * the three hours at the multiplier were never paid. Now the edited booking is priced again exactly as the timesheet
 * collector prices a booking: `payrollHoursResult` under the policy in effect that day (with the booking's own
 * overtime rate and break toggle, in the organisation zone) and `payForHours` for each part, rounded to pennies.
 *
 * The weekly report priced each booking on web but summed hours and priced once per row on iOS, so the two apps could
 * differ by pennies. `bookingPaySlices` prices one booking (its standard part and its overtime part, each rounded) and
 * `mergeBookingPaySlice` adds a booking's slice to a row (hours and pay summed, pay rounded), so both apps sum
 * per-booking pennies exactly as the timesheet and invoice do.
 *
 * Plain inputs only, so iOS calls them through JavaScriptCore.
 */

import type { OrgPayrollTimePolicy } from './organizationSettings'
import { weekdayPaidHours } from './organizationSettings'
import { payrollHoursResult, payrollMultipliedHours, type PayrollHoursResult } from './payrollHours'
import { payrollTimePolicyForDayFromState, type PayrollTimePolicyState } from './payrollPolicySchedule'
import { orgDayHours, payForHours, roundPennies } from './payRate'

const HOURS_EPSILON = 1e-9

function roundHours(value: number): number {
  return Math.round(value * 10000) / 10000
}

function basisOf(value: unknown): 'hourly' | 'day' {
  const text = String(value ?? '').trim().toLowerCase()
  return text === 'hourly' || text === 'hour' ? 'hourly' : 'day'
}

export type RevisedPayrollLineInput = {
  /** The line's day, `YYYY-MM-DD` in the organisation zone. */
  dayKey: string
  /** The organisation business zone (`organizationTimeZone`). */
  timeZone: string
  /** The working-hours policy in effect on `dayKey`, or … */
  policy?: OrgPayrollTimePolicy | null
  /** … the organisation's whole working-hours state (the policy in effect on `dayKey` is read from it). */
  policyState?: PayrollTimePolicyState | null
  /** The edited booking's clock times (`HH:mm`). */
  startTime: string
  endTime: string
  /** The booking's "No unpaid break" toggle as edited. */
  isBreakRemoved?: boolean | null
  /** The booking's own overtime rate (1–3); missing = the organisation's rate for that day. */
  otMultiplierOverride?: number | null
  /** The line's rate as the collector resolved it (`payRateOnDay`): `day` or `hourly`. */
  payBasis?: string | null
  dayRate?: number | null
  hourlyRate?: number | null
  /** Whether the booking has its own overtime line on the sheet (`{prefix}-{bookingId}-ot`). */
  bookingHasOvertimeLine: boolean
  /**
   * The overtime a booking needs before the collector gives it an overtime line (web and iOS collectors: 0.05h;
   * an owner question in 1.46.0). With no overtime line, overtime at or below this is not paid, exactly as the
   * collector does. Default 0.
   */
  overtimeLineMinHours?: number | null
}

export type RevisedPayrollLineAmounts = {
  /** Hours inside the working day (`payrollHoursResult.standardHours`). */
  standardHours: number
  /** Hours at the multiplier (`payrollHoursResult.outsideHours`). */
  overtimeHours: number
  overtimeMultiplier: number
  /** Weighted paid hours (`totalPaidHours`). */
  totalPaidHours: number
  /** The paid day a day rate is divided by (`weekdayPaidHours` of the policy in effect that day). */
  standardDayHours: number
  /** `payForHours` of the standard hours, rounded to pennies. */
  standardAmount: number
  /** `payForHours` of the overtime hours at the multiplier, rounded to pennies (0 when not paid, see above). */
  overtimeAmount: number
  /**
   * What to store as the revised amount of each line of the booking (`payrollLineReviews[lineId].revisedAmount`).
   * With its own overtime line: the standard line its standard pay and the overtime line its overtime pay. With no
   * overtime line: the standard line carries both (so overtime the edit created is paid, on the invoice and in the
   * totals), and `overtimeLineAmount` is null.
   */
  standardLineAmount: number
  overtimeLineAmount: number | null
  /** `standardLineAmount + (overtimeLineAmount ?? 0)`: the booking as edited. */
  total: number
}

/**
 * Re-price a timesheet booking whose hours the line manager edited (rulebook §8, 1.46.0). The result equals what the
 * timesheet collector produces for a booking with those times on that day, at that rate.
 */
export function revisedPayrollLineAmounts(input: RevisedPayrollLineInput): RevisedPayrollLineAmounts {
  const dayKey = String(input.dayKey || '').trim()
  const policy = input.policyState
    ? payrollTimePolicyForDayFromState(input.policyState, dayKey)
    : (input.policy as OrgPayrollTimePolicy)
  const hours = payrollHoursResult({
    booking: {
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: input.startTime,
      workEndTime: input.endTime,
      isBreakRemoved: input.isBreakRemoved === true,
      otMultiplierOverride: input.otMultiplierOverride ?? undefined,
    },
    dayKey,
    policy,
    timeZone: input.timeZone,
  })
  const standardDayHours = orgDayHours(weekdayPaidHours(policy))
  const rate = { payBasis: basisOf(input.payBasis), dayRate: input.dayRate ?? null, hourlyRate: input.hourlyRate ?? null }
  const standardHours = Math.max(0, hours.standardHours)
  const overtimeHours = Math.max(0, hours.outsideHours)
  const minOvertime = Math.max(0, Number(input.overtimeLineMinHours) || 0)
  const overtimePaid = input.bookingHasOvertimeLine || overtimeHours > minOvertime + HOURS_EPSILON
  const standardAmount = payForHours({ ...rate, paidHours: standardHours, standardDayHours })
  const overtimeAmount = overtimePaid
    ? payForHours({ ...rate, paidHours: overtimeHours, standardDayHours, otMultiplier: hours.outsideMultiplier })
    : 0
  const standardLineAmount = input.bookingHasOvertimeLine ? standardAmount : roundPennies(standardAmount + overtimeAmount)
  const overtimeLineAmount = input.bookingHasOvertimeLine ? overtimeAmount : null
  return {
    standardHours: roundHours(standardHours),
    overtimeHours: roundHours(overtimeHours),
    overtimeMultiplier: hours.outsideMultiplier,
    totalPaidHours: roundHours(hours.totalPaidHours),
    standardDayHours,
    standardAmount,
    overtimeAmount,
    standardLineAmount,
    overtimeLineAmount,
    total: roundPennies(standardLineAmount + (overtimeLineAmount ?? 0)),
  }
}

// MARK: - Weekly report: one booking's pay, summed per row (rulebook §7, 1.46.0)

export type BookingPaySlice = {
  payBasis: 'day' | 'hourly'
  isOvertime: boolean
  otMultiplier: number | null
  /** The rate shown on the row (the overtime rate is the rate × multiplier, rounded); null for PAYE or no rate. */
  rate: number | null
  paidHours: number
  /** `payForHours` for this part of this one booking, rounded to pennies; 0 on a PAYE day. */
  pay: number
  isPaye: boolean
  /** The paid day in effect on the booking's day. */
  standardDayHours: number
  /** Overtime only, display: clock hours at the multiplier and the unpaid break off them (`payrollMultipliedHours`). */
  clockHours?: number
  breakHours?: number
}

/**
 * One booking's pay for the weekly report (rulebook §7, 1.46.0): its standard part and its overtime part, each priced
 * with `payForHours` and rounded — the same per-booking pennies as the timesheet collector. `hours` is
 * `payrollHoursResult` for the booking under the policy in effect that day; `standardDayHours` is that day's paid day.
 * A PAYE day keeps its hours and pays 0. A part with no hours is left out.
 */
export function bookingPaySlices(input: {
  hours: PayrollHoursResult
  standardDayHours: number
  payBasis?: string | null
  dayRate?: number | null
  hourlyRate?: number | null
  isPaye?: boolean | null
}): BookingPaySlice[] {
  const isPaye = input.isPaye === true
  const payBasis = basisOf(input.payBasis)
  const standard = orgDayHours(input.standardDayHours)
  const rateValue = payBasis === 'hourly' ? input.hourlyRate : input.dayRate
  const rate = isPaye || rateValue == null || !Number.isFinite(Number(rateValue)) ? null : Number(rateValue)
  const multiplied = payrollMultipliedHours(input.hours)
  const slices: BookingPaySlice[] = []
  const push = (paidHours: number, overtime: boolean, multiplier: number) => {
    if (!(paidHours > 0)) return
    const pay = isPaye
      ? 0
      : payForHours({ payBasis, dayRate: input.dayRate ?? null, hourlyRate: input.hourlyRate ?? null, paidHours, standardDayHours: standard, otMultiplier: overtime ? multiplier : 1 })
    slices.push({
      payBasis,
      isOvertime: overtime,
      otMultiplier: overtime ? multiplier : null,
      rate: rate == null ? null : overtime ? roundPennies(rate * multiplier) : rate,
      paidHours,
      pay,
      isPaye,
      standardDayHours: standard,
      ...(overtime && multiplied && multiplied.breakHours > 0 ? { clockHours: multiplied.clockHours, breakHours: multiplied.breakHours } : {}),
    })
  }
  push(Math.max(0, input.hours.standardHours), false, 1)
  push(input.hours.outsideHours, true, input.hours.outsideMultiplier)
  return slices
}

/**
 * Add one booking's slice to a weekly-report row of the same kind (rulebook §7, 1.46.0): hours and pay are summed —
 * pay as the sum of each booking's rounded pennies, never re-priced from the summed hours. An overtime row keeps its
 * clock hours and break apart once any booking in it had a break (display only). Returns the merged slice.
 */
export function mergeBookingPaySlice<T extends Pick<BookingPaySlice, 'isOvertime' | 'paidHours' | 'pay' | 'clockHours' | 'breakHours'>>(
  row: T,
  slice: Pick<BookingPaySlice, 'isOvertime' | 'paidHours' | 'pay' | 'clockHours' | 'breakHours'>
): T {
  const next = { ...row }
  if (slice.isOvertime && (Number(slice.breakHours) > 0 || Number(row.breakHours) > 0)) {
    const clockOf = (part: { paidHours: number; clockHours?: number; breakHours?: number }) =>
      Number(part.breakHours) > 0 ? Number(part.clockHours) || 0 : part.paidHours
    next.clockHours = clockOf(row) + clockOf(slice)
    next.breakHours = (Number(row.breakHours) || 0) + (Number(slice.breakHours) || 0)
  }
  next.paidHours = roundPennies(row.paidHours + slice.paidHours)
  next.pay = roundPennies(row.pay + slice.pay)
  return next
}
