import type { User } from '@/types'
import { canSelfBookAnnualLeave } from '@/lib/canonical'
import { londonIsoWeekday } from '@/lib/ios-parity/londonTime'
import { dayKey } from '@/lib/ios-parity/londonTime'

export const DEFAULT_ANNUAL_LEAVE_DAYS = 25

export function annualLeaveAllowance(daysPerYear: number | null | undefined): number {
  if (daysPerYear == null || !Number.isFinite(Number(daysPerYear))) return DEFAULT_ANNUAL_LEAVE_DAYS
  return Number(daysPerYear)
}

/**
 * The status of the person's own leave booking: approved only when they self-book
 * (`canSelfBookAnnualLeave`: the annualLeaveSelfBook permission, never in operative mode).
 * Everyone else sends a pending request — having no line manager no longer saves it approved
 * (it waits for an admin, `leaveApproverIds`). Booking someone else's leave is `leaveSaveStatus`.
 */
export function leaveSubmitStatus(user: Pick<User, 'permissions' | 'role'>): 'pending' | 'approved' {
  return canSelfBookAnnualLeave({
    annualLeaveSelfBook: user.permissions?.annualLeaveSelfBook === true,
    operativeMode: user.permissions?.operativeMode === true,
    role: String(user.role ?? ''),
  })
    ? 'approved'
    : 'pending'
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
