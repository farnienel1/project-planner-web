import type { User } from '@/types'
import { userHasLineManager } from '@/lib/timesheets/timesheetApprovalPolicy'
import { londonIsoWeekday } from '@/lib/ios-parity/londonTime'
import { dayKey } from '@/lib/ios-parity/londonTime'

export const DEFAULT_ANNUAL_LEAVE_DAYS = 25

export function annualLeaveAllowance(daysPerYear: number | null | undefined): number {
  if (daysPerYear == null || !Number.isFinite(Number(daysPerYear))) return DEFAULT_ANNUAL_LEAVE_DAYS
  return Number(daysPerYear)
}

/**
 * Operatives, and managers or admins without annualLeaveSelfBook who have a
 * line manager, submit pending. No line manager saves the booking approved.
 */
export function leaveSubmitStatus(user: Pick<User, 'permissions' | 'hasNoLineManager' | 'assignedManagerUserId' | 'assignedManagerUserIds'>): 'pending' | 'approved' {
  if (!userHasLineManager(user as User)) return 'approved'
  if (user.permissions.operativeMode) return 'pending'
  if (user.permissions.annualLeaveSelfBook) return 'approved'
  return 'pending'
}

export function leaveDayBlockedReason(day: Date, isBankHoliday: boolean, timeZone?: string): string | null {
  const iso = londonIsoWeekday(day, timeZone)
  if (iso === 6 || iso === 7 || isBankHoliday) {
    return 'Saturday, Sunday, and bank holidays are not taken from the allowance.'
  }
  return null
}

/** Each calendar day counts once, capped at 1. */
export function leaveDayCount(days: Date[], timeZone?: string): number {
  const keys = new Set(days.map((day) => dayKey(day, timeZone)))
  return keys.size
}

export function leaveExceedsBalance(requestedDays: number, remainingDays: number): boolean {
  return requestedDays > remainingDays
}
