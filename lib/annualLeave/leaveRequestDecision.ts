import type { User } from '@/types'
import { canSelfBookAnnualLeave } from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { londonIsoWeekday } from '@/lib/ios-parity/londonTime'
import { dayKey } from '@/lib/ios-parity/londonTime'

export const DEFAULT_ANNUAL_LEAVE_DAYS = 25

export function annualLeaveAllowance(daysPerYear: number | null | undefined): number {
  if (daysPerYear == null || !Number.isFinite(Number(daysPerYear))) return DEFAULT_ANNUAL_LEAVE_DAYS
  return Number(daysPerYear)
}

/**
 * The status of the person's own leave booking: approved only when they self-book
 * (`canSelfBookAnnualLeave(user, roster)`: the annualLeaveSelfBook permission outside operative mode, or an admin /
 * super admin outside operative mode with no active line manager). Everyone else sends a pending request
 * (`leaveApproverIds`). Booking someone else's leave is `leaveSaveStatus`.
 */
export function leaveSubmitStatus(user: User, users: ReadonlyArray<User> = []): 'pending' | 'approved' {
  return canSelfBookAnnualLeave(rulebookPerson(user, users), rulebookRoster(users)) ? 'approved' : 'pending'
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
