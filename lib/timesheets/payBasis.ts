/**
 * Shared day-or-hourly pay contract. One person is on one basis.
 * An organisation can mix both. Organisation day length is
 * payrollTimePolicy.standardPaidHours and is never replaced with 8.
 */

export type PayBasis = 'day' | 'hourly'

export type StoredPay = {
  payBasis: PayBasis | null
  dayRate: number | null
  hourlyRate: number | null
}

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

export function money(amount: number) {
  return `£${(Number(amount) || 0).toFixed(2)}`
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
}: {
  payBasis?: string | null
  paidHours: number
  standardDayHours: number
  rate: number | null
  pay: number
  isOvertime?: boolean
  otMultiplier?: number | null
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
  const rateText = rate == null ? '' : `${money(rate)}${hourly ? '/hr' : '/day'}`
  const qty = quantityText(quantity, unit)
  const equation = rateText ? `${qty} × ${rateText} = ${money(pay)}` : `${qty} = ${money(pay)}`
  return { rateType, quantityText: qty, rateText, equation, pay: roundPennies(pay) }
}

export function exclusiveRates({
  dayRate,
  hourlyRate,
  payBasis,
}: {
  dayRate?: number | null
  hourlyRate?: number | null
  payBasis?: string | null
}): { payBasis: PayBasis; dayRate: number | null; hourlyRate: number | null } {
  const basis = payBasis === 'hourly' || payBasis === 'day' ? payBasis : null
  const day = typeof dayRate === 'number' ? dayRate : null
  const hourly = typeof hourlyRate === 'number' ? hourlyRate : null
  if (basis === 'hourly') return { payBasis: 'hourly', dayRate: null, hourlyRate: hourly }
  if (basis === 'day') return { payBasis: 'day', dayRate: day, hourlyRate: null }
  if (day != null && day > 0) return { payBasis: 'day', dayRate: day, hourlyRate: null }
  if (hourly != null && hourly > 0) return { payBasis: 'hourly', dayRate: null, hourlyRate: hourly }
  if (day != null) return { payBasis: 'day', dayRate: day, hourlyRate: null }
  return { payBasis: 'day', dayRate: null, hourlyRate: null }
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

/**
 * No basis and no amount above 0 is unset, including a lone 0 or both amounts at 0.
 * Both amounts above 0 and no payBasis is a day rate. 0 is real when payBasis is set.
 */
export function readStoredRates(input: {
  payBasis?: unknown
  dayRate?: unknown
  hourlyRate?: unknown
}): StoredPay {
  const basis = input.payBasis === 'hourly' || input.payBasis === 'day' ? input.payBasis : null
  const day = finiteNumber(input.dayRate)
  const hourly = finiteNumber(input.hourlyRate)
  if (basis == null && !(day != null && day > 0) && !(hourly != null && hourly > 0)) {
    return { payBasis: null, dayRate: null, hourlyRate: null }
  }
  return exclusiveRates({ dayRate: day, hourlyRate: hourly, payBasis: basis })
}

/** Fields for a full document write. The unused rate is omitted. */
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

export function historyRowBasis(row: { payBasis?: string | null }): PayBasis {
  return row.payBasis === 'hourly' ? 'hourly' : 'day'
}

/**
 * Rows on or before the booking day.
 * When the live profile is hourly, an hourly row covers that day until a day-rate
 * row falls on a later calendar day. A day-rate row later the same day does not cancel it.
 * Otherwise the latest row by effectiveAt, then createdAt.
 */
export function resolveHistoryPayRow<T extends HistoryPayRow>(
  rows: T[],
  dayStart: Date,
  livePayBasis: PayBasis | null,
  dayStartOf: (date: Date) => Date
): T | null {
  const bookingDay = dayStartOf(dayStart).getTime()
  const candidates = rows
    .filter((row) => dayStartOf(row.effectiveAt).getTime() <= bookingDay)
    .sort((a, b) => {
      const byEffective = a.effectiveAt.getTime() - b.effectiveAt.getTime()
      if (byEffective !== 0) return byEffective
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  if (candidates.length === 0) return null
  if (livePayBasis === 'hourly') {
    const hourlyRows = candidates.filter((row) => historyRowBasis(row) === 'hourly')
    if (hourlyRows.length > 0) {
      const hourly = hourlyRows[hourlyRows.length - 1]
      const hourlyDay = dayStartOf(hourly.effectiveAt).getTime()
      const laterDayRows = candidates.filter(
        (row) => historyRowBasis(row) === 'day' && dayStartOf(row.effectiveAt).getTime() > hourlyDay
      )
      if (laterDayRows.length > 0) return laterDayRows[laterDayRows.length - 1]
      return hourly
    }
  }
  return candidates[candidates.length - 1]
}

export function isClockSpanLabel(details: string): boolean {
  return /\d{1,2}:\d{2}/.test(details)
}
