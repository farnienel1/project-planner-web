/**
 * Shared annual-leave allowance vs count, the company leave year, and
 * a one-year remaining override. Screens stay in each app.
 *
 * `annualLeaveEnabled === false` means no paid allowance — not “no holiday”.
 * The Holiday tab stays available. That person sees days taken in the
 * company leave year. The count resets on the first day of the next year.
 */

import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { leaveRecordDayKeys } from './leaveRequests'
import { employmentTypeOnDay, employmentTypeTransition, normalizeEmploymentType, type EmploymentTypeUser } from './userProfile'

export const DEFAULT_ANNUAL_LEAVE_DAYS = 25

export const ANNUAL_LEAVE_ALLOWANCE_COPY = {
  toggleTitle: 'Annual leave allowance',
  toggleDescription:
    'Turn off annual leave allowances using this toggle. This is generally used for self-employed staff who do not get paid annual leave, therefore they do not have a set number of days per year.',
  toggleNote:
    'When off, this person can still book and see annual leave. They see days taken in the company leave year, not a remaining balance or days per year.',
  remainingTitle: "Manually adjust this user's remaining annual leave allowance for this year",
  remainingNote: 'This number will reset to the Days per year figure at the end of your company year.',
} as const

export function hasAnnualLeaveAllowance(enabled?: boolean | null): boolean {
  return enabled !== false
}

export function snapLeaveDays(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 2) / 2
}

function clampMonth(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const month = Math.trunc(n)
  if (month < 1 || month > 12) return fallback
  return month
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function parseDayKey(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

export type LeaveYearBounds = {
  startDayKey: string
  endDayKey: string
  yearKey: string
}

/**
 * Rulebook 1.12.0 §4.4: a leave year is always 12 months, so its end month is the month before its start month
 * (January → December, April → March). The end month is never chosen on its own.
 */
export function leaveYearEndMonth(startMonth: number | null | undefined): number {
  const start = clampMonth(startMonth, 1)
  return start === 1 ? 12 : start - 1
}

/**
 * Rulebook 1.13.0 §4.4: the inverse of `leaveYearEndMonth` — the month a 12-month leave year starts when it ends in
 * `endMonth` (December → January, March → April). Pickers that let the person choose the end month move the start
 * month with this; no app computes it itself.
 */
export function leaveYearStartMonth(endMonth: number | null | undefined): number {
  const end = clampMonth(endMonth, 12)
  return end === 12 ? 1 : end + 1
}

export const LEAVE_YEAR_MONTHS_MESSAGE = 'The leave year must be 12 months: it ends the month before it starts.'

/**
 * Save check for a leave year (`annualLeaveDefaults` on the organisation, or a person's
 * `annualLeaveYearStartMonth` / `annualLeaveYearEndMonth`): null when valid, else the message. Both months must be
 * whole months 1–12 and the end must be `leaveYearEndMonth(start)`. Both apps refuse the save otherwise.
 */
export function validateLeaveYearMonths(startMonth: unknown, endMonth: unknown): string | null {
  const start = Number(startMonth)
  const end = Number(endMonth)
  const month = (n: number) => Number.isInteger(n) && n >= 1 && n <= 12
  if (!month(start) || !month(end)) return 'Choose the months the leave year starts and ends.'
  return end === leaveYearEndMonth(start) ? null : LEAVE_YEAR_MONTHS_MESSAGE
}

/** `validateLeaveYearMonths` for an organisation `annualLeaveDefaults` save (days per year are checked by the app). */
export function validateAnnualLeaveDefaults(defaults: { startMonth?: unknown; endMonth?: unknown } | null | undefined): string | null {
  return validateLeaveYearMonths(defaults?.startMonth, defaults?.endMonth)
}

/**
 * Inclusive leave year that contains `onDayKey`. Months can wrap (April → March). 1.12.0: the year always runs 12
 * months from `startMonth` (`leaveYearEndMonth`); a stored `endMonth` that disagrees (saved before the check) is
 * ignored, so no leave falls outside every year and no year runs 13 months.
 */
export function leaveYearBounds(input: {
  startMonth?: number | null
  endMonth?: number | null
  onDayKey: string
}): LeaveYearBounds {
  const parsed = parseDayKey(input.onDayKey)
  const startMonth = clampMonth(input.startMonth, 1)
  const endMonth = leaveYearEndMonth(startMonth)
  if (!parsed) {
    const startDayKey = `1970-${pad2(startMonth)}-01`
    const endDay = lastDayOfMonth(endMonth <= startMonth ? 1971 : 1970, endMonth)
    const endDayKey = `${endMonth <= startMonth ? 1971 : 1970}-${pad2(endMonth)}-${pad2(endDay)}`
    return { startDayKey, endDayKey, yearKey: startDayKey }
  }
  let year = parsed.year
  if (parsed.month < startMonth) year -= 1
  const startDayKey = `${year}-${pad2(startMonth)}-01`
  const endYear = endMonth <= startMonth ? year + 1 : year
  const endDay = lastDayOfMonth(endYear, endMonth)
  const endDayKey = `${endYear}-${pad2(endMonth)}-${pad2(endDay)}`
  return { startDayKey, endDayKey, yearKey: startDayKey }
}

function leaveUnits(slot?: string | null): number {
  const raw = String(slot || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
  if (raw === 'AM' || raw === 'PM') return 0.5
  return 1
}

export type LeaveDayRecord = {
  startDayKey: string
  endDayKey?: string
  timeSlot?: string | null
  status?: string | null
}

/**
 * Days a record takes inside one leave year. A multi-day record (one document per request)
 * counts its working days only (`leaveRecordDayKeys`) and each day falls in its own leave year.
 */
function bookingsInYear(
  bookings: LeaveDayRecord[],
  startDayKey: string,
  endDayKey: string,
  status: 'approved' | 'pending',
  timeZone: string,
  nonWorkingDayKeys: ReadonlyArray<string>,
  counts?: (dayKey: string) => boolean
): number {
  let total = 0
  for (const booking of bookings) {
    const raw = String(booking.status || 'approved').toLowerCase()
    if (raw !== status) continue
    const start = String(booking.startDayKey || '').trim()
    if (!parseDayKey(start)) continue
    const days = leaveRecordDayKeys(
      { startDayKey: start, endDayKey: String(booking.endDayKey || start).trim() || start },
      timeZone,
      nonWorkingDayKeys
    ).filter((key) => key >= startDayKey && key <= endDayKey && (!counts || counts(key))).length
    total += days * leaveUnits(booking.timeSlot)
  }
  return snapLeaveDays(total)
}

export type AnnualLeaveBalanceInput = {
  annualLeaveEnabled?: boolean | null
  daysPerYear?: number | null
  startMonth?: number | null
  endMonth?: number | null
  orgDaysPerYear?: number | null
  orgStartMonth?: number | null
  orgEndMonth?: number | null
  carriesOver?: boolean | null
  yearAllowance?: number | null
  yearAllowanceKey?: string | null
  bookings?: LeaveDayRecord[] | null
  onDayKey: string
  timeZone?: string | null
  /** Bank holidays inside a multi-day record do not come out of the allowance. */
  nonWorkingDayKeys?: ReadonlyArray<string> | null
  /**
   * 1.13.0 (Q4): the person's start date (`users/{uid}.employmentStartDate`, an organisation-zone day key; never the
   * account's `createdAt`).
   * The leave year they joined in is pro rata from it (`proRataLeaveAllowance`); a year that ended before it gives
   * nothing to carry over. Missing = a full allowance every year (as before).
   */
  employmentStartDayKey?: string | null
  /** 1.13.0 (Q4): the organisation `annualLeaveDefaults.maxCarryOverDays`. Null or missing = no cap. */
  maxCarryOverDays?: number | null
  /**
   * 1.40.0 (§4.4, owner decisions 11 Nov G25–G27): the person's employment type fields (`employmentType`,
   * `employmentTypeTransitionFrom`, `employmentTypeEffectiveAt`). When given, the allowance applies only on days the
   * person is PAYE (`employmentTypeOnDay`): self-employed today → no allowance (days taken only); a PAYE part of a
   * year is pro rata to its days; only leave on PAYE days comes out of it; no carry-over out of a self-employed year.
   * Missing (older callers) = every day counts, as before 1.40.0.
   */
  employment?: EmploymentTypeUser | null
  /**
   * 1.40.0 (§4.4, owner decisions 11 Nov H28–H35): manual adjustments (`annualLeaveAdjustments`, read with
   * `parseAnnualLeaveAdjustmentDocument`). Those whose `yearKey` is this leave year's are added on top of the allowance
   * (after pro rata and carry-over), only while the person has an allowance; never carried over.
   */
  adjustments?: ReadonlyArray<{ days?: unknown; yearKey?: unknown }> | null
}

export type AnnualLeaveBalance = {
  hasAllowance: boolean
  startDayKey: string
  endDayKey: string
  yearKey: string
  taken: number
  pending: number
  usedThisYear: number
  daysPerYear: number
  /** 1.13.0: this leave year's allowance before carry-over — `daysPerYear`, or the pro-rata figure in the year joined. */
  yearEntitlement: number
  /** 1.13.0: true when `yearEntitlement` is pro rata from the start date. */
  proRata: boolean
  carriedForward: number
  yearAllowance: number | null
  /** 1.40.0: approved leave that came out of the allowance this year (leave on PAYE days only; `taken` otherwise). */
  allowanceTaken: number
  /** 1.40.0: pending leave that comes out of the allowance this year (on PAYE days only; `pending` otherwise). */
  allowancePending: number
  /** 1.40.0: this year's manual adjustments added to the allowance (0 while there is no allowance). */
  adjustmentDays: number
  /**
   * 1.40.0: the allowance before adjustments and leave — the override, else `yearEntitlement` + `carriedForward`.
   * 0 with no allowance.
   */
  allowanceBeforeAdjustments: number
  /** May be below 0 (owner decision 11 Nov: an adjustment or an overrun can take it below zero). */
  remaining: number | null
  /**
   * 1.40.0: the "taken" figure a screen shows — `allowanceTaken` with an allowance, else `taken` (days taken only).
   * Screens show these sums; they never subtract themselves.
   */
  shownTaken: number
  /** 1.40.0: the "awaiting approval" figure a screen shows — `allowancePending` with an allowance, else `pending`. */
  shownPending: number
  /** 1.40.0: approved leave this year that does not come out of the allowance (days not PAYE); 0 with no allowance. */
  notCountedTaken: number
  /** 1.40.0: pending leave this year that will not come out of the allowance; 0 with no allowance. */
  notCountedPending: number
}

function dayNumber(dayKey: string): number | null {
  const parsed = parseDayKey(dayKey)
  if (!parsed) return null
  return Math.round(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86_400_000)
}

/**
 * Rulebook 1.13.0 §4.4 (owner decisions round 4, Q4): the allowance for one leave year of someone who started on
 * `employmentStartDayKey`. Started on or before the year's first day (or no start date): the full `daysPerYear`.
 * Started inside the year: `daysPerYear` × the calendar days from the start date to the year's last day (both
 * included) ÷ the days in that year, rounded up to the next half day. Started after the year: 0.
 */
export function proRataLeaveAllowance(input: {
  daysPerYear: number
  year: { startDayKey: string; endDayKey: string }
  employmentStartDayKey?: string | null
}): { allowance: number; proRata: boolean } {
  const full = snapLeaveDays(input.daysPerYear)
  const joined = dayNumber(String(input.employmentStartDayKey || '').trim())
  const first = dayNumber(input.year.startDayKey)
  const last = dayNumber(input.year.endDayKey)
  if (joined == null || first == null || last == null || joined <= first) return { allowance: full, proRata: false }
  if (joined > last) return { allowance: 0, proRata: true }
  const fraction = (last - joined + 1) / (last - first + 1)
  return { allowance: Math.min(full, Math.ceil(full * fraction * 2 - 1e-9) / 2), proRata: true }
}

/**
 * 1.40.0: the allowance for the part of one leave year from `fromDayKey` to `toDayKey` (both included; missing = the
 * year's own ends) — `daysPerYear` × the window's calendar days ÷ the year's, rounded up to the next half day; the
 * whole year gives the full figure, an empty window 0. `proRataLeaveAllowance` is this from the start date to the year end.
 */
export function leaveAllowanceForWindow(input: {
  daysPerYear: number
  year: { startDayKey: string; endDayKey: string }
  fromDayKey?: string | null
  toDayKey?: string | null
}): { allowance: number; proRata: boolean } {
  const full = snapLeaveDays(input.daysPerYear)
  const first = dayNumber(input.year.startDayKey)
  const last = dayNumber(input.year.endDayKey)
  if (first == null || last == null) return { allowance: full, proRata: false }
  const from = Math.max(first, dayNumber(String(input.fromDayKey || '').trim()) ?? first)
  const to = Math.min(last, dayNumber(String(input.toDayKey || '').trim()) ?? last)
  if (from <= first && to >= last) return { allowance: full, proRata: false }
  if (to < from) return { allowance: 0, proRata: true }
  const fraction = (to - from + 1) / (last - first + 1)
  return { allowance: Math.min(full, Math.ceil(full * fraction * 2 - 1e-9) / 2), proRata: true }
}

function keyFromDayNumber(n: number): string {
  const date = new Date(n * 86_400_000)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

/**
 * 1.40.0: the days of a leave year on which the person is PAYE (`employmentTypeOnDay`, effective-dated), as one
 * from–to window (one stored transition gives one contiguous PAYE part), or null when they are PAYE on none.
 * Worked out from the stored change (`employmentTypeTransition`), never day by day: with no change the whole year is
 * one type.
 */
function payeWindow(
  employment: EmploymentTypeUser,
  year: { startDayKey: string; endDayKey: string },
  timeZone: string
): { fromDayKey: string; toDayKey: string } | null {
  if (!parseDayKey(year.startDayKey) || !parseDayKey(year.endDayKey)) return null
  const change = employmentTypeTransition(employment, timeZone)
  if (!change) {
    return normalizeEmploymentType(employment.employmentType) === 'paye'
      ? { fromDayKey: year.startDayKey, toDayKey: year.endDayKey }
      : null
  }
  const pieces: Array<{ fromDayKey: string; toDayKey: string }> = []
  const eff = change.effectiveDayKey
  // Before the change (days < eff): the earlier type.
  if (change.before === 'paye' && eff > year.startDayKey) {
    const dayBefore = addDaysInZone(dateFromDayKeyInZone(eff, timeZone), -1, timeZone)
    const lastBefore = dayKeyInZone(dayBefore, timeZone)
    pieces.push({ fromDayKey: year.startDayKey, toDayKey: lastBefore < year.endDayKey ? lastBefore : year.endDayKey })
  }
  // From the change (days >= eff): the current type.
  if (change.after === 'paye' && eff <= year.endDayKey) {
    pieces.push({ fromDayKey: eff > year.startDayKey ? eff : year.startDayKey, toDayKey: year.endDayKey })
  }
  if (!pieces.length) return null
  return { fromDayKey: pieces[0].fromDayKey, toDayKey: pieces[pieces.length - 1].toDayKey }
}

function laterDayKey(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = String(a || '').trim()
  const right = String(b || '').trim()
  if (!left) return right || null
  if (!right) return left
  return left > right ? left : right
}

/** 1.40.0: sum of the adjustments whose `yearKey` is `yearKey`, snapped to half days. */
export function annualLeaveAdjustmentDaysForYear(
  adjustments: ReadonlyArray<{ days?: unknown; yearKey?: unknown }> | null | undefined,
  yearKey: string
): number {
  const key = String(yearKey || '').trim()
  if (!key) return 0
  let total = 0
  for (const row of adjustments || []) {
    if (!row || String(row.yearKey ?? '').trim() !== key) continue
    const days = Number(row.days)
    if (Number.isFinite(days)) total += days
  }
  return snapLeaveDays(total)
}

function resolveDaysPerYear(userDays: unknown, orgDays: unknown): number {
  const user = Number(userDays)
  if (Number.isFinite(user) && user >= 0) return snapLeaveDays(user)
  const org = Number(orgDays)
  if (Number.isFinite(org) && org >= 0) return snapLeaveDays(org)
  return DEFAULT_ANNUAL_LEAVE_DAYS
}

function previousYearEndKey(startDayKey: string, timeZone: string): string {
  const start = dateFromDayKeyInZone(startDayKey, timeZone)
  return dayKeyInZone(addDaysInZone(start, -1, timeZone), timeZone)
}

/**
 * Remaining / taken for the leave year that contains `onDayKey`.
 * No allowance → `remaining` is null; `usedThisYear` is the running count.
 * An override whose key matches this year replaces days-per-year + carry.
 */
/** The leave-year months `annualLeaveBalance` uses: the person's own with an allowance, else the organisation's. */
function balanceYearMonths(input: AnnualLeaveYearInput): { startMonth: number; endMonth: number } {
  const hasAllowance = balanceHasAllowance(input)
  const orgStart = clampMonth(input.orgStartMonth, 1)
  const orgEnd = clampMonth(input.orgEndMonth, 12)
  return {
    startMonth: hasAllowance ? clampMonth(input.startMonth, orgStart) : orgStart,
    endMonth: hasAllowance ? clampMonth(input.endMonth, orgEnd) : orgEnd,
  }
}

/** The fields of `AnnualLeaveBalanceInput` that decide which leave year a day is in. */
export type AnnualLeaveYearInput = Pick<
  AnnualLeaveBalanceInput,
  'annualLeaveEnabled' | 'startMonth' | 'endMonth' | 'orgStartMonth' | 'orgEndMonth' | 'onDayKey' | 'timeZone' | 'employment'
>

/**
 * 1.40.0: whether the person has an allowance on `onDayKey` — `annualLeaveEnabled` not false and, when `employment` is
 * given, PAYE that day (`employmentTypeOnDay`). Self-employed (ghosts included) → no allowance: days taken only.
 */
export function balanceHasAllowance(input: AnnualLeaveYearInput): boolean {
  if (!hasAnnualLeaveAllowance(input.annualLeaveEnabled)) return false
  if (!input.employment) return true
  const timeZone = zoneOrLondon(input.timeZone)
  const day = parseDayKey(input.onDayKey) ? dateFromDayKeyInZone(input.onDayKey, timeZone) : new Date(NaN)
  if (Number.isNaN(day.getTime())) return true
  return employmentTypeOnDay(input.employment, day, timeZone) === 'paye'
}

export type AnnualLeaveBankHolidayRange = {
  /** The first day of the previous leave year (carry-over counts the leave taken in it). */
  startDayKey: string
  /** The last day of the leave year containing `onDayKey`. */
  endDayKey: string
  /** Every calendar year from `startDayKey` to `endDayKey`, oldest first — the years to load bank holidays for. */
  years: number[]
}

/**
 * Rulebook 1.35.0 §4.4: the days whose bank holidays `annualLeaveBalance` needs for the leave year containing
 * `onDayKey` — from the first day of the PREVIOUS leave year (carry-over counts the leave taken in it, and a bank
 * holiday inside a multi-day record is not leave there either) to the last day of the current one. Every screen that
 * shows a balance loads bank holidays for `years` before it calls `annualLeaveBalance`, so the same person reads the
 * same figure on My Profile, Annual leave and Edit User on every platform. Pass the balance's own input.
 */
export function annualLeaveBankHolidayRange(input: AnnualLeaveYearInput): AnnualLeaveBankHolidayRange {
  const timeZone = zoneOrLondon(input.timeZone)
  const { startMonth, endMonth } = balanceYearMonths(input)
  const year = leaveYearBounds({ startMonth, endMonth, onDayKey: input.onDayKey })
  const previous = leaveYearBounds({ startMonth, endMonth, onDayKey: previousYearEndKey(year.startDayKey, timeZone) })
  const first = Number(previous.startDayKey.slice(0, 4))
  const last = Number(year.endDayKey.slice(0, 4))
  const years: number[] = []
  for (let value = first; Number.isFinite(value) && value <= last; value += 1) years.push(value)
  return { startDayKey: previous.startDayKey, endDayKey: year.endDayKey, years }
}

export function annualLeaveBalance(input: AnnualLeaveBalanceInput): AnnualLeaveBalance {
  const hasAllowance = balanceHasAllowance(input)
  const timeZone = zoneOrLondon(input.timeZone)
  const { startMonth, endMonth } = balanceYearMonths(input)
  const year = leaveYearBounds({ startMonth, endMonth, onDayKey: input.onDayKey })
  const bookings = input.bookings ?? []
  const nonWorking = input.nonWorkingDayKeys ?? []
  const taken = bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'approved', timeZone, nonWorking)
  const pending = bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'pending', timeZone, nonWorking)
  const daysPerYear = hasAllowance
    ? resolveDaysPerYear(input.daysPerYear, input.orgDaysPerYear)
    : 0
  const employment = input.employment ?? null

  // 1.40.0: the PAYE part of a year (the whole year without `employment`) and whether a day is in it.
  const paidWindow = (bounds: { startDayKey: string; endDayKey: string }) =>
    employment ? payeWindow(employment, bounds, timeZone) : { fromDayKey: bounds.startDayKey, toDayKey: bounds.endDayKey }
  const allowanceIn = (bounds: { startDayKey: string; endDayKey: string }) => {
    const window = paidWindow(bounds)
    if (!window) return { allowance: 0, proRata: true, window }
    const from = laterDayKey(window.fromDayKey, input.employmentStartDayKey)
    return { ...leaveAllowanceForWindow({ daysPerYear, year: bounds, fromDayKey: from, toDayKey: window.toDayKey }), window }
  }
  const inWindow = (window: { fromDayKey: string; toDayKey: string } | null) => (dayKey: string) =>
    Boolean(window) && dayKey >= window!.fromDayKey && dayKey <= window!.toDayKey

  const overrideKey = String(input.yearAllowanceKey || '').trim()
  const overrideApplies =
    hasAllowance &&
    overrideKey !== '' &&
    overrideKey === year.yearKey &&
    Number.isFinite(Number(input.yearAllowance))

  const current = hasAllowance ? allowanceIn(year) : { allowance: 0, proRata: false, window: null }
  const entitlement = { allowance: current.allowance, proRata: current.proRata }
  const counts = employment && hasAllowance ? inWindow(current.window) : undefined
  const allowanceTaken = counts
    ? bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'approved', timeZone, nonWorking, counts)
    : taken
  const allowancePending = counts
    ? bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'pending', timeZone, nonWorking, counts)
    : pending

  let carriedForward = 0
  if (hasAllowance && input.carriesOver === true && !overrideApplies && daysPerYear > 0) {
    const prevOn = previousYearEndKey(year.startDayKey, timeZone)
    const previous = leaveYearBounds({ startMonth, endMonth, onDayKey: prevOn })
    // 1.13.0: the previous year's own allowance (pro rata in the year joined, nothing before it), then the cap.
    // 1.40.0: only its PAYE part (nothing out of a self-employed year), less the leave taken on its PAYE days;
    // adjustments are never carried over.
    const prior = allowanceIn(previous)
    const prevTaken = bookingsInYear(
      bookings,
      previous.startDayKey,
      previous.endDayKey,
      'approved',
      timeZone,
      nonWorking,
      employment ? inWindow(prior.window) : undefined
    )
    carriedForward = prior.window ? Math.max(0, snapLeaveDays(prior.allowance - prevTaken)) : 0
    const cap = input.maxCarryOverDays
    if (cap != null && Number.isFinite(Number(cap)) && Number(cap) >= 0) {
      carriedForward = Math.min(carriedForward, snapLeaveDays(Number(cap)))
    }
  }

  const yearAllowance = overrideApplies ? snapLeaveDays(input.yearAllowance) : null
  const allowanceBeforeAdjustments = hasAllowance
    ? snapLeaveDays(yearAllowance != null ? yearAllowance : entitlement.allowance + carriedForward)
    : 0
  const adjustmentDays = hasAllowance ? annualLeaveAdjustmentDaysForYear(input.adjustments, year.yearKey) : 0
  const pot = allowanceBeforeAdjustments + adjustmentDays
  const remaining = hasAllowance ? snapLeaveDays(pot - allowanceTaken - allowancePending) : null

  return {
    hasAllowance,
    startDayKey: year.startDayKey,
    endDayKey: year.endDayKey,
    yearKey: year.yearKey,
    taken,
    pending,
    usedThisYear: taken,
    daysPerYear,
    yearEntitlement: entitlement.allowance,
    proRata: entitlement.proRata,
    carriedForward,
    yearAllowance,
    allowanceTaken,
    allowancePending,
    adjustmentDays,
    allowanceBeforeAdjustments,
    remaining,
    shownTaken: hasAllowance ? allowanceTaken : taken,
    shownPending: hasAllowance ? allowancePending : pending,
    notCountedTaken: hasAllowance ? Math.max(0, snapLeaveDays(taken - allowanceTaken)) : 0,
    notCountedPending: hasAllowance ? Math.max(0, snapLeaveDays(pending - allowancePending)) : 0,
  }
}

export type RemainingOverrideWrite = {
  annualLeaveYearAllowance: number
  annualLeaveYearAllowanceKey: string
}

/**
 * Persist a remaining figure for this leave year.
 * Stored pot = remaining + already taken + pending, so later bookings
 * reduce remaining without rewriting the document.
 */
export function applyRemainingOverride(input: {
  remaining: number
  taken?: number | null
  pending?: number | null
  yearKey: string
}): RemainingOverrideWrite {
  const remaining = snapLeaveDays(input.remaining)
  const taken = snapLeaveDays(input.taken)
  const pending = snapLeaveDays(input.pending)
  return {
    annualLeaveYearAllowance: snapLeaveDays(remaining + taken + pending),
    annualLeaveYearAllowanceKey: String(input.yearKey || '').trim(),
  }
}

/**
 * 1.40.0 (§4.4, review r306 #2): the employment-type input of `annualLeaveBalance` for one person, read from the same
 * pay record every other screen uses (`payEditorStartingValues`): the person's `users` / `operatives` document while
 * `privatePay` is off; while it is on, that document with its pay profile laid over (`payProfiles/{id}`, the person's
 * id, else a former id), because the employment type is pay data (`PAY_PROFILE_FIELDS`) and a stripped users document
 * no longer holds it.
 *
 * `payProfileRead` false (privatePay on and the pay profile could not be read — refused, offline, not loaded) gives
 * null: the balance then counts the whole year as before 1.40.0 (no employment filter) rather than reading a stripped
 * document as self-employed with no allowance. `payProfile` null with `payProfileRead` true means none is stored: the
 * person's document is the record.
 */
export function annualLeaveEmploymentInput(input: {
  person: Record<string, unknown> | null | undefined
  payProfile?: { fields: Record<string, unknown> } | null
  privatePay: boolean
  payProfileRead: boolean
}): EmploymentTypeUser | null {
  const person = input.person ?? {}
  let record: Record<string, unknown> = person
  if (input.privatePay) {
    if (!input.payProfileRead) return null
    if (input.payProfile) record = { ...person, ...input.payProfile.fields }
  }
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)
  const at = record.employmentTypeEffectiveAt
  return {
    employmentType: str(record.employmentType),
    employmentTypeTransitionFrom: str(record.employmentTypeTransitionFrom),
    employmentTypeEffectiveAt:
      at instanceof Date || typeof at === 'string' || typeof at === 'number' ? (at as Date | string | number) : documentInstant(at),
  }
}

function documentInstant(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { toMillis?: () => number; seconds?: unknown; _seconds?: unknown }
  if (typeof v.toMillis === 'function') {
    const ms = v.toMillis()
    return Number.isFinite(ms) ? ms : null
  }
  const seconds = Number(v.seconds ?? v._seconds)
  return Number.isFinite(seconds) ? seconds * 1000 : null
}

export type AnnualLeaveBalanceNotes = {
  /** Shown when the allowance this year is pro rata. */
  proRata: string | null
  /** Shown when some leave this year does not come out of the allowance. */
  notCounted: string | null
  /** Shown instead of a remaining figure when there is no allowance. */
  noAllowance: string | null
}

function leaveCount(days: number): string {
  const n = snapLeaveDays(days)
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/**
 * 1.40.0 (§4.4, review r306 #2): the notes under a balance. They name the employment type only when the viewer may see
 * the person's pay (`showsEmploymentType` = `canViewPersonPay(viewer, person, roster)`: the person, admins, an
 * Operatives manager for an operative). Anyone else — a line manager who is neither — sees the same figures with
 * neutral wording, because the employment type is pay data (§8).
 */
export function annualLeaveBalanceNotes(
  balance: Pick<AnnualLeaveBalance, 'hasAllowance' | 'proRata' | 'notCountedTaken'>,
  options: { showsEmploymentType: boolean }
): AnnualLeaveBalanceNotes {
  const named = options.showsEmploymentType
  if (!balance.hasAllowance) {
    return {
      proRata: null,
      notCounted: null,
      noAllowance: named
        ? 'No paid allowance: self-employed, or the allowance is switched off. The count resets at the end of the company leave year.'
        : 'No paid allowance this leave year. The count resets at the end of the company leave year.',
    }
  }
  const notCounted = balance.notCountedTaken > 0
    ? named
      ? `${leaveCount(balance.notCountedTaken)} taken while self-employed ${balance.notCountedTaken === 1 ? 'does' : 'do'} not come out of the allowance.`
      : `${leaveCount(balance.notCountedTaken)} taken this leave year ${balance.notCountedTaken === 1 ? 'does' : 'do'} not come out of the allowance.`
    : null
  return {
    proRata: balance.proRata
      ? named
        ? 'Pro rata: the allowance counts only from the start date or the day PAYE began.'
        : 'Pro rata: the allowance counts only from part of this leave year.'
      : null,
    notCounted,
    noAllowance: null,
  }
}
