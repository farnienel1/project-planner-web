/**
 * The pay rate in effect for one person on one day.
 *
 * Rule (both apps):
 *   1. PAYE on that day (`employmentTypeOnDay`) → rate 0. The person keeps their hours on the
 *      timesheet; the line is flagged PAYE and is never paid or invoiced.
 *   2. Otherwise the latest `organizations/{orgId}/operativeDayRateHistory` row for this person whose
 *      effective day (organisation zone) is on or before the day. An explicit 0 is a real rate.
 *      When the live profile is hourly, an hourly row keeps covering until a day-rate row falls on a
 *      later calendar day (a day-rate row later the same day does not cancel it).
 *   3. No history row → the live profile rate (`users/{uid}` first, then the operative row):
 *      `payBasis` plus `dayRate` or `hourlyRate`.
 *   4. Nothing set → rate null (`hasRate` false, "rate not set").
 *
 * Day boundary is the organisation-zone day key, never the device zone.
 * History rows keep the amount in `dayRate` for both bases (old rows have no `payBasis` = day).
 */

import { dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { employmentTypeOnDay, type EmploymentType, type EmploymentTypeUser } from './userProfile'

export type PayBasis = 'day' | 'hourly'

export type StoredPay = {
  payBasis: PayBasis | null
  dayRate: number | null
  hourlyRate: number | null
}

export type PayRateProfile = {
  id?: string | null
  payBasis?: unknown
  dayRate?: unknown
  hourlyRate?: unknown
}

export type PayRateUser = PayRateProfile & EmploymentTypeUser

export type PayRateHistoryRow = {
  id?: string | null
  userId?: string | null
  operativeId?: string | null
  /** Amount per day or per hour. */
  dayRate: number
  payBasis?: string | null
  effectiveAt: Date | string | number
  createdAt?: Date | string | number | null
}

export type PayRateOnDayInput = {
  user?: PayRateUser | null
  /** The operative catalogue row linked to this person, used when the user document has no rate. */
  operative?: PayRateProfile | null
  history?: ReadonlyArray<PayRateHistoryRow> | null
  /** History rows match on these user ids (default: user.id). Pass former and same-email ids. */
  userIds?: ReadonlyArray<string> | null
  /** History rows match on these operative ids (default: operative.id). */
  operativeIds?: ReadonlyArray<string> | null
  dayKey: string
  timeZone?: string | null
}

export type PayRateOnDay = {
  payBasis: PayBasis
  /** Per day or per hour by `payBasis`. 0 for PAYE. null when no rate is set. */
  rate: number | null
  employmentType: EmploymentType
  isPaye: boolean
  hasRate: boolean
  source: 'paye' | 'history' | 'profile' | 'none'
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

export function exclusiveRates(input: {
  dayRate?: number | null
  hourlyRate?: number | null
  payBasis?: string | null
}): { payBasis: PayBasis; dayRate: number | null; hourlyRate: number | null } {
  const basis = input.payBasis === 'hourly' || input.payBasis === 'day' ? input.payBasis : null
  const day = typeof input.dayRate === 'number' ? input.dayRate : null
  const hourly = typeof input.hourlyRate === 'number' ? input.hourlyRate : null
  if (basis === 'hourly') return { payBasis: 'hourly', dayRate: null, hourlyRate: hourly }
  if (basis === 'day') return { payBasis: 'day', dayRate: day, hourlyRate: null }
  if (day != null && day > 0) return { payBasis: 'day', dayRate: day, hourlyRate: null }
  if (hourly != null && hourly > 0) return { payBasis: 'hourly', dayRate: null, hourlyRate: hourly }
  if (day != null) return { payBasis: 'day', dayRate: day, hourlyRate: null }
  return { payBasis: 'day', dayRate: null, hourlyRate: null }
}

/**
 * No basis and no amount above 0 is unset, including a lone 0 or both amounts at 0.
 * Both amounts above 0 and no payBasis is a day rate. 0 is real when payBasis is set.
 */
export function readStoredRates(input: PayRateProfile | null | undefined): StoredPay {
  const source = input || {}
  const basis = source.payBasis === 'hourly' || source.payBasis === 'day' ? source.payBasis : null
  const day = finiteNumber(source.dayRate)
  const hourly = finiteNumber(source.hourlyRate)
  if (basis == null && !(day != null && day > 0) && !(hourly != null && hourly > 0)) {
    return { payBasis: null, dayRate: null, hourlyRate: null }
  }
  return exclusiveRates({ dayRate: day, hourlyRate: hourly, payBasis: basis })
}

export function historyRowBasis(row: { payBasis?: string | null }): PayBasis {
  return row.payBasis === 'hourly' ? 'hourly' : 'day'
}

/**
 * The history row in effect on a day. `dayOf` turns an instant into a sortable day value
 * (the organisation-zone day key). Rows are compared by effective day, then effectiveAt, then createdAt.
 */
export function historyPayRowOnDay<T extends { payBasis?: string | null; effectiveAt: Date; createdAt: Date }>(
  rows: ReadonlyArray<T>,
  day: string,
  livePayBasis: PayBasis | null,
  dayOf: (date: Date) => string
): T | null {
  const candidates = rows
    .filter((row) => dayOf(row.effectiveAt) <= day)
    .slice()
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
      const hourlyDay = dayOf(hourly.effectiveAt)
      const laterDayRows = candidates.filter(
        (row) => historyRowBasis(row) === 'day' && dayOf(row.effectiveAt) > hourlyDay
      )
      if (laterDayRows.length > 0) return laterDayRows[laterDayRows.length - 1]
      return hourly
    }
  }
  return candidates[candidates.length - 1]
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function idSet(values: ReadonlyArray<string | null | undefined>): Set<string> {
  return new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
}

/** The live profile rate: the user document when it has one, else the operative row. */
export function livePayRate(user?: PayRateProfile | null, operative?: PayRateProfile | null): StoredPay {
  const fromUser = user ? readStoredRates(user) : null
  if (fromUser && (fromUser.dayRate != null || fromUser.hourlyRate != null)) return fromUser
  const fromOperative = operative ? readStoredRates(operative) : null
  if (fromOperative && (fromOperative.dayRate != null || fromOperative.hourlyRate != null)) return fromOperative
  return { payBasis: null, dayRate: null, hourlyRate: null }
}

export function payRateOnDay(input: PayRateOnDayInput): PayRateOnDay {
  const timeZone = zoneOrLondon(input.timeZone)
  const dayKey = String(input.dayKey || '').trim()
  const user = input.user || null
  const operative = input.operative || null
  const live = livePayRate(user, operative)
  const liveBasis: PayBasis = live.payBasis === 'hourly' ? 'hourly' : 'day'
  const employmentType = user
    ? employmentTypeOnDay(user, dateFromDayKeyInZone(dayKey, timeZone), timeZone)
    : 'self_employed'

  if (user && employmentType === 'paye') {
    return { payBasis: liveBasis, rate: 0, employmentType, isPaye: true, hasRate: true, source: 'paye' }
  }

  const userIds = idSet(input.userIds && input.userIds.length > 0 ? input.userIds : [user?.id])
  const operativeIds = idSet(input.operativeIds && input.operativeIds.length > 0 ? input.operativeIds : [operative?.id])
  const seen = new Set<string>()
  const rows: Array<{ payBasis?: string | null; effectiveAt: Date; createdAt: Date; dayRate: number }> = []
  ;(input.history || []).forEach((row, index) => {
    if (!row) return
    const amount = finiteNumber(row.dayRate)
    const effectiveAt = toDate(row.effectiveAt)
    if (amount == null || !effectiveAt) return
    const rowUser = String(row.userId || '').trim()
    const rowOperative = String(row.operativeId || '').trim()
    if (!(rowUser && userIds.has(rowUser)) && !(rowOperative && operativeIds.has(rowOperative))) return
    const key = String(row.id || '').trim() || `#${index}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      payBasis: row.payBasis ?? null,
      dayRate: amount,
      effectiveAt,
      createdAt: toDate(row.createdAt) || effectiveAt,
    })
  })

  const match = historyPayRowOnDay(rows, dayKey, live.payBasis, (date) => dayKeyInZone(date, timeZone))
  if (match) {
    return {
      payBasis: historyRowBasis(match),
      rate: match.dayRate,
      employmentType,
      isPaye: false,
      hasRate: true,
      source: 'history',
    }
  }

  const rate = liveBasis === 'hourly' ? live.hourlyRate : live.dayRate
  return {
    payBasis: liveBasis,
    rate,
    employmentType,
    isPaye: false,
    hasRate: rate != null,
    source: rate != null ? 'profile' : 'none',
  }
}
