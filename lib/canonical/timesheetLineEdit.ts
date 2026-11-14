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
import { employmentTypeOnDay, type EmploymentTypeUser } from './userProfile'
import { dateFromDayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import type { PayrollLineReview } from './timesheetEntryReviews'

const HOURS_EPSILON = 1e-9

function roundHours(value: number): number {
  return Math.round(value * 10000) / 10000
}

function basisOf(value: unknown): 'hourly' | 'day' {
  const text = String(value ?? '').trim().toLowerCase()
  return text === 'hourly' || text === 'hour' ? 'hourly' : 'day'
}

/** Shown on Edit hours (both apps) when the times cannot be priced: blank, not a clock time, or start equal to finish. */
export const PAYROLL_LINE_EDIT_TIMES_MESSAGE = 'Enter a start and a finish time that are different.'

function clockMinutes(value: unknown): number | null {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Rulebook 1.46.0 (§8): why Edit hours cannot price these times — `PAYROLL_LINE_EDIT_TIMES_MESSAGE` when the start or
 * finish is blank or not `HH:mm`, or the start equals the finish (0 hours) — else null. A finish before the start is an
 * overnight booking and is allowed. Before 1.46.0 a blank time priced as a full day.
 */
export function revisedPayrollLineTimesError(startTime: unknown, endTime: unknown): string | null {
  const start = clockMinutes(startTime)
  const end = clockMinutes(endTime)
  if (start == null || end == null || start === end) return PAYROLL_LINE_EDIT_TIMES_MESSAGE
  return null
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
  /**
   * The person's employment fields (`employmentType`, `employmentTypeTransitionFrom`, `employmentTypeEffectiveAt`):
   * a PAYE day (`employmentTypeOnDay`) keeps its hours and pays 0. Missing = self-employed.
   */
  employment?: EmploymentTypeUser | null
  /** Whether the booking has its own overtime line on the sheet (`{prefix}-{bookingId}-ot`). */
  bookingHasOvertimeLine: boolean
  /**
   * The overtime a booking needs before the collector gives it an overtime line (web and iOS collectors: 0.05h;
   * an owner question in 1.46.0). Overtime at or below this is not paid and counts no hours, exactly as the collector
   * does, whether or not the booking already has an overtime line. Default 0.
   */
  overtimeLineMinHours?: number | null
  /**
   * The live booking's fingerprint when the review is made (`overtimeBookingFingerprint` of the booking as the sheet
   * shows it; web and iOS put it on each payroll line as `bookingFingerprint`). Stored on each review as
   * `reviewedBookingFingerprint`; once the booking changes the review is stale (`payrollLineReview`).
   */
  bookingFingerprint?: string | null
}

/**
 * The fields stored on one line's review by Edit hours (1.46.0), beside `decision: 'edited'`, in
 * `payrollLineReviews[lineId]`. Field names are fixed for web and iOS.
 */
export type PayrollLineEditReviewFields = {
  /** `revisedStandardAmount + revisedOvertimeAmount`, pennies. */
  revisedAmount: number
  /** Hours inside the working day this line now pays (0 on an overtime line). */
  revisedStandardHours: number
  /** Hours at the multiplier this line now pays (`payrollHoursResult.outsideHours`, the base before the multiplier). */
  revisedOvertimeHours: number
  /** The clock hours of that overtime (`payrollMultipliedHours.clockHours`, else `revisedOvertimeHours`), display. */
  revisedOvertimeClockHours: number
  /** The overtime multiplier (null when the line pays no overtime). */
  revisedOvertimeMultiplier: number | null
  revisedStandardAmount: number
  revisedOvertimeAmount: number
  /** The live booking's fingerprint when the review was made; '' when the caller had none. */
  reviewedBookingFingerprint: string
}

export type RevisedPayrollLineAmounts = {
  /** Hours inside the working day (`payrollHoursResult.standardHours`). */
  standardHours: number
  /** Hours at the multiplier (`payrollHoursResult.outsideHours`); 0 at or below the overtime-line cut-off. */
  overtimeHours: number
  /** Clock hours of the overtime (`payrollMultipliedHours`), display. */
  overtimeClockHours: number
  overtimeMultiplier: number
  /** Weighted paid hours: `standardHours + overtimeHours × overtimeMultiplier`. */
  totalPaidHours: number
  /** The paid day a day rate is divided by (`weekdayPaidHours` of the policy in effect that day). */
  standardDayHours: number
  /** True on a PAYE day (`employmentTypeOnDay`): hours kept, every amount 0. */
  isPayeDay: boolean
  /** `payForHours` of the standard hours, rounded to pennies. */
  standardAmount: number
  /** `payForHours` of the overtime hours at the multiplier, rounded to pennies. */
  overtimeAmount: number
  /**
   * What to store as the revised amount of each line of the booking (`payrollLineReviews[lineId].revisedAmount`).
   * With its own overtime line: the standard line its standard pay and the overtime line its overtime pay. With no
   * overtime line: the standard line carries both (so overtime the edit created is paid, on the invoice and in the
   * totals), and `overtimeLineAmount` is null.
   */
  standardLineAmount: number
  overtimeLineAmount: number | null
  /** The review fields to store on each line (`PayrollLineEditReviewFields`); `overtime` null with no overtime line. */
  reviewFields: { standard: PayrollLineEditReviewFields; overtime: PayrollLineEditReviewFields | null }
  /** `standardLineAmount + (overtimeLineAmount ?? 0)`: the booking as edited. */
  total: number
}

/**
 * Re-price a timesheet booking whose hours the line manager edited (rulebook §8, 1.46.0). The result equals what the
 * timesheet collector produces for a booking with those times on that day, at that rate. Null when the times cannot be
 * priced (`revisedPayrollLineTimesError`: blank, not a clock time, or start equal to finish).
 */
export function revisedPayrollLineAmounts(input: RevisedPayrollLineInput): RevisedPayrollLineAmounts | null {
  if (revisedPayrollLineTimesError(input.startTime, input.endTime)) return null
  const dayKey = String(input.dayKey || '').trim()
  const policy = input.policyState
    ? payrollTimePolicyForDayFromState(input.policyState, dayKey)
    : (input.policy as OrgPayrollTimePolicy)
  const hours = payrollHoursResult({
    booking: {
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: String(input.startTime).trim(),
      workEndTime: String(input.endTime).trim(),
      isBreakRemoved: input.isBreakRemoved === true,
      otMultiplierOverride: input.otMultiplierOverride ?? undefined,
    },
    dayKey,
    policy,
    timeZone: input.timeZone,
  })
  const zone = zoneOrLondon(input.timeZone)
  const isPayeDay = Boolean(input.employment) && employmentTypeOnDay(input.employment as EmploymentTypeUser, dateFromDayKeyInZone(dayKey, zone), zone) === 'paye'
  const standardDayHours = orgDayHours(weekdayPaidHours(policy))
  const rate = isPayeDay
    ? { payBasis: basisOf(input.payBasis), dayRate: 0, hourlyRate: 0 }
    : { payBasis: basisOf(input.payBasis), dayRate: input.dayRate ?? null, hourlyRate: input.hourlyRate ?? null }
  const standardHours = Math.max(0, hours.standardHours)
  const minOvertime = Math.max(0, Number(input.overtimeLineMinHours) || 0)
  // The collector's overtime-line cut-off, applied the same way with or without an overtime line (1.46.0 review).
  const overtimeCounted = hours.outsideHours > minOvertime + HOURS_EPSILON
  const overtimeHours = overtimeCounted ? Math.max(0, hours.outsideHours) : 0
  const multiplied = overtimeCounted ? payrollMultipliedHours(hours) : null
  const overtimeClockHours = overtimeCounted ? (multiplied ? multiplied.clockHours : overtimeHours) : 0
  const multiplier = hours.outsideMultiplier
  const standardAmount = payForHours({ ...rate, paidHours: standardHours, standardDayHours })
  const overtimeAmount = overtimeCounted ? payForHours({ ...rate, paidHours: overtimeHours, standardDayHours, otMultiplier: multiplier }) : 0
  const fingerprint = String(input.bookingFingerprint ?? '').trim()
  const fields = (part: { std: boolean; ot: boolean }): PayrollLineEditReviewFields => {
    const stdAmount = part.std ? standardAmount : 0
    const otAmount = part.ot ? overtimeAmount : 0
    const otHours = part.ot ? overtimeHours : 0
    return {
      revisedAmount: roundPennies(stdAmount + otAmount),
      revisedStandardHours: part.std ? roundHours(standardHours) : 0,
      revisedOvertimeHours: roundHours(otHours),
      revisedOvertimeClockHours: part.ot ? roundHours(overtimeClockHours) : 0,
      revisedOvertimeMultiplier: otHours > 0 ? multiplier : null,
      revisedStandardAmount: stdAmount,
      revisedOvertimeAmount: otAmount,
      reviewedBookingFingerprint: fingerprint,
    }
  }
  const standardFields = fields({ std: true, ot: !input.bookingHasOvertimeLine })
  const overtimeFields = input.bookingHasOvertimeLine ? fields({ std: false, ot: true }) : null
  return {
    standardHours: roundHours(standardHours),
    overtimeHours: roundHours(overtimeHours),
    overtimeClockHours: roundHours(overtimeClockHours),
    overtimeMultiplier: multiplier,
    totalPaidHours: roundHours(standardHours + overtimeHours * multiplier),
    standardDayHours,
    isPayeDay,
    standardAmount,
    overtimeAmount,
    standardLineAmount: standardFields.revisedAmount,
    overtimeLineAmount: overtimeFields ? overtimeFields.revisedAmount : null,
    reviewFields: { standard: standardFields, overtime: overtimeFields },
    total: roundPennies(standardFields.revisedAmount + (overtimeFields ? overtimeFields.revisedAmount : 0)),
  }
}

/** One labour line of a signed snapshot (`weeklyReportOverride.lines`) built from a live line and its review. */
export type PayrollLineSnapshotPart = {
  id: string
  isOvertime: boolean
  paidHours: number
  otMultiplier: number | null
  amount: number
}

/**
 * Rulebook 1.46.0 (§8): the signed-snapshot lines for one live payroll line with an Edit hours review. Each line keeps
 * the hours and pay of its own part (`revisedStandardHours` / `revisedOvertimeHours`), never the live hours with the
 * edited money; a standard line that carries overtime (the booking had no overtime line) becomes two snapshot lines —
 * the standard line and `{booking}-ot` at the multiplier — so the weekly report reads 8.5h at the day rate and 3h × 2,
 * not "1 day at £426.47". Returns null when the review carries no edited hours (older reviews; the caller keeps today's
 * line). `review` is `payrollLineReview` of the line (stale reviews are already null).
 */
export function payrollLineReviewSnapshotParts(
  line: { id: string; isOvertimeLine?: boolean | null },
  review: PayrollLineReview | null | undefined
): PayrollLineSnapshotPart[] | null {
  if (!review || review.decision !== 'edited' || review.revisedStandardHours == null || review.revisedOvertimeHours == null) return null
  const id = String(line.id || '')
  const stdAmount = roundPennies(Number(review.revisedStandardAmount) || 0)
  const otAmount = roundPennies(Number(review.revisedOvertimeAmount) || 0)
  const otHours = Math.max(0, Number(review.revisedOvertimeHours) || 0)
  const multiplier = review.revisedOvertimeMultiplier ?? null
  if (line.isOvertimeLine === true) {
    return [{ id, isOvertime: true, paidHours: otHours, otMultiplier: multiplier, amount: otAmount }]
  }
  const parts: PayrollLineSnapshotPart[] = [
    { id, isOvertime: false, paidHours: Math.max(0, Number(review.revisedStandardHours) || 0), otMultiplier: null, amount: stdAmount },
  ]
  if (otHours > 0) {
    parts.push({ id: `${id.replace(/-normal$/i, '')}-ot`, isOvertime: true, paidHours: otHours, otMultiplier: multiplier, amount: otAmount })
  }
  return parts
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
