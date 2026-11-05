/**
 * The Book labour list for one viewer and one day: its phase (loading / error / no access / ready), its people and
 * the viewer's warning scope. Moved unchanged out of `components/book-labour/BookLabourFlowScreen.tsx` (owner decision
 * 3, 5 Nov 2026) so Home's "N people have nothing booked today → Book labour" banner counts exactly the people Book
 * labour lists for the same viewer: admins everyone; a manager their reports and themselves (`warningScopeFor`).
 *
 * Rulebook §5 / §6: the people are `unbookedLabourRowsOnDay` (`buildBookLabourCandidates`), built with the Warnings
 * input and the viewer's Warnings scope (`orgWarningScope`). Rows saved for another company never count
 * (`partitionRowsByOrganization`, `warningScanUsers`). Nothing is listed until every source has loaded for this
 * organisation (`bookLabourListPhase`).
 */

import type { PayrollTimePolicyState, WarningScope } from '@/lib/canonical'
import { webJobAccessViewer } from '@/lib/access/readPlan'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { partitionRowsByOrganization, warningScanUsers } from '@/lib/warnings/warningsScan'
import { orgWarningScope } from '@/lib/warnings/warningScopeRoster'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import { bookLabourListPhase, buildBookLabourCandidates, type BookLabourCandidate, type BookLabourListPhase } from './candidates'

/** A source the list waits for: finished loading for this organisation (before the foreign-row check), or failed. */
type Source = { ready: boolean; error?: string | null }

export type BookLabourListInput = {
  organizationId: string
  viewer: User | null
  enforcedReads: boolean
  /** The day shown, `YYYY-MM-DD` in the organisation zone. */
  dayKey: string
  timeZone: string
  users: User[]
  rosterLoadedOrgId: string | null
  usersError?: string | null
  userIdAliases?: Record<string, string>
  operatives: Operative[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  projects: Project[]
  smallWorks: Project[]
  /** The live organisation document's warning settings and working hours; null until it has arrived. */
  liveDetails: {
    warningDetection: Pick<
      OrgWarningDetectionSettings,
      'includeWeekendsForUnbookedLabour' | 'excludedUserIdsFromUnbookedWarnings' | 'weekendCoverage'
    >
    payrollTimePolicy: OrgPayrollTimePolicy
    payrollTimePolicyState: PayrollTimePolicyState | null
  } | null
  sources: {
    organization: Source
    operatives: Source
    bookings: Source
    managerBookings: Source
    holidays: Source
    jobs: Source
  }
  focusedUserIds?: string[]
}

export type BookLabourList = {
  phase: BookLabourListPhase
  candidates: BookLabourCandidate[]
  scope: WarningScope
}

export function bookLabourList(input: BookLabourListInput): BookLabourList {
  const orgId = input.organizationId
  const userScope = warningScanUsers(input.users, orgId, Boolean(orgId) && input.rosterLoadedOrgId === orgId)
  const operativeScope = partitionRowsByOrganization(input.operatives, orgId)
  const bookingScope = partitionRowsByOrganization(input.bookings, orgId)
  const managerScope = partitionRowsByOrganization(input.managerSiteBookings, orgId)
  const holidayScope = partitionRowsByOrganization(input.holidays, orgId)
  const projectScope = partitionRowsByOrganization(mergeProjectsAndSmallWorks(input.projects, input.smallWorks), orgId)
  // Owner decision (4 Nov 2026): Book labour is scoped exactly like the Warnings unbooked list — admins see everyone;
  // a manager themselves and the people they line-manage (`warningScopeFor`, rulebook 1.31.0 §5).
  const scope = orgWarningScope({
    viewer: webJobAccessViewer(input.viewer),
    enforcedReads: input.enforcedReads,
    projects: projectScope.rows,
    users: userScope.rows,
    userIdAliases: input.userIdAliases,
    operatives: operativeScope.rows,
  })
  const { sources } = input
  const phase = bookLabourListPhase(
    {
      organization: sources.organization,
      roster: { ready: input.rosterLoadedOrgId === orgId && !userScope.foreign, error: input.usersError },
      operatives: { ready: sources.operatives.ready && !operativeScope.foreign, error: sources.operatives.error },
      bookings: { ready: sources.bookings.ready && !bookingScope.foreign, error: sources.bookings.error },
      managerBookings: { ready: sources.managerBookings.ready && !managerScope.foreign, error: sources.managerBookings.error },
      holidays: { ready: sources.holidays.ready && !holidayScope.foreign, error: sources.holidays.error },
      jobs: { ready: sources.jobs.ready && !projectScope.foreign, error: sources.jobs.error },
    },
    scope
  )
  const candidates =
    phase !== 'ready' || !input.liveDetails
      ? []
      : // Rulebook §5 / §6: exactly the `unbookedLabourRowsOnDay` people for the day (Warnings and Daily Overview).
        buildBookLabourCandidates({
          dayKey: input.dayKey,
          timeZone: input.timeZone,
          users: userScope.rows,
          operatives: operativeScope.rows,
          bookings: bookingScope.rows,
          managerSiteBookings: managerScope.rows,
          holidays: holidayScope.rows,
          warningDetection: input.liveDetails.warningDetection,
          payrollPolicy: input.liveDetails.payrollTimePolicy,
          payrollPolicyState: input.liveDetails.payrollTimePolicyState,
          userIdAliases: input.userIdAliases,
          scope,
          focusedUserIds: input.focusedUserIds,
        })
  return { phase, candidates, scope }
}
