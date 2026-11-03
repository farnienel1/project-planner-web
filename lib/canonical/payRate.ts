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
 *   5. A cleared rate is a history row `{ dayRate: null, payBasis: null, effectiveAt }`: from its effective day
 *      the rate is "rate not set" (`hasRate` false) until a later row sets one. It ends an hourly row too.
 *
 * Day boundary is the organisation-zone day key, never the device zone. A history row's `effectiveAt` is the
 * organisation-zone midnight of its effective day (`payRateHistoryWriteFields`).
 * History rows keep the amount in `dayRate` for both bases (old rows have no `payBasis` = day).
 */

import { dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { employmentTypeOnDay, type EmploymentType, type EmploymentTypeUser } from './userProfile'
import { personIdSet, type PersonIdsInput, type PersonRosterRow } from './personIds'

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
  /** Amount per day or per hour. null on a "rate cleared" row. */
  dayRate: number | null
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
  /**
   * 1.10.0: the person whose rate this is (`id`, `email`, `formerUserIds`, `sameEmailUserIds`) and the roster. When
   * given, history rows match every id of the person (`personIdSet`: own id, former ids, same-email ids, roster rows
   * with the same email) as well as `userIds` — so the apps pass the whole history and never pick ids themselves.
   */
  person?: PersonIdsInput | null
  roster?: ReadonlyArray<PersonRosterRow> | null
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

  const personIds = input.person ? personIdSet(input.person, input.roster ?? []) : []
  const userIds = idSet([
    ...(input.userIds && input.userIds.length > 0 ? input.userIds : [user?.id]),
    ...personIds,
  ])
  const operativeIds = idSet(input.operativeIds && input.operativeIds.length > 0 ? input.operativeIds : [operative?.id])
  const seen = new Set<string>()
  const rows: Array<{ payBasis?: string | null; effectiveAt: Date; createdAt: Date; dayRate: number | null }> = []
  ;(input.history || []).forEach((row, index) => {
    if (!row) return
    const amount = finiteNumber(row.dayRate)
    const cleared = row.dayRate === null
    const effectiveAt = toDate(row.effectiveAt)
    if ((amount == null && !cleared) || !effectiveAt) return
    const rowUser = String(row.userId || '').trim()
    const rowOperative = String(row.operativeId || '').trim()
    if (!(rowUser && userIds.has(rowUser)) && !(rowOperative && operativeIds.has(rowOperative))) return
    const key = String(row.id || '').trim() || `#${index}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      payBasis: cleared ? null : row.payBasis ?? null,
      dayRate: cleared ? null : amount,
      effectiveAt,
      createdAt: toDate(row.createdAt) || effectiveAt,
    })
  })

  const match = historyPayRowOnDay(rows, dayKey, live.payBasis, (date) => dayKeyInZone(date, timeZone))
  if (match && match.dayRate == null) {
    return { payBasis: liveBasis, rate: null, employmentType, isPaye: false, hasRate: false, source: 'none' }
  }
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

export type PayRateHistoryWriteInput = {
  userId?: string | null
  operativeId?: string | null
  /** The new amount (per day or per hour), 0 included. null, or not a finite number, records "rate cleared". */
  rate: number | null | undefined
  payBasis?: string | null
  /** The effective day: a `yyyy-MM-dd` key in the organisation zone, or an instant (its organisation-zone day). */
  effective: string | number | Date
  timeZone?: string | null
}

export type PayRateHistoryWriteFields = {
  userId: string
  operativeId: string
  /** null on a "rate cleared" row. */
  dayRate: number | null
  /** null on a "rate cleared" row. */
  payBasis: PayBasis | null
  /** Write `effectiveAt` as a Timestamp of this instant: organisation-zone midnight of the effective day. */
  effectiveAtMs: number
  effectiveDayKey: string
}

const HISTORY_DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/**
 * One new `organizations/{orgId}/operativeDayRateHistory` row (history is never rewritten). The effective day is
 * the organisation-zone day, and `effectiveAtMs` its midnight in that zone — never London unless that is the
 * organisation's zone, never the device zone. Clearing a rate writes `dayRate: null, payBasis: null`
 * ("rate not set from that day", read by `payRateOnDay`). The app adds `createdAt` and `writeMetadataFields`.
 * Null when there is no person id or no usable effective day.
 */
export function payRateHistoryWriteFields(input: PayRateHistoryWriteInput): PayRateHistoryWriteFields | null {
  const timeZone = zoneOrLondon(input.timeZone)
  const userId = String(input.userId || '').trim()
  const operativeId = String(input.operativeId || '').trim()
  if (!userId && !operativeId) return null
  let dayKey = ''
  if (typeof input.effective === 'string' && HISTORY_DAY_KEY.test(input.effective.trim())) {
    dayKey = input.effective.trim()
  } else {
    const instant = toDate(input.effective)
    if (!instant) return null
    dayKey = dayKeyInZone(instant, timeZone)
  }
  const amount = finiteNumber(input.rate)
  return {
    userId,
    operativeId,
    dayRate: amount,
    payBasis: amount == null ? null : input.payBasis === 'hourly' ? 'hourly' : 'day',
    effectiveAtMs: dateFromDayKeyInZone(dayKey, timeZone).getTime(),
    effectiveDayKey: dayKey,
  }
}

export type PayRateChangeProfile = {
  /** The amount on the profile (per day or per hour); null when no rate is set. */
  rate: number | null | undefined
  payBasis?: string | null
}

export type PayRateChangeWrites =
  | { ok: true; rows: PayRateHistoryWriteFields[] }
  | { ok: false; reason: 'history_not_loaded'; message: string }

/**
 * Rulebook §8 (1.11.0): the sentence both apps show under the pay fields. A person is paid by the day or by the hour:
 * a rate save writes exactly one basis and removes the other (`exclusiveRates`, `PAY_WRITE_GROUP`).
 */
export const PAY_BASIS_SAVE_NOTE =
  'Pay is a day rate or an hourly rate, not both. Saving a day rate removes the hourly rate, and saving an hourly rate removes the day rate.'
/** Under the day-rate field. */
export const PAY_BASIS_DAY_HELP =
  'Day rate pays a share of the standard day. This person cannot also have an hourly rate. Other people can still be paid hourly.'
/** Under the hourly-rate field. */
export const PAY_BASIS_HOURLY_HELP =
  'Hourly pay is worked hours × this rate, including 15-minute blocks. This person cannot also have a day rate. Other people can still be on a day rate.'

export const PAY_HISTORY_NOT_LOADED_MESSAGE = 'Pay history could not be loaded. Check your connection and save again.'

/**
 * The `operativeDayRateHistory` rows a pay change writes (1.10.0, §8), in the same batch as the profile save:
 *   - nothing when the amount and basis are unchanged;
 *   - a "rate cleared" row when a saved rate is cleared;
 *   - otherwise the new row, preceded by a seed row of the previous rate from `seedEffective` (the account's creation
 *     day) only when the person has no history row yet and the previous rate was above 0.
 * `history` is the person's loaded rows (any shape with an id); `null` means the history did not load, and the save is
 * refused (`history_not_loaded`) rather than treating it as empty and writing a duplicate seed.
 */
export function payRateChangeWrites(input: {
  userId?: string | null
  operativeId?: string | null
  previousProfile: PayRateChangeProfile
  nextProfile: PayRateChangeProfile
  history: ReadonlyArray<unknown> | null | undefined
  /** The day the change takes effect (`yyyy-MM-dd` in the organisation zone, or an instant). */
  effectiveDayKey: string | number | Date
  /** The seed row's effective instant (the account's creation). Without it no seed row is written. */
  seedEffective?: string | number | Date | null
  timeZone?: string | null
}): PayRateChangeWrites {
  const previous = finiteNumber(input.previousProfile?.rate)
  const next = finiteNumber(input.nextProfile?.rate)
  const prevBasis =
    input.previousProfile?.payBasis === 'hourly' ? 'hourly' : input.previousProfile?.payBasis === 'day' ? 'day' : null
  const nextBasis = input.nextProfile?.payBasis === 'hourly' ? 'hourly' : 'day'
  const base = { userId: input.userId, operativeId: input.operativeId, timeZone: input.timeZone }
  if (next == null) {
    if (previous == null) return { ok: true, rows: [] }
  } else if (previous === next && (prevBasis == null || prevBasis === nextBasis)) {
    return { ok: true, rows: [] }
  }
  if (!Array.isArray(input.history)) {
    return { ok: false, reason: 'history_not_loaded', message: PAY_HISTORY_NOT_LOADED_MESSAGE }
  }
  const rows: PayRateHistoryWriteFields[] = []
  if (next == null) {
    const cleared = payRateHistoryWriteFields({ ...base, rate: null, effective: input.effectiveDayKey })
    return { ok: true, rows: cleared ? [cleared] : [] }
  }
  if (input.history.length === 0 && previous != null && previous > 0 && input.seedEffective != null) {
    const seed = payRateHistoryWriteFields({
      ...base,
      rate: previous,
      payBasis: prevBasis === 'hourly' ? 'hourly' : 'day',
      effective: input.seedEffective,
    })
    if (seed) rows.push(seed)
  }
  const row = payRateHistoryWriteFields({ ...base, rate: next, payBasis: nextBasis, effective: input.effectiveDayKey })
  if (row) rows.push(row)
  return { ok: true, rows }
}

// MARK: - Pay arithmetic (1.10.0, L16; was web lib/timesheets/payBasis.ts and iOS PayrollRateResolver)

/** Money rounded to whole pence (half away from zero for positive amounts, as `Math.round`). */
export function roundPennies(amount: number): number {
  return Math.round(Number(amount) * 100) / 100
}

/** The organisation's paid hours in a day (`payrollTimePolicy.standardPaidHours`); never 0 (0.01 floor), never 8 by default. */
/** The shortest paid day a day rate is divided by (`PAYROLL_POLICY_LIMITS.paidHours.min`). */
export const PAY_STANDARD_DAY_MIN_HOURS = 1

export function orgDayHours(standardPaidHours: number): number {
  const hours = Number(standardPaidHours)
  return hours > 0 ? hours : 0.01
}

/**
 * Pay for `paidHours` on one basis: hourly → rate × hours × multiplier; day → day rate × (hours ÷ the organisation's
 * paid day) × multiplier; rounded to pence. 0 hours (or fewer) pay 0; a missing rate counts as 0.
 * 1.12.0 §8: a day rate with no usable paid day (`standardDayHours` below 1, missing or not a number) pays 0 — rate
 * not set — instead of dividing by the 0.01 floor (up to 800× the day rate). A multiplier that is not a positive
 * number is 1; a rate that is not a number is 0.
 */
export function payForHours(input: {
  payBasis?: string | null
  dayRate?: number | null
  hourlyRate?: number | null
  paidHours: number
  standardDayHours: number
  otMultiplier?: number
}): number {
  const paidHours = Number(input.paidHours)
  if (!(paidHours > 0)) return 0
  const rawMultiplier = Number(input.otMultiplier ?? 1)
  const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0 ? rawMultiplier : 1
  const rate = (value: number | null | undefined) => {
    const n = Number(value ?? 0)
    return Number.isFinite(n) ? n : 0
  }
  if (input.payBasis === 'hourly') return roundPennies(rate(input.hourlyRate) * paidHours * multiplier)
  const standardDay = Number(input.standardDayHours)
  if (!(standardDay >= PAY_STANDARD_DAY_MIN_HOURS)) return 0
  return roundPennies(rate(input.dayRate) * (paidHours / standardDay) * multiplier)
}
