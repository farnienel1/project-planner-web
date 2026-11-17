/**
 * Shared day-or-hourly pay contract. One person is on one basis.
 * An organisation can mix both. Organisation day length is
 * payrollTimePolicy.standardPaidHours and is never replaced with 8.
 */

import { historyPayRowOnDay, readStoredRates, type PayBasis } from '@/lib/canonical/payRate'
import { formatMoney } from '@/lib/canonical/money'
import { multipliedHoursText } from '@/lib/canonical/payrollHours'
import { dayRateOvertimeCalcText } from '@/lib/canonical/dayRateOvertimeText'

export type { PayBasis, StoredPay } from '@/lib/canonical/payRate'

export type HistoryPayRow = {
  /** null on a "rate cleared" row (`payRateHistoryWriteFields`). */
  dayRate: number | null
  payBasis?: string | null
  effectiveAt: Date
  createdAt: Date
}

// Rulebook 1.10.0 (L16): the pay arithmetic is the rulebook's (`payForHours`, `roundPennies`, `orgDayHours`).
export { orgDayHours, payForHours, roundPennies } from '@/lib/canonical/payRate'
import { orgDayHours, roundPennies } from '@/lib/canonical/payRate'

/** Organisation money (`formatMoney`). Pass the organisation currency; GBP when omitted. */
export function money(amount: number, currencyCode?: string | null) {
  return formatMoney(Number(amount) || 0, currencyCode)
}

export function quantityText(quantity: number, unit: 'hours' | 'days') {
  const number = Number(quantity).toFixed(2)
  if (unit === 'hours') return Math.abs(quantity - 1) < 0.001 ? `${number} hour` : `${number} hours`
  return Math.abs(quantity - 1) < 0.001 ? `${number} day` : `${number} days`
}

/**
 * Rulebook 1.61.0 §8 (owner 17 Nov): the hours wording of a day-rate overtime line, or null so the caller keeps the
 * older wording. Null also when the text throws, or when it would not show this line's own figures — its hours sum
 * must be the line's paid hours at the multiplier (`paidHours × N`, which equals clock × N − break) and its amount the
 * line's amount in pennies. Exported for tests.
 */
export function dayRateOvertimeTextOrNull(input: {
  paidHours: number
  clockHours?: number | null
  breakHours?: number | null
  multiplier: number
  dayRate: number
  standard: number
  pay: number
  currencyCode?: string | null
}): ReturnType<typeof dayRateOvertimeCalcText> {
  try {
    const hasClock = Number(input.clockHours) > 0
    const calc = dayRateOvertimeCalcText({
      clockHours: hasClock ? Number(input.clockHours) : input.paidHours,
      multiplier: input.multiplier,
      breakHours: hasClock ? Number(input.breakHours) || 0 : 0,
      dayRate: input.dayRate,
      dayRateHours: input.standard,
      pay: input.pay,
      currency: input.currencyCode ?? null,
    })
    if (!calc) return null
    if (Math.abs(calc.paidHours - input.paidHours * input.multiplier) > 0.005) return null
    if (calc.pay !== roundPennies(input.pay) || calc.payShown !== money(roundPennies(input.pay), input.currencyCode)) return null
    return calc
  } catch {
    return null
  }
}

export function payLineDisplay({
  payBasis,
  paidHours,
  standardDayHours,
  rate,
  pay,
  isOvertime = false,
  otMultiplier = null,
  currencyCode = null,
  clockHours = null,
  breakHours = null,
  baseRate = null,
}: {
  payBasis?: string | null
  paidHours: number
  standardDayHours: number
  rate: number | null
  pay: number
  isOvertime?: boolean
  otMultiplier?: number | null
  currencyCode?: string | null
  /**
   * Rulebook 1.20.3: the clock hours at the multiplier and the unpaid break taken off them as plain hours
   * (`payrollMultipliedHours`). With a break, the line shows "6.5h × 2 − 0.5h break = 12.5h" (`multipliedHoursText`)
   * at the base rate — never the back-calculated `paidHours` ("6.25h × 2"). `rate` is still the multiplied OT rate
   * the line was priced with; `pay` is shown as given, so no total changes.
   */
  clockHours?: number | null
  breakHours?: number | null
  /**
   * Rulebook 1.61.0: the person's own rate (never multiplied), when the caller has it, so the hourly rate shown is
   * exactly `dayRate ÷ divisor` rounded to pennies. Missing: `rate ÷ otMultiplier`.
   */
  baseRate?: number | null
}) {
  const standard = orgDayHours(standardDayHours)
  const hourly = payBasis === 'hourly'
  const unit = hourly ? 'hours' : 'days'
  const quantity = hourly ? paidHours : paidHours / standard
  const kind = hourly ? 'Hourly' : 'Day'
  let rateType = kind
  if (isOvertime) {
    const ot =
      otMultiplier == null
        ? 'OT'
        : Number.isInteger(otMultiplier)
          ? `OT x${otMultiplier}`
          : `OT x${Number(otMultiplier).toFixed(1)}`
    rateType = `${kind} ${ot}`
  }
  const multiplier = Number(otMultiplier) > 0 ? Number(otMultiplier) : 1
  if (isOvertime && !hourly && rate != null && Number(otMultiplier) > 0) {
    // Rulebook 1.61.0 §8 (owner decision 17 Nov): a day-rate overtime line reads in hours —
    // "6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)" — never a multiplied day
    // rate. `rate` is the multiplied rate the line was priced with; the person's day rate is rate ÷ N. `pay` as given.
    // Owner 17 Nov: the amount is already priced (`pay`); the text only shows it. It never blocks or changes the
    // amount: if it cannot be built, throws, or does not show this line's own hours and amount, the older wording
    // below is used.
    const calc = dayRateOvertimeTextOrNull({
      paidHours,
      clockHours,
      breakHours,
      multiplier,
      dayRate: Number(baseRate) > 0 ? Number(baseRate) : rate / multiplier,
      standard,
      pay,
      currencyCode,
    })
    if (calc) {
      return { rateType, quantityText: calc.hoursText, rateText: calc.rateText, equation: calc.text, pay: roundPennies(pay) }
    }
  }
  if (isOvertime && Number(breakHours) > 0 && Number(clockHours) > 0) {
    // 1.20.3: clock hours × N, then the break as plain hours; the quantity is the hours that pays, at the base rate.
    const hoursText = multipliedHoursText({ clockHours: Number(clockHours), multiplier, breakHours: Number(breakHours) })
    const equivalent = Math.max(0, Number(clockHours) * multiplier - Number(breakHours))
    const baseRate = rate == null ? null : rate / multiplier
    const baseRateText = baseRate == null ? '' : `${money(baseRate, currencyCode)}${hourly ? '/hr' : '/day'}`
    const qty = hourly ? hoursText : `${hoursText} = ${quantityText(equivalent / standard, 'days')}`
    const equation = baseRateText ? `${qty} × ${baseRateText} = ${money(pay, currencyCode)}` : `${qty} = ${money(pay, currencyCode)}`
    return { rateType, quantityText: qty, rateText: baseRateText, equation, pay: roundPennies(pay) }
  }
  const rateText = rate == null ? '' : `${money(rate, currencyCode)}${hourly ? '/hr' : '/day'}`
  const qty = quantityText(quantity, unit)
  const equation = rateText ? `${qty} × ${rateText} = ${money(pay, currencyCode)}` : `${qty} = ${money(pay, currencyCode)}`
  return { rateType, quantityText: qty, rateText, equation, pay: roundPennies(pay) }
}

/** The rate contract lives in the rulebook (`lib/canonical/payRate.ts`). */
export { exclusiveRates, readStoredRates } from '@/lib/canonical/payRate'

/**
 * iOS saveOperative writes both amounts. loadOperatives does
 * `dayRate: loadedDay ?? loadedHourly`, so a missing dayRate becomes the hourly
 * amount and payroll then treats that person as day-rate. 0 keeps the fields apart.
 * `payBasis` is for web reads; iOS ignores it.
 */
export function operativeRosterRateFields(input: {
  payBasis?: unknown
  dayRate?: unknown
  hourlyRate?: unknown
}): Record<string, unknown> {
  const stored = readStoredRates(input)
  if (stored.payBasis === 'hourly' && stored.hourlyRate != null) {
    return { payBasis: 'hourly', hourlyRate: stored.hourlyRate, dayRate: 0 }
  }
  if (stored.payBasis === 'day' && stored.dayRate != null) {
    return { payBasis: 'day', dayRate: stored.dayRate, hourlyRate: 0 }
  }
  return { hourlyRate: 0, dayRate: 0 }
}

/** Fields for a user-document write. iOS saveUser deletes the unused rate. */
export function exclusiveRateDocumentFields(input: {
  payBasis?: unknown
  dayRate?: unknown
  hourlyRate?: unknown
}): Record<string, unknown> {
  const stored = readStoredRates(input)
  if (stored.payBasis == null || (stored.dayRate == null && stored.hourlyRate == null)) return {}
  if (stored.payBasis === 'hourly') {
    return { payBasis: 'hourly', hourlyRate: stored.hourlyRate ?? 0 }
  }
  return { payBasis: 'day', dayRate: stored.dayRate ?? 0 }
}

export { historyRowBasis } from '@/lib/canonical/payRate'

/**
 * Rows on or before the booking day (`historyPayRowOnDay` in the rulebook).
 * `dayStartOf` maps an instant to the start of its organisation-zone day.
 */
export function resolveHistoryPayRow<T extends HistoryPayRow>(
  rows: T[],
  dayStart: Date,
  livePayBasis: PayBasis | null,
  dayStartOf: (date: Date) => Date
): T | null {
  const dayOf = (date: Date) => String(dayStartOf(date).getTime()).padStart(16, '0')
  return historyPayRowOnDay(rows, dayOf(dayStart), livePayBasis, dayOf)
}

export function isClockSpanLabel(details: string): boolean {
  return /\d{1,2}:\d{2}/.test(details)
}
