'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  loadCanonicalTimesheetDrafts,
  loadExportedTimesheetHistory,
  loadPayPeriodTimesheetDrafts,
  loadTimesheetDraft,
  loadTimesheetDrafts,
  mergeListedTimesheetDrafts,
  saveTimesheetDraft,
  timesheetSourceDocumentId,
  type ExportedTimesheetHistoryRow,
} from '@/lib/timesheets/timesheetStorage'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import { SIGNED_OFF_EDIT_NOTE } from '@/lib/timesheets/timesheetApprovalPolicy'
import { resolveTimesheetPeriod, timesheetListBucket } from '@/lib/canonical'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { groupHasLineManager, subjectForUser, timesheetRosterGroups, userIdsSharingEmail } from '@/lib/timesheets/timesheetWeekUtils'
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
import { shouldAppearInOperativeTimesheetRoster } from '@/lib/timesheets/timesheetPayrollPolicy'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { timesheetExportPath, uploadFile } from '@/lib/firebase/storageUtils'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import {
  DEFAULT_MY_SCHEDULE,
  type MyScheduleOptions,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { dateFromDayKey, dayKey, LONDON_TIME_ZONE } from '@/lib/ios-parity/londonTime'
import { timesheetsTeamHref } from '@/lib/timesheets/timesheetRoutes'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'
import { formatStampInZone } from '@/lib/orgTime/zoneTime'

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
  invoicing,
  loading,
  teamTab,
  timeZone = LONDON_TIME_ZONE,
  history = emptyDayRateHistory(),
  scheduleOptions = DEFAULT_MY_SCHEDULE,
}: {
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
  invoicing: OrgInvoicingSettings
  loading?: boolean
  teamTab: TeamTimesheetTab
  timeZone?: string
  history?: OperativeDayRateHistoryCollection
  scheduleOptions?: MyScheduleOptions
}) {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const [drafts, setDrafts] = useState<Map<string, TimesheetDraft>>(new Map())
  const [exportedRows, setExportedRows] = useState<ExportedTimesheetHistoryRow[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
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
    return timesheetRosterGroups(user, users)
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
      const canonical = await loadCanonicalTimesheetDrafts(organization.id, userIds, periodStart, timeZone)
      if (stale()) return
      listed = mergeListedTimesheetDrafts(listed, canonical)
      setDrafts((current) => mergeListedTimesheetDrafts(current, listed))
    } catch {
      if (!stale()) setLoadError('Timesheets did not finish loading. Check the connection and try again.')
      return
    } finally {
      if (!stale()) setRecordsLoading(false)
    }

    const missing = userIds.filter((id) => !listed.has(id))
    if (stale() || missing.length === 0) return
    setCheckingEarlier(true)
    try {
      for (let index = 0; index < missing.length; index += 8) {
        if (stale()) return
        const slice = missing.slice(index, index + 8)
        const extra = await loadTimesheetDrafts(organization.id, slice, periodStart, timeZone, periodEnd)
        if (stale()) return
        setDrafts((current) => mergeListedTimesheetDrafts(current, extra))
      }
    } catch {
      // The pay-period rows already on screen stay. This scan is not allowed to blank the tab.
    } finally {
      if (!stale()) setCheckingEarlier(false)
    }
  }, [organization?.id, roster, periodStart, periodEnd, timeZone, teamTab])

  const personDraft = (group: User[]) => {
    const signed = group
      .map((member) => ({ member, draft: drafts.get(member.id) }))
      .find((row) => row.draft?.operativeSignedAt)
    if (signed?.draft) return signed
    const any = group.map((member) => ({ member, draft: drafts.get(member.id) })).find((row) => row.draft)
    return any?.draft ? any : null
  }

  useEffect(() => {
    void reload()
  }, [reload])

  const visible = useMemo(() => {
    const rows: User[] = []
    for (const group of groups) {
      const picked = personDraft(group)
      if (!picked?.draft || teamTab === 'exported') continue
      const bucket = timesheetListBucket(
        {
          operativeSignedAtMs: picked.draft.operativeSignedAt?.getTime() ?? null,
          operativeSignedByName: picked.draft.operativeSignedByName || '',
          operativeSignatureImageBase64: picked.draft.operativeSignatureImageBase64 || '',
          managerSignedAtMs: picked.draft.managerSignedAt?.getTime() ?? null,
          managerSignedByName: picked.draft.managerSignedByName || '',
          managerSignedByUserId: picked.draft.managerSignedByUserId || '',
          managerSignatureImageBase64: picked.draft.managerSignatureImageBase64 || '',
          exportedAtMs: picked.draft.exportedAt?.getTime() ?? null,
        },
        groupHasLineManager(group)
      )
      if (bucket === teamTab) rows.push(picked.member)
    }
    return rows
  }, [groups, drafts, teamTab])

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
      timeZone,
      history,
      scheduleOptions,
      aliasUserIds: userIdsSharingEmail(member, users),
    })
    const priceWork = draft?.priceWorkEntries.reduce((sum, entry) => sum + entry.amount, 0) || 0
    const expenses = draft?.expenseEntries.reduce((sum, entry) => sum + entry.amount, 0) || 0
    return { hours: payroll.totalHours, overtimeHours: payroll.overtimeHours, priceWork, expenses }
  }

  const persistExportedFlag = async (exportedAt: Date) => {
    if (!organization?.id || !user) return
    for (const member of visible) {
      const listed = drafts.get(member.id)
      if (!listed) continue
      const full = await loadTimesheetDraft(organization.id, member.id, periodStart, timeZone, periodEnd)
      const documentId = timesheetSourceDocumentId(full)
      const source = full.operativeSignedAt ? full : listed
      if (!source.operativeSignedAt) continue
      const agreed = applyWeeklyReportOverride({
        draft: { ...source, exportedAt },
        user: member,
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
        scheduleOptions,
        timeZone,
      })
      await saveTimesheetDraft({
        organizationId: organization.id,
        userId: member.id,
        weekStart: periodStart,
        weekEnd: periodEnd,
        draft: agreed,
        timeZone,
        documentId,
      })
    }
  }

  const exportSigned = async () => {
    if (!organization?.id || !user || visible.length === 0) return
    const recipientEmail = user.email?.trim()
    setExporting(true)
    setExportMessage(null)
    const stamp = paymentRunDateStamp(periodStart, periodEnd, timeZone)
    const periodLine = formatPaymentPeriodLine(periodStart, periodEnd, timeZone)
    const downloadLinks: Array<{ fileName: string; url: string }> = []
    const pdfAttachments: Array<{ fileName: string; content: string }> = []
    const failed: string[] = []
    const exportedAt = new Date()
    try {
      await persistExportedFlag(exportedAt)
      for (const member of visible) {
        const draft = drafts.get(member.id)
        if (!draft) continue
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
          timeZone,
          history,
          scheduleOptions,
          aliasUserIds: userIdsSharingEmail(member, users),
        })
        const agreed = applyWeeklyReportOverride({
          draft: { ...draft, exportedAt },
          user: member,
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
          scheduleOptions,
          timeZone,
        })
        const lines = invoiceLinesForTimesheet({
          payroll,
          draft: agreed,
          timeZone,
          extrasMode: 'export',
          standardDayHours: payrollPolicy.standardPaidHours,
        })
        const pdf = buildTimesheetInvoicePdf({
          organizationName: organization.name || 'Organisation',
          subject: subjectForUser(member, operatives),
          weekStart: periodStart,
          weekEnd: periodEnd,
          amount: invoiceLinesTotal(lines),
          vatNumber: member.vatNumber,
          utrNumber: member.utrNumber,
          timeZone,
          lines,
          notes: signatureNotes(draft, timeZone),
          documentTitle: 'Timesheet',
          periodMetaLabel: 'PAYMENT RUN',
          totalLabel: 'Total timesheet amount',
          emptyStateMessage: 'No work entries were found for this timesheet period.',
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
      <div className="empty card pad">
        <h3>Timesheets did not load</h3>
        <p>{loadError}</p>
        <button type="button" className="btn sm" onClick={() => void reload()}>
          Try again
        </button>
      </div>
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
      <div className="empty card pad">
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
        {checkingEarlier ? <p className="muted">Checking the rest of the team…</p> : null}
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {checkingEarlier ? <p className="muted">Checking the rest of the team…</p> : null}
      <div className="rows">
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
      </div>
      {teamTab === 'signed' ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="muted small">{SIGNED_OFF_EDIT_NOTE}</p>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportSigned()}
            className="btn primary block"
          >
            {exporting ? 'Sending timesheets…' : `Email and export ${visible.length} timesheet${visible.length === 1 ? '' : 's'}`}
          </button>
          {exportMessage ? <p className="muted small">{exportMessage}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function formatQueueHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
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
  const role = member.permissions.operativeMode ? 'Operative' : hasAdminAccess(member) ? 'Admin' : 'Manager'
  const lineManager = (() => {
    if (!hasAdminAccess(viewer)) return null
    const managerId = member.assignedManagerUserIds?.[0] || member.assignedManagerUserId
    if (!managerId) return 'Unassigned'
    const manager = users.find((row) => row.id === managerId)
    return manager ? displayName(manager) : 'Unknown'
  })()
  return (
    <button type="button" onClick={onClick} className="ritem" data-hue="ts">
      <span className="ico-chip">{initials(displayName(member))}</span>
      <span className="grow">
        <span className="t">{displayName(member)}</span>
        {periodLine ? <span className="s" style={{ color: 'var(--ts)', fontWeight: 600 }}>{periodLine}</span> : null}
        {exportedAt && timeZone ? (
          <span className="s">Exported {formatStampInZone(exportedAt, timeZone)}</span>
        ) : null}
        <span className="s">
          Hrs {formatQueueHours(summary.hours)} · OT {formatQueueHours(summary.overtimeHours)} · PW £{summary.priceWork.toFixed(2)} · Exp £
          {summary.expenses.toFixed(2)} · {role}
        </span>
        {lineManager ? <span className="s">Line manager: {lineManager}</span> : null}
      </span>
      <span className="pill" data-hue={pillHue}>
        {pill}
      </span>
    </button>
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
    <div className="stack" style={{ gap: 12 }}>
      <div className="card pad" data-hue="ts">
        <label className="muted small" htmlFor="exported-search">
          Search
        </label>
        <input
          id="exported-search"
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Name or payment run"
          className="pp-in"
          style={{ width: '100%', marginTop: 6 }}
        />
        <p className="muted small" style={{ marginTop: 12 }}>
          Filter
        </p>
        <div className="seg" role="group" aria-label="Sort exported timesheets">
          {(
            [
              ['firstName', 'First name'],
              ['lastName', 'Last name'],
              ['dateNewest', 'Date newest'],
              ['dateOldest', 'Date oldest'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={sort === id ? 'on' : ''} onClick={() => onSort(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="muted small" htmlFor="exported-run" style={{ display: 'block', marginTop: 12 }}>
          Payment run
        </label>
        <select
          id="exported-run"
          value={runKey}
          onChange={(event) => onRunKey(event.target.value)}
          className="pp-in"
          style={{ width: '100%', marginTop: 6 }}
        >
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
      {filtered.length === 0 ? (
        <div className="empty card pad">
          <h3>{rows.length === 0 ? emptyTitle : 'No matching exported timesheets'}</h3>
          <p>{rows.length === 0 ? emptyDescription : 'Try another name, sort, or payment run.'}</p>
        </div>
      ) : (
        <div className="rows">
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
        </div>
      )}
    </div>
  )
}
