/**
 * Annual leave against bookings, for one organisation.
 * The rule lives in lib/canonical/leaveCoverage.ts. This file maps app types in and out.
 */

import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { leaveCoverageRows, type LeaveCoverageRow, type LeavePerson } from '@/lib/canonical'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { dateFromDayKey, dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { isPlaceholderOperative } from '@/lib/operatives/operativeRosterUtils'
import { computeWarningCoverageWindow, isDateWithinWarningWindow } from '@/lib/warnings/warningLookahead'
import { bookingJobLabel } from '@/lib/canonical'
import { holidayBookingLabourInput } from '@/lib/annualLeave/holidayDayKeys'

export type LeaveCoverageWarning = LeaveCoverageRow & {
  date: Date
}

function emailKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

/** One person per account; operative profiles join the account that shares their email. */
export function leavePeopleFrom(
  users: User[],
  operatives: Operative[],
  userIdAliases: Readonly<Record<string, string>> | null = null
): LeavePerson[] {
  // Rulebook 1.53.0: every id a person goes by — stored former / same-email ids and the roster fold's aliases.
  const aliasesByKept = new Map<string, string[]>()
  for (const [alias, kept] of Object.entries(userIdAliases || {})) {
    if (!alias || !kept || alias === kept) continue
    const list = aliasesByKept.get(kept) || []
    list.push(alias)
    aliasesByKept.set(kept, list)
  }
  const operativeIdsByEmail = new Map<string, string[]>()
  for (const operative of operatives) {
    if (isPlaceholderOperative(operative)) continue
    const email = emailKey(operative.email)
    if (!email) continue
    const list = operativeIdsByEmail.get(email) || []
    list.push(operative.id)
    operativeIdsByEmail.set(email, list)
  }

  const people: LeavePerson[] = []
  const claimedEmails = new Set<string>()
  for (const user of users) {
    const email = emailKey(user.email)
    const name = `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || user.id
    people.push({
      personKey: user.id,
      name,
      userId: user.id,
      operativeIds: email ? operativeIdsByEmail.get(email) || [] : [],
      aliasUserIds: [
        ...((user as { formerUserIds?: string[] | null }).formerUserIds || []),
        ...((user as { sameEmailUserIds?: string[] | null }).sameEmailUserIds || []),
        ...(aliasesByKept.get(user.id) || []),
      ].filter((id) => id && id !== user.id),
    })
    if (email) claimedEmails.add(email)
  }
  for (const operative of operatives) {
    if (isPlaceholderOperative(operative)) continue
    const email = emailKey(operative.email)
    if (email && claimedEmails.has(email)) continue
    if (email) claimedEmails.add(email)
    people.push({
      personKey: operative.id,
      name: `${operative.firstName} ${operative.lastName}`.trim() || operative.email || 'Operative',
      userId: null,
      operativeIds: email ? operativeIdsByEmail.get(email) || [operative.id] : [operative.id],
    })
  }
  return people
}

export function computeLeaveCoverageWarnings({
  bookings,
  managerSiteBookings = [],
  operatives,
  users,
  projects,
  holidays,
  warningDetection,
  invoicing,
  payrollPolicy = DEFAULT_PAYROLL_POLICY,
  payrollPolicyState = null,
  referenceDate = new Date(),
  timeZone,
  userIdAliases = null,
}: {
  bookings: Booking[]
  managerSiteBookings?: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  projects: Project[]
  holidays: HolidayBooking[]
  warningDetection: OrgWarningDetectionSettings
  invoicing?: import('@/lib/settings/organizationSettings').OrgInvoicingSettings
  payrollPolicy?: OrgPayrollTimePolicy
  /** Rulebook 1.23.0: the whole working-hours state, so each day of the window uses the rules in effect on it. */
  payrollPolicyState?: import('@/lib/canonical').PayrollTimePolicyState | null
  referenceDate?: Date
  timeZone?: string
  /** Folded same-email `users` id → the id the roster kept (rulebook 1.53.0: leave under either id counts). */
  userIdAliases?: Readonly<Record<string, string>> | null
}): LeaveCoverageWarning[] {
  const window = computeWarningCoverageWindow(referenceDate, warningDetection, invoicing, timeZone)
  const windowStart = londonMidnight(window.start, timeZone)
  const windowEnd = londonMidnight(window.end, timeZone)
  const projectsById = new Map(projects.map((project) => [project.id, `${project.jobNumber} ${project.siteName}`.trim()]))

  const rows = leaveCoverageRows({
    timeZone,
    startDayKey: window.startDayKey,
    endDayKey: window.endDayKey,
    day: payrollPolicyState ?? payrollPolicy,
    includeWeekends: warningDetection.includeWeekendsForUnbookedLabour,
    excludedUserIds: warningDetection.excludedUserIdsFromUnbookedWarnings,
    people: leavePeopleFrom(users, operatives, userIdAliases),
    // Parsed day keys from `parseHolidayDocument` (rulebook §9), never recomputed here.
    leave: holidays.map((holiday) => holidayBookingLabourInput(holiday, timeZone)),
    bookings: [
      ...bookings
        .filter(
          (booking) =>
            isActiveBookingStatus(booking.status) &&
            Boolean(booking.operativeId) &&
            isDateWithinWarningWindow(booking.date, windowStart, windowEnd, timeZone)
        )
        .map((booking) => ({
          id: booking.id,
          personId: booking.operativeId,
          kind: 'operative' as const,
          dayKey: dayKey(booking.date, timeZone),
          timeSlot: String(booking.timeSlot),
          workStartTime: booking.workStartTime,
          workEndTime: booking.workEndTime,
          label: bookingJobLabel(projectsById.get(booking.projectId)),
        })),
      ...managerSiteBookings
        .filter(
          (booking) => Boolean(booking.userId) && isDateWithinWarningWindow(booking.date, windowStart, windowEnd, timeZone)
        )
        .map((booking) => ({
          id: booking.id,
          personId: booking.userId,
          kind: 'manager' as const,
          dayKey: dayKey(booking.date, timeZone),
          timeSlot: booking.timeSlot,
          workStartTime: booking.workStartTime,
          workEndTime: booking.workEndTime,
          label: managerSiteBookingDisplayTitle(booking, projectsById),
        })),
    ],
  })

  return rows.map((row) => ({ ...row, date: dateFromDayKey(row.dayKey, timeZone) }))
}
