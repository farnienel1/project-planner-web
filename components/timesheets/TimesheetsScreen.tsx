'use client'

import { formatMoney } from '@/lib/canonical/money'
import { useOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  forgetExportedTimesheetHistory,
  loadExportedTimesheetHistory,
  loadPayPeriodTimesheetDrafts,
  loadTimesheetDraft,
  loadTimesheetDraftsByUserHistory,
  mergeListedTimesheetDrafts,
  saveTimesheetDraft,
  timesheetSourceDocumentId,
  type ExportedTimesheetHistoryRow,
} from '@/lib/timesheets/timesheetStorage'
import { emptyTimesheetDraft, type TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { draftTimesheetTotals } from '@/lib/timesheets/timesheetAdjustments'
import { SIGNED_OFF_EDIT_NOTE, userTimesheetSelfSigned } from '@/lib/timesheets/timesheetApprovalPolicy'
import {
  SENSITIVE_EXPORT_OPTION_LABEL,
  canViewSensitiveProfile,
  exportIncludesSensitiveFields,
  resolveTimesheetPeriod,
  weekdayPaidHours,
  timesheetExportOwnSheetNotice,
} from '@/lib/canonical'
import { staffAccountRole } from '@/lib/permissions'
import { loadTaxIds } from '@/lib/sensitiveProfile/taxIdsService'
import { currentPeriodTimesheetMembers } from '@/lib/timesheets/timesheetHubStats'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { exportedTimesheetRosterGroups, subjectForUser, timesheetRosterGroups, userIdsSharingEmail } from '@/lib/timesheets/timesheetWeekUtils'
import { formatPaymentPeriodLine, listSelectablePayPeriods, periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { collectTimesheetPayroll } from '@/lib/timesheets/timesheetPayrollCollector'
import {
  invoiceLinesForTimesheet,
  invoiceLinesTotal,
  paymentRunDateStamp,
  pdfBytesToBase64,
  signatureNotes,
  timesheetExportFileName,
} from '@/lib/timesheets/timesheetExport'
import { buildTimesheetInvoicePdf, timesheetPdfBlob } from '@/lib/timesheets/invoicePdf'
import { shouldAppearInOperativeTimesheetRoster, timesheetDayKeysForPeriod } from '@/lib/timesheets/timesheetPayrollPolicy'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { timesheetExportPath, uploadFile } from '@/lib/firebase/storageUtils'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import {
  DEFAULT_MY_SCHEDULE,
  orgPayrollPolicyForDay,
  type MyScheduleOptions,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { timesheetsTeamHref } from '@/lib/timesheets/timesheetRoutes'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { formatStampInZone } from '@/lib/orgTime/zoneTime'
import { PayInputsBanner } from '@/components/timesheets/PayInputsBanner'
import { ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid'
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  IconTile,
  Note,
  PuButton,
  SegmentedTabs,
  WarnIcon,
  type DataColumn,
} from '@/components/ui/page'
import { EXPORT_STOPPED_MESSAGE, type TimesheetInputsState } from '@/lib/timesheets/timesheetInputs'
import { runTimesheetExport } from '@/lib/timesheets/timesheetExportRun'
import type { PayrollTimePolicyState } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

export type TeamTimesheetTab = 'awaiting' | 'signed' | 'exported'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function displayName(member: User): string {
  return `${member.firstName} ${member.surname}`.trim() || member.email
}

export function TimesheetsScreen({
  bookings,
  managerSiteBookings,
  operatives,
  users,
  projects = [],
  smallWorks = [],
  periodStart,
  periodEnd,
  payrollPolicy,
  payrollPolicyPrior = null,
  payrollPolicyEffectiveFrom = null,
  payrollPolicyState = null,
  invoicing,
  loading,
  teamTab,
  timeZone = organizationZoneOr(),
  history = emptyDayRateHistory(),
  scheduleOptions = DEFAULT_MY_SCHEDULE,
  payInputs,
}: {
  payInputs: TimesheetInputsState
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  projects?: Project[]
  smallWorks?: Project[]
  periodStart: Date
  periodEnd: Date
  payrollPolicy: OrgPayrollTimePolicy
  payrollPolicyPrior?: OrgPayrollTimePolicy | null
  payrollPolicyEffectiveFrom?: string | null
  /** Rulebook 1.19.0: the whole working-hours state; each day is priced under the rules in effect on it. */
  payrollPolicyState?: PayrollTimePolicyState | null
  invoicing: OrgInvoicingSettings
  loading?: boolean
  teamTab: TeamTimesheetTab
  timeZone?: string
  history?: OperativeDayRateHistoryCollection
  scheduleOptions?: MyScheduleOptions
}) {
  const currency = useOrganizationCurrency()
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const [drafts, setDrafts] = useState<Map<string, TimesheetDraft>>(new Map())
  const [exportedRows, setExportedRows] = useState<ExportedTimesheetHistoryRow[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Exports leave UTR and VAT out unless an admin ticks the box (rulebook).
  const [exportTaxIds, setExportTaxIds] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkingEarlier, setCheckingEarlier] = useState(false)
  const [exportedSearch, setExportedSearch] = useState('')
  const [exportedSort, setExportedSort] = useState<'firstName' | 'lastName' | 'dateNewest' | 'dateOldest'>('dateNewest')
  const [exportedRunKey, setExportedRunKey] = useState('all')
  const paintedListKey = useRef('')
  const reloadGeneration = useRef(0)

  const groups = useMemo(() => {
    if (!user) return [] as User[][]
    // Rulebook 1.31.0: the Exported list is `exportedTimesheetHistorySubjects` (own sheets read-only, inactive people
    // in scope); the other tabs stay `userTimesheetSubjects`.
    return (teamTab === 'exported' ? exportedTimesheetRosterGroups(user, users) : timesheetRosterGroups(user, users))
      .map((group) =>
        teamTab === 'exported'
          ? group
          : group.filter((member) =>
              shouldAppearInOperativeTimesheetRoster(member, periodStart, periodEnd, invoicing, new Date(), timeZone)
            )
      )
      .filter((group) => group.length > 0)
  }, [user, users, teamTab, periodStart, periodEnd, invoicing, timeZone])

  const roster = useMemo(() => groups.flat(), [groups])

  const reload = useCallback(async () => {
    if (!organization?.id) return
    const generation = ++reloadGeneration.current
    const stale = () => generation !== reloadGeneration.current
    const userIds = roster.map((row) => row.id)
    if (teamTab === 'exported') {
      if (userIds.length === 0) {
        setExportedRows([])
        setRecordsLoading(false)
        return
      }
      setRecordsLoading(true)
      setLoadError(null)
      try {
        setExportedRows(await loadExportedTimesheetHistory({ organizationId: organization.id, users: roster }))
      } catch {
        setLoadError('Timesheets did not finish loading. Check the connection and try again.')
      } finally {
        setRecordsLoading(false)
      }
      return
    }

    const listKey = `${organization.id}|${teamTab}|${periodStart.getTime()}|${periodEnd.getTime()}`
    if (paintedListKey.current !== listKey) {
      paintedListKey.current = listKey
      setDrafts(new Map())
      setRecordsLoading(true)
    }
    setLoadError(null)
    let listed = new Map<string, TimesheetDraft>()
    try {
      const indexed = await loadPayPeriodTimesheetDrafts(organization.id, periodStart, timeZone)
      if (stale()) return
      listed = mergeListedTimesheetDrafts(listed, indexed)
      setDrafts((current) => mergeListedTimesheetDrafts(current, listed))
    } catch (error) {
      // Rulebook 1.26.0 §16: with `privatePay` on, the rules refuse a non-admin's period-wide query (it could return
      // sheets of people whose pay they may not see). Only that refusal falls through to the per-person reads below;
      // any other failure (offline, timeout, missing index) still shows the error.
      const code = (error as { code?: unknown } | null)?.code
      if (code !== 'permission-denied' || userIds.length === 0) {
        if (!stale()) setLoadError('Timesheets did not finish loading. Check the connection and try again.')
        return
      }
    } finally {
      if (!stale()) setRecordsLoading(false)
    }

    const missing = userIds.filter((id) => !listed.has(id))
    if (stale() || missing.length === 0) return
    setCheckingEarlier(true)
    try {
      const extra = await loadTimesheetDraftsByUserHistory(organization.id, missing, periodStart, timeZone, periodEnd)
      if (stale()) return
      setDrafts((current) => mergeListedTimesheetDrafts(current, extra))
    } catch {
      // The pay-period rows already on screen stay. This scan is not allowed to blank the tab.
    } finally {
      if (!stale()) setCheckingEarlier(false)
    }
  }, [organization?.id, roster, periodStart, periodEnd, timeZone, teamTab])

  useEffect(() => {
    void reload()
  }, [reload])

  // Rulebook 1.32.0 §8: the export never includes the exporter's own sheet; say so when theirs is signed and waiting.
  const [ownSheet, setOwnSheet] = useState<{ signed: boolean; exported: boolean } | null>(null)
  useEffect(() => {
    if (teamTab !== 'signed' || !organization?.id || !user?.id) {
      setOwnSheet(null)
      return
    }
    let live = true
    loadTimesheetDraft(organization.id, user.id, periodStart, timeZone, periodEnd)
      .then((draft) => live && setOwnSheet({ signed: Boolean(draft.operativeSignedAt), exported: Boolean(draft.exportedAt) }))
      .catch(() => live && setOwnSheet(null))
    return () => {
      live = false
    }
  }, [teamTab, organization?.id, user?.id, periodStart, periodEnd, timeZone])
  const ownSheetNotice = ownSheet ? timesheetExportOwnSheetNotice({ ownSheetSigned: ownSheet.signed, ownSheetExported: ownSheet.exported }) : null

  const visible = useMemo(
    () => (teamTab === 'exported' ? [] : currentPeriodTimesheetMembers(groups, drafts, teamTab, users)),
    [groups, drafts, teamTab, users]
  )

  const summaryFor = (member: User, draft: TimesheetDraft | undefined, start: Date, end: Date) => {
    const payroll = collectTimesheetPayroll({
      user: member,
      bookings,
      managerSiteBookings,
      operatives,
      projects,
      smallWorks,
      periodStart: start,
      periodEnd: end,
      payrollPolicy,
      payrollPolicyPrior,
      payrollPolicyEffectiveFrom,
      payrollPolicyState,
      timeZone,
      history,
      scheduleOptions,
      aliasUserIds: userIdsSharingEmail(member, users),
    })
    // Rulebook 1.22.0 (§8): `timesheetTotals` — the export invoice's figures (declined entries 0, revised at the
    // revision, a stale review at its own amount, PAYE days left out), never a raw sum of entries.
    const totals = draftTimesheetTotals({
      lines: payroll.lineItems,
      draft: draft ?? emptyTimesheetDraft(),
      decided: true,
      timesheetDays: timesheetDayKeysForPeriod(member, start, end, timeZone),
      timeZone,
    })
    return { hours: totals.hours, overtimeHours: totals.overtimeHours, priceWork: totals.priceWork, expenses: totals.expenses }
  }

  // Rulebook 1.43.0 (review r318): the bookings gate as it is NOW (not as it was when Export was pressed), re-checked
  // before each person — `coverage` can drop mid-export (a re-plan, a network blip).
  const payInputsRef = useRef(payInputs)
  payInputsRef.current = payInputs

  /**
   * Rulebook 1.43.0 (review r318): one sheet of an export, prepared without writing anything — re-read fresh (the
   * stamp and the invoice are built from this copy); a sheet already exported is left exactly as it is; a fresh copy
   * the person has not signed is left out; the snapshot is built (rebuilt if frozen empty,
   * `timesheetSnapshotNeedsRebuild`) BEFORE `exportedAt` is set, because an exported snapshot is never rebuilt.
   */
  const prepareExport = async (
    member: User,
    exportedAt: Date
  ): Promise<{ draft: TimesheetDraft; documentId: string | null; member: User } | { skip: 'exported' } | null> => {
    if (!organization?.id || !user) return null
    const full = await loadTimesheetDraft(organization.id, member.id, periodStart, timeZone, periodEnd)
    if (full.exportedAt) return { skip: 'exported' }
    if (!full.operativeSignedAt) return null
    const built = applyWeeklyReportOverride({
      draft: { ...full, exportedAt: null },
      user: member,
      users,
      viewer: user,
      weekStart: periodStart,
      weekEnd: periodEnd,
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
    })
    return { draft: { ...built, exportedAt }, documentId: timesheetSourceDocumentId(full), member }
  }

  const stampExport = async (sheet: { draft: TimesheetDraft; documentId: string | null; member: User }) => {
    if (!organization?.id) return
    await saveTimesheetDraft({
      organizationId: organization.id,
      userId: sheet.member.id,
      weekStart: periodStart,
      weekEnd: periodEnd,
      draft: sheet.draft,
      timeZone,
      documentId: sheet.documentId,
      access: { subjectHasLineManager: !userTimesheetSelfSigned(sheet.member, users) },
    })
  }

  const exportSigned = async () => {
    if (!organization?.id || !user || visible.length === 0) return
    // Never export or freeze `weeklyReportOverride` from default settings / an empty pay history.
    if (!payInputs.ready) {
      setExportMessage(payInputs.message)
      return
    }
    const recipientEmail = user.email?.trim()
    setExporting(true)
    setExportMessage(null)
    const stamp = paymentRunDateStamp(periodStart, periodEnd, timeZone)
    const periodLine = formatPaymentPeriodLine(periodStart, periodEnd, timeZone)
    const downloadLinks: Array<{ fileName: string; url: string }> = []
    const pdfAttachments: Array<{ fileName: string; content: string }> = []
    const failed: string[] = []
    const exportedAt = new Date()
    let stopMessage: string | null = null
    try {
      const run = await runTimesheetExport({
        members: visible.filter((member) => drafts.has(member.id)),
        memberId: (member) => member.id,
        memberName: (member) => displayName(member),
        // Rulebook 1.43.0 (review r318): every person is prepared (and the gate checked) before anyone is stamped.
        gateReady: () => payInputsRef.current.ready,
        prepare: (member) => prepareExport(member, exportedAt),
        stamp: (row) => stampExport(row.sheet),
        forgetHistory: forgetExportedTimesheetHistory,
        // Every sheet that was stamped gets its PDF, backup and email — also when a later stamp failed.
        deliver: async (rows) => {
          const exported = new Map(rows.map((row) => [row.memberId, row.sheet.draft]))
          for (const member of visible) {
            // Review r318: the invoice is the snapshot that was just saved (`exported`); a skipped sheet gets none.
            const agreed = exported.get(member.id)
            if (!agreed) continue
            const name = displayName(member)
            const payroll = collectTimesheetPayroll({
              user: member,
              bookings,
              managerSiteBookings,
              operatives,
              projects,
              smallWorks,
              periodStart,
              periodEnd,
              payrollPolicy,
              payrollPolicyPrior,
              payrollPolicyEffectiveFrom,
              payrollPolicyState,
              timeZone,
              history,
              scheduleOptions,
              aliasUserIds: userIdsSharingEmail(member, users),
            })
            const lines = invoiceLinesForTimesheet({
              payroll,
              draft: agreed,
              timeZone,
              extrasMode: 'export',
              standardDayHours: weekdayPaidHours(payrollPolicy),
              // Rulebook 1.19.0: a signed line's day units against the standard day in effect on its own day.
              standardDayHoursOn: (date: Date) =>
                weekdayPaidHours(
                  orgPayrollPolicyForDay(date, payrollPolicy, payrollPolicyPrior, payrollPolicyEffectiveFrom, timeZone, null, payrollPolicyState)
                ),
              currencyCode: currency,
              // Rulebook 1.11.0: only the self-employed days of the period reach the invoice.
              timesheetDays: timesheetDayKeysForPeriod(member, periodStart, periodEnd, timeZone),
            })
            const includeTaxIds = exportIncludesSensitiveFields({
              requested: exportTaxIds,
              canView: canViewSensitiveProfile({
                viewerRole: staffAccountRole(user),
                viewerUserId: user.id,
                subjectUserId: member.id,
              }),
            })
            const taxIds = includeTaxIds ? await loadTaxIds(member.id, member).catch(() => null) : null
            const pdf = buildTimesheetInvoicePdf({
              organizationName: organization.name || 'Organisation',
              subject: subjectForUser(member, operatives),
              weekStart: periodStart,
              weekEnd: periodEnd,
              amount: invoiceLinesTotal(lines),
              vatNumber: taxIds?.vatNumber || undefined,
              utrNumber: taxIds?.utrNumber || undefined,
              timeZone,
              lines,
              notes: signatureNotes(agreed, timeZone),
              documentTitle: 'Timesheet',
              periodMetaLabel: 'PAYMENT RUN',
              totalLabel: 'Total timesheet amount',
              emptyStateMessage: 'No work entries were found for this timesheet period.',
              currencyCode: currency,
            })
            const fileName = timesheetExportFileName(name, stamp)
            pdfAttachments.push({ fileName, content: pdfBytesToBase64(pdf) })
            try {
              const url = await uploadFile(
                timesheetExportPath(organization.id, fileName),
                timesheetPdfBlob(pdf),
                'application/pdf'
              )
              downloadLinks.push({ fileName, url })
            } catch {
              failed.push(name)
            }
          }
          if (recipientEmail && pdfAttachments.length > 0) {
            const response = await fetch('/api/timesheets/export-email', {
              method: 'POST',
              headers: await jsonAuthHeaders(),
              body: JSON.stringify({
                organizationId: organization.id,
                recipientEmail,
                recipientName: `${user.firstName} ${user.surname}`.trim() || user.email,
                organizationName: organization.name || 'Organisation',
                weekTitle: periodLine,
                paymentRunStamp: stamp,
                timesheetCount: pdfAttachments.length,
                attachmentNames: pdfAttachments.map((row) => row.fileName),
                downloadLinks,
                pdfAttachments,
              }),
            })
            const payload = (await response.json().catch(() => ({}))) as { error?: string }
            if (!response.ok) {
              setExportMessage(payload.error || 'Timesheets were exported. Email delivery failed.')
              router.replace(timesheetsTeamHref({ tab: 'exported' }))
              return
            }
            setExportMessage(
              failed.length
                ? `Emailed ${pdfAttachments.length} to ${recipientEmail}. Storage backup skipped: ${failed.join(', ')}.`
                : `Emailed ${pdfAttachments.length} timesheet${pdfAttachments.length === 1 ? '' : 's'} to ${recipientEmail} for filing.`
            )
          } else if (!recipientEmail) {
            setExportMessage('Timesheets were exported. Add an email address to receive the filing copy.')
          } else {
            setExportMessage(failed.length ? `Exported. Storage backup skipped: ${failed.join(', ')}.` : 'Timesheets exported.')
          }
        },
      })
      if (run.stopped?.reason === 'gate') {
        setExportMessage(EXPORT_STOPPED_MESSAGE)
        return
      }
      if (run.stopped?.reason === 'stamp') {
        const why = run.stopped.error instanceof Error ? ` (${run.stopped.error.message})` : ''
        stopMessage = `Export stopped${why}: ${run.stamped.length} timesheet${run.stamped.length === 1 ? ' was' : 's were'} exported and sent; the rest were not. Try again for the rest.`
      }
      const skipped = run.skipped
      if (skipped.length > 0) {
        setExportMessage((message) => `${message ?? 'Timesheets exported.'} Already exported, left as it was: ${skipped.join(', ')}.`)
      }
      if (stopMessage) setExportMessage((message) => `${stopMessage}${message ? ` ${message}` : ''}`)
      router.replace(timesheetsTeamHref({ tab: 'exported' }))
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  if ((loading && users.length === 0) || (recordsLoading && visible.length === 0)) return <LoadingSpinner />

  if (loadError) {
    return (
      <Card>
        <EmptyState
          tile={<IconTile tone="red" size="lg"><WarnIcon /></IconTile>}
          title="Timesheets did not load"
          description={loadError}
        >
          <PuButton size="sm" onClick={() => void reload()}>
            Try again
          </PuButton>
        </EmptyState>
      </Card>
    )
  }

  const emptyTitle =
    teamTab === 'exported'
      ? 'No exported timesheets'
      : teamTab === 'signed'
        ? 'No signed-off timesheets'
        : 'No timesheets awaiting sign-off'
  const emptyDescription =
    teamTab === 'exported'
      ? 'Exported timesheets stay here for years. Open a row to edit agreed days, price work or expenses; those changes feed the weekly report.'
      : teamTab === 'signed'
        ? `Counter-signed and ready. Email and export sends timesheet PDFs to your email for filing. ${SIGNED_OFF_EDIT_NOTE}`
        : 'People appear here only after they have signed their own timesheet. Unsigned booked hours stay on My Timesheets until they sign.'

  if (teamTab === 'exported') {
    return (
      <ExportedTimesheetsList
        rows={exportedRows}
        invoicing={invoicing}
        timeZone={timeZone}
        search={exportedSearch}
        sort={exportedSort}
        runKey={exportedRunKey}
        onSearch={setExportedSearch}
        onSort={setExportedSort}
        onRunKey={setExportedRunKey}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        summaryFor={summaryFor}
        users={users}
        viewer={user}
        onOpen={(row, period) =>
          router.push(
            timesheetsTeamHref({
              tab: 'exported',
              user: row.user.id,
              period: periodStartKey(period.start, timeZone),
              periodEnd: dayKey(period.end, timeZone),
            })
          )
        }
      />
    )
  }

  if (visible.length === 0) {
    return (
      <Card>
        <EmptyState
          tile={<IconTile tone={teamTab === 'signed' ? 'green' : 'amber'} size="lg"><ClockIcon /></IconTile>}
          title={emptyTitle}
          description={emptyDescription}
        >
          {checkingEarlier ? <span>Checking the rest of the team…</span> : null}
        </EmptyState>
      </Card>
    )
  }

  return (
    <>
      {checkingEarlier ? <Note tone="info">Checking the rest of the team…</Note> : null}
      <Card>
      <MemberTable viewer={user}>
        {visible.map((member) => {
          const draft = drafts.get(member.id)
          const summary = summaryFor(member, draft, periodStart, periodEnd)
          return (
            <MemberRow
              key={member.id}
              member={member}
              users={users}
              viewer={user}
              pill={teamTab === 'signed' ? 'Signed off' : 'Pending'}
              pillHue={teamTab === 'signed' ? 'green' : 'warn'}
              summary={summary}
              onClick={() =>
                router.push(
                  timesheetsTeamHref({
                    tab: teamTab,
                    user: member.id,
                    period: periodStartKey(periodStart, timeZone),
                    periodEnd: dayKey(periodEnd, timeZone),
                  })
                )
              }
            />
          )
        })}
      </MemberTable>
      </Card>
      {teamTab === 'signed' ? (
        <Card>
        <div className="pu-card-b">
          <Note tone="green">{SIGNED_OFF_EDIT_NOTE}</Note>
          {user && canViewSensitiveProfile({ viewerRole: staffAccountRole(user), viewerUserId: user.id, subjectUserId: '' }) ? (
            <label className="pu-form-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={exportTaxIds} onChange={(e) => setExportTaxIds(e.target.checked)} />
              {SENSITIVE_EXPORT_OPTION_LABEL}
            </label>
          ) : null}
          <PayInputsBanner inputs={payInputs} />
          <PuButton variant="primary" block disabled={exporting || !payInputs.ready} onClick={() => void exportSigned()}>
            {exporting ? 'Sending timesheets…' : `Email and export ${visible.length} timesheet${visible.length === 1 ? '' : 's'}`}
          </PuButton>
          {ownSheetNotice ? <Note tone="amber">{ownSheetNotice}</Note> : null}
          {exportMessage ? <span className="pu-sub">{exportMessage}</span> : null}
        </div>
        </Card>
      ) : null}
    </>
  )
}

function formatQueueHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Table shell for User Timesheets rows: the Line manager column only when the rows show it (admins). */
function MemberTable({ viewer, exported, children }: { viewer: User | null; exported?: boolean; children: ReactNode }) {
  const columns: DataColumn[] = [
    { key: 'person', label: 'Person' },
    ...(exported
      ? [
          { key: 'run', label: 'Pay run' },
          { key: 'exported', label: 'Exported' },
        ]
      : []),
    { key: 'hrs', label: 'Hrs', align: 'right' as const },
    { key: 'ot', label: 'OT', align: 'right' as const },
    { key: 'pw', label: 'PW', align: 'right' as const },
    { key: 'exp', label: 'Exp', align: 'right' as const },
    { key: 'role', label: 'Role' },
    ...(hasAdminAccess(viewer) ? [{ key: 'lm', label: 'Line manager' }] : []),
    { key: 'status', label: 'Status' },
  ]
  return <DataTable columns={columns}>{children}</DataTable>
}

function MemberRow({
  member,
  users,
  viewer,
  pill,
  pillHue,
  summary,
  periodLine,
  exportedAt,
  timeZone,
  onClick,
}: {
  member: User
  users: User[]
  viewer: User | null
  pill: string
  pillHue: 'warn' | 'green' | 'lib'
  summary: { hours: number; overtimeHours: number; priceWork: number; expenses: number }
  periodLine?: string
  exportedAt?: Date | null
  timeZone?: string
  onClick: () => void
}) {
  const currency = useOrganizationCurrency()
  const role = member.permissions.operativeMode ? 'Operative' : hasAdminAccess(member) ? 'Admin' : 'Manager'
  const lineManager = (() => {
    if (!hasAdminAccess(viewer)) return null
    const managerId = member.assignedManagerUserIds?.[0] || member.assignedManagerUserId
    if (!managerId) return 'Unassigned'
    const manager = users.find((row) => row.id === managerId)
    return manager ? displayName(manager) : 'Unknown'
  })()
  const name = displayName(member)
  const exportedColumns = periodLine !== undefined
  return (
    <tr className="click" onClick={onClick}>
      <td>
        <span className="pu-who">
          <IconTile tone={role === 'Operative' ? 'green' : role === 'Admin' ? 'purple' : 'blue'} size="sm" round>
            {initials(name)}
          </IconTile>
          <span>
            <button
              type="button"
              className="pu-rowbtn"
              onClick={(event) => {
                event.stopPropagation()
                onClick()
              }}
            >
              <b>{name}</b>
            </button>
          </span>
        </span>
      </td>
      {exportedColumns ? (
        <>
          <td style={{ color: 'var(--pu-blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>{periodLine}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{exportedAt && timeZone ? formatStampInZone(exportedAt, timeZone) : ''}</td>
        </>
      ) : null}
      <td className="num">{formatQueueHours(summary.hours)}</td>
      <td className="num">{formatQueueHours(summary.overtimeHours)}</td>
      <td className="num">{formatMoney(summary.priceWork, currency)}</td>
      <td className="num">{formatMoney(summary.expenses, currency)}</td>
      <td>{role}</td>
      {lineManager != null ? <td>{lineManager}</td> : null}
      <td>
        <Chip tone={pillHue === 'warn' ? 'amber' : pillHue === 'green' ? 'green' : 'slate'}>{pill}</Chip>
      </td>
    </tr>
  )
}

function exportedRowPeriod(
  row: ExportedTimesheetHistoryRow,
  invoicing: OrgInvoicingSettings,
  timeZone: string
): { start: Date; end: Date } {
  const live = computeInvoicingPeriod(row.weekStart, invoicing, timeZone)
  const resolved = resolveTimesheetPeriod({
    storedStartDayKey: dayKey(row.weekStart, timeZone),
    storedEndDayKey: row.endDayKey,
    currentPeriod: { startDayKey: dayKey(live.start, timeZone), endDayKey: dayKey(live.end, timeZone) },
  })
  return {
    start: dateFromDayKey(resolved.startDayKey, timeZone),
    end: dateFromDayKey(resolved.endDayKey, timeZone),
  }
}

function ExportedTimesheetsList({
  rows,
  invoicing,
  timeZone,
  search,
  sort,
  runKey,
  onSearch,
  onSort,
  onRunKey,
  emptyTitle,
  emptyDescription,
  summaryFor,
  users,
  viewer,
  onOpen,
}: {
  rows: ExportedTimesheetHistoryRow[]
  invoicing: OrgInvoicingSettings
  timeZone: string
  search: string
  sort: 'firstName' | 'lastName' | 'dateNewest' | 'dateOldest'
  runKey: string
  onSearch: (value: string) => void
  onSort: (value: 'firstName' | 'lastName' | 'dateNewest' | 'dateOldest') => void
  onRunKey: (value: string) => void
  emptyTitle: string
  emptyDescription: string
  summaryFor: (member: User, draft: TimesheetDraft | undefined, start: Date, end: Date) => {
    hours: number
    overtimeHours: number
    priceWork: number
    expenses: number
  }
  users: User[]
  viewer: User | null
  onOpen: (row: ExportedTimesheetHistoryRow, period: { start: Date; end: Date }) => void
}) {
  const observed = rows.map((row) => exportedRowPeriod(row, invoicing, timeZone))
  const runs = listSelectablePayPeriods(invoicing, new Date(), 120, timeZone, observed)
  const needle = search.trim().toLowerCase()
  const filtered = rows
    .map((row) => ({ row, period: exportedRowPeriod(row, invoicing, timeZone) }))
    .filter(({ row, period }) => {
      if (runKey !== 'all') {
        const key = `${periodStartKey(period.start, timeZone)}|${dayKey(period.end, timeZone)}`
        if (key !== runKey) return false
      }
      if (!needle) return true
      const name = `${row.user.firstName} ${row.user.surname} ${row.user.email}`.toLowerCase()
      const periodLine = formatPaymentPeriodLine(period.start, period.end, timeZone).toLowerCase()
      return name.includes(needle) || periodLine.includes(needle)
    })
    .sort((left, right) => {
      if (sort === 'firstName') return left.row.user.firstName.localeCompare(right.row.user.firstName)
      if (sort === 'lastName') return left.row.user.surname.localeCompare(right.row.user.surname)
      const leftAt = left.row.draft.exportedAt?.getTime() || 0
      const rightAt = right.row.draft.exportedAt?.getTime() || 0
      return sort === 'dateOldest' ? leftAt - rightAt : rightAt - leftAt
    })

  return (
    <Card>
      <div className="pu-toolbar" style={{ alignItems: 'flex-end' }}>
        <div className="pu-toolbar-group">
          <label className="pu-form-label" htmlFor="exported-search">
            Search
          </label>
          <span className="pu-field">
            <MagnifyingGlassIcon width={16} height={16} aria-hidden="true" />
            <input
              id="exported-search"
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Name or payment run"
            />
          </span>
        </div>
        <div className="pu-toolbar-group">
          <p className="pu-form-label">Filter</p>
          <SegmentedTabs
            ariaLabel="Sort exported timesheets"
            items={[
              { id: 'firstName', label: 'First name' },
              { id: 'lastName', label: 'Last name' },
              { id: 'dateNewest', label: 'Date newest' },
              { id: 'dateOldest', label: 'Date oldest' },
            ]}
            value={sort}
            onChange={onSort}
          />
        </div>
        <div className="pu-toolbar-group">
          <label htmlFor="exported-run" className="pu-form-label">
            Payment run
          </label>
          <select id="exported-run" value={runKey} onChange={(event) => onRunKey(event.target.value)} className="pu-sel">
            <option value="all">All payment runs</option>
            {runs.map((period) => {
              const key = `${periodStartKey(period.start, timeZone)}|${dayKey(period.end, timeZone)}`
              return (
                <option key={key} value={key}>
                  {formatPaymentPeriodLine(period.start, period.end, timeZone)}
                </option>
              )
            })}
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          tile={<IconTile tone="slate" size="lg"><ClockIcon /></IconTile>}
          title={rows.length === 0 ? emptyTitle : 'No matching exported timesheets'}
          description={rows.length === 0 ? emptyDescription : 'Try another name, sort, or payment run.'}
        />
      ) : (
        <MemberTable viewer={viewer} exported>
          {filtered.map(({ row, period }) => {
            const summary = summaryFor(row.user, row.draft, period.start, period.end)
            return (
              <MemberRow
                key={row.id}
                member={row.user}
                users={users}
                viewer={viewer}
                pill="Exported"
                pillHue="lib"
                summary={summary}
                periodLine={formatPaymentPeriodLine(period.start, period.end, timeZone)}
                exportedAt={row.draft.exportedAt}
                timeZone={timeZone}
                onClick={() => onOpen(row, period)}
              />
            )
          })}
        </MemberTable>
      )}
    </Card>
  )
}
