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
  nonWorkingDayKeys: ReadonlyArray<string>
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
    ).filter((key) => key >= startDayKey && key <= endDayKey).length
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
  remaining: number | null
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
export function annualLeaveBalance(input: AnnualLeaveBalanceInput): AnnualLeaveBalance {
  const hasAllowance = hasAnnualLeaveAllowance(input.annualLeaveEnabled)
  const timeZone = zoneOrLondon(input.timeZone)
  const orgStart = clampMonth(input.orgStartMonth, 1)
  const orgEnd = clampMonth(input.orgEndMonth, 12)
  const startMonth = hasAllowance ? clampMonth(input.startMonth, orgStart) : orgStart
  const endMonth = hasAllowance ? clampMonth(input.endMonth, orgEnd) : orgEnd
  const year = leaveYearBounds({ startMonth, endMonth, onDayKey: input.onDayKey })
  const bookings = input.bookings ?? []
  const nonWorking = input.nonWorkingDayKeys ?? []
  const taken = bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'approved', timeZone, nonWorking)
  const pending = bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'pending', timeZone, nonWorking)
  const daysPerYear = hasAllowance
    ? resolveDaysPerYear(input.daysPerYear, input.orgDaysPerYear)
    : 0

  const overrideKey = String(input.yearAllowanceKey || '').trim()
  const overrideApplies =
    hasAllowance &&
    overrideKey !== '' &&
    overrideKey === year.yearKey &&
    Number.isFinite(Number(input.yearAllowance))

  const entitlement = hasAllowance
    ? proRataLeaveAllowance({ daysPerYear, year, employmentStartDayKey: input.employmentStartDayKey })
    : { allowance: 0, proRata: false }

  let carriedForward = 0
  if (hasAllowance && input.carriesOver === true && !overrideApplies && daysPerYear > 0) {
    const prevOn = previousYearEndKey(year.startDayKey, timeZone)
    const previous = leaveYearBounds({ startMonth, endMonth, onDayKey: prevOn })
    const prevTaken = bookingsInYear(
      bookings,
      previous.startDayKey,
      previous.endDayKey,
      'approved',
      timeZone,
      nonWorking
    )
    // 1.13.0: the previous year's own allowance (pro rata in the year joined, nothing before it), then the cap.
    const prevAllowance = proRataLeaveAllowance({
      daysPerYear,
      year: previous,
      employmentStartDayKey: input.employmentStartDayKey,
    }).allowance
    carriedForward = Math.max(0, snapLeaveDays(prevAllowance - prevTaken))
    const cap = input.maxCarryOverDays
    if (cap != null && Number.isFinite(Number(cap)) && Number(cap) >= 0) {
      carriedForward = Math.min(carriedForward, snapLeaveDays(Number(cap)))
    }
  }

  const yearAllowance = overrideApplies ? snapLeaveDays(input.yearAllowance) : null
  const pot = yearAllowance != null ? yearAllowance : entitlement.allowance + carriedForward
  const remaining = hasAllowance ? snapLeaveDays(pot - taken - pending) : null

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
    remaining,
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
