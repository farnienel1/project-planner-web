/**
 * One Daily Overview set-up for every screen that shows a day of it (owner decision 5, 5 Nov 2026): Daily Overview
 * itself and the Home team panels (admins). Both call these functions with the same stores, so the two cannot drift.
 *
 * Moved out of `components/daily-overview/DailyOverviewScreen.tsx` unchanged: the settings come from the one live
 * `organizations/{orgId}` listener (rulebook 1.10.0), the working hours are those in effect on the day shown
 * (`effectivePayrollTimePolicy`, rulebook 1.17.0 / 1.19.0), and the model is `buildDailyOverview`. No figure changes:
 * `dailyOverviewToday.test.ts` compares the output with the wiring Daily Overview had before.
 */

import { effectivePayrollTimePolicy, type JobAccessViewer, type WeekendCoverage } from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { policyForBookingDate } from '@/lib/scheduling/bookingSlotRules'
import { DEFAULT_PAYROLL_POLICY, organizationDetailsFromData, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { findUserByAnyId, rosterDisplayName } from '@/lib/staff/userRosterUtils'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import { normalizeDocumentId } from '@/lib/canonical'
import type { OverviewSubcontractorBooking, buildDailyOverview } from './buildDailyOverview'

/** The organisation settings Daily Overview reads for the day shown. */
export type DailyOverviewSettings = {
  payrollPolicy: OrgPayrollTimePolicy
  includeWeekendsForUnbookedLabour: boolean
  excludedUserIdsFromUnbookedWarnings: string[]
  /** Rulebook 1.19.0 §5: the weekend "Hours to cover" toggles and windows (`warningDetection.weekendCoverage`). */
  weekendCoverage: WeekendCoverage | null
}

/** What Daily Overview showed before the organisation document arrived. */
export const DEFAULT_DAILY_OVERVIEW_SETTINGS: DailyOverviewSettings = {
  payrollPolicy: DEFAULT_PAYROLL_POLICY,
  includeWeekendsForUnbookedLabour: false,
  excludedUserIdsFromUnbookedWarnings: [],
  weekendCoverage: null,
}

/**
 * The settings for `day` from the live organisation document, or null while the listener does not hold this
 * organisation's document yet (the caller keeps what it had).
 */
export function dailyOverviewSettings(input: {
  organizationId: string | null | undefined
  liveOrganizationId: string
  data: Record<string, unknown> | null | undefined
  day: Date
  timeZone: string
}): DailyOverviewSettings | null {
  if (!input.organizationId || input.liveOrganizationId !== input.organizationId || !input.data) return null
  const details = organizationDetailsFromData(input.organizationId, input.data)
  return {
    // Rulebook 1.17.0 §4.3 / §6: the working hours in effect on the day shown (`effectivePayrollTimePolicy`), so a
    // past day keeps its old rules and a day after a scheduled change uses the new ones.
    payrollPolicy: effectivePayrollTimePolicy(input.data, dayKey(input.day, input.timeZone), input.timeZone),
    includeWeekendsForUnbookedLabour: details.warningDetection.includeWeekendsForUnbookedLabour,
    excludedUserIdsFromUnbookedWarnings: details.warningDetection.excludedUserIdsFromUnbookedWarnings ?? [],
    weekendCoverage: details.warningDetection.weekendCoverage ?? null,
  }
}

/** The `buildDailyOverview` input, exactly as Daily Overview passed it. */
export function dailyOverviewInput(input: {
  viewer: JobAccessViewer | null
  enforcedReads: boolean
  day: Date
  today: Date
  projects: Project[]
  smallWorks: Project[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  users: User[]
  userIdAliases?: Record<string, string>
  operatives: Operative[]
  subcontractorBookings: OverviewSubcontractorBooking[]
  subcontractors: { id: string; name: string; contacts?: { id: string; name: string }[] }[]
  settings: DailyOverviewSettings
  timeZone: string
}): Parameters<typeof buildDailyOverview>[0] {
  return {
    // Rulebook 1.10.0 §17: restricted managers see only their jobs and people (`warningScopeFor`).
    viewer: input.viewer,
    enforcedReads: input.enforcedReads,
    day: input.day,
    today: input.today,
    projects: [...input.projects, ...input.smallWorks],
    bookings: input.bookings,
    managerBookings: input.managerSiteBookings,
    holidays: input.holidays,
    users: input.users,
    userIdAliases: input.userIdAliases,
    operatives: input.operatives,
    subcontractorBookings: input.subcontractorBookings,
    subcontractors: input.subcontractors,
    // Rulebook 1.19.0 / 1.20.2: the working hours in effect on the day shown (history first), so the rows and the
    // day's hours are the pay rule's for that day.
    payrollPolicy: policyForBookingDate(input.day, input.settings.payrollPolicy) ?? input.settings.payrollPolicy,
    includeWeekendsForUnbookedLabour: input.settings.includeWeekendsForUnbookedLabour,
    excludedUserIdsFromUnbookedWarnings: input.settings.excludedUserIdsFromUnbookedWarnings,
    weekendCoverage: input.settings.weekendCoverage,
    timeZone: input.timeZone,
  }
}

/** A roster person's name for a manager site booking row (Office, WFH, site survey, custom). */
export function overviewPersonName(userId: string, users: User[], aliases?: Record<string, string>): string {
  const user = findUserByAnyId(users, userId, aliases)
  return rosterDisplayName(user)
}

/** The name on an annual leave row: the account, else the operatives row, else "Team member". */
export function overviewHolidayName(
  booking: { userId?: string; operativeId?: string },
  users: User[],
  operatives: { id: string; firstName: string; lastName: string }[],
  aliases?: Record<string, string>
): string {
  if (booking.userId) {
    const named = overviewPersonName(booking.userId, users, aliases)
    if (named) return named
  }
  if (booking.operativeId) {
    const op = operatives.find((row) => normalizeDocumentId(row.id) === normalizeDocumentId(booking.operativeId))
    if (op) {
      const named = rosterDisplayName({ firstName: op.firstName, surname: op.lastName, email: '' })
      if (named) return named
    }
  }
  return 'Team member'
}
