/**
 * Load fully approved timesheet snapshots for a weekly report range.
 * Rulebook 1.10.0 (M7): a missing `weeklyReportOverride` is built in memory for the report only — the Weekly Report
 * never writes anyone's timesheet (`syncWriteAllowed('weeklyReport')` is false). Who is in the feed is
 * `timesheetParticipant` (M6).
 */
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { MyScheduleOptions, OrgInvoicingSettings, OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_MY_SCHEDULE, DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { LONDON_TIME_ZONE, dayKey } from '@/lib/ios-parity/londonTime'
import { isTimesheetFullyApproved } from '@/lib/timesheets/timesheetApprovalPolicy'
import { timesheetParticipant } from '@/lib/canonical'
import { payPeriodsOverlapping } from '@/lib/timesheets/timesheetPayrollPolicy'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { listTimesheetStates } from '@/lib/timesheets/timesheetStorage'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { findUserAndOperative, resolveDisplayName, resolvePersonRole, resolvePersonTrade } from '@/lib/weekly-report/weeklyReportPayroll'
import { mergeDuplicatePersonWeeks, type ApprovedTimesheetWeek } from '@/lib/weekly-report/timesheetFeed'

/** Rulebook 1.10.0 (M6): `timesheetParticipant` on the period's first day — the same people as the reminders. */
function participatesInPeriod(user: User, day: Date, timeZone: string): boolean {
  return timesheetParticipant(
    {
      ...user,
      name: `${user.firstName ?? ''} ${user.surname ?? ''}`.trim(),
      operativeMode: user.permissions?.operativeMode === true,
    },
    day,
    timeZone
  )
}

export async function loadWeeklyReportTimesheetFeed({
  organizationId,
  users,
  operatives,
  rangeStart,
  rangeEnd,
  invoicing,
  bookings,
  managerSiteBookings,
  projects,
  smallWorks,
  history = emptyDayRateHistory(),
  payrollPolicy = DEFAULT_PAYROLL_POLICY,
  payrollPolicyPrior = null,
  payrollPolicyEffectiveFrom = null,
  scheduleOptions = DEFAULT_MY_SCHEDULE,
  timeZone = LONDON_TIME_ZONE,
}: {
  organizationId: string
  users: User[]
  operatives: Operative[]
  rangeStart: Date
  rangeEnd: Date
  invoicing: OrgInvoicingSettings
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  projects: Project[]
  smallWorks: Project[]
  history?: OperativeDayRateHistoryCollection
  payrollPolicy?: OrgPayrollTimePolicy
  payrollPolicyPrior?: OrgPayrollTimePolicy | null
  payrollPolicyEffectiveFrom?: string | null
  scheduleOptions?: MyScheduleOptions
  timeZone?: string
}): Promise<ApprovedTimesheetWeek[]> {
  const periods = payPeriodsOverlapping(rangeStart, rangeEnd, invoicing, timeZone)
  const weeks: ApprovedTimesheetWeek[] = []

  for (const user of users) {
    if (!periods.some((period) => participatesInPeriod(user, period.start, timeZone))) continue
    const rows = await listTimesheetStates(organizationId, user.id, 80)
    const byStart = new Map(rows.map((row) => [dayKey(row.weekStart, timeZone), row.draft]))
    const { operative } = findUserAndOperative(users, operatives, { userId: user.id })
    for (const period of periods) {
      const draft = byStart.get(dayKey(period.start, timeZone))
      if (!draft || !isTimesheetFullyApproved(draft, user, users)) continue
      let working = draft
      if (!working.weeklyReportOverride) {
        working = applyWeeklyReportOverride({
          draft: working,
          user,
          users,
          weekStart: period.start,
          weekEnd: period.end,
          bookings,
          managerSiteBookings,
          operatives,
          projects,
          smallWorks,
          history,
          aliasUserIds: users
            .filter((row) => row.email.trim().toLowerCase() === user.email.trim().toLowerCase())
            .map((row) => row.id),
          payrollPolicy,
          payrollPolicyPrior,
          payrollPolicyEffectiveFrom,
          scheduleOptions,
          timeZone,
        })
        // Never written back (M7): the report only reads timesheets.
      }
      if (!working.weeklyReportOverride) continue
      weeks.push({
        userId: user.id,
        personName: resolveDisplayName(user, operative),
        role: resolvePersonRole(user, operative),
        trade: resolvePersonTrade(user, operative),
        weekStart: period.start,
        weekEnd: period.end,
        override: working.weeklyReportOverride,
      })
    }
  }

  const preferredIds = new Set(
    users
      .filter((user) => user.passwordSet && user.isActive !== false)
      .map((user) => user.id)
  )
  const ordered = [...weeks].sort((a, b) => {
    const score = (week: ApprovedTimesheetWeek) =>
      (preferredIds.has(week.userId) ? 0 : 2) + (week.trade && week.trade !== 'General' ? 0 : 1)
    return score(a) - score(b)
  })
  return mergeDuplicatePersonWeeks(
    ordered,
    users.map((user) => ({ id: user.id, email: user.email })),
    timeZone
  )
}
