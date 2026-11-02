/**
 * Shared day-or-hourly pay contract. One person is on one basis.
 * An organisation can mix both. Organisation day length is
 * payrollTimePolicy.standardPaidHours and is never replaced with 8.
 */

import { historyPayRowOnDay, readStoredRates, type PayBasis } from '@/lib/canonical/payRate'
import { formatMoney } from '@/lib/canonical/money'

export type { PayBasis, StoredPay } from '@/lib/canonical/payRate'

export type HistoryPayRow = {
  dayRate: number
  payBasis?: string | null
  effectiveAt: Date
  createdAt: Date
}

export function roundPennies(amount: number) {
  return Math.round(amount * 100) / 100
}

export function orgDayHours(standardPaidHours: number) {
  const hours = Number(standardPaidHours)
  return hours > 0 ? hours : 0.01
}

export function payForHours({
  payBasis,
  dayRate,
  hourlyRate,
  paidHours,
  standardDayHours,
  otMultiplier = 1,
}: {
  payBasis?: string | null
  dayRate?: number | null
  hourlyRate?: number | null
  paidHours: number
  standardDayHours: number
  otMultiplier?: number
}) {
  if (!(paidHours > 0)) return 0
  const standard = orgDayHours(standardDayHours)
  if (payBasis === 'hourly') {
    return roundPennies((hourlyRate ?? 0) * paidHours * otMultiplier)
  }
  return roundPennies((dayRate ?? 0) * (paidHours / standard) * otMultiplier)
}

/** Organisation money (`formatMoney`). Pass the organisation currency; GBP when omitted. */
export function money(amount: number, currencyCode?: string | null) {
  return formatMoney(Number(amount) || 0, currencyCode)
}

export function quantityText(quantity: number, unit: 'hours' | 'days') {
  const number = Number(quantity).toFixed(2)
  if (unit === 'hours') return Math.abs(quantity - 1) < 0.001 ? `${number} hour` : `${number} hours`
  return Math.abs(quantity - 1) < 0.001 ? `${number} day` : `${number} days`
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
}: {
  payBasis?: string | null
  paidHours: number
  standardDayHours: number
  rate: number | null
  pay: number
  isOvertime?: boolean
  otMultiplier?: number | null
  currencyCode?: string | null
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
