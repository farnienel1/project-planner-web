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

export function employmentTypeOnDay(
  user: EmploymentTypeUser,
  date: Date,
  timeZone?: string
): EmploymentTypeRaw {
  const current = normalizeEmploymentType(user.employmentType)
  const from = user.employmentTypeTransitionFrom
  const effectiveAt = user.employmentTypeEffectiveAt
  if (!from || !effectiveAt) return current
  if (dayKey(date, timeZone) < dayKey(effectiveAt, timeZone)) {
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
