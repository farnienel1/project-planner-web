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
import { dayKey } from '@/lib/ios-parity/londonTime'
import { isTimesheetFullyApproved } from '@/lib/timesheets/timesheetApprovalPolicy'
import { normalizeDocumentId, timesheetParticipant } from '@/lib/canonical'
import { payPeriodsOverlapping } from '@/lib/timesheets/timesheetPayrollPolicy'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { periodBookingChanges } from '@/lib/timesheets/timesheetBookingChanges'
import { listTimesheetStates } from '@/lib/timesheets/timesheetStorage'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { findUserAndOperative, resolveDisplayName, resolvePersonRole, resolvePersonTrade } from '@/lib/weekly-report/weeklyReportPayroll'
import { mergeDuplicatePersonWeeks, type ApprovedTimesheetWeek } from '@/lib/weekly-report/timesheetFeed'
import type { PayrollTimePolicyState, WeeklyReportPaySheet } from '@/lib/canonical'
import { timesheetSnapshotMoneyRowsCurrent } from '@/lib/canonical'
import { collectTimesheetPayroll } from '@/lib/timesheets/timesheetPayrollCollector'
import { draftEntryFingerprints, draftStoredExported, timesheetSheetFields } from '@/lib/timesheets/timesheetAdjustments'
import { timesheetStatusFieldsFromDraft } from '@/lib/timesheets/timesheetHubStats'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

/** Rulebook 1.11.0: `timesheetParticipant` over the whole period (`showsMyTimesheets`) — self-employed on a day of it. */
function participatesInPeriod(user: User, period: { start: Date; end: Date }, timeZone: string): boolean {
  return timesheetParticipant(
    {
      ...user,
      name: `${user.firstName ?? ''} ${user.surname ?? ''}`.trim(),
      operativeMode: user.permissions?.operativeMode === true,
    },
    { startDayKey: dayKey(period.start, timeZone), endDayKey: dayKey(period.end, timeZone) },
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
  payrollPolicyState = null,
  scheduleOptions = DEFAULT_MY_SCHEDULE,
  timeZone = organizationZoneOr(),
  bookingsCoverFrom = () => false,
}: {
  /**
   * Rulebook 1.47.0 (review #325 item 6): whether the loaded labour and manager site bookings hold every booking from
   * this organisation day on. A sheet whose whole pay run is not held is never read as changed. Missing = never.
   */
  bookingsCoverFrom?: (startDayKey: string) => boolean
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
  /** Rulebook 1.19.0: the whole working-hours state; each day is priced under the rules in effect on it. */
  payrollPolicyState?: PayrollTimePolicyState | null
  scheduleOptions?: MyScheduleOptions
  timeZone?: string
}): Promise<WeeklyReportTimesheetLoad> {
  const periods = payPeriodsOverlapping(rangeStart, rangeEnd, invoicing, timeZone)
  const weeks: ApprovedTimesheetWeek[] = []
  // Rulebook 1.51.0 §7 (Q2): every payment run of every self-employed person in the range, for the check line
  // (`weeklyReportPayRows` `sheets`): the stored sheet (or none), its status, its booking changes and the live payroll
  // lines the timesheet collector builds for it (the input of `timesheetInvoiceRows`).
  const sheets: WeeklyReportPaySheet[] = []
  // Rulebook 1.45.0: evidence per price work / expense entry (by id), shared by every week so a merged week keeps it.
  const evidenceCounts: Record<string, number> = {}

  for (const user of users) {
    if (!periods.some((period) => participatesInPeriod(user, period, timeZone))) continue
    const rows = await listTimesheetStates(organizationId, user.id, 80)
    const byStart = new Map(rows.map((row) => [dayKey(row.weekStart, timeZone), row.draft]))
    const { operative } = findUserAndOperative(users, operatives, { userId: user.id })
    const aliasUserIds = users
      .filter((row) => row.email.trim().toLowerCase() === user.email.trim().toLowerCase())
      .map((row) => row.id)
    for (const period of periods) {
      if (!participatesInPeriod(user, period, timeZone)) continue
      const draft = byStart.get(dayKey(period.start, timeZone))
      const catalogue = {
        users,
        liveLoaded: true,
        // Only when the loaded window holds this pay run (a booking outside it is not deleted).
        coversPeriod: (p: { start: Date; end: Date }) => bookingsCoverFrom(dayKey(p.start, timeZone)),
        bookings,
        managerSiteBookings,
        operatives,
        projects,
        smallWorks,
        history,
        payrollPolicy,
        payrollPolicyPrior,
        payrollPolicyEffectiveFrom,
        payrollPolicyState,
        scheduleOptions,
        timeZone,
      }
      const checkChange = draft ? periodBookingChanges(catalogue, user, draft, period) : null
      const payroll = collectTimesheetPayroll({
        user,
        bookings,
        managerSiteBookings,
        operatives,
        projects,
        smallWorks,
        periodStart: period.start,
        periodEnd: period.end,
        payrollPolicy,
        payrollPolicyPrior,
        payrollPolicyEffectiveFrom,
        payrollPolicyState,
        timeZone,
        history,
        scheduleOptions,
        aliasUserIds,
      })
      sheets.push({
        personId: user.id,
        startDayKey: dayKey(period.start, timeZone),
        endDayKey: dayKey(period.end, timeZone),
        sheet: draft ? timesheetSheetFields(draft) : null,
        status: draft ? timesheetStatusFieldsFromDraft(draft) : null,
        change: checkChange ? { reopened: checkChange.reopened, changed: checkChange.changed, waitingFor: checkChange.waitingFor } : null,
        payrollLines: payroll.lineItems,
        entryFingerprints: draft ? draftEntryFingerprints(draft) : null,
      })
      if (!draft || !isTimesheetFullyApproved(draft, user, users)) continue
      // Rulebook 1.47.0 §8: a signed, unexported sheet whose bookings changed since it was signed is not approved until
      // it is signed (and counter-signed) again — the report shows its live bookings, never the stale snapshot.
      const change = checkChange
      // 1.54.0: late extras waiting for the line manager never take a signed sheet out of the feed (its signed money
      // stands; only approved late extras are in its snapshot).
      if (change?.reopened && change.bookingsChanged !== false) continue
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
          aliasUserIds,
          payrollPolicy,
          payrollPolicyPrior,
          payrollPolicyEffectiveFrom,
          payrollPolicyState,
          scheduleOptions,
          timeZone,
        })
        // Never written back (M7): the report only reads timesheets.
      }
      if (!working.weeklyReportOverride) continue
      // Rulebook 1.54.0 (third review of #337): a snapshot's late-extra rows count only while that late extra is still
      // approved at the same amount (`timesheetSnapshotMoneyRowsCurrent`); an exported sheet stays as signed.
      const signed = working.weeklyReportOverride
      const currentOptions = { entryFingerprints: draftEntryFingerprints(working), exportedAtStored: draftStoredExported(working) }
      const signedFields = timesheetSheetFields(working)
      const override = {
        ...signed,
        priceWork: timesheetSnapshotMoneyRowsCurrent(signedFields, signed.priceWork, currentOptions),
        expenses: timesheetSnapshotMoneyRowsCurrent(signedFields, signed.expenses, currentOptions),
      }
      for (const entry of [...working.priceWorkEntries, ...working.expenseEntries]) {
        const count = entry.evidence?.length ?? 0
        if (count > 0) evidenceCounts[normalizeDocumentId(entry.id)] = count
      }
      weeks.push({
        userId: user.id,
        personName: resolveDisplayName(user, operative),
        role: resolvePersonRole(user, operative),
        trade: resolvePersonTrade(user, operative),
        weekStart: period.start,
        weekEnd: period.end,
        override,
        evidenceCounts,
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
  return {
    weeks: mergeDuplicatePersonWeeks(
      ordered,
      users.map((user) => ({ id: user.id, email: user.email })),
      timeZone
    ),
    sheets,
  }
}

/** Rulebook 1.51.0: the approved-timesheet feed and the payment runs behind each self-employed person's check line. */
export type WeeklyReportTimesheetLoad = { weeks: ApprovedTimesheetWeek[]; sheets: WeeklyReportPaySheet[] }
