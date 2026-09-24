/**
 * Load fully approved timesheet snapshots for a weekly report range.
 * Missing `weeklyReportOverride` maps are built once and written back so iOS reads them too.
 */
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { MyScheduleOptions, OrgInvoicingSettings, OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_MY_SCHEDULE, DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { LONDON_TIME_ZONE, dayKey } from '@/lib/ios-parity/londonTime'
import { isTimesheetFullyApproved } from '@/lib/timesheets/timesheetApprovalPolicy'
import { payPeriodsOverlapping } from '@/lib/timesheets/timesheetPayrollPolicy'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { listTimesheetStates, saveTimesheetDraft } from '@/lib/timesheets/timesheetStorage'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { findUserAndOperative, resolveDisplayName, resolvePersonRole, resolvePersonTrade } from '@/lib/weekly-report/weeklyReportPayroll'
import type { ApprovedTimesheetWeek } from '@/lib/weekly-report/timesheetFeed'

function participatesInTimesheets(user: User): boolean {
  if (user.isActive === false) return false
  return Boolean(
    user.permissions?.operativeMode ||
      user.permissions?.manager ||
      user.permissions?.adminAccess ||
      user.isSuperAdmin ||
      user.role === 'manager' ||
      user.role === 'admin'
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
    if (!participatesInTimesheets(user)) continue
    const rows = await listTimesheetStates(organizationId, user.id, 80)
    const byStart = new Map(rows.map((row) => [dayKey(row.weekStart, timeZone), row.draft]))
    const { operative } = findUserAndOperative(users, operatives, { userId: user.id })
    for (const period of periods) {
      const draft = byStart.get(dayKey(period.start, timeZone))
      if (!draft || !isTimesheetFullyApproved(draft, user)) continue
      let working = draft
      if (!working.weeklyReportOverride) {
        working = applyWeeklyReportOverride({
          draft: working,
          user,
          weekStart: period.start,
          weekEnd: period.end,
          bookings,
          managerSiteBookings,
          operatives,
          projects,
          smallWorks,
          history,
          payrollPolicy,
          payrollPolicyPrior,
          payrollPolicyEffectiveFrom,
          scheduleOptions,
          timeZone,
        })
        if (working.weeklyReportOverride) {
          await saveTimesheetDraft({
            organizationId,
            userId: user.id,
            weekStart: period.start,
            draft: working,
            timeZone,
          })
        }
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

  return weeks
}
