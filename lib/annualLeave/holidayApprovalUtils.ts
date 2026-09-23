import type { HolidayBooking, Operative, User } from '@/types'
import { hasAdminAccess, isOperativeMode } from '@/lib/navigation/menuPermissions'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { isPendingHolidayRequest } from '@/lib/stores/holidayStore'

/** Line manager who should approve this leave request (mirrors iOS `assignedApproverUserId`). */
export function getAssignedApproverUserId(
  request: HolidayBooking,
  users: User[],
  operatives: Operative[]
): string | null {
  if (request.userId) {
    const requester = users.find((u) => u.id === request.userId)
    if (requester) {
      if (
        requester.permissions.manager &&
        !requester.permissions.annualLeaveSelfBook &&
        !requester.permissions.operativeMode &&
        !requester.isSuperAdmin &&
        !requester.permissions.adminAccess &&
        requester.role !== 'admin'
      ) {
        return null
      }
      const managerId = requester.assignedManagerUserId?.trim()
      return managerId || null
    }
  }

  if (request.operativeId) {
    const op = operatives.find((o) => o.id === request.operativeId)
    if (op) {
      const requester = users.find(
        (u) =>
          (u.permissions.operativeMode || u.role === 'operative') &&
          u.email.toLowerCase() === op.email.toLowerCase()
      )
      if (requester) {
        const managerId = requester.assignedManagerUserId?.trim()
        return managerId || null
      }
    }
  }

  return null
}

export function getPendingHolidayRequests(bookings: HolidayBooking[]): HolidayBooking[] {
  return bookings.filter(isPendingHolidayRequest)
}

/** Pending leave/cancellation requests the current user should action (mirrors iOS Tasks screen). */
export function getPendingHolidayApprovalsForUser(
  bookings: HolidayBooking[],
  user: User | null,
  users: User[],
  operatives: Operative[]
): HolidayBooking[] {
  if (!user || isOperativeMode(user)) return []

  const pending = getPendingHolidayRequests(bookings)
  const isManagerOnly =
    user.permissions.manager &&
    !user.isSuperAdmin &&
    !user.permissions.adminAccess &&
    user.role !== 'admin'

  if (isManagerOnly) {
    return pending.filter((request) => getAssignedApproverUserId(request, users, operatives) === user.id)
  }

  if (hasAdminAccess(user)) {
    return pending.filter((request) => {
      const assigned = getAssignedApproverUserId(request, users, operatives)
      return assigned == null || assigned === user.id
    })
  }

  return []
}

export function isCancellationRequest(booking: HolidayBooking): boolean {
  return booking.cancellationRequestedAt != null
}

/** Accepted leave that still has a day after today. Past and today-only bookings stay on the calendar. */
export function isFutureAcceptedAnnualLeave(booking: HolidayBooking, today = new Date()): boolean {
  if (String(booking.status).toLowerCase() !== 'approved') return false
  return dayKey(booking.endDate) > dayKey(today)
}
