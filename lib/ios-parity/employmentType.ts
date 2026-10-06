/**
 * iOS parity: Models/AppModels.swift AppUser.employmentType(on:)
 * Scheduled PAYE ↔ self-employed transitions apply per calendar day.
 */
import type { User } from '@/types'
import { normalizeEmploymentType, type EmploymentTypeRaw } from '@/lib/ios-parity/enums'
import { dayKey } from '@/lib/ios-parity/londonTime'

export type EmploymentTypeUser = Pick<
  User,
  'employmentType' | 'employmentTypeTransitionFrom' | 'employmentTypeEffectiveAt'
>

function validDay(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}

export function employmentTypeOnDay(
  user: EmploymentTypeUser,
  date: Date,
  timeZone?: string
): EmploymentTypeRaw {
  const current = normalizeEmploymentType(user.employmentType)
  const from = user.employmentTypeTransitionFrom
  const day = validDay(date)
  const effectiveAt = validDay(user.employmentTypeEffectiveAt)
  if (!from || !day || !effectiveAt) return current
  if (dayKey(day, timeZone) < dayKey(effectiveAt, timeZone)) {
    return normalizeEmploymentType(from)
  }
  return current
}

/** iOS TimesheetPayrollPolicy.isBillableSelfEmployedDay */
export function isBillableSelfEmployedDay(
  user: EmploymentTypeUser,
  date: Date,
  timeZone?: string
): boolean {
  return employmentTypeOnDay(user, date, timeZone) === 'self_employed'
}
