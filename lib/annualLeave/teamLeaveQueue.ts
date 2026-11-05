/**
 * The leave requests a viewer can decide on Annual leave → Team (`leaveDecisionQueue` / `canDecideLeave`), over the
 * people that tab lists for them. Shared by the Team tab (its count badge) and Home's "Waiting for you" card, so the
 * two always show the same number (owner decision 12, 5 Nov 2026). Moved unchanged out of
 * `components/annual-leave/OperativeAnnualLeaveManagement.tsx`.
 */

import { isPendingHolidayRequest } from '@/lib/stores/holidayStore'
import type { HolidayBooking, Operative, User } from '@/types'
import { bookingMatchesPerson, buildAnnualLeavePeople, canManagePersonAnnualLeave, type AnnualLeavePerson } from './annualLeavePerson'
import { getPendingHolidayApprovalsForUser } from './holidayApprovalUtils'

/** The people Annual leave → Team lists for this viewer. */
export function teamLeavePeople(user: User | null, users: User[], operatives: Operative[]): AnnualLeavePerson[] {
  const rows = buildAnnualLeavePeople(users, operatives)
  return rows.filter((person) => canManagePersonAnnualLeave(user, person, users))
}

/** Leave records of those people. */
export function teamLeaveBookings(bookings: HolidayBooking[], people: AnnualLeavePerson[]): HolidayBooking[] {
  return bookings.filter((b) => people.some((p) => bookingMatchesPerson(b, p)))
}

/** Pending requests and cancellation requests this viewer may decide, newest first (the Team tab's queue). */
export function teamLeaveDecisionQueue(
  teamBookings: HolidayBooking[],
  user: User | null,
  users: User[],
  operatives: Operative[]
): HolidayBooking[] {
  return getPendingHolidayApprovalsForUser(teamBookings, user, users, operatives)
    .filter((b) => isPendingHolidayRequest(b))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
}
