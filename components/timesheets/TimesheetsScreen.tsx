'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  loadExportedTimesheetHistory,
  loadTimesheetDraft,
  loadTimesheetDrafts,
  saveTimesheetDraft,
  timesheetSourceDocumentId,
  type ExportedTimesheetHistoryRow,
} from '@/lib/timesheets/timesheetStorage'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  awaitingManagerSignOff,
  isTimesheetFullyApproved,
  SIGNED_OFF_EDIT_NOTE,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { teamTimesheetUsers, subjectForUser } from '@/lib/timesheets/timesheetWeekUtils'
import { formatPaymentPeriodLine, periodStartKey } from '@/lib/timesheets/paymentRunCopy'
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
import { LONDON_TIME_ZONE } from '@/lib/ios-parity/londonTime'
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

  const roster = useMemo(() => {
    const base = user ? teamTimesheetUsers(user, users) : []
    if (teamTab === 'exported') return base
    return base.filter((member) =>
      shouldAppearInOperativeTimesheetRoster(member, periodStart, periodEnd, invoicing, new Date(), timeZone)
    )
  }, [user, users, teamTab, periodStart, periodEnd, invoicing, timeZone])

  const reload = useCallback(async () => {
    if (!organization?.id) return
    const userIds = roster.map((row) => row.id)
    if (userIds.length === 0) {
      setExportedRows([])
      setDrafts(new Map())
      setRecordsLoading(false)
      return
    }
    setRecordsLoading(true)
    setLoadError(null)
    try {
      if (teamTab === 'exported') {
        setExportedRows(await loadExportedTimesheetHistory({ organizationId: organization.id, users: roster }))
      } else {
        setDrafts(await loadTimesheetDrafts(organization.id, userIds, periodStart, timeZone, periodEnd))
      }
    } catch {
      setLoadError('Timesheets did not finish loading. Check the connection and try again.')
    } finally {
      setRecordsLoading(false)
    }
  }, [organization?.id, roster, periodStart, periodEnd, timeZone, teamTab])

  useEffect(() => {
    void reload()
  }, [reload])

  const visible = useMemo(() => {
    return roster.filter((member) => {
      const draft = drafts.get(member.id)
      if (!draft) return false
      if (teamTab === 'exported') return false
      if (teamTab === 'signed') return isTimesheetFullyApproved(draft, member) && !draft.exportedAt
      return awaitingManagerSignOff(draft, member) && !draft.exportedAt
    })
  }, [roster, drafts, teamTab])

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
    })
    const priceWork = draft?.priceWorkEntries.reduce((sum, entry) => sum + entry.amount, 0) || 0
    const expenses = draft?.expenseEntries.reduce((sum, entry) => sum + entry.amount, 0) || 0
    return { hours: payroll.totalHours, overtimeHours: payroll.overtimeHours, priceWork, expenses }
  }

  const exportSigned = async () => {
    if (!organization?.id || !user || visible.length === 0) return
    const recipientEmail = user.email?.trim()
    if (!recipientEmail) {
      setExportMessage('Your account needs an email address to receive the export.')
      return
    }
    setExporting(true)
    setExportMessage(null)
    const stamp = paymentRunDateStamp(periodStart, periodEnd, timeZone)
    const periodLine = formatPaymentPeriodLine(periodStart, periodEnd, timeZone)
    const downloadLinks: Array<{ fileName: string; url: string }> = []
    const pdfAttachments: Array<{ fileName: string; content: string }> = []
    const failed: string[] = []
    try {
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
        })
        const agreed = applyWeeklyReportOverride({
          draft,
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
      if (pdfAttachments.length === 0) {
        setExportMessage(failed.length ? `Could not build exports: ${failed.join(', ')}` : 'No timesheets could be exported.')
        return
      }
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
        setExportMessage(payload.error || 'Email delivery failed.')
        return
      }
      for (const member of visible) {
        if (!drafts.get(member.id)) continue
        const full = await loadTimesheetDraft(organization.id, member.id, periodStart, timeZone, periodEnd)
        const documentId = timesheetSourceDocumentId(full)
        if (!full.operativeSignedAt) continue
        const agreed = applyWeeklyReportOverride({
          draft: { ...full, exportedAt: new Date() },
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
          draft: agreed,
          timeZone,
          documentId,
        })
      }
      setExportMessage(
        failed.length
          ? `Emailed ${pdfAttachments.length} to ${recipientEmail}. Storage backup skipped: ${failed.join(', ')}.`
          : `Emailed ${pdfAttachments.length} timesheet${pdfAttachments.length === 1 ? '' : 's'} to ${recipientEmail} for filing.`
      )
      router.replace(timesheetsTeamHref({ tab: 'exported' }))
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  if (loading || recordsLoading) return <LoadingSpinner />

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
    if (exportedRows.length === 0) {
      return (
        <div className="empty card pad">
          <h3>{emptyTitle}</h3>
          <p>{emptyDescription}</p>
        </div>
      )
    }
    return (
      <div className="rows">
        {exportedRows.map((row) => {
          const period = computeInvoicingPeriod(row.weekStart, invoicing, timeZone)
          const summary = summaryFor(row.user, row.draft, period.start, period.end)
          return (
            <MemberRow
              key={row.id}
              member={row.user}
              users={users}
              viewer={user}
              pill="Exported"
              pillHue="lib"
              summary={summary}
              periodLine={formatPaymentPeriodLine(period.start, period.end, timeZone)}
              exportedAt={row.draft.exportedAt}
              timeZone={timeZone}
              onClick={() =>
                router.push(
                  timesheetsTeamHref({
                    tab: 'exported',
                    user: row.user.id,
                    period: periodStartKey(period.start, timeZone),
                  })
                )
              }
            />
          )
        })}
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="empty card pad">
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
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
          Hrs {summary.hours.toFixed(1)} · OT {summary.overtimeHours.toFixed(1)} · PW £{summary.priceWork.toFixed(2)} · Exp £
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
