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
  managerAdjustmentRows,
  payrollTotal,
  priceWorkTotal,
  showsTimesheetAdjustment,
} from '@/lib/timesheets/timesheetAdjustments'
import {
  collectTimesheetPayroll,
  timesheetHoursRateLine,
  type TimesheetPayrollLineItem,
} from '@/lib/timesheets/timesheetPayrollCollector'
import { loadTimesheetDraft, saveTimesheetDraft } from '@/lib/timesheets/timesheetStorage'
import { invoiceLinesForTimesheet, invoiceLinesTotal, invoiceRateChangeNotes } from '@/lib/timesheets/timesheetExport'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import {
  decisionLabel,
  decisionTint,
  draftAdditionalTotal,
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
import { isTimesheetAgreedManagerCandidate, subjectForUser } from '@/lib/timesheets/timesheetWeekUtils'
import { SignaturePad } from '@/components/timesheets/SignaturePad'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { formatAbbreviatedDayInZone, formatStampInZone } from '@/lib/orgTime/zoneTime'
import { formatTimesheetHours, overtimeHoursBeyondPaidStandard, paidBookedHours, weekdayOtMultiplier } from '@/lib/timesheets/timesheetHours'
import { parseTimesheetManagerAmount, parseTimesheetMoneyAmount } from '@/lib/timesheets/timesheetMoney'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import {
  bookingIdFromLineId,
  initialHoursChoice,
  revisedPayrollAmount,
} from '@/lib/timesheets/payrollLineBookingLookup'
import { extraReviewAfterSave, payrollReviewAfterSave } from '@/lib/timesheets/managerReviewSave'

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
  payrollPolicyPrior = null,
  payrollPolicyEffectiveFrom = null,
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
  payrollPolicyPrior?: OrgPayrollTimePolicy | null
  payrollPolicyEffectiveFrom?: string | null
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
  const [hoursStart, setHoursStart] = useState('07:30')
  const [hoursEnd, setHoursEnd] = useState('16:00')
  const [hoursBreakRemoved, setHoursBreakRemoved] = useState(false)
  const [hoursOt, setHoursOt] = useState('')
  const [editingExtra, setEditingExtra] = useState<{
    type: 'expense' | 'priceWork'
    id: string
    title: string
    original: number
  } | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [pendingExtraMode, setPendingExtraMode] = useState<'priceWork' | 'expense' | null>(null)
  const [extrasReviewAlert, setExtrasReviewAlert] = useState(false)
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
        payrollPolicyPrior,
        payrollPolicyEffectiveFrom,
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
      payrollPolicyPrior,
      payrollPolicyEffectiveFrom,
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
      setPendingExtraMode(kind)
      return
    }
    setExtraMode(kind)
  }

  const acceptPostSignExtra = async () => {
    const kind = pendingExtraMode
    if (!kind) return
    await persist(clearSignatures(draft))
    setPendingExtraMode(null)
    setExtraMode(kind)
  }

  const openPayrollHoursEditor = (line: TimesheetPayrollLineItem) => {
    const bookingId = bookingIdFromLineId(line.id)
    const operativeBooking = bookingId ? bookings.find((row) => row.id === bookingId) : undefined
    const managerBooking = bookingId ? managerSiteBookings.find((row) => row.id === bookingId) : undefined
    const choice =
      initialHoursChoice({
        row: line,
        operativeBooking,
        managerBooking,
        policy: payrollPolicy,
      }) || {
        startTime: payrollPolicy.standardDayStart,
        endTime: payrollPolicy.standardDayEnd,
        breakRemoved: false,
      }
    setHoursStart(choice.startTime)
    setHoursEnd(choice.endTime)
    setHoursBreakRemoved(choice.breakRemoved)
    setHoursOt(
      line.isOvertimeLine ? String(weekdayOtMultiplier(line.date, payrollPolicy)) : ''
    )
    setEditingLineId(line.id)
  }

  const savePayrollHours = () => {
    if (!editingLineId) return
    const row = payroll.lineItems.find((item) => item.id === editingLineId)
    if (!row) return
    const amount = revisedPayrollAmount({
      row,
      startTime: hoursStart,
      endTime: hoursEnd,
      breakRemoved: hoursBreakRemoved,
      policy: payrollPolicy,
    })
    const prior = draft.payrollLineReviews[editingLineId]?.decision
    const review = payrollReviewAfterSave(prior, row.amount, amount)
    void persist({
      ...draft,
      payrollLineReviews: {
        ...draft.payrollLineReviews,
        [editingLineId]: review,
      },
    })
    setEditingLineId(null)
  }

  const saveExtraAmount = () => {
    if (!editingExtra) return
    const amount = parseTimesheetManagerAmount(editAmount)
    if (amount == null) return
    if (editingExtra.type === 'expense') {
      const next = draft.expenseEntries.map((entry) => {
        if (entry.id !== editingExtra.id) return entry
        return { ...entry, ...extraReviewAfterSave(entry.managerDecision, entry.amount, amount) }
      })
      void persist({ ...draft, expenseEntries: next })
    } else {
      const next = draft.priceWorkEntries.map((entry) => {
        if (entry.id !== editingExtra.id) return entry
        return { ...entry, ...extraReviewAfterSave(entry.managerDecision, entry.amount, amount) }
      })
      void persist({ ...draft, priceWorkEntries: next })
    }
    setEditingExtra(null)
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
      setManagerSignOpen(false)
      setSignature(null)
      setExtrasReviewAlert(true)
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

  // Download only — iOS Generate Invoice does not set exportedAt. Email and export does.
  const runInvoiceGeneration = () => {
    if (!organization || !fullyApproved) return
    const subject = subjectForUser(subjectUser, operatives)
    const lines = invoiceLinesForTimesheet({
      payroll,
      draft,
      timeZone,
      extrasMode: 'raw',
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
      amount: invoiceLinesTotal(lines),
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
      amount: invoiceLinesTotal(lines),
      vatNumber: subjectUser.vatNumber,
      utrNumber: subjectUser.utrNumber,
      timeZone,
      lines,
      notes,
    })
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
          <p className="mt-1 text-[15px] text-ios-muted">{periodTitle}</p>
          <ReviewStatusCapsule signed={Boolean(draft.operativeSignedAt)} />
        </div>
      ) : null}

      {managerHasSigned && managerAdjustmentCount(draft) > 0 ? (
        <AdjustmentSummaryCard
          managerName={draft.managerSignedByName || 'Line manager'}
          rows={managerAdjustmentRows(draft)}
        />
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
            {mode === 'review'
              ? 'No bookings found for this period.'
              : 'No bookings found for this payment period yet. Hours from site, office, site survey and other schedule entries will appear here automatically.'}
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
                onEdit={() => openPayrollHoursEditor(line)}
              />
            ))}
          </ul>
        )}
        <div className="space-y-2 border-t border-slate-100 px-4 py-4">
          {mode === 'review' ? (
            <>
              <Row
                label={`Hours · ${payroll.shiftCount} shifts (${formatTimesheetHours(payroll.totalHours)}h)`}
                value={money(hoursSubtotal)}
              />
              <Row label="Overtime" value={money(overtimeAmount)} />
              <Row label={`Price work · ${draft.priceWorkEntries.length}`} value={money(extrasTotal)} />
              <Row label={`Expenses · ${draft.expenseEntries.length}`} value={money(expensesAmount)} />
            </>
          ) : (
            <>
              <Row label="Hours subtotal" value={money(hoursSubtotal)} strong />
              {overtimeAmount > 0 ? <Row label="Overtime" value={money(overtimeAmount)} /> : null}
              {extrasTotal + expensesAmount > 0 ? (
                <div className="flex justify-between text-[15px]">
                  <span>{managerHasSigned ? 'Approved extras' : 'Extras (price work & expenses)'}</span>
                  {managerHasSigned && extrasTotal + expensesAmount !== draftAdditionalTotal(draft) ? (
                    <span className="text-right">
                      <span className="block text-[12px] text-ios-muted line-through">
                        {money(draftAdditionalTotal(draft))}
                      </span>
                      <span className="font-semibold text-[#34C759]">{money(extrasTotal + expensesAmount)}</span>
                    </span>
                  ) : (
                    <span className="font-semibold">
                      {money(managerHasSigned ? extrasTotal + expensesAmount : draftAdditionalTotal(draft))}
                    </span>
                  )}
                </div>
              ) : null}
            </>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <p className="text-[17px] font-semibold">
              {mode === 'review' && managerHasSigned ? 'Approved total' : 'Total'}
            </p>
            <p className="text-[22px] font-bold">{money(total)}</p>
          </div>
          {mode === 'review' && draft.managerNote.trim() ? (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[15px] font-semibold">Note to manager</p>
              <p className="mt-1 text-[14px] text-ios-muted">{draft.managerNote}</p>
            </div>
          ) : null}
          {managerHasSigned && managerAdjustmentCount(draft) > 0 ? (
            <p className="text-[12px] text-ios-muted">Includes line manager adjustments</p>
          ) : null}
        </div>
      </section>

      {mode === 'mine' ? <PaymentRunsBox invoicing={invoicing} /> : null}

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
                onBlur={(event) => void persist({ ...draft, managerNote: event.currentTarget.value })}
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
              className="w-full rounded-xl bg-[#007AFF] py-3.5 text-[16px] font-semibold text-white"
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
          onEditExtra={(type, id, title, original, current) => {
            setEditingExtra({ type, id, title, original })
            setEditAmount(current.toFixed(2))
          }}
        />
      )}

      {mode === 'review' ? (
        <>
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
                    setExtrasReviewAlert(true)
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
            .filter(isTimesheetAgreedManagerCandidate)
            .map((row) => `${row.firstName} ${row.surname}`.trim())
            .filter(Boolean)}
          timeZone={timeZone}
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
        <EditHoursSheet
          line={payroll.lineItems.find((item) => item.id === editingLineId) || null}
          start={hoursStart}
          end={hoursEnd}
          breakRemoved={hoursBreakRemoved}
          otText={hoursOt}
          policy={payrollPolicy}
          timeZone={timeZone}
          onStart={setHoursStart}
          onEnd={setHoursEnd}
          onBreak={setHoursBreakRemoved}
          onOt={setHoursOt}
          onCancel={() => setEditingLineId(null)}
          onSave={savePayrollHours}
        />
      ) : null}

      {editingExtra ? (
        <AmountEditSheet
          title={editingExtra.type === 'expense' ? 'Edit expense' : 'Edit price work'}
          subtitle={editingExtra.title}
          originalAmount={editingExtra.original}
          amountText={editAmount}
          onAmount={setEditAmount}
          onCancel={() => setEditingExtra(null)}
          onSave={saveExtraAmount}
        />
      ) : null}

      {pendingExtraMode ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-[17px] font-semibold">Re-sign required</p>
            <p className="mt-3 text-[15px] text-ios-muted">{postSignExtraWarningCopy(subjectUser, draft)}</p>
            <button
              type="button"
              onClick={() => void acceptPostSignExtra()}
              className="mt-5 w-full rounded-xl bg-[#007AFF] py-3 text-[16px] font-semibold text-white"
            >
              Accept — add anyway
            </button>
            <button
              type="button"
              onClick={() => setPendingExtraMode(null)}
              className="mt-2 w-full py-2 text-[15px] font-semibold text-ios-muted"
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}

      {extrasReviewAlert ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-[17px] font-semibold">Review required</p>
            <p className="mt-3 text-[15px] text-ios-muted">
              Please approve, decline or edit each expense and price-work item using the buttons provided.
            </p>
            <button
              type="button"
              onClick={() => setExtrasReviewAlert(false)}
              className="mt-5 w-full rounded-xl bg-[#007AFF] py-3 text-[16px] font-semibold text-white"
            >
              OK
            </button>
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
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ReviewStatusCapsule({ signed }: { signed: boolean }) {
  return signed ? (
    <span className="mt-2 inline-flex rounded-full bg-[#34C759]/15 px-2 py-0.5 text-[12px] font-semibold text-[#34C759]">
      Operative signed
    </span>
  ) : (
    <span className="mt-2 inline-flex rounded-full bg-[#FF9500]/15 px-2 py-0.5 text-[12px] font-semibold text-[#FF9500]">
      Awaiting operative signature
    </span>
  )
}

function AdjustmentSummaryCard({
  managerName,
  rows,
}: {
  managerName: string
  rows: ReturnType<typeof managerAdjustmentRows>
}) {
  return (
    <section className="rounded-[14px] border border-[#007AFF]/20 bg-[#007AFF]/[0.06] p-3.5">
      <p className="text-[17px] font-semibold">Line manager adjustments</p>
      <p className="mt-1 text-[12px] text-ios-muted">
        {managerName} reviewed your timesheet. Struck-through amounts are what you submitted; coloured amounts are what
        will be paid.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={`${row.title}-${row.decision}`} className="flex items-start gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ color: decisionTint(row.decision), background: `${decisionTint(row.decision)}24` }}
            >
              {decisionLabel(row.decision)}
            </span>
            <div>
              <p className="text-[15px] font-semibold">{row.title}</p>
              {row.detail ? <p className="text-[12px] text-ios-muted">{row.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AdjustedAmountText({
  original,
  effective,
  decision,
  managerHasSigned,
  applyLiveReview = false,
}: {
  original: number
  effective: number
  decision: TimesheetManagerDecision
  managerHasSigned: boolean
  applyLiveReview?: boolean
}) {
  if (
    showsTimesheetAdjustment({
      original,
      effective,
      decision,
      managerHasSigned,
      applyLiveReview,
    })
  ) {
    return (
      <div className="text-right">
        <p className={`text-[12px] text-ios-muted ${decision === 'declined' || decision === 'edited' ? 'line-through' : ''}`}>
          {money(original)}
        </p>
        <p className="text-[15px] font-bold" style={{ color: decisionTint(decision) }}>
          {money(effective)}
        </p>
      </div>
    )
  }
  return <p className="text-[15px] font-bold">{money(original)}</p>
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
        <AdjustedAmountText
          original={line.amount}
          effective={effective}
          decision={decision}
          managerHasSigned={managerHasSigned}
          applyLiveReview={canReview}
        />
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
  const approved = selected === 'approved' || selected === 'edited'
  const declined = selected === 'declined'
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button
        type="button"
        onClick={onApprove}
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[13px] font-bold ${
          approved
            ? 'bg-[#34C759] text-white'
            : declined
              ? 'bg-[#E5E5EA] text-[#C7C7CC]'
              : 'bg-[#34C759]/15 text-[#34C759] ring-1 ring-[#34C759]/25'
        }`}
        aria-label="Approve"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onDecline}
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[13px] font-bold ${
          declined
            ? 'bg-[#FF3B30] text-white'
            : approved
              ? 'bg-[#E5E5EA] text-[#C7C7CC]'
              : 'bg-[#FF3B30]/15 text-[#FF3B30] ring-1 ring-[#FF3B30]/25'
        }`}
        aria-label="Decline"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-[#007AFF]/12 text-[13px] text-[#007AFF] ring-1 ring-[#007AFF]/25"
        aria-label="Edit"
      >
        ⚙
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
                <p className="text-[11px] font-bold uppercase" style={{ color: decisionTint(item.decision) }}>
                  {decisionLabel(item.decision)}
                </p>
              ) : null}
            </div>
            <AdjustedAmountText
              original={item.original}
              effective={item.amount}
              decision={item.decision}
              managerHasSigned={managerHasSigned}
            />
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
  onEditExtra,
}: {
  draft: TimesheetDraft
  canReview: boolean
  timeZone: string
  onSave: (next: TimesheetDraft) => void
  onEditExtra: (
    type: 'expense' | 'priceWork',
    id: string,
    title: string,
    original: number,
    current: number
  ) => void
}) {
  if (draft.expenseEntries.length === 0 && draft.priceWorkEntries.length === 0) return null
  return (
    <>
      {draft.expenseEntries.length > 0 ? (
        <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <p className="text-[17px] font-semibold">{canReview ? 'Expenses — review required' : 'Expenses'}</p>
          {draft.expenseEntries.map((entry, index) => {
            const effective = effectiveExpenseAmount(entry, !canReview, canReview)
            const removed = entry.managerDecision === 'declined'
            return (
            <div key={entry.id} className={`mt-3 flex items-start justify-between gap-3 ${removed ? 'opacity-55' : ''}`}>
              <div>
                <p className={`font-semibold ${removed ? 'line-through' : ''}`}>{entry.title}</p>
                <p className={`text-[12px] text-ios-muted ${removed ? 'line-through' : ''}`}>
                  {abbreviatedDate(entry.date, timeZone)} · {entry.jobNumber}
                </p>
                <AdjustedAmountText
                  original={entry.amount}
                  effective={effective}
                  decision={entry.managerDecision}
                  managerHasSigned={!canReview}
                  applyLiveReview={canReview}
                />
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
                  onEdit={() =>
                    onEditExtra(
                      'expense',
                      entry.id,
                      entry.title,
                      entry.amount,
                      entry.managerRevisedAmount ?? entry.amount
                    )
                  }
                />
              ) : null}
            </div>
            )
          })}
        </section>
      ) : null}
      {draft.priceWorkEntries.length > 0 ? (
        <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <p className="text-[17px] font-semibold">{canReview ? 'Price work — review required' : 'Price work'}</p>
          {draft.priceWorkEntries.map((entry, index) => {
            const effective = effectivePriceWorkAmount(entry, !canReview, canReview)
            const removed = entry.managerDecision === 'declined'
            return (
            <div key={entry.id} className={`mt-3 flex items-start justify-between gap-3 ${removed ? 'opacity-55' : ''}`}>
              <div>
                <p className={`font-semibold ${removed ? 'line-through' : ''}`}>{entry.title}</p>
                <p className={`text-[12px] text-ios-muted ${removed ? 'line-through' : ''}`}>
                  Agreed with: {entry.agreedManagerName} · {abbreviatedDate(entry.startDate, timeZone)} · {entry.jobNumber}
                </p>
                <AdjustedAmountText
                  original={entry.amount}
                  effective={effective}
                  decision={entry.managerDecision}
                  managerHasSigned={!canReview}
                  applyLiveReview={canReview}
                />
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
                  onEdit={() =>
                    onEditExtra(
                      'priceWork',
                      entry.id,
                      entry.title,
                      entry.amount,
                      entry.managerRevisedAmount ?? entry.amount
                    )
                  }
                />
              ) : null}
            </div>
            )
          })}
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
        {managerMode ? 'Cancel' : 'Back'}
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

function EditHoursSheet({
  line,
  start,
  end,
  breakRemoved,
  otText,
  policy,
  timeZone,
  onStart,
  onEnd,
  onBreak,
  onOt,
  onCancel,
  onSave,
}: {
  line: TimesheetPayrollLineItem | null
  start: string
  end: string
  breakRemoved: boolean
  otText: string
  policy: OrgPayrollTimePolicy
  timeZone: string
  onStart: (value: string) => void
  onEnd: (value: string) => void
  onBreak: (value: boolean) => void
  onOt: (value: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  if (!line) return null
  const paid = paidBookedHours('customHours', start, end, policy, breakRemoved)
  const ot = overtimeHoursBeyondPaidStandard(line.date, 'customHours', start, end, policy, breakRemoved)
  const amount = revisedPayrollAmount({
    row: line,
    startTime: start,
    endTime: end,
    breakRemoved,
    policy,
  })
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-[#F2F2F7] p-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onCancel} className="text-[15px] font-semibold text-[#007AFF]">
            Cancel
          </button>
          <p className="text-[17px] font-semibold">Edit Hours</p>
          <button type="button" onClick={onSave} className="text-[15px] font-semibold text-[#007AFF]">
            Save
          </button>
        </div>
        <p className="text-center text-[13px] text-ios-muted">
          {abbreviatedDate(line.date, timeZone)} · {line.jobNumber} {line.projectName}
        </p>
        <div className="rounded-2xl bg-white p-4">
          <HoursTimelinePicker
            start={start}
            end={end}
            breakRemoved={breakRemoved}
            policy={policy}
            onStart={onStart}
            onEnd={onEnd}
            onBreak={onBreak}
            showBreak={!line.isOvertimeLine}
          />
        </div>
        {line.isOvertimeLine ? (
          <label className="block rounded-2xl bg-white px-4 py-3 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">
            Overtime multiplier
            <input
              value={otText}
              onChange={(event) => onOt(event.target.value)}
              className="mt-1 w-full border-0 p-0 text-[14px] font-medium text-ios-ink outline-none"
              inputMode="decimal"
            />
          </label>
        ) : null}
        <div className="rounded-2xl bg-white px-4 py-3 text-[14px]">
          <p className="flex justify-between">
            <span>Paid hours</span>
            <span className="font-semibold">{formatTimesheetHours(paid)}h</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span>Overtime</span>
            <span className="font-semibold">{formatTimesheetHours(ot)}h</span>
          </p>
          <p className="mt-2 flex justify-between text-[15px] font-semibold">
            <span>Revised amount</span>
            <span>{money(amount)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function AmountEditSheet({
  title,
  subtitle,
  originalAmount,
  amountText,
  onAmount,
  onCancel,
  onSave,
}: {
  title: string
  subtitle: string
  originalAmount: number
  amountText: string
  onAmount: (value: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onCancel} className="text-[15px] font-semibold text-[#007AFF]">
            Cancel
          </button>
          <p className="text-[17px] font-semibold">{title}</p>
          <button type="button" onClick={onSave} className="text-[15px] font-semibold text-[#007AFF]">
            Save
          </button>
        </div>
        <p className="mt-3 text-[14px] text-ios-muted">{subtitle}</p>
        <label className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[15px]">
          £
          <input
            value={amountText}
            onChange={(event) => onAmount(event.target.value)}
            className="w-full border-0 p-0 outline-none"
            inputMode="decimal"
          />
        </label>
        <p className="mt-2 text-[12px] text-ios-muted">Original: {money(originalAmount)}</p>
      </div>
    </div>
  )
}

function ExtraForm({
  mode,
  jobs,
  managerNames,
  timeZone,
  onCancel,
  onSave,
}: {
  mode: 'priceWork' | 'expense'
  jobs: Array<{ jobNumber: string; siteName: string }>
  managerNames: string[]
  timeZone: string
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
  const [date, setDate] = useState(() => dayKey(new Date(), timeZone))
  const [includeEndDate, setIncludeEndDate] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [receiptName, setReceiptName] = useState<string | null>(null)
  const value = parseTimesheetMoneyAmount(amount)
  const canSave = value != null && (mode === 'priceWork' || Boolean(receiptName))
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
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-[#F2F2F7] p-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (value == null || !canSave) return
          const start = dateFromDayKey(date, timeZone)
          if (mode === 'priceWork') {
            void onSave({
              priceWork: {
                id: newUuid(),
                title: title.trim() || 'Untitled price work',
                details: details.trim(),
                jobNumber: jobNumber.trim(),
                agreedManagerName: agreedManagerName.trim() || 'Manager',
                startDate: start,
                endDate: includeEndDate && endDate ? dateFromDayKey(endDate, timeZone) : null,
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
                date: start,
                amount: value,
                receiptName,
                managerDecision: 'approved',
              },
            })
          }
        }}
      >
        <div className="flex items-center justify-between">
          <button type="button" onClick={onCancel} className="text-[15px] font-semibold text-[#007AFF]">
            Cancel
          </button>
          <p className="text-[17px] font-semibold">{mode === 'priceWork' ? 'Add Price Work' : 'Add Expense'}</p>
          <button type="submit" disabled={!canSave} className="text-[15px] font-semibold text-[#007AFF] disabled:text-ios-muted">
            {mode === 'expense' ? 'Add expense' : 'Add price work'}
          </button>
        </div>
        <div className="space-y-0 overflow-hidden rounded-2xl bg-white px-4">
          <label className="block border-b border-[#E5E5EA] py-3 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">
            {mode === 'expense' ? 'Expense name' : 'Price work name'}
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full border-0 p-0 text-[14px] font-medium text-ios-ink outline-none" />
          </label>
          <label className="block border-b border-[#E5E5EA] py-3 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">
            Description
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="mt-1 min-h-[72px] w-full border-0 p-0 text-[14px] text-ios-ink outline-none" />
          </label>
          <label className="block border-b border-[#E5E5EA] py-3 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">
            Job number
            <input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} className="mt-1 w-full border-0 p-0 text-[14px] font-medium text-ios-ink outline-none" />
          </label>
          {jobSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2 py-2">
              {jobSuggestions.map((job) => (
                <button
                  key={`${job.jobNumber}-${job.siteName}`}
                  type="button"
                  onClick={() => setJobNumber(job.jobNumber)}
                  className="rounded-full bg-[#007AFF]/10 px-3 py-1 text-[12px] font-medium text-[#007AFF]"
                >
                  {job.jobNumber}
                </button>
              ))}
            </div>
          ) : null}
          <label className="block py-3 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">
            Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="£0.00" inputMode="decimal" className="mt-1 w-full border-0 p-0 text-[14px] font-medium text-ios-ink outline-none" required />
          </label>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white px-4 py-3">
          <label className="block text-[13px] font-medium text-ios-ink">
            {mode === 'expense' ? 'Date' : 'Start date'}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-[15px] text-ios-ink" />
          </label>
          {mode === 'priceWork' ? (
            <>
              <label className="mt-3 flex items-center justify-between text-[13px] font-medium text-ios-ink">
                Add end date
                <input type="checkbox" checked={includeEndDate} onChange={(e) => setIncludeEndDate(e.target.checked)} />
              </label>
              {includeEndDate ? (
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-[15px]" />
              ) : null}
            </>
          ) : null}
        </div>
        {mode === 'priceWork' ? (
          <div className="overflow-hidden rounded-2xl bg-white px-4 py-3">
            <label className="block text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">
              Manager who agreed this
              <input value={agreedManagerName} onChange={(e) => setAgreedManagerName(e.target.value)} className="mt-1 w-full border-0 p-0 text-[14px] font-medium text-ios-ink outline-none" />
            </label>
            {managerSuggestions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {managerSuggestions.map((name) => (
                  <button key={name} type="button" onClick={() => setAgreedManagerName(name)} className="rounded-full bg-[#007AFF]/10 px-3 py-1 text-[12px] font-medium text-[#007AFF]">
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[13px] font-medium text-ios-ink">
            <span className="text-[#007AFF]">📎</span>
            <span>Upload receipt</span>
            <span className={`ml-auto text-[12px] ${receiptName ? 'text-[#007AFF]' : 'text-red-600'}`}>{receiptName || 'Required'}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setReceiptName(file ? file.name : null)
              }}
            />
          </label>
        )}
      </form>
    </div>
  )
}
