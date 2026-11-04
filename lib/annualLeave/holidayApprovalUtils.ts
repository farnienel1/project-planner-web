import { lineManagerOptions } from '@/lib/canonical/lineManagers'
import type { HolidayBooking, Operative, User } from '@/types'
import { staffAccountRole } from '@/lib/permissions'
import { rulebookPerson, rulebookRoster, type RulebookPerson } from '@/lib/staff/rulebookPeople'
import {
  canDecideLeave,
  canSelfBookAnnualLeave,
  leaveApproverIds,
  leaveDecisionQueue,
  lineManagerIds,
  leaveSubmitLabel,
  lineManagerRequired,
  lineManagerRequiredError,
  usersMissingLineManager,
} from '@/lib/canonical'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
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

/**
 * The rulebook's view of a `users` row for the leave rules: the full person (`rulebookPerson`: id, email, active
 * flag, role and role flags, `formerUserIds`, `sameEmailUserIds`, line-manager fields). Pass the roster so the
 * same-email aliases are filled in.
 */
export function leaveUser(user: User, users: ReadonlyArray<User> = []): RulebookPerson {
  return rulebookPerson(user, users)
}

/** The roster as the leave rules read it (`rulebookRoster`). */
export function leaveRoster(users: ReadonlyArray<User>): RulebookPerson[] {
  return rulebookRoster(users)
}

/**
 * `canSelfBookAnnualLeave(user, roster)`: the self-book permission outside operative mode, or the Super Admin
 * (rulebook 1.28.0; having no line manager no longer self-books an admin).
 */
export function userCanSelfBookAnnualLeave(user: User | null | undefined, users: ReadonlyArray<User> = []): boolean {
  return user ? canSelfBookAnnualLeave(leaveUser(user, users), leaveRoster(users)) : false
}

/** `leaveSubmitLabel(user, roster)`: "Submit" when the leave saves approved, else "Submit request". */
export function userLeaveSubmitLabel(user: User | null | undefined, users: ReadonlyArray<User> = []): string {
  return user ? leaveSubmitLabel(leaveUser(user, users), leaveRoster(users)) : leaveSubmitLabel(null)
}

/** `lineManagerRequiredError(user, roster)` for the person as it will be saved (Manage Users). */
export function userLineManagerRequiredError(user: User, users: ReadonlyArray<User>): string | null {
  const roster = users.some((member) => member.id === user.id)
    ? users.map((member) => (member.id === user.id ? user : member))
    : [...users, user]
  return lineManagerRequiredError(leaveUser(user, roster), leaveRoster(roster))
}

/**
 * Whether Manage Users offers "No line manager" for this person (`lineManagerOptions`): an admin or super admin outside
 * operative mode. 1.28.0: the save still needs both self-manage toggles on (`lineManagerRequiredError`).
 */
export function userMayHaveNoLineManager(user: User, users: ReadonlyArray<User> = []): boolean {
  // Rulebook 1.11.0 `lineManagerOptions`: "No line manager" only when `lineManagerRequired` is false.
  return lineManagerOptions({ ...leaveUser(user, users), isActive: true } as never).allowsNoLineManager
}

/** `usersMissingLineManager`: roster people an admin still has to give a line manager. */
export function usersWithoutRequiredLineManager(users: User[]): User[] {
  const ids = new Set(usersMissingLineManager(leaveRoster(users)))
  return users.filter((member) => ids.has(member.id))
}

function requesterFor(request: HolidayBooking, users: User[], operatives: Operative[]) {
  const requester = holidayRequester(request, users, operatives)
  if (requester) return leaveUser(requester, users)
  return { id: request.userId || request.operativeId || null }
}

/** `leaveApproverIds`: every current line manager, else the admins. */
export function holidayApproverIds(request: HolidayBooking, users: User[], operatives: Operative[]): string[] {
  return leaveApproverIds(requesterFor(request, users, operatives), leaveRoster(users))
}

/**
 * `canDecideLeave`: whether `viewer` may approve, decline or remove this person's leave (and accept a
 * cancellation). Never their own request; admins decide any; otherwise `leaveApproverIds`.
 */
export function canDecideHoliday(
  viewer: User | null | undefined,
  request: HolidayBooking,
  users: User[],
  operatives: Operative[]
): boolean {
  if (!viewer) return false
  return canDecideLeave(
    { id: viewer.id, role: staffAccountRole(viewer) },
    requesterFor(request, users, operatives),
    leaveRoster(users)
  )
}

/**
 * The status a new leave booking is saved with. Approved when the viewer books their own leave and
 * `canSelfBookAnnualLeave`, or books someone else's leave they may decide (`canDecideLeave`); otherwise a
 * pending request. Having no line manager never makes a booking approved.
 */
export function leaveSaveStatus(
  viewer: User | null | undefined,
  subject: { userId?: string | null; operativeId?: string | null },
  users: User[],
  operatives: Operative[]
): 'approved' | 'pending' {
  if (!viewer) return 'pending'
  const ownLeave = Boolean(subject.userId && subject.userId === viewer.id)
  if (ownLeave) return userCanSelfBookAnnualLeave(viewer, users) ? 'approved' : 'pending'
  const probe = {
    userId: subject.userId ?? undefined,
    operativeId: subject.operativeId ?? undefined,
  } as HolidayBooking
  return canDecideHoliday(viewer, probe, users, operatives) ? 'approved' : 'pending'
}

/** First approver (kept for callers that show one name). */
export function getAssignedApproverUserId(
  request: HolidayBooking,
  users: User[],
  operatives: Operative[]
): string | null {
  const requester = holidayRequester(request, users, operatives)
  return requester ? lineManagerIds(leaveUser(requester, users), leaveRoster(users))[0] ?? null : null
}

export function getPendingHolidayRequests(bookings: HolidayBooking[]): HolidayBooking[] {
  return bookings.filter(isPendingHolidayRequest)
}

/** Pending leave/cancellation requests the current user should action (`leaveDecisionQueue`). */
export function getPendingHolidayApprovalsForUser(
  bookings: HolidayBooking[],
  user: User | null,
  users: User[],
  operatives: Operative[]
): HolidayBooking[] {
  if (!user) return []
  // `leaveDecisionQueue`: pending requests and cancellation requests this viewer may decide (`canDecideLeave`).
  const queued = leaveDecisionQueue(
    { id: user.id, role: staffAccountRole(user) },
    getPendingHolidayRequests(bookings).map((booking) => {
      const requester = holidayRequester(booking, users, operatives)
      return {
        booking,
        userId: requester?.id ?? booking.userId ?? null,
        operativeId: booking.operativeId ?? null,
        status: booking.status,
        cancellationRequestedAt: booking.cancellationRequestedAt ? booking.cancellationRequestedAt.getTime() : null,
        cancellationRequestedByUserId: booking.cancellationRequestedByUserId ?? null,
      }
    }),
    leaveRoster(users)
  )
  return queued.map((entry) => entry.booking)
}

export function isCancellationRequest(booking: HolidayBooking): boolean {
  return booking.cancellationRequestedAt != null
}

/** Accepted leave that still has a day after today. Past and today-only bookings stay on the calendar. */
export function isFutureAcceptedAnnualLeave(booking: HolidayBooking, today = new Date(), timeZone?: string): boolean {
  if (String(booking.status).toLowerCase() !== 'approved') return false
  const zone = organizationZoneOr(timeZone)
  return dayKeyInZone(booking.endDate, zone) > dayKeyInZone(today, zone)
}
