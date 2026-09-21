'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  loadExportedTimesheetHistory,
  loadTimesheetDrafts,
  saveTimesheetDraft,
  type ExportedTimesheetHistoryRow,
} from '@/lib/timesheets/timesheetStorage'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  awaitingManagerSignOff,
  isTimesheetFullyApproved,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import { teamTimesheetUsers, subjectForUser } from '@/lib/timesheets/timesheetWeekUtils'
import { formatPaymentPeriodLine, periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { collectTimesheetPayroll } from '@/lib/timesheets/timesheetPayrollCollector'
import { invoiceLinesForTimesheet, paymentRunDateStamp, signatureNotes, timesheetExportFileName } from '@/lib/timesheets/timesheetExport'
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
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { LONDON_TIME_ZONE } from '@/lib/ios-parity/londonTime'
import { computeInvoicingPeriod } from '@/lib/warnings/warningLookahead'

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
    if (userIds.length === 0) return
    setRecordsLoading(true)
    try {
      if (teamTab === 'exported') {
        setExportedRows(await loadExportedTimesheetHistory({ organizationId: organization.id, users: roster }))
      } else {
        setDrafts(await loadTimesheetDrafts(organization.id, userIds, periodStart, timeZone))
      }
    } finally {
      setRecordsLoading(false)
    }
  }, [organization?.id, roster, periodStart, timeZone, teamTab])

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
          timeZone,
          history,
          scheduleOptions,
        })
        const lines = invoiceLinesForTimesheet({
          payroll,
          draft,
          timeZone,
          managerHasSigned: isTimesheetFullyApproved(draft, member),
          applyLiveReview: false,
        })
        const pdf = buildTimesheetInvoicePdf({
          organizationName: organization.name || 'Organisation',
          subject: subjectForUser(member, operatives),
          weekStart: periodStart,
          weekEnd: periodEnd,
          amount:
            payroll.workAmount +
            draft.priceWorkEntries.reduce((sum, entry) => sum + entry.amount, 0) +
            draft.expenseEntries.reduce((sum, entry) => sum + entry.amount, 0),
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
      if (downloadLinks.length === 0) {
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
          timesheetCount: downloadLinks.length,
          attachmentNames: downloadLinks.map((link) => link.fileName),
          downloadLinks,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setExportMessage(payload.error || 'Email delivery failed.')
        return
      }
      for (const member of visible) {
        const draft = drafts.get(member.id)
        if (!draft) continue
        await saveTimesheetDraft({
          organizationId: organization.id,
          userId: member.id,
          weekStart: periodStart,
          draft: { ...draft, exportedAt: new Date() },
          timeZone,
        })
      }
      setExportMessage(
        failed.length
          ? `Emailed ${downloadLinks.length} to ${recipientEmail}. Skipped: ${failed.join(', ')}.`
          : `Emailed ${downloadLinks.length} timesheet${downloadLinks.length === 1 ? '' : 's'} to ${recipientEmail} for filing.`
      )
      router.replace('/dashboard/timesheets?surface=team&tab=exported')
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  if (loading || recordsLoading) return <LoadingSpinner />

  const emptyTitle =
    teamTab === 'exported'
      ? 'No exported timesheets'
      : teamTab === 'signed'
        ? 'No signed-off timesheets'
        : 'No timesheets awaiting sign-off'
  const emptyDescription =
    teamTab === 'exported'
      ? 'Exported timesheets stay here for years after you email and export, or generate an invoice.'
      : teamTab === 'signed'
        ? 'Counter-signed timesheets ready to export will appear here.'
        : 'People appear here only after they have signed their own timesheet. Unsigned booked hours stay on My Timesheets until they sign.'

  if (teamTab === 'exported') {
    if (exportedRows.length === 0) {
      return <EmptyState title={emptyTitle} description={emptyDescription} />
    }
    return (
      <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
        {exportedRows.map((row, index) => {
          const period = computeInvoicingPeriod(row.weekStart, invoicing, timeZone)
          const summary = summaryFor(row.user, row.draft, period.start, period.end)
          return (
            <div key={row.id}>
              {index > 0 ? <div className="ml-[58px] h-px bg-[#E5E5EA]" /> : null}
              <MemberRow
                member={row.user}
                users={users}
                viewer={user}
                pill="Exported"
                pillClass="bg-slate-200/70 text-slate-600"
                summary={summary}
                periodLine={formatPaymentPeriodLine(period.start, period.end, timeZone)}
                onClick={() =>
                  router.push(
                    `/dashboard/timesheets?surface=team&tab=exported&user=${row.user.id}&period=${periodStartKey(period.start, timeZone)}`
                  )
                }
              />
            </div>
          )
        })}
      </div>
    )
  }

  if (visible.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
        {visible.map((member, index) => {
          const draft = drafts.get(member.id)
          const summary = summaryFor(member, draft, periodStart, periodEnd)
          return (
            <div key={member.id}>
              {index > 0 ? <div className="ml-[58px] h-px bg-[#E5E5EA]" /> : null}
              <MemberRow
                member={member}
                users={users}
                viewer={user}
                pill={teamTab === 'signed' ? 'Signed off' : 'Pending'}
                pillClass={teamTab === 'signed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}
                summary={summary}
                onClick={() =>
                  router.push(
                    `/dashboard/timesheets?surface=team&tab=${teamTab}&user=${member.id}&period=${periodStartKey(periodStart, timeZone)}`
                  )
                }
              />
            </div>
          )
        })}
      </div>
      {teamTab === 'signed' ? (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportSigned()}
            className="w-full rounded-xl bg-[#185FA5] px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {exporting ? 'Sending timesheets…' : `Email and export ${visible.length} timesheet${visible.length === 1 ? '' : 's'}`}
          </button>
          {exportMessage ? <p className="text-[13px] text-ios-muted">{exportMessage}</p> : null}
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
  pillClass,
  summary,
  periodLine,
  onClick,
}: {
  member: User
  users: User[]
  viewer: User | null
  pill: string
  pillClass: string
  summary: { hours: number; overtimeHours: number; priceWork: number; expenses: number }
  periodLine?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)] hover:ring-2 hover:ring-[#185FA5]/20"
    >
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#007AFF] text-[12px] font-bold text-white">
        {initials(displayName(member))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[17px] font-semibold">{displayName(member)}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillClass}`}>{pill}</span>
        </div>
        {periodLine ? <p className="mt-0.5 text-[13px] font-semibold text-[#185FA5]">{periodLine}</p> : null}
        <p className="mt-1 text-[13px] text-ios-muted">
          Hrs {summary.hours.toFixed(1)} · OT {summary.overtimeHours.toFixed(1)} · PW £{summary.priceWork.toFixed(2)} · Exp £
          {summary.expenses.toFixed(2)}
          {member.permissions.operativeMode ? ' · Operative' : hasAdminAccess(member) ? ' · Admin' : ' · Manager'}
        </p>
        {hasAdminAccess(viewer) ? (
          <p className="mt-0.5 text-[12px] text-ios-muted">
            Line manager:{' '}
            {(() => {
              const managerId = member.assignedManagerUserIds?.[0] || member.assignedManagerUserId
              if (!managerId) return 'Unassigned'
              const manager = users.find((row) => row.id === managerId)
              return manager ? displayName(manager) : 'Unknown'
            })()}
          </p>
        ) : null}
      </div>
      <span className="text-[#185FA5]">›</span>
    </button>
  )
}
