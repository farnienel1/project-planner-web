'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess, isOperativeMode } from '@/lib/navigation/menuPermissions'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import {
  approveTimesheetWeek,
  loadTimesheetWeekRecords,
  markTimesheetInvoiceGenerated,
  submitTimesheetWeek,
  type TimesheetWeekRecord,
} from '@/lib/timesheets/timesheetStorage'
import {
  buildTimesheetInvoiceHtml,
  downloadTimesheetInvoice,
} from '@/lib/timesheets/invoiceGenerator'
import {
  buildTimesheetSubjects,
  collectSubjectDayEntries,
  estimatedAmount,
  estimatedDays,
  totalHours,
  weekRangeFromStart,
  type TimesheetSubject,
} from '@/lib/timesheets/timesheetWeekUtils'
import type { Booking, Operative, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'

type SubjectRow = {
  subject: TimesheetSubject
  entries: ReturnType<typeof collectSubjectDayEntries>
  hours: number
  days: number
  amount: number | null
  record: TimesheetWeekRecord | null
}

export function TimesheetsScreen({
  bookings,
  managerSiteBookings,
  operatives,
  users,
  weekStart,
  payrollPolicy,
  loading,
  onWeekStartChange,
}: {
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  weekStart: Date
  payrollPolicy: OrgPayrollTimePolicy
  loading?: boolean
  onWeekStartChange: (value: string) => void
}) {
  const { user, organization } = useAuthStore()
  const [records, setRecords] = useState<Map<string, TimesheetWeekRecord>>(new Map())
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const weekRange = useMemo(() => weekRangeFromStart(weekStart), [weekStart])
  const subjects = useMemo(() => buildTimesheetSubjects(users, operatives), [users, operatives])

  const rows = useMemo<SubjectRow[]>(() => {
    return subjects
      .map((subject) => {
        const entries = collectSubjectDayEntries({
          subject,
          bookings,
          managerSiteBookings,
          weekRange,
          payrollPolicy,
        })
        const hours = totalHours(entries)
        return {
          subject,
          entries,
          hours,
          days: estimatedDays(entries, payrollPolicy.standardPaidHours),
          amount: estimatedAmount(subject, hours),
          record: subject.userId ? records.get(subject.userId) || null : records.get(subject.userId || '') || null,
        }
      })
      .filter((row) => row.hours > 0 || row.record?.status === 'submitted' || row.record?.status === 'approved')
      .sort((a, b) => a.subject.name.localeCompare(b.subject.name))
  }, [subjects, bookings, managerSiteBookings, weekRange, payrollPolicy, records])

  const linkedOperative = useMemo(
    () => (user ? findOperativeForUser(user, operatives) : undefined),
    [user, operatives]
  )

  const canApprove = Boolean(user && (hasAdminAccess(user) || user.permissions.manager))
  const isManagerView = canApprove && !isOperativeMode(user)

  const reloadRecords = useCallback(async () => {
    if (!organization?.id) return
    const userIds = subjects.map((s) => s.userId).filter((id): id is string => Boolean(id))
    if (userIds.length === 0) return
    setRecordsLoading(true)
    try {
      const next = await loadTimesheetWeekRecords(organization.id, userIds, weekStart)
      setRecords(next)
    } finally {
      setRecordsLoading(false)
    }
  }, [organization?.id, subjects, weekStart])

  useEffect(() => {
    void reloadRecords()
  }, [reloadRecords])

  const resolveRecord = (subject: TimesheetSubject): TimesheetWeekRecord | null => {
    if (!subject.userId) return null
    return records.get(subject.userId) || { userId: subject.userId, weekStart: format(weekRange.start, 'yyyy-MM-dd'), status: 'draft' }
  }

  const canSubmitForSubject = (subject: TimesheetSubject) => {
    if (!user) return false
    if (subject.userId && subject.userId === user.id) return true
    if (linkedOperative && subject.operativeId === linkedOperative.id) return true
    return canApprove
  }

  const handleSubmit = async (row: SubjectRow) => {
    if (!organization?.id || !user?.id || !row.subject.userId) return
    setBusyKey(row.subject.key)
    setError(null)
    try {
      await submitTimesheetWeek({
        organizationId: organization.id,
        userId: row.subject.userId,
        weekStart,
        totalHours: row.hours,
        submittedByUserId: user.id,
      })
      await reloadRecords()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit timesheet')
    } finally {
      setBusyKey(null)
    }
  }

  const handleApprove = async (row: SubjectRow) => {
    if (!organization?.id || !user?.id || !row.subject.userId || !canApprove) return
    setBusyKey(row.subject.key)
    setError(null)
    try {
      await approveTimesheetWeek({
        organizationId: organization.id,
        userId: row.subject.userId,
        weekStart,
        approvedByUserId: user.id,
        approvedByName: `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email,
      })
      await reloadRecords()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve timesheet')
    } finally {
      setBusyKey(null)
    }
  }

  const handleInvoice = async (row: SubjectRow) => {
    if (!organization?.id || !row.subject.userId) return
    const record = resolveRecord(row.subject)
    if (record?.status !== 'approved') return

    const html = buildTimesheetInvoiceHtml({
      organizationName: organization?.name || 'Organisation',
      subject: row.subject,
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
      totalHours: row.hours,
      totalDays: row.days,
      amount: row.amount,
      vatNumber: row.subject.vatNumber,
      utrNumber: row.subject.utrNumber,
    })

    downloadTimesheetInvoice(
      html,
      `invoice-${row.subject.name.replace(/\s+/g, '-').toLowerCase()}-${format(weekRange.start, 'yyyy-MM-dd')}.html`
    )

    await markTimesheetInvoiceGenerated(organization.id, row.subject.userId, weekStart)
    await reloadRecords()
  }

  if (loading || recordsLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Week starting</label>
        <input
          type="date"
          value={format(weekStart, 'yyyy-MM-dd')}
          onChange={(e) => onWeekStartChange(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="text-sm text-slate-500">
          {format(weekRange.start, 'd MMM')} – {format(weekRange.end, 'd MMM yyyy')}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Hours are calculated from operative <strong>bookings</strong> and manager <strong>site bookings</strong>.
        Submit your week for approval, then generate an invoice once approved — synced to Firestore for iOS parity.
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No timesheet hours this week"
          description="Schedule operatives or managers on projects to populate timesheet data."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const record = row.subject.userId ? records.get(row.subject.userId) : null
            const status = record?.status || 'draft'
            const expanded = expandedKey === row.subject.key
            const busy = busyKey === row.subject.key

            return (
              <div key={row.subject.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedKey(expanded ? null : row.subject.key)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{row.subject.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {row.subject.kind === 'manager' ? 'Manager' : 'Operative'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : status === 'submitted'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.hours.toFixed(1)}h · {row.days.toFixed(1)} days · {row.entries.length} booking
                      {row.entries.length !== 1 ? 's' : ''}
                      {row.amount != null ? ` · £${row.amount.toFixed(2)} est.` : ''}
                    </p>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <div className="space-y-2">
                      {row.entries.map((entry) => (
                        <div key={`${entry.date.toISOString()}-${entry.label}`} className="flex justify-between text-xs text-slate-600">
                          <span>{format(entry.date, 'EEE d MMM')} · {entry.label}</span>
                          <span>{entry.hours.toFixed(1)}h</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {canSubmitForSubject(row.subject) && status === 'draft' && (
                        <button
                          type="button"
                          disabled={busy || row.hours <= 0}
                          onClick={() => handleSubmit(row)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {busy ? 'Submitting…' : 'Submit for approval'}
                        </button>
                      )}
                      {isManagerView && status === 'submitted' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleApprove(row)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? 'Approving…' : 'Approve timesheet'}
                        </button>
                      )}
                      {status === 'approved' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleInvoice(row)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Generate invoice
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
