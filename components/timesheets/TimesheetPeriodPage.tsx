/**
 * iOS parity source: Views/InvoicingView.swift MyTimesheetView + SignTimesheetView +
 * OperativeTimesheetReviewView (sign, extras, payment box, manager ticks).
 */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  capitalizeDay,
  DEFAULT_MY_SCHEDULE,
  type MyScheduleOptions,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { formatPaymentPeriodLine, recurringRunDisplaySummary } from '@/lib/timesheets/paymentRunCopy'
import {
  applySelfApprovalIfNoLineManager,
  clearSignatures,
  hoursWarningCopy,
  isTimesheetFullyApproved,
  postSignExtraWarningCopy,
  requiresLineManagerCounterSign,
  userHasLineManager,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import {
  notifyTimesheetPendingManagerSignoff,
  notifyTimesheetSignedByManager,
} from '@/lib/timesheets/timesheetNotifications'
import {
  effectiveExpenseAmount,
  effectivePayrollAmount,
  effectivePriceWorkAmount,
  expensesTotal,
  extrasPendingReview,
  grandTotal,
  isPayrollLineRemoved,
  managerAdjustmentCount,
  payrollTotal,
  priceWorkTotal,
} from '@/lib/timesheets/timesheetAdjustments'
import {
  collectTimesheetPayroll,
  timesheetHoursRateLine,
  type TimesheetPayrollLineItem,
} from '@/lib/timesheets/timesheetPayrollCollector'
import { loadTimesheetDraft, saveTimesheetDraft } from '@/lib/timesheets/timesheetStorage'
import { invoiceLinesForTimesheet, invoiceRateChangeNotes } from '@/lib/timesheets/timesheetExport'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import {
  decisionLabel,
  emptyTimesheetDraft,
  reviewSelection,
  type TimesheetDraft,
  type TimesheetManagerDecision,
} from '@/lib/timesheets/timesheetDraft'
import { buildTimesheetInvoiceHtml, printTimesheetInvoice } from '@/lib/timesheets/invoiceGenerator'
import {
  buildTimesheetInvoicePdf,
  downloadTimesheetPdf,
  timesheetInvoicePdfFileName,
} from '@/lib/timesheets/invoicePdf'
import { subjectForUser } from '@/lib/timesheets/timesheetWeekUtils'
import { SignaturePad } from '@/components/timesheets/SignaturePad'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { formatAbbreviatedDayInZone, formatStampInZone } from '@/lib/orgTime/zoneTime'

function money(value: number): string {
  return `£${value.toFixed(2)}`
}

function abbreviatedDate(date: Date, timeZone: string): string {
  return formatAbbreviatedDayInZone(date, timeZone)
}

function signedStamp(date: Date | null | undefined, timeZone: string): string {
  if (!date) return ''
  return formatStampInZone(date, timeZone)
}

export function TimesheetPeriodPage({
  subjectUser,
  mode,
  periodStart,
  periodEnd,
  invoicing,
  payrollPolicy,
  bookings,
  managerSiteBookings,
  operatives,
  projects,
  smallWorks,
  timeZone,
  history = emptyDayRateHistory(),
  scheduleOptions = DEFAULT_MY_SCHEDULE,
}: {
  subjectUser: User
  mode: 'mine' | 'review'
  periodStart: Date
  periodEnd: Date
  invoicing: OrgInvoicingSettings
  payrollPolicy: OrgPayrollTimePolicy
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  projects: Project[]
  smallWorks: Project[]
  timeZone: string
  history?: OperativeDayRateHistoryCollection
  scheduleOptions?: MyScheduleOptions
}) {
  const { user: viewer, organization } = useAuthStore()
  const { users } = useOrgUserStore()
  const [draft, setDraft] = useState<TimesheetDraft>(emptyTimesheetDraft())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signOpen, setSignOpen] = useState(false)
  const [managerSignOpen, setManagerSignOpen] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [extraMode, setExtraMode] = useState<'priceWork' | 'expense' | null>(null)
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [utrWarningOpen, setUtrWarningOpen] = useState(false)
  const [invoiceHtml, setInvoiceHtml] = useState<string | null>(null)
  const [invoicePdf, setInvoicePdf] = useState<Uint8Array | null>(null)

  const periodTitle = formatPaymentPeriodLine(periodStart, periodEnd, timeZone)
  const payroll = useMemo(
    () =>
      collectTimesheetPayroll({
        user: subjectUser,
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
      }),
    [
      subjectUser,
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
    ]
  )

  const needsCounterSign = requiresLineManagerCounterSign(subjectUser)
  const canManagerReview =
    mode === 'review' && userHasLineManager(subjectUser) && !draft.managerSignedAt && Boolean(draft.operativeSignedAt)
  const managerHasSigned = Boolean(draft.managerSignedAt)
  const fullyApproved = isTimesheetFullyApproved(draft, subjectUser)
  const extrasTotal = priceWorkTotal(draft, managerHasSigned, canManagerReview)
  const expensesAmount = expensesTotal(draft, managerHasSigned, canManagerReview)
  const total = grandTotal(payroll.lineItems, draft, managerHasSigned, canManagerReview)
  const overtimeAmount = payrollTotal(
    payroll.lineItems.filter((line) => line.isOvertimeLine),
    draft,
    managerHasSigned,
    canManagerReview
  )
  const hoursSubtotal = payrollTotal(
    payroll.lineItems.filter((line) => !line.isOvertimeLine),
    draft,
    managerHasSigned,
    canManagerReview
  )

  const persist = useCallback(
    async (next: TimesheetDraft) => {
      if (!organization?.id) return
      setDraft(next)
      await saveTimesheetDraft({
        organizationId: organization.id,
        userId: subjectUser.id,
        weekStart: periodStart,
        draft: next,
        timeZone,
      })
    },
    [organization?.id, subjectUser.id, periodStart, timeZone]
  )

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    setLoading(true)
    loadTimesheetDraft(organization.id, subjectUser.id, periodStart, timeZone)
      .then((loaded) => {
        if (!cancelled) setDraft(applySelfApprovalIfNoLineManager(loaded, subjectUser))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load timesheet')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organization?.id, subjectUser.id, periodStart, timeZone, subjectUser])

  const beginExtra = (kind: 'priceWork' | 'expense') => {
    if (fullyApproved) {
      const accept = window.confirm(postSignExtraWarningCopy(subjectUser, draft))
      if (!accept) return
      void persist(clearSignatures(draft)).then(() => setExtraMode(kind))
      return
    }
    setExtraMode(kind)
  }

  const handleOperativeSign = async () => {
    if (!viewer || !signature) return
    setBusy(true)
    setError(null)
    try {
      const name = `${viewer.firstName} ${viewer.surname}`.trim() || viewer.email
      const next = applySelfApprovalIfNoLineManager(
        {
          ...draft,
          operativeSignedAt: new Date(),
          operativeSignedByName: name,
          operativeSignatureImageBase64: signature,
        },
        subjectUser
      )
      await persist(next)
      if (organization?.id && requiresLineManagerCounterSign(subjectUser)) {
        try {
          await notifyTimesheetPendingManagerSignoff({
            organizationId: organization.id,
            signedByUser: subjectUser,
            weekStart: periodStart,
            timeZone,
          })
        } catch {
          // Signature is already saved; inbox delivery is best-effort like iOS Task {}.
        }
      }
      setSignOpen(false)
      setSignature(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign timesheet')
    } finally {
      setBusy(false)
    }
  }

  const handleManagerSign = async () => {
    if (!viewer || !signature) return
    if (extrasPendingReview(draft) && (draft.expenseEntries.length > 0 || draft.priceWorkEntries.length > 0)) {
      window.alert('Please approve, decline or edit each expense and price-work item using the buttons provided.')
      return
    }
    setBusy(true)
    try {
      const name = `${viewer.firstName} ${viewer.surname}`.trim() || viewer.email
      await persist({
        ...draft,
        managerSignedAt: new Date(),
        managerSignedByName: name,
        managerSignedByUserId: viewer.id,
        managerSignatureImageBase64: signature,
      })
      if (organization?.id) {
        try {
          await notifyTimesheetSignedByManager({
            organizationId: organization.id,
            subjectUser,
            signedByName: name,
            signedByUserId: viewer.id,
            weekStart: periodStart,
            weekEnd: periodEnd,
            timeZone,
          })
        } catch {
          // Counter-sign is already saved; inbox delivery is best-effort.
        }
      }
      setManagerSignOpen(false)
      setSignature(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to counter-sign')
    } finally {
      setBusy(false)
    }
  }

  const runInvoiceGeneration = () => {
    if (!organization || !fullyApproved) return
    const subject = subjectForUser(subjectUser, operatives)
    const lines = invoiceLinesForTimesheet({
      payroll,
      draft,
      timeZone,
      managerHasSigned,
      applyLiveReview: canManagerReview,
    })
    const notes = invoiceRateChangeNotes({
      history,
      user: subjectUser,
      operatives,
      periodStart,
      periodEnd,
      timeZone,
    })
    const html = buildTimesheetInvoiceHtml({
      organizationName: organization.name || 'Organisation',
      subject,
      weekStart: periodStart,
      weekEnd: periodEnd,
      totalHours: payroll.totalHours,
      totalDays: payroll.totalHours / Math.max(payrollPolicy.standardPaidHours, 0.01),
      amount: total,
      vatNumber: subjectUser.vatNumber,
      utrNumber: subjectUser.utrNumber,
      timeZone,
      lines,
      notes,
    })
    const pdf = buildTimesheetInvoicePdf({
      organizationName: organization.name || 'Organisation',
      subject,
      weekStart: periodStart,
      weekEnd: periodEnd,
      amount: total,
      vatNumber: subjectUser.vatNumber,
      utrNumber: subjectUser.utrNumber,
      timeZone,
      lines,
      notes,
    })
    downloadTimesheetPdf(pdf, timesheetInvoicePdfFileName(subject.name))
    setInvoiceHtml(html)
    setInvoicePdf(pdf)
  }

  const handleInvoice = () => {
    if (!organization || !fullyApproved) return
    if (!subjectUser.utrNumber?.trim()) {
      setUtrWarningOpen(true)
      return
    }
    runInvoiceGeneration()
  }

  const setLineDecision = (lineId: string, decision: TimesheetManagerDecision, revisedAmount?: number | null) => {
    void persist({
      ...draft,
      payrollLineReviews: {
        ...draft.payrollLineReviews,
        [lineId]: { decision, revisedAmount: revisedAmount ?? null },
      },
    })
  }

  if (loading) return <LoadingSpinner />

  if (signOpen || managerSignOpen) {
    const hoursAmount = payrollTotal(payroll.lineItems, draft, managerHasSigned, managerSignOpen)
    const priceWorkAmount = priceWorkTotal(draft, managerHasSigned, managerSignOpen)
    const expenses = expensesTotal(draft, managerHasSigned, managerSignOpen)
    const signerName = `${viewer?.firstName || ''} ${viewer?.surname || ''}`.trim() || viewer?.email || 'User'
    return (
      <SignSheet
        periodTitle={periodTitle}
        hoursAmount={hoursAmount}
        priceWorkAmount={priceWorkAmount}
        expensesAmount={expenses}
        signerName={signerName}
        signature={signature}
        onSignature={setSignature}
        confirmTitle={
          managerSignOpen
            ? 'Sign off & finalise'
            : needsCounterSign
              ? 'Confirm and send to line managers'
              : 'Confirm Signature and Approve'
        }
        managerMode={managerSignOpen}
        busy={busy}
        onCancel={() => {
          setSignOpen(false)
          setManagerSignOpen(false)
          setSignature(null)
        }}
        onConfirm={() => void (managerSignOpen ? handleManagerSign() : handleOperativeSign())}
      />
    )
  }

  return (
    <div className="space-y-4 pb-10">
      <p className="text-[15px] font-semibold text-ios-muted">{periodTitle}</p>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      {mode === 'review' ? (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <p className="text-[20px] font-semibold">
            {`${subjectUser.firstName} ${subjectUser.surname}`.trim() || subjectUser.email}
          </p>
          <p className="mt-1 text-[15px] text-ios-muted">{statusLine(draft, subjectUser)}</p>
        </div>
      ) : null}

      {managerHasSigned && managerAdjustmentCount(draft) > 0 ? (
        <div className="rounded-2xl bg-amber-50 p-4 text-[14px] text-amber-900">
          Line manager {draft.managerSignedByName || 'Line manager'} made {managerAdjustmentCount(draft)} adjustment
          {managerAdjustmentCount(draft) === 1 ? '' : 's'} on this timesheet.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
        <div className="px-4 pt-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.4px] text-ios-muted">
            {mode === 'review' ? 'Breakdown' : 'This period'}
          </p>
          {canManagerReview ? (
            <p className="mt-1 text-[13px] text-ios-muted">
              Review each day, expense and price-work line. Use ✓ approve, ✕ decline, or edit. Changes are shown to the
              operative when you sign off.
            </p>
          ) : null}
        </div>
        {payroll.lineItems.length === 0 ? (
          <p className="p-4 text-[14px] text-ios-muted">
            No bookings found for this payment period yet. Hours from site, office, site survey and other schedule
            entries will appear here automatically.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payroll.lineItems.map((line) => (
              <PayrollLine
                key={line.id}
                line={line}
                draft={draft}
                managerHasSigned={managerHasSigned}
                canReview={canManagerReview}
                timeZone={timeZone}
                onApprove={() => setLineDecision(line.id, 'approved')}
                onDecline={() => setLineDecision(line.id, 'declined')}
                onEdit={() => {
                  setEditingLineId(line.id)
                  setEditAmount(String(line.amount.toFixed(2)))
                }}
              />
            ))}
          </ul>
        )}
        <div className="space-y-2 border-t border-slate-100 px-4 py-4">
          <Row label="Hours subtotal" value={money(hoursSubtotal)} strong />
          {overtimeAmount > 0 ? <Row label="Overtime" value={money(overtimeAmount)} /> : null}
          {extrasTotal + expensesAmount > 0 ? (
            <Row
              label={managerHasSigned ? 'Approved extras' : 'Extras (price work & expenses)'}
              value={money(extrasTotal + expensesAmount)}
            />
          ) : null}
          <div className="flex items-baseline justify-between pt-1">
            <p className="text-[17px] font-semibold">{managerHasSigned ? 'Approved total' : 'Total'}</p>
            <p className="text-[22px] font-bold">{money(total)}</p>
          </div>
        </div>
      </section>

      <PaymentRunsBox invoicing={invoicing} />

      {mode === 'mine' ? (
        <>
          {draft.priceWorkEntries.length > 0 ? (
            <ExtraList
              title={managerHasSigned ? 'Price work (after review)' : 'Price Work'}
              items={draft.priceWorkEntries.map((item) => ({
                id: item.id,
                title: item.title,
                details: item.details,
                amount: effectivePriceWorkAmount(item, managerHasSigned),
                original: item.amount,
                decision: item.managerDecision,
                removed: managerHasSigned && item.managerDecision === 'declined',
              }))}
              managerHasSigned={managerHasSigned}
            />
          ) : null}
          {draft.expenseEntries.length > 0 ? (
            <ExtraList
              title={managerHasSigned ? 'Expenses (after review)' : 'Expenses'}
              items={draft.expenseEntries.map((item) => ({
                id: item.id,
                title: item.title,
                details: item.details,
                amount: effectiveExpenseAmount(item, managerHasSigned),
                original: item.amount,
                decision: item.managerDecision,
                removed: managerHasSigned && item.managerDecision === 'declined',
              }))}
              managerHasSigned={managerHasSigned}
            />
          ) : null}

          <p className="text-[13px] font-semibold uppercase tracking-[0.4px] text-ios-muted">Add to this timesheet</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => beginExtra('priceWork')} className="rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
              <p className="text-[16px] font-semibold text-[#5449B7]">Price Work</p>
              <p className="text-[13px] text-ios-muted">Agreed extras</p>
            </button>
            <button type="button" onClick={() => beginExtra('expense')} className="rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
              <p className="text-[16px] font-semibold text-[#B45309]">Expenses</p>
              <p className="text-[13px] text-ios-muted">+ receipts</p>
            </button>
          </div>

          {userHasLineManager(subjectUser) ? (
            <label className="block rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
              <span className="text-[15px] font-semibold">Note to manager</span>
              <textarea
                value={draft.managerNote}
                onChange={(event) => setDraft({ ...draft, managerNote: event.target.value })}
                onBlur={() => void persist(draft)}
                className="mt-2 min-h-[74px] w-full rounded-xl bg-[#F7F8FC] p-3 text-[15px]"
              />
            </label>
          ) : null}

          <div className="flex gap-3 rounded-xl bg-[#FDEAEA] p-3 text-[13px] text-[#7F1D1D]">
            <span className="text-lg">⚠</span>
            <p>{hoursWarningCopy(subjectUser)}</p>
          </div>

          {!draft.operativeSignedAt ? (
            <button
              type="button"
              onClick={() => setSignOpen(true)}
              className="w-full rounded-xl bg-[#185FA5] py-3.5 text-[16px] font-semibold text-white"
            >
              Continue to sign
            </button>
          ) : (
            <SignedBlock
              base64={draft.operativeSignatureImageBase64}
              caption={`Signed by ${draft.operativeSignedByName || 'Operative'} on ${signedStamp(draft.operativeSignedAt, timeZone)}`}
            />
          )}

          {needsCounterSign && draft.managerSignedAt ? (
            <SignedBlock
              base64={draft.managerSignatureImageBase64}
              caption={`Manager: ${draft.managerSignedByName || 'Line manager'} · ${signedStamp(draft.managerSignedAt, timeZone)}`}
            />
          ) : null}

          {fullyApproved ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleInvoice}
              className="w-full rounded-xl bg-[#16A34A] py-3.5 text-[16px] font-semibold text-white disabled:opacity-60"
            >
              Generate Invoice
            </button>
          ) : (
            <div className="space-y-2">
              <div className="w-full rounded-xl bg-[#D1D1D6] py-3.5 text-center text-[16px] font-semibold text-slate-500">
                Generate Invoice
              </div>
              <p className="text-center text-[13px] text-ios-muted">
                {!draft.operativeSignedAt
                  ? needsCounterSign
                    ? 'Add any expenses or price work, then sign your timesheet. Your line manager will counter-sign before you can invoice.'
                    : 'Add any expenses or price work, then confirm and approve your timesheet to unlock Generate Invoice.'
                  : needsCounterSign
                    ? 'Timesheet pending manager signature — Generate Invoice unlocks after your line manager counter-signs.'
                    : 'Re-sign your timesheet to generate an invoice.'}
              </p>
            </div>
          )}
        </>
      ) : (
        <ReviewExtras
          draft={draft}
          canReview={canManagerReview}
          timeZone={timeZone}
          onSave={(next) => void persist(next)}
        />
      )}

      {mode === 'review' ? (
        <>
          {draft.managerNote.trim() ? (
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
              <p className="text-[15px] font-semibold">Note to manager</p>
              <p className="mt-1 text-[14px] text-ios-muted">{draft.managerNote}</p>
            </div>
          ) : null}
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
            <p className="text-[17px] font-semibold">Signatures</p>
            {draft.operativeSignedAt ? (
              <SignedBlock
                base64={draft.operativeSignatureImageBase64}
                caption={`Operative: ${draft.operativeSignedByName || `${subjectUser.firstName} ${subjectUser.surname}`.trim()} · ${signedStamp(draft.operativeSignedAt, timeZone)}`}
              />
            ) : (
              <p className="mt-2 text-[14px] text-amber-700">Operative has not signed this week yet.</p>
            )}
            {userHasLineManager(subjectUser) ? (
              draft.managerSignedAt ? (
                <SignedBlock
                  base64={draft.managerSignatureImageBase64}
                  caption={`Manager approved: ${draft.managerSignedByName || 'Manager'} · ${signedStamp(draft.managerSignedAt, timeZone)}`}
                />
              ) : (
                <div className="mt-3 flex h-[82px] items-center justify-center rounded-[10px] border border-dashed border-slate-300 italic text-slate-500">
                  Manager signature
                </div>
              )
            ) : null}
          </div>
          {fullyApproved ? (
            <div className="rounded-xl bg-green-100 py-3.5 text-center text-[16px] font-semibold text-green-700">
              Signed off
            </div>
          ) : userHasLineManager(subjectUser) && !draft.managerSignedAt ? (
            <div className="space-y-2">
              {extrasPendingReview(draft) && (draft.expenseEntries.length > 0 || draft.priceWorkEntries.length > 0) ? (
                <p className="text-[13px] text-amber-700">
                  Approve, decline or edit every expense and price-work line before signing off.
                </p>
              ) : null}
              <button
                type="button"
                disabled={!draft.operativeSignedAt}
                onClick={() => {
                  if (extrasPendingReview(draft) && (draft.expenseEntries.length > 0 || draft.priceWorkEntries.length > 0)) {
                    window.alert('Please approve, decline or edit each expense and price-work item using the buttons provided.')
                    return
                  }
                  setManagerSignOpen(true)
                }}
                className="w-full rounded-xl bg-[#16A34A] py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
              >
                Sign off & finalise
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {extraMode ? (
        <ExtraForm
          mode={extraMode}
          jobs={[...projects, ...smallWorks].filter((row) => row.jobNumber)}
          managerNames={users
            .filter((row) => row.permissions.manager || row.permissions.adminAccess || row.isSuperAdmin)
            .map((row) => `${row.firstName} ${row.surname}`.trim())
            .filter(Boolean)}
          onCancel={() => setExtraMode(null)}
          onSave={async (entry) => {
            const next =
              extraMode === 'priceWork'
                ? { ...draft, priceWorkEntries: [...draft.priceWorkEntries, entry.priceWork!] }
                : { ...draft, expenseEntries: [...draft.expenseEntries, entry.expense!] }
            await persist(next)
            setExtraMode(null)
          }}
        />
      ) : null}

      {editingLineId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-[17px] font-semibold">Edit amount</p>
            <input
              value={editAmount}
              onChange={(event) => setEditAmount(event.target.value)}
              className="mt-3 w-full rounded-lg border px-3 py-2"
              inputMode="decimal"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingLineId(null)} className="text-sm font-semibold text-ios-muted">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const amount = Number(editAmount)
                  if (!Number.isFinite(amount)) return
                  setLineDecision(editingLineId, 'edited', amount)
                  setEditingLineId(null)
                }}
                className="rounded-lg bg-[#185FA5] px-3 py-1.5 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {utrWarningOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <button type="button" onClick={() => setUtrWarningOpen(false)} className="text-[15px] font-medium text-[#185FA5]">
              Back
            </button>
            <p className="mt-3 text-[17px] font-semibold">Before you invoice</p>
            <p className="mt-3 text-[15px] text-ios-muted">
              Your UTR number is currently blank. Please fill this in via My Profile in Settings to ensure prompt payment.
            </p>
            <button
              type="button"
              onClick={() => {
                setUtrWarningOpen(false)
                runInvoiceGeneration()
              }}
              className="mt-5 w-full rounded-xl bg-[#16A34A] py-3 text-[16px] font-semibold text-white"
            >
              Accept
            </button>
          </div>
        </div>
      ) : null}

      {invoiceHtml ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setInvoiceHtml(null)
                  setInvoicePdf(null)
                }}
                className="text-[15px] font-medium text-[#185FA5]"
              >
                Done
              </button>
            </div>
            <p className="mt-2 text-[40px] leading-none text-[#16A34A]">✓</p>
            <p className="mt-4 text-[20px] font-semibold">Invoice generated successfully</p>
            <button
              type="button"
              onClick={() => {
                if (invoicePdf) {
                  downloadTimesheetPdf(invoicePdf, timesheetInvoicePdfFileName(subjectForUser(subjectUser, operatives).name))
                  return
                }
                printTimesheetInvoice(invoiceHtml)
              }}
              className="mt-6 w-full rounded-xl bg-[#16A34A] py-3.5 text-[16px] font-semibold text-white"
            >
              Share invoice
            </button>
            <p className="mt-3 text-[13px] text-ios-muted">
              A PDF invoice is downloaded, matching iOS. Generating an invoice does not move this sheet to Exported — that
              happens when a line manager emails and exports from Signed off.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function statusLine(draft: TimesheetDraft, user: User): string {
  if (isTimesheetFullyApproved(draft, user)) return 'Signed off'
  if (draft.operativeSignedAt && userHasLineManager(user) && !draft.managerSignedAt) {
    return 'Awaiting your counter-sign'
  }
  if (draft.operativeSignedAt) return 'Partially signed'
  return 'Not signed yet'
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between text-[15px]">
      <span className={strong ? 'font-semibold' : ''}>{label}</span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </div>
  )
}

function PayrollLine({
  line,
  draft,
  managerHasSigned,
  canReview,
  timeZone,
  onApprove,
  onDecline,
  onEdit,
}: {
  line: TimesheetPayrollLineItem
  draft: TimesheetDraft
  managerHasSigned: boolean
  canReview: boolean
  timeZone: string
  onApprove: () => void
  onDecline: () => void
  onEdit: () => void
}) {
  const removed = isPayrollLineRemoved(line, draft, managerHasSigned, canReview)
  const effective = effectivePayrollAmount(line, draft, managerHasSigned, canReview)
  const decision = draft.payrollLineReviews[line.id]?.decision || 'approved'
  const orange = line.isPayeDay || (line.dayRate <= 0 && !line.hourlyRate)
  return (
    <li className={`flex gap-3 px-4 py-3 ${removed ? 'opacity-55' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] font-bold ${removed ? 'line-through' : ''}`}>{abbreviatedDate(line.date, timeZone)}</p>
        <p className={`text-[13px] text-ios-muted ${removed ? 'line-through' : ''}`}>
          {line.jobNumber} · {line.projectName}
        </p>
        <p className={`text-[12px] text-ios-muted ${removed ? 'line-through' : ''}`}>{line.details}</p>
        <p className={`text-[12px] font-medium ${orange ? 'text-orange-500' : ''} ${removed ? 'line-through' : ''}`}>
          {timesheetHoursRateLine(line)}
        </p>
      </div>
      <div className="text-right">
        {effective !== line.amount && (managerHasSigned || canReview) ? (
          <>
            <p className="text-[12px] text-ios-muted line-through">{money(line.amount)}</p>
            <p className="text-[15px] font-semibold text-green-700">{money(effective)}</p>
          </>
        ) : (
          <p className="text-[15px] font-semibold">{money(line.amount)}</p>
        )}
        {canReview ? <TickCross decision={decision} onApprove={onApprove} onDecline={onDecline} onEdit={onEdit} /> : null}
      </div>
    </li>
  )
}

function TickCross({
  decision,
  onApprove,
  onDecline,
  onEdit,
}: {
  decision: TimesheetManagerDecision
  onApprove: () => void
  onDecline: () => void
  onEdit: () => void
}) {
  const selected = reviewSelection(decision)
  return (
    <div className="mt-2 flex justify-end gap-1">
      <button
        type="button"
        onClick={onApprove}
        className={`rounded-md px-2 py-1 text-sm font-bold ${selected === 'approved' || selected === 'edited' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
        aria-label="Approve"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onDecline}
        className={`rounded-md px-2 py-1 text-sm font-bold ${selected === 'declined' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}
        aria-label="Decline"
      >
        ✕
      </button>
      <button type="button" onClick={onEdit} className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-600" aria-label="Edit">
        ✎
      </button>
    </div>
  )
}

function ExtraList({
  title,
  items,
  managerHasSigned,
}: {
  title: string
  items: Array<{
    id: string
    title: string
    details: string
    amount: number
    original: number
    decision: TimesheetManagerDecision
    removed: boolean
  }>
  managerHasSigned: boolean
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
      <p className="text-[17px] font-semibold">{title}</p>
      <ul className="mt-2 space-y-3">
        {items.map((item) => (
          <li key={item.id} className={`flex justify-between gap-3 ${item.removed ? 'opacity-55' : ''}`}>
            <div>
              <p className={`font-semibold ${item.removed ? 'line-through' : ''}`}>{item.title}</p>
              <p className="text-[12px] text-ios-muted">{item.details}</p>
              {managerHasSigned && item.decision !== 'pending' ? (
                <p className="text-[11px] font-bold uppercase text-ios-muted">{decisionLabel(item.decision)}</p>
              ) : null}
            </div>
            <p className="font-semibold">{money(item.amount)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReviewExtras({
  draft,
  canReview,
  timeZone,
  onSave,
}: {
  draft: TimesheetDraft
  canReview: boolean
  timeZone: string
  onSave: (next: TimesheetDraft) => void
}) {
  if (draft.expenseEntries.length === 0 && draft.priceWorkEntries.length === 0) return null
  return (
    <>
      {draft.expenseEntries.length > 0 ? (
        <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <p className="text-[17px] font-semibold">{canReview ? 'Expenses — review required' : 'Expenses'}</p>
          {draft.expenseEntries.map((entry, index) => (
            <div key={entry.id} className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{entry.title}</p>
                <p className="text-[12px] text-ios-muted">
                  {abbreviatedDate(entry.date, timeZone)} · {entry.jobNumber}
                </p>
                <p className="font-semibold">{money(effectiveExpenseAmount(entry, false, canReview))}</p>
              </div>
              {canReview ? (
                <TickCross
                  decision={entry.managerDecision}
                  onApprove={() => {
                    const next = [...draft.expenseEntries]
                    next[index] = { ...entry, managerDecision: 'approved', managerRevisedAmount: null }
                    onSave({ ...draft, expenseEntries: next })
                  }}
                  onDecline={() => {
                    const next = [...draft.expenseEntries]
                    next[index] = { ...entry, managerDecision: 'declined', managerRevisedAmount: null }
                    onSave({ ...draft, expenseEntries: next })
                  }}
                  onEdit={() => {
                    const amount = window.prompt('Revised expense amount', String(entry.amount))
                    if (amount == null) return
                    const next = [...draft.expenseEntries]
                    next[index] = { ...entry, managerDecision: 'edited', managerRevisedAmount: Number(amount) }
                    onSave({ ...draft, expenseEntries: next })
                  }}
                />
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {draft.priceWorkEntries.length > 0 ? (
        <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <p className="text-[17px] font-semibold">{canReview ? 'Price work — review required' : 'Price work'}</p>
          {draft.priceWorkEntries.map((entry, index) => (
            <div key={entry.id} className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{entry.title}</p>
                <p className="text-[12px] text-ios-muted">
                  Agreed with: {entry.agreedManagerName} · {abbreviatedDate(entry.startDate, timeZone)} · {entry.jobNumber}
                </p>
                <p className="font-semibold">{money(effectivePriceWorkAmount(entry, false, canReview))}</p>
              </div>
              {canReview ? (
                <TickCross
                  decision={entry.managerDecision}
                  onApprove={() => {
                    const next = [...draft.priceWorkEntries]
                    next[index] = { ...entry, managerDecision: 'approved', managerRevisedAmount: null }
                    onSave({ ...draft, priceWorkEntries: next })
                  }}
                  onDecline={() => {
                    const next = [...draft.priceWorkEntries]
                    next[index] = { ...entry, managerDecision: 'declined', managerRevisedAmount: null }
                    onSave({ ...draft, priceWorkEntries: next })
                  }}
                  onEdit={() => {
                    const amount = window.prompt('Revised price-work amount', String(entry.amount))
                    if (amount == null) return
                    const next = [...draft.priceWorkEntries]
                    next[index] = { ...entry, managerDecision: 'edited', managerRevisedAmount: Number(amount) }
                    onSave({ ...draft, priceWorkEntries: next })
                  }}
                />
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </>
  )
}

function PaymentRunsBox({ invoicing }: { invoicing: OrgInvoicingSettings }) {
  const payout = (index: number) => {
    if (invoicing.paymentDateMode === 'specific_dates') {
      const dates = invoicing.paymentDates || []
      if (index >= dates.length) return null
      return `• Payout day ${dates[index]}`
    }
    return `• Payout every ${capitalizeDay(invoicing.recurringPaymentDay)}`
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[17px] font-semibold">Payment Runs and Payouts</p>
      {invoicing.paymentRunMode === 'date_ranges' ? (
        invoicing.paymentRunDateRanges.map((range, index) => (
          <div key={`${range.startDay}-${range.endDay}`} className="mt-1 text-[15px]">
            <p>• Run: {range.startDay} - {range.endDay}</p>
            {payout(index) ? <p>{payout(index)}</p> : null}
          </div>
        ))
      ) : (
        <div className="mt-1 text-[15px]">
          <p>• {recurringRunDisplaySummary(invoicing)}</p>
          {payout(0) ? <p>{payout(0)}</p> : null}
        </div>
      )}
      {invoicing.noteToUsers.trim() ? (
        <>
          <p className="mt-3 text-[15px] font-semibold">Note</p>
          <p className="text-[15px] text-ios-muted">{invoicing.noteToUsers}</p>
        </>
      ) : null}
    </section>
  )
}

function SignedBlock({ base64, caption }: { base64?: string | null; caption: string }) {
  return (
    <div className="space-y-2">
      {base64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${base64}`}
          alt="Signature"
          className="h-[88px] w-full rounded-xl border border-slate-200 bg-white object-contain"
        />
      ) : null}
      <p className="text-center text-[13px] font-semibold text-green-700">{caption}</p>
    </div>
  )
}

function SignSheet({
  periodTitle,
  hoursAmount,
  priceWorkAmount,
  expensesAmount,
  signerName,
  signature,
  onSignature,
  confirmTitle,
  managerMode,
  busy,
  onCancel,
  onConfirm,
}: {
  periodTitle: string
  hoursAmount: number
  priceWorkAmount: number
  expensesAmount: number
  signerName: string
  signature: string | null
  onSignature: (value: string | null) => void
  confirmTitle: string
  managerMode: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const total = hoursAmount + priceWorkAmount + expensesAmount
  return (
    <div className="space-y-4 pb-10">
      <button type="button" onClick={onCancel} className="text-[15px] font-medium text-[#185FA5]">
        Back
      </button>
      <h2 className="text-[22px] font-semibold">{managerMode ? 'Sign Off' : 'Sign Timesheet'}</h2>
      {!managerMode ? (
        <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <p className="text-[17px] font-semibold">You&apos;re approving</p>
          <div className="mt-3 space-y-2 text-[15px]">
            <Row label="Period" value={periodTitle} />
            <Row label="Hours" value={money(hoursAmount)} />
            <Row label="Price work" value={money(priceWorkAmount)} />
            <Row label="Expenses" value={money(expensesAmount)} />
          </div>
          <div className="mt-3 flex justify-between rounded-xl bg-[#0E1F33] p-3 text-white">
            <span className="text-white/75">Timesheet total</span>
            <span className="text-[20px] font-bold">{money(total)}</span>
          </div>
        </section>
      ) : (
        <p className="text-[14px] text-ios-muted">Sign as {signerName} to finalise this timesheet.</p>
      )}
      <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
        <p className="text-[17px] font-semibold">Your signature</p>
        <p className="text-[12px] text-ios-muted">Signing as {signerName}</p>
        <div className="mt-3">
          <SignaturePad value={signature} onChange={onSignature} />
        </div>
      </section>
      {!managerMode ? (
        <div className="flex gap-3 rounded-xl bg-[#FDEAEA] p-3 text-[13px] text-[#7F1D1D]">
          <span>⚠</span>
          <p>By signing you confirm these hours match the work you carried out.</p>
        </div>
      ) : null}
      <button
        type="button"
        disabled={!signature || busy}
        onClick={onConfirm}
        className="w-full rounded-xl bg-[#16A34A] py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
      >
        {confirmTitle}
      </button>
    </div>
  )
}

function ExtraForm({
  mode,
  jobs,
  managerNames,
  onCancel,
  onSave,
}: {
  mode: 'priceWork' | 'expense'
  jobs: Array<{ jobNumber: string; siteName: string }>
  managerNames: string[]
  onCancel: () => void
  onSave: (entry: {
    priceWork?: TimesheetDraft['priceWorkEntries'][number]
    expense?: TimesheetDraft['expenseEntries'][number]
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [jobNumber, setJobNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [agreedManagerName, setAgreedManagerName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [includeEndDate, setIncludeEndDate] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [receiptName, setReceiptName] = useState<string | null>(null)
  const value = Number(amount)
  const canSave = Number.isFinite(value) && value > 0 && (mode === 'priceWork' || Boolean(receiptName))
  const query = jobNumber.trim().toLowerCase()
  const jobSuggestions = jobs
    .filter((job) => {
      if (!query) return false
      const haystack = `${job.jobNumber} ${job.siteName}`.toLowerCase()
      return haystack.includes(query) && job.jobNumber.toLowerCase() !== query
    })
    .slice(0, 6)
  const managerSuggestions = managerNames
    .filter(
      (name) =>
        agreedManagerName.trim() &&
        name.toLowerCase().includes(agreedManagerName.trim().toLowerCase()) &&
        name.toLowerCase() !== agreedManagerName.trim().toLowerCase()
    )
    .slice(0, 6)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSave) return
          if (mode === 'priceWork') {
            void onSave({
              priceWork: {
                id: newUuid(),
                title: title.trim() || 'Untitled price work',
                details: details.trim(),
                jobNumber: jobNumber.trim(),
                agreedManagerName: agreedManagerName.trim() || 'Manager',
                startDate: new Date(`${date}T00:00:00`),
                endDate: includeEndDate && endDate ? new Date(`${endDate}T00:00:00`) : null,
                amount: value,
                managerDecision: 'approved',
              },
            })
          } else {
            void onSave({
              expense: {
                id: newUuid(),
                title: title.trim() || 'Untitled expense',
                details: details.trim(),
                jobNumber: jobNumber.trim(),
                date: new Date(`${date}T00:00:00`),
                amount: value,
                receiptName,
                managerDecision: 'approved',
              },
            })
          }
        }}
      >
        <p className="text-[18px] font-semibold">{mode === 'priceWork' ? 'Add Price Work' : 'Add Expense'}</p>
        <label className="block text-[13px] font-medium text-ios-muted">
          {mode === 'expense' ? 'Expense name' : 'Price work name'}
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] text-ios-ink" />
        </label>
        <label className="block text-[13px] font-medium text-ios-muted">
          Description
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="mt-1 min-h-[72px] w-full rounded-lg border px-3 py-2 text-[15px] text-ios-ink" />
        </label>
        <label className="block text-[13px] font-medium text-ios-muted">
          Job number
          <input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] text-ios-ink" />
        </label>
        {jobSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {jobSuggestions.map((job) => (
              <button
                key={`${job.jobNumber}-${job.siteName}`}
                type="button"
                onClick={() => setJobNumber(job.jobNumber)}
                className="rounded-full bg-[#E6F1FB] px-3 py-1 text-[12px] font-semibold text-[#185FA5]"
              >
                {job.jobNumber} {job.siteName}
              </button>
            ))}
          </div>
        ) : null}
        <label className="block text-[13px] font-medium text-ios-muted">
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="£0.00" inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] text-ios-ink" required />
        </label>
        <label className="block text-[13px] font-medium text-ios-muted">
          {mode === 'expense' ? 'Date' : 'Start date'}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] text-ios-ink" />
        </label>
        {mode === 'priceWork' ? (
          <>
            <label className="flex items-center gap-2 text-[13px] font-medium text-ios-ink">
              <input type="checkbox" checked={includeEndDate} onChange={(e) => setIncludeEndDate(e.target.checked)} />
              Add end date
            </label>
            {includeEndDate ? (
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[15px]" />
            ) : null}
            <label className="block text-[13px] font-medium text-ios-muted">
              Manager who agreed this
              <input value={agreedManagerName} onChange={(e) => setAgreedManagerName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] text-ios-ink" />
            </label>
            {managerSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {managerSuggestions.map((name) => (
                  <button key={name} type="button" onClick={() => setAgreedManagerName(name)} className="rounded-full bg-[#E6F1FB] px-3 py-1 text-[12px] font-semibold text-[#185FA5]">
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <label className="block text-[13px] font-medium text-ios-muted">
            Upload receipt
            <input
              type="file"
              accept="image/*,application/pdf"
              className="mt-1 w-full text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setReceiptName(file ? file.name : null)
              }}
            />
            <span className={`mt-1 block text-[12px] ${receiptName ? 'text-[#185FA5]' : 'text-red-600'}`}>
              {receiptName || 'Required'}
            </span>
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-ios-muted">
            Cancel
          </button>
          <button type="submit" disabled={!canSave} className="rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {mode === 'expense' ? 'Add expense' : 'Add price work'}
          </button>
        </div>
      </form>
    </div>
  )
}
