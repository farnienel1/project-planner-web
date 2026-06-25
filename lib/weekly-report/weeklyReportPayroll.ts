import { getISODay } from 'date-fns'
import { hoursFromSlot } from '@/lib/timesheets/timesheetWeekUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'

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

export function resolvePersonTrade(user: User | undefined, operative: Operative | undefined): string {
  if (user?.tradeTypeCustom?.trim()) return user.tradeTypeCustom.trim()
  if (user?.tradeTypePreset?.trim()) return user.tradeTypePreset.trim()
  if (operative?.skills?.length) {
    const first = operative.skills[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'name' in first) return String((first as { name: string }).name)
  }
  return 'General'
}

export function resolvePersonRole(user: User | undefined, operative: Operative | undefined): string {
  if (!user) return operative ? 'Operative' : 'User'
  if (user.permissions.adminAccess || user.isSuperAdmin) return 'Admin User'
  if (user.permissions.manager) return 'Manager'
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
  const user = opts.userId ? users.find((entry) => entry.id === opts.userId) : undefined
  const operative = opts.operativeId
    ? operatives.find((entry) => entry.id === opts.operativeId)
    : user
      ? findOperativeForUser(user, operatives)
      : undefined
  return { user, operative }
}

export type PayLine = {
  rateType: string
  days: number
  rate: number
  pay: number
}

export function buildPayLinesForDays(
  totalDays: number,
  dayRate: number | undefined,
  hourlyRate: number | undefined,
  standardHours: number,
  otMultiplier: number
): PayLine[] {
  if (!dayRate && !hourlyRate) return []

  const rate = dayRate && dayRate > 0 ? dayRate : (hourlyRate || 0) * standardHours
  if (rate <= 0) return []

  const normalDays = Math.min(totalDays, Math.floor(totalDays))
  const otDays = Math.round((totalDays - normalDays) * 100) / 100
  const lines: PayLine[] = []

  if (normalDays > 0) {
    lines.push({
      rateType: 'Normal',
      days: normalDays,
      rate,
      pay: Math.round(normalDays * rate * 100) / 100,
    })
  }

  if (otDays > 0) {
    const otRate = Math.round(rate * otMultiplier * 100) / 100
    lines.push({
      rateType: `OT x${otMultiplier}`,
      days: otDays,
      rate: otRate,
      pay: Math.round(otDays * otRate * 100) / 100,
    })
  }

  if (lines.length === 0 && totalDays > 0) {
    lines.push({
      rateType: 'Normal',
      days: totalDays,
      rate,
      pay: Math.round(totalDays * rate * 100) / 100,
    })
  }

  return lines
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
