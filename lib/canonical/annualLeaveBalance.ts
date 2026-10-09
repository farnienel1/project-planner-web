/**
 * Shared annual-leave allowance vs count, the company leave year, and
 * a one-year remaining override. Screens stay in each app.
 *
 * `annualLeaveEnabled === false` means no paid allowance — not “no holiday”.
 * The Holiday tab stays available. That person sees days taken in the
 * company leave year. The count resets on the first day of the next year.
 */

import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime'
import { eachDayKey, zoneOrLondon } from './dayKeys'

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

/** Inclusive leave year that contains `onDayKey`. Months can wrap (April → March). */
export function leaveYearBounds(input: {
  startMonth?: number | null
  endMonth?: number | null
  onDayKey: string
}): LeaveYearBounds {
  const parsed = parseDayKey(input.onDayKey)
  const startMonth = clampMonth(input.startMonth, 1)
  const endMonth = clampMonth(input.endMonth, 12)
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

function bookingDays(startDayKey: string, endDayKey: string, timeZone: string): number {
  const keys = eachDayKey(startDayKey, endDayKey || startDayKey, timeZone)
  return keys.length
}

export type LeaveDayRecord = {
  startDayKey: string
  endDayKey?: string
  timeSlot?: string | null
  status?: string | null
}

function bookingCount(booking: LeaveDayRecord, timeZone: string): number {
  const start = String(booking.startDayKey || '').trim()
  if (!parseDayKey(start)) return 0
  const end = String(booking.endDayKey || start).trim() || start
  return snapLeaveDays(bookingDays(start, end, timeZone) * leaveUnits(booking.timeSlot))
}

function bookingsInYear(
  bookings: LeaveDayRecord[],
  startDayKey: string,
  endDayKey: string,
  status: 'approved' | 'pending',
  timeZone: string
): number {
  let total = 0
  for (const booking of bookings) {
    const raw = String(booking.status || 'approved').toLowerCase()
    if (raw !== status) continue
    const start = String(booking.startDayKey || '').trim()
    if (start < startDayKey || start > endDayKey) continue
    total += bookingCount(booking, timeZone)
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
  carriedForward: number
  yearAllowance: number | null
  remaining: number | null
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
  const taken = bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'approved', timeZone)
  const pending = bookingsInYear(bookings, year.startDayKey, year.endDayKey, 'pending', timeZone)
  const daysPerYear = hasAllowance
    ? resolveDaysPerYear(input.daysPerYear, input.orgDaysPerYear)
    : 0

  const overrideKey = String(input.yearAllowanceKey || '').trim()
  const overrideApplies =
    hasAllowance &&
    overrideKey !== '' &&
    overrideKey === year.yearKey &&
    Number.isFinite(Number(input.yearAllowance))

  let carriedForward = 0
  if (hasAllowance && input.carriesOver === true && !overrideApplies && daysPerYear > 0) {
    const prevOn = previousYearEndKey(year.startDayKey, timeZone)
    const previous = leaveYearBounds({ startMonth, endMonth, onDayKey: prevOn })
    const prevTaken = bookingsInYear(
      bookings,
      previous.startDayKey,
      previous.endDayKey,
      'approved',
      timeZone
    )
    carriedForward = Math.max(0, snapLeaveDays(daysPerYear - prevTaken))
  }

  const yearAllowance = overrideApplies ? snapLeaveDays(input.yearAllowance) : null
  const pot = yearAllowance != null ? yearAllowance : daysPerYear + carriedForward
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
