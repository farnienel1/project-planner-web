'use client'

/**
 * Owner item 5 (17 Nov follow-up): background repair of signed snapshots frozen with no labour lines, while a reviewer
 * has the Timesheets hub or User Timesheets open. Choice: `snapshotRepairCandidates`. Repair: the stored sheet is read
 * fresh (signatures included), checked again, rebuilt with `applyWeeklyReportOverride` (the same call the period page
 * and Export make; signatures and approver kept) and saved with `saveTimesheetDraft` (changed fields only, the
 * reviewer's write). One sheet at a time, once per sheet per session; never before `ready` (bookings and pay inputs
 * loaded from the server). A failure is left for the next session or the period page's own repair.
 */
import { useEffect, useRef } from 'react'
import { timesheetSnapshotNeedsRebuild } from '@/lib/canonical'
import { collectTimesheetPayroll } from '@/lib/timesheets/timesheetPayrollCollector'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { loadTimesheetDraftAt, saveTimesheetDraft } from '@/lib/timesheets/timesheetStorage'
import { userTimesheetSelfSigned } from '@/lib/timesheets/timesheetApprovalPolicy'
import { userIdsSharingEmail } from '@/lib/timesheets/timesheetWeekUtils'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { timesheetMemberIds } from '@/lib/timesheets/timesheetQueue'
import { snapshotRepairCandidates, type RepairSheet } from '@/lib/timesheets/snapshotAutoRepair'
import type { BookingChangeCatalogue } from '@/lib/timesheets/timesheetBookingChanges'
import type { User } from '@/types'

/** Tried this session, by organisation and document id (also across the hub and User Timesheets). */
const tried = new Set<string>()

export function useSnapshotAutoRepair(input: {
  organizationId: string | null | undefined
  viewer: User | null | undefined
  /** The collector's inputs (the screen's own `BookingChangeCatalogue`). */
  catalogue: BookingChangeCatalogue
  sheets: ReadonlyArray<RepairSheet>
  /** Bookings (server-confirmed, covering the sheets' pay runs) and pay inputs have loaded. */
  ready: boolean
  /** Called after a sheet was repaired (the screen reloads its rows). */
  onRepaired?: () => void
}): void {
  const latest = useRef(input)
  latest.current = input
  const running = useRef(false)
  const { organizationId, viewer, sheets, ready, catalogue } = input
  useEffect(() => {
    if (!ready || !organizationId || !viewer || running.current) return
    const { users, liveLoaded, coversPeriod, ...collector } = catalogue
    if (!liveLoaded) return
    const payrollFor = (sheet: RepairSheet) =>
      collectTimesheetPayroll({
        ...collector,
        user: sheet.member,
        periodStart: sheet.period.start,
        periodEnd: sheet.period.end,
        aliasUserIds: userIdsSharingEmail(sheet.member, [...users]),
      })
    const candidates = snapshotRepairCandidates({
      organizationId,
      sheets,
      viewer,
      users,
      liveLinesFor: (sheet) => payrollFor(sheet).lineItems,
      coversPeriod,
      tried,
    })
    if (candidates.length === 0) return
    running.current = true
    void (async () => {
      let repaired = 0
      try {
        for (const sheet of candidates) {
          tried.add(sheet.key)
          // Stop when the screen's inputs stopped being ready meanwhile (a re-plan, a network blip).
          if (!latest.current.ready) break
          try {
            const full = await loadTimesheetDraftAt(organizationId, sheet.documentId!, organizationZoneOr(collector.timeZone), timesheetMemberIds(sheet.member, users))
            if (!full || full.exportedAt) continue
            if (!timesheetSnapshotNeedsRebuild(full, payrollFor({ ...sheet, draft: full }).lineItems)) continue
            const built = applyWeeklyReportOverride({
              draft: full,
              user: sheet.member,
              users: [...users],
              viewer,
              weekStart: sheet.period.start,
              weekEnd: sheet.period.end,
              bookings: collector.bookings,
              managerSiteBookings: collector.managerSiteBookings,
              operatives: collector.operatives,
              projects: collector.projects,
              smallWorks: collector.smallWorks,
              history: collector.history,
              payrollPolicy: collector.payrollPolicy,
              payrollPolicyPrior: collector.payrollPolicyPrior,
              payrollPolicyEffectiveFrom: collector.payrollPolicyEffectiveFrom,
              payrollPolicyState: collector.payrollPolicyState,
              scheduleOptions: collector.scheduleOptions,
              timeZone: collector.timeZone,
            })
            if (!built.weeklyReportOverride || built.weeklyReportOverride.lines.length === 0) continue
            await saveTimesheetDraft({
              organizationId,
              userId: sheet.member.id,
              weekStart: sheet.period.start,
              weekEnd: sheet.period.end,
              draft: built,
              timeZone: organizationZoneOr(collector.timeZone),
              documentId: sheet.documentId,
              base: full,
              access: { reviewer: true, subjectHasLineManager: !userTimesheetSelfSigned(sheet.member, [...users]) },
            })
            repaired += 1
          } catch (error) {
            console.warn('[timesheets] background snapshot repair failed', { documentId: sheet.documentId, error })
          }
        }
      } finally {
        running.current = false
        if (repaired > 0) latest.current.onRepaired?.()
      }
    })()
  }, [ready, organizationId, viewer, sheets, catalogue])
}
