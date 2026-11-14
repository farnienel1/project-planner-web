import { formatMoney, parseMultipliedHoursText, payrollMultipliedHours, reportDayValue, resolveBookingPerson, rosterAliasIdsFor, weekdayPaidHours } from '@/lib/canonical'
import { currentOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import type { Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { STAFF_TRADE_PRESETS } from '@/lib/staff/staffTradeTypes'
import { employmentTypeOnDay } from '@/lib/ios-parity/employmentType'
import { bookingHoursOnDay } from '@/lib/timesheets/timesheetHours'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { payForHours, resolvePayrollRate } from '@/lib/timesheets/payrollRateResolver'
import { orgDayHours, payLineDisplay, quantityText, roundPennies, type PayBasis } from '@/lib/timesheets/payBasis'
import { normalizeDocumentId } from '@/lib/canonical'

/** Day units for a staff booking (`reportDayValue` of `payrollHoursResult`), as on iOS. */
export function bookingDayUnits(
  timeSlot: string,
  workStartTime?: string,
  workEndTime?: string,
  payrollPolicy?: OrgPayrollTimePolicy,
  date?: Date,
  isBreakRemoved?: boolean,
  otMultiplierOverride?: number | null,
  timeZone?: string
): number {
  const policy = payrollPolicy || DEFAULT_PAYROLL_POLICY
  const hours = bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, policy, isBreakRemoved, otMultiplierOverride, timeZone)
  return reportDayValue({ totalPaidHours: hours.totalPaidHours, standardPaidHours: weekdayPaidHours(policy) })
}

function readableTrade(value?: string): string | undefined {
  const trimmed = value?.trim() || ''
  if (!trimmed || trimmed === '—' || trimmed === 'Other') return undefined
  if ((STAFF_TRADE_PRESETS as readonly string[]).includes(trimmed)) return trimmed
  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed)) return undefined
  return trimmed
}

export function resolvePersonTrade(user: User | undefined, operative: Operative | undefined): string {
  const named = [
    readableTrade(user?.tradeTypeCustom),
    readableTrade(user?.tradeTypePreset),
    readableTrade(operative?.tradeTypeCustom),
    readableTrade(operative?.tradeTypePreset),
  ].find(Boolean)
  if (named) return named
  for (const skill of operative?.skills || []) {
    const label = typeof skill === 'string' ? skill : skill && typeof skill === 'object' && 'name' in skill ? String(skill.name) : ''
    const trade = readableTrade(label)
    if (trade) return trade
  }
  return 'General'
}

function preferLinkedUser(matches: User[]): User | undefined {
  const finished = matches.filter((person) => person.passwordSet && person.isActive !== false)
  const pool = finished.length ? finished : matches.filter((person) => person.isActive !== false)
  const ranked = pool.length ? pool : matches
  return (
    ranked.find((person) => readableTrade(person.tradeTypeCustom) || readableTrade(person.tradeTypePreset)) ||
    ranked[0]
  )
}

export function resolvePersonRole(user: User | undefined, operative: Operative | undefined): string {
  if (!user) return operative ? 'Operative' : 'User'
  if (user.permissions.adminAccess || user.isSuperAdmin || user.permissions.manager) return 'Admin User'
  if (user.permissions.operativeMode || operative) return 'Operative'
  return 'User'
}

export function resolveDisplayName(
  user: User | undefined,
  operative: Operative | undefined,
  fallback = 'Unknown'
): string {
  if (user) {
    const name = `${user.firstName || ''} ${user.surname || ''}`.trim()
    if (name) return name
    return user.email || fallback
  }
  if (operative) {
    return `${operative.firstName || ''} ${operative.lastName || ''}`.trim() || operative.email || fallback
  }
  return fallback
}

export function findUserAndOperative(
  users: User[],
  operatives: Operative[],
  opts: {
    userId?: string
    operativeId?: string
    /** The roster's same-email profile map (web `userIdAliases`): other users document id → the id it kept. */
    aliases?: Readonly<Record<string, string>>
  }
): { user?: User; operative?: Operative } {
  const accounts = () =>
    users.map((entry) => ({
      id: entry.id,
      email: entry.email,
      formerIds: entry.formerUserIds ?? [],
      aliasIds: rosterAliasIdsFor(entry.id, opts.aliases),
    }))
  let user = opts.userId
    ? users.find((entry) => entry.id === opts.userId) ||
      // A manager booking saved under an invite id the account later replaced, or on the other same-email profile.
      users.find((entry) => (entry.formerUserIds ?? []).includes(opts.userId as string)) ||
      users.find((entry) => rosterAliasIdsFor(entry.id, opts.aliases).includes(opts.userId as string))
    : undefined
  let operative = opts.operativeId ? operatives.find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(opts.operativeId)) : undefined
  if (!user && operative?.email) {
    const email = operative.email.trim().toLowerCase()
    user = preferLinkedUser(users.filter((entry) => entry.email.trim().toLowerCase() === email))
  }
  if (!user && opts.operativeId) {
    // A booking stored under a users id, a former invite id or a same-email alias (web #189).
    const person = resolveBookingPerson(opts.operativeId, { accounts: accounts(), operatives })
    if (person.accountId) user = users.find((entry) => entry.id === person.accountId)
    if (!operative && person.operativeId) operative = operatives.find((entry) => normalizeDocumentId(entry.id) === normalizeDocumentId(person.operativeId))
  }
  if (!operative && user) operative = findOperativeForUser(user, operatives)
  return { user, operative }
}

export type PayLine = {
  rateType: string
  days: number
  rate: number
  pay: number
}

/** Kept for older callers. A person is on one basis. Hourly pay stays in hours. */
export function buildPayLinesForDays(
  totalDays: number,
  dayRate: number | undefined,
  hourlyRate: number | undefined,
  standardHours: number,
  _otMultiplier: number
): PayLine[] {
  const standard = orgDayHours(standardHours)
  if (!(dayRate != null && dayRate > 0) && hourlyRate != null && hourlyRate > 0) {
    const hours = totalDays * standard
    return [
      {
        rateType: 'Hourly',
        days: hours,
        rate: hourlyRate,
        pay: roundPennies(hourlyRate * hours),
      },
    ]
  }
  if (!(dayRate != null && dayRate > 0) || !(totalDays > 0)) return []
  return [
    {
      rateType: 'Day',
      days: totalDays,
      rate: dayRate,
      pay: roundPennies(dayRate * totalDays),
    },
  ]
}

/** Organisation money (`formatMoney`). The open company's currency unless a code is passed. */
export function formatCurrency(amount: number, currencyCode: string = currentOrganizationCurrency()): string {
  return formatMoney(amount, currencyCode)
}

export function formatDays(days: number): string {
  return days.toFixed(2)
}

export type LabourPaySlice = {
  payBasis: PayBasis
  isOvertime: boolean
  otMultiplier: number | null
  rate: number | null
  paidHours: number
  pay: number
  isPaye: boolean
  /**
   * Rulebook 1.19.0: the standard paid day in effect on the slice's day (`effectivePayrollTimePolicy`), so day units are
   * shown against that day's rules. Missing → the caller's standard day.
   */
  standardDayHours?: number
  /**
   * Rulebook 1.20.3 (display only): an overtime slice's clock hours at the multiplier and the unpaid break taken off
   * them as plain hours (`payrollMultipliedHours`). Set only when a break was taken off; summed when slices merge.
   */
  clockHours?: number
  breakHours?: number
}

export function labourPaySlices({
  date,
  timeSlot,
  workStartTime,
  workEndTime,
  isBreakRemoved,
  otMultiplierOverride,
  user,
  operative,
  history = emptyDayRateHistory(),
  aliasUserIds = [],
  operativeIds = [],
  payroll,
  timeZone,
}: {
  date: Date
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  otMultiplierOverride?: number | null
  user?: User
  operative?: Operative
  history?: OperativeDayRateHistoryCollection
  aliasUserIds?: string[]
  /** 1.36.0 (FU-5): every `operatives` row of the person (`personRateHistoryIds`), for their rate history. */
  operativeIds?: string[]
  payroll?: OrgPayrollTimePolicy
  timeZone?: string
}): LabourPaySlice[] {
  // `payroll` is the policy in effect on `date` (`orgPayrollPolicyForDay`); the caller resolves it per day.
  const policy = payroll || DEFAULT_PAYROLL_POLICY
  const standard = orgDayHours(weekdayPaidHours(policy))
  // `payrollHoursResult`: the same normal hours, overtime hours and multiplier iOS uses.
  const hours = bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, policy, isBreakRemoved, otMultiplierOverride, timeZone)
  const otHours = hours.outsideHours
  // Unrounded, as the timesheet collector pays them; `payForHours` rounds the pay once.
  const normalHours = Math.max(0, hours.standardHours)
  const otMultiplier = hours.outsideMultiplier
  const resolved = resolvePayrollRate({
    user,
    operative,
    day: date,
    history,
    timeZone,
    aliasUserIds,
    operativeIds,
  })
  const isPaye = Boolean(user && employmentTypeOnDay(user, date, timeZone) === 'paye')
  const basis: PayBasis = resolved.basis === 'hourly' ? 'hourly' : 'day'
  const rate = isPaye ? null : basis === 'hourly' ? resolved.hourlyRate : resolved.dayRate
  const slices: LabourPaySlice[] = []
  // 1.20.3: the overtime slice's clock hours and the break off them as plain hours (display only; pay unchanged).
  const multiplied = payrollMultipliedHours(hours)
  const push = (hours: number, overtime: boolean, multiplier: number) => {
    if (!(hours > 0)) return
    const pay = isPaye ? 0 : payForHours(
      isPaye ? { basis: resolved.basis, dayRate: null, hourlyRate: null } : resolved,
      hours,
      standard,
      overtime ? multiplier : 1
    )
    slices.push({
      payBasis: basis,
      isOvertime: overtime,
      otMultiplier: overtime ? multiplier : null,
      rate: isPaye || rate == null ? null : overtime ? roundPennies(rate * multiplier) : rate,
      paidHours: hours,
      pay,
      isPaye,
      standardDayHours: standard,
      ...(overtime && multiplied && multiplied.breakHours > 0
        ? { clockHours: multiplied.clockHours, breakHours: multiplied.breakHours }
        : {}),
    })
  }
  push(normalHours, false, 1)
  push(otHours, true, otMultiplier)
  return slices
}

/** `isPaye` is `employmentTypeOnDay` for the line's day; a PAYE line keeps its hours and shows no pay (`reportPayCell`). */
export function signedLabourSlice(line: {
  paidHours: number
  days: number
  amount: number
  isOvertime: boolean
  payBasis?: string | null
  otMultiplier?: number | null
  details?: string | null
}, standardHours: number, otMultiplier: number | null, isPaye = false): LabourPaySlice {
  const payBasis: PayBasis = line.payBasis === 'hourly' ? 'hourly' : 'day'
  // Rulebook 1.44.0 §8: a signed line is never re-priced, and neither is how it reads. A day-rate line shows its stored
  // days (`days`, worked out at signing on the paid day of that time) and the rate that gives its signed amount — its own
  // paid day is `paidHours / days`, never today's (`standardHours`). Today's day is used only for a line that stored no
  // days or hours (older data).
  const signedDay =
    payBasis === 'day' && Number(line.days) > 0.0001 && Number(line.paidHours) > 0 ? Number(line.paidHours) / Number(line.days) : null
  const standard = signedDay ?? orgDayHours(standardHours)
  const paidHours = line.paidHours > 0 ? line.paidHours : payBasis === 'day' ? line.days * standard : 0
  const quantity = payBasis === 'hourly' ? paidHours : paidHours / standard
  const rate = quantity > 0.0001 ? roundPennies(line.amount / quantity) : 0
  const storedMultiplier = line.otMultiplier != null ? line.otMultiplier : line.isOvertime ? otMultiplier : null
  const parsed = line.isOvertime ? parseMultipliedHoursText(line.details) : null
  const signedBreak = parsed && parsed.breakHours > 0 ? parsed : null
  return {
    payBasis,
    isOvertime: line.isOvertime,
    otMultiplier: line.isOvertime ? storedMultiplier : null,
    rate,
    paidHours,
    pay: isPaye ? 0 : roundPennies(line.amount),
    isPaye,
    standardDayHours: standard,
    // 1.20.3: a signed overtime line with a break keeps its clock hours and break for display (from its stored text).
    ...(line.isOvertime && signedBreak ? { clockHours: signedBreak.clockHours, breakHours: signedBreak.breakHours } : {}),
  }
}

export function paySliceDisplay(slice: LabourPaySlice, standardHours: number, currencyCode: string = currentOrganizationCurrency()) {
  if (slice.isPaye) {
    return {
      rateType: 'PAYE',
      quantityText: quantityText(slice.paidHours, 'hours'),
      rateText: '',
      pay: 0,
      days: slice.paidHours,
      rate: 0,
    }
  }
  const display = payLineDisplay({
    payBasis: slice.payBasis,
    paidHours: slice.paidHours,
    standardDayHours: slice.standardDayHours ?? standardHours,
    rate: slice.rate,
    pay: slice.pay,
    isOvertime: slice.isOvertime,
    otMultiplier: slice.otMultiplier,
    currencyCode,
    clockHours: slice.clockHours ?? null,
    breakHours: slice.breakHours ?? null,
  })
  // 1.20.3: with a break off hours at a multiplier the quantity is the hours that pay (clock × N − break) at the base
  // rate, so quantity × rate still equals the pay; no back-calculated base hours are shown.
  const multiplier = Number(slice.otMultiplier) > 0 ? Number(slice.otMultiplier) : 1
  const withBreak = slice.isOvertime && Number(slice.breakHours) > 0 && Number(slice.clockHours) > 0
  const hoursShown = withBreak ? Math.max(0, Number(slice.clockHours) * multiplier - Number(slice.breakHours)) : slice.paidHours
  return {
    rateType: display.rateType,
    quantityText: display.quantityText,
    rateText: display.rateText,
    pay: display.pay,
    days: slice.payBasis === 'hourly' ? hoursShown : hoursShown / orgDayHours(slice.standardDayHours ?? standardHours),
    rate: withBreak ? (slice.rate ?? 0) / multiplier : slice.rate ?? 0,
  }
}
