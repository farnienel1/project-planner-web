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

export type LeaveCoverageWarning = LeaveCoverageRow & {
  date: Date
}

function emailKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

/** One person per account; operative profiles join the account that shares their email. */
export function leavePeopleFrom(users: User[], operatives: Operative[]): LeavePerson[] {
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
  referenceDate = new Date(),
  timeZone,
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
  referenceDate?: Date
  timeZone?: string
}): LeaveCoverageWarning[] {
  const window = computeWarningCoverageWindow(referenceDate, warningDetection, invoicing, timeZone)
  const windowStart = londonMidnight(window.start, timeZone)
  const windowEnd = londonMidnight(window.end, timeZone)
  const projectsById = new Map(projects.map((project) => [project.id, `${project.jobNumber} ${project.siteName}`.trim()]))

  const rows = leaveCoverageRows({
    timeZone,
    startDayKey: dayKey(windowStart, timeZone),
    endDayKey: dayKey(windowEnd, timeZone),
    day: payrollPolicy,
    includeWeekends: warningDetection.includeWeekendsForUnbookedLabour,
    excludedUserIds: warningDetection.excludedUserIdsFromUnbookedWarnings,
    people: leavePeopleFrom(users, operatives),
    leave: holidays.map((holiday) => ({
      id: holiday.id,
      userId: holiday.userId,
      operativeId: holiday.operativeId,
      startDayKey: dayKey(holiday.startDate, timeZone),
      endDayKey: dayKey(holiday.endDate, timeZone),
      timeSlot: holiday.timeSlot,
      approved: String(holiday.status).toLowerCase() === 'approved',
    })),
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
          label: projectsById.get(booking.projectId) || 'Job',
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
