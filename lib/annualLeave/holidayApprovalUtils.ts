import type { HolidayBooking, Operative, User } from '@/types'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { staffAccountRole } from '@/lib/permissions'
import { leaveApproverIds, lineManagerIds } from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { isPendingHolidayRequest } from '@/lib/stores/holidayStore'

/** The account that asked for this leave: the booking userId, else the operative-mode user on the operative's email. */
export function holidayRequester(request: HolidayBooking, users: User[], operatives: Operative[]): User | null {
  if (request.userId) {
    const requester = users.find((u) => u.id === request.userId)
    if (requester) return requester
  }
  if (request.operativeId) {
    const op = operatives.find((o) => o.id === request.operativeId)
    if (op) {
      const email = op.email.toLowerCase()
      return (
        users.find(
          (u) => (u.permissions.operativeMode || u.role === 'operative') && u.email.toLowerCase() === email
        ) ?? null
      )
    }
  }
  return null
}

/** `leaveApproverIds`: every current line manager, else the admins. */
export function holidayApproverIds(request: HolidayBooking, users: User[], operatives: Operative[]): string[] {
  const roster = users.map((member) => ({ id: member.id, isActive: member.isActive, role: staffAccountRole(member) }))
  return leaveApproverIds(holidayRequester(request, users, operatives), roster)
}

/** First approver (kept for callers that show one name). */
export function getAssignedApproverUserId(
  request: HolidayBooking,
  users: User[],
  operatives: Operative[]
): string | null {
  const requester = holidayRequester(request, users, operatives)
  return requester ? lineManagerIds(requester)[0] ?? null : null
}

export function getPendingHolidayRequests(bookings: HolidayBooking[]): HolidayBooking[] {
  return bookings.filter(isPendingHolidayRequest)
}

/** Pending leave/cancellation requests the current user should action (`leaveApproverIds`). */
export function getPendingHolidayApprovalsForUser(
  bookings: HolidayBooking[],
  user: User | null,
  users: User[],
  operatives: Operative[]
): HolidayBooking[] {
  if (!user || isOperativeMode(user)) return []
  return getPendingHolidayRequests(bookings).filter((request) =>
    holidayApproverIds(request, users, operatives).includes(user.id)
  )
}

export function isCancellationRequest(booking: HolidayBooking): boolean {
  return booking.cancellationRequestedAt != null
}

/** Accepted leave that still has a day after today. Past and today-only bookings stay on the calendar. */
export function isFutureAcceptedAnnualLeave(booking: HolidayBooking, today = new Date()): boolean {
  if (String(booking.status).toLowerCase() !== 'approved') return false
  return dayKey(booking.endDate) > dayKey(today)
}
