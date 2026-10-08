import { getISODay } from 'date-fns'
import { hoursFromSlot } from '@/lib/timesheets/timesheetWeekUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import type { Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { STAFF_TRADE_PRESETS } from '@/lib/staff/staffTradeTypes'
import { employmentTypeOnDay } from '@/lib/ios-parity/employmentType'
import { overtimeHoursBeyondPaidStandard, paidBookedHours, weekdayOtMultiplier } from '@/lib/timesheets/timesheetHours'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { payForHours, resolvePayrollRate } from '@/lib/timesheets/payrollRateResolver'
import { orgDayHours, payLineDisplay, quantityText, roundPennies, type PayBasis } from '@/lib/timesheets/payBasis'

export function bookingDayUnits(
  timeSlot: string,
  workStartTime?: string,
  workEndTime?: string,
  payrollPolicy?: OrgPayrollTimePolicy
): number {
  const normalized = (timeSlot || '').toUpperCase()
  const standardHours = payrollPolicy?.standardPaidHours ?? 8
  if (normalized === 'AM' || normalized === 'PM') return 0.5
  if (normalized.includes('FULL')) return 1
  const hours = hoursFromSlot(timeSlot, workStartTime, workEndTime, payrollPolicy)
  return Math.round((hours / standardHours) * 100) / 100
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
  opts: { userId?: string; operativeId?: string }
): { user?: User; operative?: Operative } {
  let user = opts.userId ? users.find((entry) => entry.id === opts.userId) : undefined
  let operative = opts.operativeId ? operatives.find((entry) => entry.id === opts.operativeId) : undefined
  if (!user && operative?.email) {
    const email = operative.email.trim().toLowerCase()
    user = preferLinkedUser(users.filter((entry) => entry.email.trim().toLowerCase() === email))
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

export function isWeekendDay(date: Date): boolean {
  const iso = getISODay(date)
  return iso === 6 || iso === 7
}

export function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`
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
}

export function labourPaySlices({
  date,
  timeSlot,
  workStartTime,
  workEndTime,
  isBreakRemoved,
  user,
  operative,
  history = emptyDayRateHistory(),
  aliasUserIds = [],
  payroll,
  timeZone,
}: {
  date: Date
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  user?: User
  operative?: Operative
  history?: OperativeDayRateHistoryCollection
  aliasUserIds?: string[]
  payroll?: OrgPayrollTimePolicy
  timeZone?: string
}): LabourPaySlice[] {
  const policy = payroll || DEFAULT_PAYROLL_POLICY
  const standard = orgDayHours(policy.standardPaidHours)
  const paid = paidBookedHours(timeSlot, workStartTime, workEndTime, policy, isBreakRemoved)
  const otHours = overtimeHoursBeyondPaidStandard(date, timeSlot, workStartTime, workEndTime, policy, isBreakRemoved)
  const normalHours = Math.max(0, roundPennies(paid - otHours))
  const otMultiplier = weekdayOtMultiplier(date, policy)
  const resolved = resolvePayrollRate({
    user,
    operative,
    day: date,
    history,
    standardDayHours: standard,
    timeZone,
    aliasUserIds,
  })
  const isPaye = Boolean(user && employmentTypeOnDay(user, date, timeZone) === 'paye')
  const basis: PayBasis = resolved.basis === 'hourly' ? 'hourly' : 'day'
  const rate = isPaye ? null : basis === 'hourly' ? resolved.hourlyRate : resolved.dayRate
  const slices: LabourPaySlice[] = []
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
    })
  }
  push(normalHours, false, 1)
  push(otHours, true, otMultiplier)
  return slices
}

export function signedLabourSlice(line: {
  paidHours: number
  days: number
  amount: number
  isOvertime: boolean
  payBasis?: string | null
  otMultiplier?: number | null
}, standardHours: number, otMultiplier: number | null): LabourPaySlice {
  const payBasis: PayBasis = line.payBasis === 'hourly' ? 'hourly' : 'day'
  const standard = orgDayHours(standardHours)
  const paidHours = line.paidHours > 0 ? line.paidHours : payBasis === 'day' ? line.days * standard : 0
  const quantity = payBasis === 'hourly' ? paidHours : paidHours / standard
  const rate = quantity > 0.0001 ? roundPennies(line.amount / quantity) : 0
  const storedMultiplier = line.otMultiplier != null ? line.otMultiplier : line.isOvertime ? otMultiplier : null
  return {
    payBasis,
    isOvertime: line.isOvertime,
    otMultiplier: line.isOvertime ? storedMultiplier : null,
    rate,
    paidHours,
    pay: roundPennies(line.amount),
    isPaye: false,
  }
}

export function paySliceDisplay(slice: LabourPaySlice, standardHours: number) {
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
    standardDayHours: standardHours,
    rate: slice.rate,
    pay: slice.pay,
    isOvertime: slice.isOvertime,
    otMultiplier: slice.otMultiplier,
  })
  return {
    rateType: display.rateType,
    quantityText: display.quantityText,
    rateText: display.rateText,
    pay: display.pay,
    days: slice.payBasis === 'hourly' ? slice.paidHours : slice.paidHours / orgDayHours(standardHours),
    rate: slice.rate ?? 0,
  }
}
