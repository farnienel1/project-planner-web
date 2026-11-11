/**
 * iOS parity source: Views/InvoicingView.swift MyTimesheetView + SignTimesheetView +
 * OperativeTimesheetReviewView (sign, extras, payment box, manager ticks).
 */
'use client'

import { rulebookRoster } from '@/lib/staff/rulebookPeople'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  capitalizeDay,
  DEFAULT_MY_SCHEDULE,
  type MyScheduleOptions,
  type OrgInvoicingSettings,
  orgPayrollPolicyForDay,
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
  SIGNED_OFF_EDIT_NOTE,
  lineManagerUserIds,
  userTimesheetSelfSigned,
} from '@/lib/timesheets/timesheetApprovalPolicy'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { staffAccountRole, userTimesheetSubjectIds } from '@/lib/permissions'
import {
  SENSITIVE_EXPORT_OPTION_LABEL,
  canViewSensitiveProfile,
  exportIncludesSensitiveFields,
  seesEveryUserTimesheet,
  timesheetWriterIsReviewer,
  priceWorkJobNumberError,
  priceWorkJobNumberText,
  PRICE_WORK_JOB_NUMBER_MAX,
} from '@/lib/canonical'
import { loadTaxIds } from '@/lib/sensitiveProfile/taxIdsService'
import {
  notifyTimesheetPendingManagerSignoff,
  notifyTimesheetSignedByManager,
} from '@/lib/timesheets/timesheetNotifications'
import {
  effectiveExpenseAmount,
  effectivePayrollAmount,
  effectivePriceWorkAmount,
  draftTimesheetTotals,
  extrasPendingReview,
  isPayrollLineRemoved,
  managerAdjustmentCount,
  managerAdjustmentRows,
  showsTimesheetAdjustment,
  draftPayrollLineReview,
} from '@/lib/timesheets/timesheetAdjustments'
import { timesheetDayKeysForPeriod } from '@/lib/timesheets/timesheetPayrollPolicy'
import {
  collectTimesheetPayroll,
  timesheetHoursRateLine,
  type TimesheetPayrollLineItem,
} from '@/lib/timesheets/timesheetPayrollCollector'
import {
  draftFromFirestoreMap,
  loadTimesheetDraft,
  saveTimesheetDraft,
  timesheetDocId,
  timesheetSourceDocumentId,
} from '@/lib/timesheets/timesheetStorage'
import { watchOrgDocument } from '@/lib/firebase/watchOrgQuery'
import { invoiceLinesForTimesheet, invoiceLinesTotal, invoiceRateChangeNotes } from '@/lib/timesheets/timesheetExport'
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
  shareTimesheetPdf,
  timesheetInvoicePdfFileName,
} from '@/lib/timesheets/invoicePdf'
import {
  extraFormJobSuggestions,
  extraFormManagerSuggestions,
  isTimesheetAgreedManagerCandidate,
  subjectForUser,
  timesheetReceiptStoredName,
  userIdsSharingEmail,
} from '@/lib/timesheets/timesheetWeekUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { SignaturePad } from '@/components/timesheets/SignaturePad'
import { signaturePngSrc } from '@/lib/signature/signatureImage'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { formatAbbreviatedDayInZone, formatStampInZone } from '@/lib/orgTime/zoneTime'
import { formatTimesheetHours, overtimeHoursBeyondPaidStandard, overtimeHoursText, paidBookedHours, weekdayOtMultiplier } from '@/lib/timesheets/timesheetHours'
import { parseTimesheetManagerAmount, parseTimesheetMoneyAmount } from '@/lib/timesheets/timesheetMoney'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { HoursTimelinePicker } from '@/components/scheduling/HoursTimelinePicker'
import { confirmCustomHoursBreak } from '@/lib/scheduling/bookingSlotRules'
import {
  bookingIdFromLineId,
  initialHoursChoice,
  revisedPayrollAmount,
} from '@/lib/timesheets/payrollLineBookingLookup'
import { extraReviewAfterSave, payrollReviewAfterSave } from '@/lib/timesheets/managerReviewSave'
import { OVERLAPPING_BOOKING_NOTE, currencySymbol, formatMoney, timesheetLeaveLines, weekdayPaidHours } from '@/lib/canonical'
import { useOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { timesheetLeaveLinesForAccount } from '@/lib/timesheets/timesheetLeave'
import type { TimesheetLeaveLine } from '@/lib/canonical'
import { useOrgBankHolidays } from '@/components/annual-leave/useOrgBankHolidays'
import { PayInputsBanner } from '@/components/timesheets/PayInputsBanner'
import { BriefcaseIcon, CheckCircleIcon, ClockIcon, ReceiptPercentIcon } from '@heroicons/react/24/solid'
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  IconTile,
  InfoIcon,
  Modal,
  Note,
  PageBand,
  PuButton,
  StatRow,
  WarnIcon,
  type StatItem,
} from '@/components/ui/page'
import { TimesheetInputsNotReadyError, type TimesheetInputsState } from '@/lib/timesheets/timesheetInputs'
import type { PayrollTimePolicyState } from '@/lib/canonical'

function money(value: number, currency: string): string {
  return formatMoney(value, currency)
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
  payrollPolicyState = null,
  bookings,
  managerSiteBookings,
  operatives,
  projects,
  smallWorks,
  timeZone,
  history = emptyDayRateHistory(),
  scheduleOptions = DEFAULT_MY_SCHEDULE,
  payInputs,
  heading = 'Timesheet',
  back,
}: {
  payInputs: TimesheetInputsState
  /** Page name shown in the band eyebrow (was the nav bar title). */
  heading?: string
  /** The nav bar's existing back control: same label and handler. */
  back?: { label: string; onClick: () => void }
  subjectUser: User
  mode: 'mine' | 'review'
  periodStart: Date
  periodEnd: Date
  invoicing: OrgInvoicingSettings
  payrollPolicy: OrgPayrollTimePolicy
  payrollPolicyPrior?: OrgPayrollTimePolicy | null
  payrollPolicyEffectiveFrom?: string | null
  /** Rulebook 1.19.0: the whole working-hours state; each day is priced under the rules in effect on it. */
  payrollPolicyState?: PayrollTimePolicyState | null
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  projects: Project[]
  smallWorks: Project[]
  timeZone: string
  history?: OperativeDayRateHistoryCollection
  scheduleOptions?: MyScheduleOptions
}) {
  const currency = useOrganizationCurrency()
  const { user: viewer, organization } = useAuthStore()
  const { users } = useOrgUserStore()
  const [draft, setDraft] = useState<TimesheetDraft>(emptyTimesheetDraft())
  const sourceDocumentId = useRef<string | null>(null)
  // Rulebook 1.9.0 §1: the open sheet is live. A sign-off or edit on another device replaces the draft — unless this
  // screen holds an unsaved edit or an open editor, when it waits and says so (never overwriting what is typed).
  const localEdits = useRef(false)
  const lastPersistAt = useRef(0)
  // Rulebook 1.9.0 `timesheetChangedFields`: the sheet as loaded (or last saved / refreshed), the base a save diffs.
  const baseDraft = useRef<TimesheetDraft | null>(null)
  const pendingRemote = useRef<TimesheetDraft | null>(null)
  const [updatedElsewhere, setUpdatedElsewhere] = useState(false)
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
  // Tax ids stay off the invoice unless the person or an admin ticks the box (rulebook).
  const [includeTaxIds, setIncludeTaxIds] = useState(false)
  const [invoiceTaxIds, setInvoiceTaxIds] = useState<{ utrNumber?: string; vatNumber?: string }>({})
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
        payrollPolicyState,
        timeZone,
        history,
        scheduleOptions,
        aliasUserIds: userIdsSharingEmail(subjectUser, users),
      }),
    [
      subjectUser,
      users,
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
    ]
  )

  // Approved annual leave in this period: information rows, no hours or pay, never invoiced.
  const { bookings: holidayBookings, loadBookings: loadHolidayBookings, loadedOrgId: holidaysLoadedOrgId } = useHolidayStore()
  useEffect(() => {
    if (organization?.id && holidaysLoadedOrgId !== organization.id) void loadHolidayBookings(organization.id)
  }, [organization?.id, holidaysLoadedOrgId, loadHolidayBookings])
  const bankHolidays = useOrgBankHolidays(periodStart, periodEnd).holidays
  const leaveLines = useMemo(
    () =>
      timesheetLeaveLinesForAccount({
        user: subjectUser,
        holidays: holidaysLoadedOrgId === organization?.id ? holidayBookings : [],
        operatives,
        aliasUserIds: userIdsSharingEmail(subjectUser, users),
        periodStart,
        periodEnd,
        timeZone,
        bankHolidayDayKeys: bankHolidays.map((holiday) => holiday.date),
        // Rulebook 1.20.0 §9: each leave half shows its clock range under the working day in effect that day.
        dayPolicy: (key: string) =>
          orgPayrollPolicyForDay(dateFromDayKey(key, timeZone), payrollPolicy, payrollPolicyPrior, payrollPolicyEffectiveFrom, timeZone, null, payrollPolicyState),
      }),
    [subjectUser, holidayBookings, holidaysLoadedOrgId, organization?.id, operatives, users, periodStart, periodEnd, timeZone, bankHolidays, payrollPolicy, payrollPolicyPrior, payrollPolicyEffectiveFrom, payrollPolicyState]
  )
  const sheetRows = useMemo(() => {
    const rows: Array<{ kind: 'pay'; key: string; dayKey: string; line: TimesheetPayrollLineItem } | { kind: 'leave'; key: string; dayKey: string; leave: TimesheetLeaveLine }> = [
      ...payroll.lineItems.map((line) => ({ kind: 'pay' as const, key: line.id, dayKey: line.dayKey || dayKey(line.date, timeZone), line })),
      ...leaveLines.map((leave) => ({ kind: 'leave' as const, key: leave.id, dayKey: leave.dayKey, leave })),
    ]
    return rows.sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0))
  }, [payroll.lineItems, leaveLines, timeZone])

  // `timesheetSelfSigned(user, roster)`: only a self-signed admin skips the counter-signature.
  const needsCounterSign = requiresLineManagerCounterSign(subjectUser, users)
  // Rulebook 1.30.2 (`timesheetWriterIsReviewer`): the viewer reviews this sheet only as its line manager or an
  // admin, and never their own under any of their ids (admins and the Super Admin included). Their own sheet is the
  // owner flow; a self-signed owner's signature completes it.
  const viewerIsReviewer = timesheetWriterIsReviewer({
    writerUserId: viewer?.id,
    subjectUserId: subjectUser.id,
    writerIsAdmin: Boolean(viewer && seesEveryUserTimesheet(staffAccountRole(viewer))),
    writerFormerIds: viewer?.formerUserIds ?? [],
    writerAliasIds: viewer ? userIdsSharingEmail(viewer, users) : [],
    subjectLineManagerIds: lineManagerUserIds(subjectUser, users),
    roster: rulebookRoster(users),
  })
  const canManagerReview = (() => {
    if (mode !== 'review' || !viewer || !viewerIsReviewer) return false
    if (draft.exportedAt) {
      // `userTimesheetSubjects`: admins see everyone, a manager the people they line-manage under any of their ids.
      const inScope = userTimesheetSubjectIds(viewer, users).includes(subjectUser.id)
      return inScope && isTimesheetFullyApproved(draft, subjectUser, users)
    }
    return needsCounterSign && !draft.managerSignedAt && Boolean(draft.operativeSignedAt)
  })()
  const managerHasSigned = Boolean(draft.managerSignedAt)
  const fullyApproved = isTimesheetFullyApproved(draft, subjectUser, users)
  // Rulebook 1.22.0 (§8): every figure below is `timesheetTotals` — the invoice rows summed — never an app sum.
  const sheetDays = subjectUser ? timesheetDayKeysForPeriod(subjectUser, periodStart, periodEnd, timeZone) : null
  const totals = draftTimesheetTotals({
    lines: payroll.lineItems,
    draft,
    decided: managerHasSigned || canManagerReview,
    reviewing: canManagerReview,
    timesheetDays: sheetDays,
    timeZone,
  })
  const extrasTotal = totals.priceWork
  const expensesAmount = totals.expenses
  const total = totals.total
  const overtimeAmount = totals.overtimeLabour
  const hoursSubtotal = totals.standardLabour

  const persist = useCallback(
    async (next: TimesheetDraft) => {
      if (!organization?.id) return
      // Never build `weeklyReportOverride` or save pay figures from defaults / an empty history (failed load).
      if (!payInputs.ready) throw new TimesheetInputsNotReadyError(payInputs.message ?? undefined)
      localEdits.current = false
      lastPersistAt.current = Date.now()
      const withOverride = applyWeeklyReportOverride({
        draft: next,
        user: subjectUser,
        users,
        viewer,
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
      setDraft(withOverride)
      // Line manager or admin (`timesheetWriterIsReviewer`, the rules' isTimesheetReviewer). The
      // owner's save leaves the reviewer-only parts alone.
      const reviewer = timesheetWriterIsReviewer({
        writerUserId: viewer?.id,
        subjectUserId: subjectUser.id,
        writerIsAdmin: Boolean(viewer && seesEveryUserTimesheet(staffAccountRole(viewer))),
        writerFormerIds: viewer?.formerUserIds ?? [],
        writerAliasIds: viewer ? userIdsSharingEmail(viewer, users) : [],
        subjectLineManagerIds: lineManagerUserIds(subjectUser, users),
        roster: rulebookRoster(users),
      })
      const reviews = await saveTimesheetDraft({
        organizationId: organization.id,
        userId: subjectUser.id,
        weekStart: periodStart,
        weekEnd: periodEnd,
        draft: withOverride,
        timeZone,
        documentId: sourceDocumentId.current,
        base: baseDraft.current,
        access: { reviewer, subjectHasLineManager: !userTimesheetSelfSigned(subjectUser, users) },
      })
      baseDraft.current = withOverride
      if (reviews !== (withOverride.extraEntryReviews ?? null)) {
        setDraft((current) => (current === withOverride ? { ...withOverride, extraEntryReviews: reviews } : current))
      }
    },
    [
      organization?.id,
      payInputs.ready,
      payInputs.message,
      subjectUser,
      viewer,
      periodStart,
      periodEnd,
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
      users,
    ]
  )

  const persistOrReport = useCallback(
    (next: TimesheetDraft) =>
      persist(next).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not save the timesheet')
      }),
    [persist]
  )

  // The roster at load time, without reloading the sheet each time the roster listener republishes.
  const usersRef = useRef(users)
  usersRef.current = users

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    setLoading(true)
    loadTimesheetDraft(organization.id, subjectUser.id, periodStart, timeZone, periodEnd)
      .then((loaded) => {
        if (cancelled) return
        sourceDocumentId.current = timesheetSourceDocumentId(loaded)
        baseDraft.current = sourceDocumentId.current ? loaded : null
        setDraft(applySelfApprovalIfNoLineManager(loaded, subjectUser, usersRef.current))
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
  }, [organization?.id, subjectUser.id, periodStart, periodEnd, timeZone, subjectUser])

  // Listen to the open sheet document once it has loaded (its stored id, else the id a new sheet is created at).
  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || loading) return
    const docId = sourceDocumentId.current || timesheetDocId(subjectUser.id, periodStart, timeZone)
    let first = true
    return watchOrgDocument(orgId, ['settings', docId], (data, meta) => {
      // The first snapshot is the copy just loaded; this device's own unsent write is not news.
      if (first) {
        first = false
        return
      }
      if (!data || meta.hasPendingWrites) return
      // The server's echo of this screen's own save (same user, from web, just now) is not a remote change.
      const ownEcho =
        data.updatedBy === viewer?.id && data.updatedFrom === 'web' && Date.now() - lastPersistAt.current < 10_000
      if (ownEcho) return
      sourceDocumentId.current = docId
      const remote = applySelfApprovalIfNoLineManager(
        draftFromFirestoreMap(data, { sheetDocId: docId, timeZone }),
        subjectUser,
        usersRef.current
      )
      pendingRemote.current = remote
      setUpdatedElsewhere(true)
    })
  }, [organization?.id, loading, subjectUser, periodStart, timeZone, viewer?.id])

  // Apply a remote change when nothing local is in progress.
  useEffect(() => {
    if (!updatedElsewhere || !pendingRemote.current) return
    if (busy || localEdits.current || editingLineId || extraMode || signOpen || managerSignOpen) return
    setDraft(pendingRemote.current)
    baseDraft.current = pendingRemote.current
    pendingRemote.current = null
    setUpdatedElsewhere(false)
  }, [updatedElsewhere, busy, editingLineId, extraMode, signOpen, managerSignOpen, draft])

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
    try {
      await persist(clearSignatures(draft))
    } catch (err: unknown) {
      setPendingExtraMode(null)
      setError(err instanceof Error ? err.message : 'Could not save the timesheet')
      return
    }
    setPendingExtraMode(null)
    setExtraMode(kind)
  }

  // Rulebook 1.19.0: a line is reviewed under the working hours in effect on its own day, never today's.
  const policyOnDay = (date: Date): OrgPayrollTimePolicy =>
    orgPayrollPolicyForDay(date, payrollPolicy, payrollPolicyPrior, payrollPolicyEffectiveFrom, timeZone, null, payrollPolicyState)

  const openPayrollHoursEditor = (line: TimesheetPayrollLineItem) => {
    const linePolicy = policyOnDay(line.date)
    const bookingId = bookingIdFromLineId(line.id)
    const operativeBooking = bookingId ? bookings.find((row) => row.id === bookingId) : undefined
    const managerBooking = bookingId ? managerSiteBookings.find((row) => row.id === bookingId) : undefined
    const choice =
      initialHoursChoice({
        row: line,
        operativeBooking,
        managerBooking,
        policy: linePolicy,
      }) || {
        startTime: linePolicy.standardDayStart,
        endTime: linePolicy.standardDayEnd,
        breakRemoved: false,
      }
    setHoursStart(choice.startTime)
    setHoursEnd(choice.endTime)
    setHoursBreakRemoved(choice.breakRemoved)
    setHoursOt(
      line.isOvertimeLine ? String(weekdayOtMultiplier(line.date, linePolicy)) : ''
    )
    setEditingLineId(line.id)
  }

  const savePayrollHours = () => {
    if (!editingLineId) return
    const row = payroll.lineItems.find((item) => item.id === editingLineId)
    if (!row) return
    const rowPolicy = policyOnDay(row.date)
    // 1.13.0 lunch warning (`customHoursBreakWarning`): the reviewed hours cover the unpaid break with it on.
    if (
      !confirmCustomHoursBreak(rowPolicy, row.date, {
        timeSlot: 'CUSTOM_HOURS',
        workStartTime: hoursStart,
        workEndTime: hoursEnd,
        isBreakRemoved: hoursBreakRemoved,
      })
    ) {
      return
    }
    const amount = revisedPayrollAmount({
      row,
      startTime: hoursStart,
      endTime: hoursEnd,
      breakRemoved: hoursBreakRemoved,
      policy: rowPolicy,
    })
    const prior = draftPayrollLineReview(draft, editingLineId)?.decision
    const review = payrollReviewAfterSave(prior, row.amount, amount)
    void persistOrReport({
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
      void persistOrReport({ ...draft, expenseEntries: next })
    } else {
      const next = draft.priceWorkEntries.map((entry) => {
        if (entry.id !== editingExtra.id) return entry
        return { ...entry, ...extraReviewAfterSave(entry.managerDecision, entry.amount, amount) }
      })
      void persistOrReport({ ...draft, priceWorkEntries: next })
    }
    setEditingExtra(null)
  }

  const handleOperativeSign = async () => {
    if (!viewer || !signature) return
    if (!payInputs.ready) {
      setError(payInputs.message)
      return
    }
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
        subjectUser,
        users
      )
      await persist(next)
      if (organization?.id && requiresLineManagerCounterSign(subjectUser, users)) {
        try {
          await notifyTimesheetPendingManagerSignoff({
            organizationId: organization.id,
            signedByUser: subjectUser,
            users,
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
    // Rulebook 1.30.2: never a counter-signature on one's own sheet.
    if (!viewer || !signature || !viewerIsReviewer) return
    if (!payInputs.ready) {
      setError(payInputs.message)
      return
    }
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
            users,
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
  const runInvoiceGeneration = (taxIds: { utrNumber?: string; vatNumber?: string } = invoiceTaxIds) => {
    if (!organization || !fullyApproved || !payInputs.ready) return
    const subject = subjectForUser(subjectUser, operatives)
    const lines = invoiceLinesForTimesheet({
      payroll,
      draft,
      timeZone,
      extrasMode: 'raw',
      standardDayHours: weekdayPaidHours(payrollPolicy),
      standardDayHoursOn: (date: Date) => weekdayPaidHours(policyOnDay(date)),
      currencyCode: currency,
      // Rulebook 1.11.0: only the self-employed days of the period reach the invoice.
      timesheetDays: subjectUser ? timesheetDayKeysForPeriod(subjectUser, periodStart, periodEnd, timeZone) : [],
    })
    const notes = invoiceRateChangeNotes({
      history,
      user: subjectUser,
      operatives,
      periodStart,
      periodEnd,
      timeZone,
      currencyCode: currency,
    })
    const html = buildTimesheetInvoiceHtml({
      organizationName: organization.name || 'Organisation',
      subject,
      weekStart: periodStart,
      weekEnd: periodEnd,
      totalHours: payroll.totalHours,
      totalDays: payroll.totalHours / Math.max(weekdayPaidHours(payrollPolicy), 0.01),
      amount: invoiceLinesTotal(lines),
      vatNumber: taxIds.vatNumber,
      utrNumber: taxIds.utrNumber,
      timeZone,
      lines,
      notes,
      currencyCode: currency,
    })
    const pdf = buildTimesheetInvoicePdf({
      organizationName: organization.name || 'Organisation',
      subject,
      weekStart: periodStart,
      weekEnd: periodEnd,
      amount: invoiceLinesTotal(lines),
      vatNumber: taxIds.vatNumber,
      utrNumber: taxIds.utrNumber,
      timeZone,
      lines,
      notes,
      currencyCode: currency,
    })
    setInvoiceHtml(html)
    setInvoicePdf(pdf)
  }

  const canViewSubjectTaxIds = Boolean(
    viewer &&
      canViewSensitiveProfile({
        viewerRole: staffAccountRole(viewer),
        viewerUserId: viewer.id,
        subjectUserId: subjectUser.id,
      })
  )

  const handleInvoice = async () => {
    if (!organization || !fullyApproved) return
    if (!payInputs.ready) {
      setError(payInputs.message)
      return
    }
    let taxIds: { utrNumber?: string; vatNumber?: string } = {}
    if (exportIncludesSensitiveFields({ requested: includeTaxIds, canView: canViewSubjectTaxIds })) {
      try {
        const loaded = await loadTaxIds(subjectUser.id, subjectUser)
        taxIds = { utrNumber: loaded.utrNumber || undefined, vatNumber: loaded.vatNumber || undefined }
      } catch {
        taxIds = {}
      }
      setInvoiceTaxIds(taxIds)
      if (!taxIds.utrNumber) {
        setUtrWarningOpen(true)
        return
      }
    } else {
      setInvoiceTaxIds({})
    }
    runInvoiceGeneration(taxIds)
  }

  const setLineDecision = (lineId: string, decision: TimesheetManagerDecision, revisedAmount?: number | null) => {
    void persistOrReport({
      ...draft,
      payrollLineReviews: {
        ...draft.payrollLineReviews,
        [lineId]: { decision, revisedAmount: revisedAmount ?? null },
      },
    })
  }

  if (loading)
    return (
      <>
        <PageBand back={back} title={heading} />
        <LoadingSpinner />
      </>
    )

  if (signOpen || managerSignOpen) {
    const signTotals = draftTimesheetTotals({
      lines: payroll.lineItems,
      draft,
      decided: managerHasSigned || managerSignOpen,
      reviewing: managerSignOpen,
      timesheetDays: sheetDays,
      timeZone,
    })
    const hoursAmount = signTotals.labour
    const priceWorkAmount = signTotals.priceWork
    const expenses = signTotals.expenses
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
        heading={heading}
        outerBack={back}
        summaryRows={sheetRows.length === 0 ? undefined : sheetRows.map((row) =>
          row.kind === 'leave' ? (
            <LeaveInfoLine key={row.key} leave={row.leave} timeZone={timeZone} />
          ) : (
            <PayrollLine
              key={row.key}
              line={row.line}
              draft={draft}
              managerHasSigned={managerHasSigned}
              canReview={false}
              timeZone={timeZone}
              onApprove={() => undefined}
              onDecline={() => undefined}
              onEdit={() => undefined}
            />
          )
        )}
        onCancel={() => {
          setSignOpen(false)
          setManagerSignOpen(false)
          setSignature(null)
        }}
        onConfirm={() => void (managerSignOpen ? handleManagerSign() : handleOperativeSign())}
      />
    )
  }

  const reviewName = `${subjectUser.firstName} ${subjectUser.surname}`.trim() || subjectUser.email
  const bandStats: StatItem[] =
    mode === 'review'
      ? [
          {
            value: money(hoursSubtotal, currency),
            label: `Hours · ${payroll.shiftCount} shifts (${formatTimesheetHours(payroll.totalHours)}h)`,
          },
          { value: money(overtimeAmount, currency), label: 'Overtime', tone: 'amber' },
          { value: money(extrasTotal, currency), label: `Price work · ${draft.priceWorkEntries.length}` },
          { value: money(expensesAmount, currency), label: `Expenses · ${draft.expenseEntries.length}` },
        ]
      : [
          { value: money(hoursSubtotal, currency), label: 'Hours subtotal' },
          ...(overtimeAmount > 0 ? [{ value: money(overtimeAmount, currency), label: 'Overtime', tone: 'amber' as const }] : []),
          ...(extrasTotal + expensesAmount > 0
            ? [{ value: money(totals.extras, currency), label: managerHasSigned ? 'Approved extras' : 'Extras (price work & expenses)' }]
            : []),
        ]
  const totalLabel = mode === 'review' && managerHasSigned ? 'Approved total' : 'Total'

  return (
    <>
      <PageBand
        back={back}
        eyebrow={`${heading} · ${mode === 'review' ? 'Breakdown' : 'This period'}`}
        title={mode === 'review' ? reviewName : periodTitle}
        subtitle={mode === 'review' ? periodTitle : undefined}
        actions={mode === 'review' ? <ReviewStatusCapsule signed={Boolean(draft.operativeSignedAt)} /> : undefined}
        aside={
          <>
            <span>{totalLabel}</span>
            <b>{money(total, currency)}</b>
          </>
        }
      >
        <StatRow items={bandStats} />
      </PageBand>
      <PayInputsBanner inputs={payInputs} />
      {error ? <Note tone="red" role="alert">{error}</Note> : null}
      {updatedElsewhere ? (
        <Note tone="amber" role="status">
          This timesheet was updated on another device. It will refresh when you finish this change.
        </Note>
      ) : null}

      {managerHasSigned && managerAdjustmentCount(draft) > 0 ? (
        <AdjustmentSummaryCard
          managerName={draft.managerSignedByName || 'Line manager'}
          rows={managerAdjustmentRows(draft)}
        />
      ) : null}

      <div className="pu-grid2">
        <div className="pu-col">
          <Card
            title={mode === 'review' ? 'Breakdown' : 'This period'}
            subtitle={
              canManagerReview
                ? 'Review each day, expense and price-work line. Use ✓ approve, ✕ decline, or edit. Changes are shown to the operative when you sign off.'
                : undefined
            }
          >
            {sheetRows.length === 0 ? (
              <EmptyState
                title={
                  mode === 'review'
                    ? 'No bookings found for this period.'
                    : 'No bookings found for this payment period yet. Hours from site, office, site survey and other schedule entries will appear here automatically.'
                }
              />
            ) : (
              <DataTable
                columns={[
                  { key: 'day', label: 'Day' },
                  { key: 'booking', label: 'Booking' },
                  { key: 'calc', label: 'Calculation' },
                  { key: 'amount', label: 'Amount', align: 'right' },
                ]}
              >
                {sheetRows.map((row) =>
                  row.kind === 'leave' ? (
                    <LeaveInfoLine key={row.key} leave={row.leave} timeZone={timeZone} />
                  ) : (
                    <PayrollLine
                      key={row.key}
                      line={row.line}
                      draft={draft}
                      managerHasSigned={managerHasSigned}
                      canReview={canManagerReview}
                      timeZone={timeZone}
                      onApprove={() => setLineDecision(row.line.id, 'approved')}
                      onDecline={() => setLineDecision(row.line.id, 'declined')}
                      onEdit={() => openPayrollHoursEditor(row.line)}
                    />
                  )
                )}
              </DataTable>
            )}
            <div className="pu-totals">
              {mode === 'review' ? (
                <>
                  <Row
                    label={`Hours · ${payroll.shiftCount} shifts (${formatTimesheetHours(payroll.totalHours)}h)`}
                    value={money(hoursSubtotal, currency)}
                  />
                  <Row label="Overtime" value={money(overtimeAmount, currency)} />
                  <Row label={`Price work · ${draft.priceWorkEntries.length}`} value={money(extrasTotal, currency)} />
                  <Row label={`Expenses · ${draft.expenseEntries.length}`} value={money(expensesAmount, currency)} />
                </>
              ) : (
                <>
                  <Row label="Hours subtotal" value={money(hoursSubtotal, currency)} strong />
                  {overtimeAmount > 0 ? <Row label="Overtime" value={money(overtimeAmount, currency)} /> : null}
                  {extrasTotal + expensesAmount > 0 ? (
                    <div className="r">
                      <span>{managerHasSigned ? 'Approved extras' : 'Extras (price work & expenses)'}</span>
                      {managerHasSigned && totals.extras !== totals.submittedExtras ? (
                        <span style={{ textAlign: 'right' }}>
                          <span className="pu-sub" style={{ textDecoration: 'line-through' }}>
                            {money(totals.submittedExtras, currency)}
                          </span>
                          <b style={{ color: 'var(--pu-c-green-ink)' }}>{money(totals.extras, currency)}</b>
                        </span>
                      ) : (
                        <b>{money(totals.extras, currency)}</b>
                      )}
                    </div>
                  ) : null}
                </>
              )}
              <div className="r big">
                <span>{totalLabel}</span>
                <span>{money(total, currency)}</span>
              </div>
              {mode === 'review' && draft.managerNote.trim() ? (
                <div style={{ paddingTop: 8 }}>
                  <b>Note to manager</b>
                  <p className="pu-sub" style={{ fontSize: 13.5, marginTop: 2 }}>{draft.managerNote}</p>
                </div>
              ) : null}
              {managerHasSigned && managerAdjustmentCount(draft) > 0 ? (
                <span className="pu-sub">Includes line manager adjustments</span>
              ) : null}
            </div>
          </Card>

          {mode === 'mine' && draft.priceWorkEntries.length > 0 ? (
            <ExtraList
              title={managerHasSigned ? 'Price work (after review)' : 'Price Work'}
              items={draft.priceWorkEntries.map((item) => ({
                id: item.id,
                title: item.title,
                jobNumber: priceWorkJobNumberText(item.jobNumber),
                details: item.details,
                amount: effectivePriceWorkAmount(item, managerHasSigned),
                original: item.amount,
                decision: item.managerDecision,
                removed: managerHasSigned && item.managerDecision === 'declined',
              }))}
              managerHasSigned={managerHasSigned}
            />
          ) : null}
          {mode === 'mine' && draft.expenseEntries.length > 0 ? (
            <ExtraList
              title={managerHasSigned ? 'Expenses (after review)' : 'Expenses'}
              items={draft.expenseEntries.map((item) => ({
                id: item.id,
                title: item.title,
                jobNumber: item.jobNumber.trim(),
                details: item.details,
                amount: effectiveExpenseAmount(item, managerHasSigned),
                original: item.amount,
                decision: item.managerDecision,
                removed: managerHasSigned && item.managerDecision === 'declined',
              }))}
              managerHasSigned={managerHasSigned}
            />
          ) : null}
          {mode === 'review' ? (
            <ReviewExtras
              draft={draft}
              canReview={canManagerReview}
              timeZone={timeZone}
              onSave={(next) => void persistOrReport(next)}
              onEditExtra={(type, id, title, _original, current) => {
                setEditingExtra({ type, id, title, original: current })
                setEditAmount(current.toFixed(2))
              }}
            />
          ) : null}
        </div>

        <div className="pu-col">
          {mode === 'mine' ? (
            <>
              <PaymentRunsBox invoicing={invoicing} />

              <Card title="Add to this timesheet">
                <div className="pu-card-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button type="button" onClick={() => beginExtra('priceWork')} className="pu-tilebtn">
                    <IconTile tone="purple" size="sm"><BriefcaseIcon /></IconTile>
                    <span style={{ minWidth: 0 }}>
                      <b>Price Work</b>
                      <small>Agreed extras</small>
                    </span>
                  </button>
                  <button type="button" onClick={() => beginExtra('expense')} className="pu-tilebtn">
                    <IconTile tone="green" size="sm"><ReceiptPercentIcon /></IconTile>
                    <span style={{ minWidth: 0 }}>
                      <b>Expenses</b>
                      <small>+ receipts</small>
                    </span>
                  </button>
                </div>
              </Card>

              {needsCounterSign ? (
                <Card title="Note to manager">
                  <div className="pu-card-b">
                    <textarea
                      aria-label="Note to manager"
                      value={draft.managerNote}
                      onChange={(event) => {
                        localEdits.current = true
                        setDraft({ ...draft, managerNote: event.target.value })
                      }}
                      onBlur={(event) => void persistOrReport({ ...draft, managerNote: event.currentTarget.value })}
                      className="pu-inp"
                    />
                  </div>
                </Card>
              ) : null}

              <Note tone="red">{hoursWarningCopy(subjectUser, users)}</Note>

              {!draft.operativeSignedAt ? (
                <PuButton variant="primary" block disabled={!payInputs.ready} onClick={() => setSignOpen(true)}>
                  Continue to sign
                </PuButton>
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
                <>
                  {needsCounterSign ? <Note tone="green">{SIGNED_OFF_EDIT_NOTE}</Note> : null}
                  {canViewSubjectTaxIds ? (
                    <label className="pu-form-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={includeTaxIds} onChange={(e) => setIncludeTaxIds(e.target.checked)} />
                      {SENSITIVE_EXPORT_OPTION_LABEL}
                    </label>
                  ) : null}
                  <PuButton variant="green" block disabled={busy || !payInputs.ready} onClick={() => void handleInvoice()}>
                    Generate Invoice
                  </PuButton>
                </>
              ) : (
                <>
                  <PuButton block disabled aria-disabled="true">
                    Generate Invoice
                  </PuButton>
                  <p className="pu-sub" style={{ textAlign: 'center' }}>
                    {!draft.operativeSignedAt
                      ? needsCounterSign
                        ? 'Add any expenses or price work, then sign your timesheet. Your line manager will counter-sign before you can invoice.'
                        : 'Add any expenses or price work, then confirm and approve your timesheet to unlock Generate Invoice.'
                      : needsCounterSign
                        ? 'Timesheet pending manager signature — Generate Invoice unlocks after your line manager counter-signs.'
                        : 'Re-sign your timesheet to generate an invoice.'}
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <Card title="Signatures">
                <div className="pu-card-b">
                  {draft.operativeSignedAt ? (
                    <SignedBlock
                      base64={draft.operativeSignatureImageBase64}
                      caption={`Operative: ${draft.operativeSignedByName || `${subjectUser.firstName} ${subjectUser.surname}`.trim()} · ${signedStamp(draft.operativeSignedAt, timeZone)}`}
                    />
                  ) : (
                    <Note tone="amber">Operative has not signed this week yet.</Note>
                  )}
                  {needsCounterSign ? (
                    draft.managerSignedAt ? (
                      <SignedBlock
                        base64={draft.managerSignatureImageBase64}
                        caption={`Manager approved: ${draft.managerSignedByName || 'Manager'} · ${signedStamp(draft.managerSignedAt, timeZone)}`}
                      />
                    ) : (
                      <div className="pu-dashed" style={{ height: 82, justifyContent: 'center', fontStyle: 'italic', cursor: 'default', color: 'var(--pu-muted)' }}>
                        Manager signature
                      </div>
                    )
                  ) : null}
                </div>
              </Card>
              {fullyApproved ? (
                <>
                  <Note tone="green" icon={<CheckCircleIcon />}>
                    <b>Signed off</b>
                  </Note>
                  <p className="pu-sub">{SIGNED_OFF_EDIT_NOTE}</p>
                </>
              ) : needsCounterSign && !draft.managerSignedAt ? (
                <>
                  {extrasPendingReview(draft) && (draft.expenseEntries.length > 0 || draft.priceWorkEntries.length > 0) ? (
                    <Note tone="amber">Approve, decline or edit every expense and price-work line before signing off.</Note>
                  ) : null}
                  <PuButton
                    variant="green"
                    block
                    disabled={!draft.operativeSignedAt || !payInputs.ready}
                    onClick={() => {
                      if (extrasPendingReview(draft) && (draft.expenseEntries.length > 0 || draft.priceWorkEntries.length > 0)) {
                        setExtrasReviewAlert(true)
                        return
                      }
                      setManagerSignOpen(true)
                    }}
                  >
                    Sign off & finalise
                  </PuButton>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {extraMode ? (
        <ExtraForm
          mode={extraMode}
          jobs={mergeProjectsAndSmallWorks(projects, smallWorks).filter((row) => row.jobNumber.trim())}
          managers={users.filter(isTimesheetAgreedManagerCandidate)}
          timeZone={timeZone}
          onCancel={() => setExtraMode(null)}
          onSave={async (entry) => {
            const next =
              extraMode === 'priceWork'
                ? { ...draft, priceWorkEntries: [...draft.priceWorkEntries, entry.priceWork!] }
                : { ...draft, expenseEntries: [...draft.expenseEntries, entry.expense!] }
            try {
              await persist(next)
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Could not save the timesheet')
              return
            }
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
          policy={(() => {
            const editing = payroll.lineItems.find((item) => item.id === editingLineId)
            return editing ? policyOnDay(editing.date) : payrollPolicy
          })()}
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
        <Modal
          size="sm"
          labelledBy="ts-resign-title"
          title="Re-sign required"
          tile={<IconTile tone="amber" size="sm"><WarnIcon /></IconTile>}
          footer={
            <>
              <PuButton onClick={() => setPendingExtraMode(null)}>Decline</PuButton>
              <PuButton variant="primary" onClick={() => void acceptPostSignExtra()}>
                Accept — add anyway
              </PuButton>
            </>
          }
        >
          <p className="pu-sub" style={{ fontSize: 14 }}>{postSignExtraWarningCopy(subjectUser, draft, users)}</p>
        </Modal>
      ) : null}

      {extrasReviewAlert ? (
        <Modal
          size="sm"
          labelledBy="ts-review-required-title"
          title="Review required"
          tile={<IconTile tone="amber" size="sm"><WarnIcon /></IconTile>}
          footer={
            <PuButton variant="primary" onClick={() => setExtrasReviewAlert(false)}>
              OK
            </PuButton>
          }
        >
          <p className="pu-sub" style={{ fontSize: 14 }}>
            Please approve, decline or edit each expense and price-work item using the buttons provided.
          </p>
        </Modal>
      ) : null}

      {utrWarningOpen ? (
        <Modal
          size="sm"
          labelledBy="ts-utr-title"
          title="Before you invoice"
          tile={<IconTile tone="amber" size="sm"><WarnIcon /></IconTile>}
          footer={
            <>
              <PuButton onClick={() => setUtrWarningOpen(false)}>Back</PuButton>
              <PuButton
                variant="green"
                onClick={() => {
                  setUtrWarningOpen(false)
                  runInvoiceGeneration()
                }}
              >
                Accept
              </PuButton>
            </>
          }
        >
          <p className="pu-sub" style={{ fontSize: 14 }}>
            The UTR number is blank. Ask an admin to add it on Edit user so invoices are paid promptly.
          </p>
        </Modal>
      ) : null}

      {invoiceHtml ? (
        <Modal
          size="sm"
          labelledBy="ts-invoice-done-title"
          title="Invoice generated successfully"
          tile={<IconTile tone="green" size="sm"><CheckCircleIcon /></IconTile>}
          headerEnd={
            <PuButton
              size="sm"
              onClick={() => {
                setInvoiceHtml(null)
                setInvoicePdf(null)
              }}
            >
              Done
            </PuButton>
          }
          footer={
            <PuButton
              variant="green"
              block
              onClick={() => {
                if (invoicePdf) {
                  void shareTimesheetPdf(
                    invoicePdf,
                    timesheetInvoicePdfFileName(subjectForUser(subjectUser, operatives).name)
                  )
                  return
                }
                printTimesheetInvoice(invoiceHtml)
              }}
            >
              Share invoice
            </PuButton>
          }
        >
        </Modal>
      ) : null}
    </>
  )
}

function ReviewStatusCapsule({ signed }: { signed: boolean }) {
  return signed ? <Chip tone="green">Operative signed</Chip> : <Chip tone="amber">Awaiting operative signature</Chip>
}

/** Chip colour for a review decision (display only; the label is `decisionLabel`). */
function decisionTone(decision: TimesheetManagerDecision): 'green' | 'red' | 'blue' | 'amber' {
  if (decision === 'approved') return 'green'
  if (decision === 'declined') return 'red'
  if (decision === 'edited') return 'blue'
  return 'amber'
}

function AdjustmentSummaryCard({
  managerName,
  rows,
}: {
  managerName: string
  rows: ReturnType<typeof managerAdjustmentRows>
}) {
  return (
    <Card
      title="Line manager adjustments"
      subtitle={`${managerName} reviewed your timesheet. Struck-through amounts are what you submitted; coloured amounts are what will be paid.`}
      icon={<IconTile tone="blue" size="sm"><InfoIcon /></IconTile>}
    >
      <div className="pu-list">
        {rows.map((row) => (
          <div key={`${row.title}-${row.decision}`} className="pu-item">
            <Chip tone={decisionTone(row.decision)}>{decisionLabel(row.decision)}</Chip>
            <span className="grow">
              <b>{row.title}</b>
              {row.detail ? <span className="pu-sub">{row.detail}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

const DECISION_INK: Record<string, string> = {
  approved: 'var(--pu-c-green-ink)',
  declined: 'var(--pu-c-red-ink)',
  edited: 'var(--pu-blue)',
  pending: 'var(--pu-c-amber-ink)',
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
  const currency = useOrganizationCurrency()
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
      <span style={{ display: 'block', textAlign: 'right' }}>
        <span
          className="pu-sub"
          style={{ textDecoration: decision === 'declined' || decision === 'edited' ? 'line-through' : undefined }}
        >
          {money(original, currency)}
        </span>
        <b style={{ color: DECISION_INK[decision] ?? 'inherit' }}>{money(effective, currency)}</b>
      </span>
    )
  }
  return <b>{money(original, currency)}</b>
}

/** iOS managerExtraRow while canReview: declined is strikethrough original only, no £0. */
function LiveReviewExtraAmount({
  amount,
  decision,
  revisedAmount,
}: {
  amount: number
  decision: TimesheetManagerDecision
  revisedAmount?: number | null
}) {
  const currency = useOrganizationCurrency()
  if (decision === 'edited' && revisedAmount != null && Math.abs(revisedAmount - amount) >= 0.01) {
    return (
      <span style={{ display: 'block' }}>
        <span className="pu-sub" style={{ textDecoration: 'line-through' }}>{money(amount, currency)}</span>
        <b style={{ color: 'var(--pu-blue)' }}>{money(revisedAmount, currency)}</b>
      </span>
    )
  }
  if (decision === 'declined') {
    return <b style={{ color: 'var(--pu-muted)', textDecoration: 'line-through' }}>{money(amount, currency)}</b>
  }
  return <b>{money(amount, currency)}</b>
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="r" style={strong ? { fontWeight: 600 } : undefined}>
      <span>{label}</span>
      <span>{value}</span>
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
  const currency = useOrganizationCurrency()
  const removed = isPayrollLineRemoved(line, draft, managerHasSigned, canReview)
  const effective = effectivePayrollAmount(line, draft, managerHasSigned, canReview)
  const decision = draftPayrollLineReview(draft, line.id)?.decision || 'approved'
  const orange = line.isPayeDay || (line.dayRate <= 0 && !line.hourlyRate)
  // `overlappingBookingIds`: still paid, shown amber for the person and their line manager.
  const overlapping = line.isOverlapping === true
  const strike = removed ? { textDecoration: 'line-through' as const } : undefined
  return (
    <tr className={[overlapping ? 'overlap' : '', removed ? 'removed' : ''].join(' ').trim() || undefined}>
      <td style={{ whiteSpace: 'nowrap' }}>
        <b style={strike}>{abbreviatedDate(line.date, timeZone)}</b>
      </td>
      <td>
        <div style={strike}>
          {line.jobNumber} · {line.projectName}
        </div>
        {/\d{1,2}:\d{2}/.test(line.details) ? (
          <div className="pu-sub" style={strike}>{line.details}</div>
        ) : null}
        {overlapping ? (
          <div style={{ marginTop: 6 }}>
            <Note tone="amber">{OVERLAPPING_BOOKING_NOTE}</Note>
          </div>
        ) : null}
      </td>
      <td>
        <span
          className="pu-sub"
          style={{ ...strike, color: orange ? 'var(--pu-c-amber-ink)' : undefined, fontWeight: orange ? 600 : undefined }}
        >
          {timesheetHoursRateLine(line, currency)}
        </span>
      </td>
      <td className="num">
        <AdjustedAmountText
          original={line.amount}
          effective={effective}
          decision={decision}
          managerHasSigned={managerHasSigned}
          applyLiveReview={canReview}
        />
        {canReview ? <TickCross decision={decision} onApprove={onApprove} onDecline={onDecline} onEdit={onEdit} /> : null}
      </td>
    </tr>
  )
}

/** Approved annual leave on this period: no hours, no pay, no edit, never on the invoice. */
function LeaveInfoLine({ leave, timeZone }: { leave: TimesheetLeaveLine; timeZone: string }) {
  return (
    <tr className="leave">
      <td style={{ whiteSpace: 'nowrap' }}>
        <b>{abbreviatedDate(dateFromDayKey(leave.dayKey, timeZone), timeZone)}</b>
      </td>
      <td>
        <div>
          {leave.label}
          {leave.timeRange ? ` · ${leave.timeRange}` : ''}
        </div>
      </td>
      <td>
        <span className="pu-sub">No hours or pay</span>
      </td>
      <td className="num" />
    </tr>
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
  const base = { width: 34, height: 34, borderRadius: 9, border: 0, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
  return (
    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
      <button
        type="button"
        onClick={onApprove}
        style={{
          ...base,
          background: approved ? '#12825A' : declined ? 'var(--pu-line-2)' : 'var(--pu-c-green-bg)',
          color: approved ? '#fff' : declined ? 'var(--pu-muted)' : 'var(--pu-c-green-ink)',
        }}
        aria-label="Approve"
        aria-pressed={approved}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onDecline}
        style={{
          ...base,
          background: declined ? '#C4242C' : approved ? 'var(--pu-line-2)' : 'var(--pu-c-red-bg)',
          color: declined ? '#fff' : approved ? 'var(--pu-muted)' : 'var(--pu-c-red-ink)',
        }}
        aria-label="Decline"
        aria-pressed={declined}
      >
        ✕
      </button>
      <button
        type="button"
        onClick={onEdit}
        style={{ ...base, background: 'var(--pu-c-blue-bg)', color: 'var(--pu-c-blue-ink)' }}
        aria-label="Edit"
      >
        ⚙
      </button>
    </span>
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
    /** Job number as shown (price work: "—" when an older entry has none). */
    jobNumber?: string
    details: string
    amount: number
    original: number
    decision: TimesheetManagerDecision
    removed: boolean
  }>
  managerHasSigned: boolean
}) {
  return (
    <Card title={title}>
      <div className="pu-list">
        {items.map((item) => (
          <div key={item.id} className="pu-item" style={item.removed ? { opacity: 0.55 } : undefined}>
            <span className="grow">
              <b style={item.removed ? { textDecoration: 'line-through' } : undefined}>{item.title}</b>
              {item.jobNumber ? <span className="pu-sub">Job {item.jobNumber}</span> : null}
              <span className="pu-sub">{item.details}</span>
              {managerHasSigned && item.decision !== 'pending' ? (
                <span style={{ display: 'inline-block', marginTop: 4 }}>
                  <Chip tone={decisionTone(item.decision)}>{decisionLabel(item.decision)}</Chip>
                </span>
              ) : null}
            </span>
            <AdjustedAmountText
              original={item.original}
              effective={item.amount}
              decision={item.decision}
              managerHasSigned={managerHasSigned}
            />
          </div>
        ))}
      </div>
    </Card>
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
        <Card title={canReview ? 'Expenses — review required' : 'Expenses'}>
          <div className="pu-list">
            {draft.expenseEntries.map((entry, index) => {
              const effective = effectiveExpenseAmount(entry, !canReview, canReview)
              const removed = entry.managerDecision === 'declined'
              return (
                <div key={entry.id} className="pu-item" style={{ alignItems: 'flex-start', opacity: removed ? 0.55 : undefined }}>
                  <span className="grow">
                    <b style={removed ? { textDecoration: 'line-through' } : undefined}>{entry.title}</b>
                    <span className="pu-sub" style={removed ? { textDecoration: 'line-through' } : undefined}>
                      {abbreviatedDate(entry.date, timeZone)} · {entry.jobNumber}
                    </span>
                    {canReview ? (
                      <LiveReviewExtraAmount
                        amount={entry.amount}
                        decision={entry.managerDecision}
                        revisedAmount={entry.managerRevisedAmount}
                      />
                    ) : (
                      <AdjustedAmountText
                        original={entry.amount}
                        effective={effective}
                        decision={entry.managerDecision}
                        managerHasSigned
                      />
                    )}
                  </span>
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
          </div>
        </Card>
      ) : null}
      {draft.priceWorkEntries.length > 0 ? (
        <Card title={canReview ? 'Price work — review required' : 'Price work'}>
          <div className="pu-list">
            {draft.priceWorkEntries.map((entry, index) => {
              const effective = effectivePriceWorkAmount(entry, !canReview, canReview)
              const removed = entry.managerDecision === 'declined'
              return (
                <div key={entry.id} className="pu-item" style={{ alignItems: 'flex-start', opacity: removed ? 0.55 : undefined }}>
                  <span className="grow">
                    <b style={removed ? { textDecoration: 'line-through' } : undefined}>{entry.title}</b>
                    <span className="pu-sub" style={removed ? { textDecoration: 'line-through' } : undefined}>
                      Agreed with: {entry.agreedManagerName} · {abbreviatedDate(entry.startDate, timeZone)} · {priceWorkJobNumberText(entry.jobNumber)}
                    </span>
                    {canReview ? (
                      <LiveReviewExtraAmount
                        amount={entry.amount}
                        decision={entry.managerDecision}
                        revisedAmount={entry.managerRevisedAmount}
                      />
                    ) : (
                      <AdjustedAmountText
                        original={entry.amount}
                        effective={effective}
                        decision={entry.managerDecision}
                        managerHasSigned
                      />
                    )}
                  </span>
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
          </div>
        </Card>
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
    <Card title="Payment runs & timesheets">
      <div className="pu-card-b pu-list-text">
        {invoicing.paymentRunMode === 'date_ranges' ? (
          invoicing.paymentRunDateRanges.map((range, index) => (
            <div key={`${range.startDay}-${range.endDay}`}>
              <p>
                • Run: {range.startDay} - {range.endDay}
              </p>
              {payout(index) ? <p>{payout(index)}</p> : null}
            </div>
          ))
        ) : (
          <div>
            <p>• {recurringRunDisplaySummary(invoicing)}</p>
            {payout(0) ? <p>{payout(0)}</p> : null}
          </div>
        )}
        {invoicing.noteToUsers.trim() ? (
          <Note tone="info">
            <b>Note</b>
            <br />
            {invoicing.noteToUsers}
          </Note>
        ) : null}
      </div>
    </Card>
  )
}

function SignedBlock({ base64, caption }: { base64?: string | null; caption: string }) {
  const src = signaturePngSrc(base64)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Signature" className="pu-sigimg" />
      ) : null}
      <Note tone="green" icon={<CheckCircleIcon />}>{caption}</Note>
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
  summaryRows,
  heading,
  outerBack,
  onCancel,
  onConfirm,
}: {
  /** The timesheet's own booking and leave rows, read-only (spec §4.6); undefined when there are none. */
  summaryRows?: ReactNode
  /** The page heading and the way back to the list, kept visible as on the screen before (Timesheet / Review Timesheet). */
  heading: string
  outerBack?: { label: string; onClick: () => void }
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
  const currency = useOrganizationCurrency()
  const total = hoursAmount + priceWorkAmount + expensesAmount
  const signatureCard = (
    <Card title="Your signature" subtitle={`Signing as ${signerName}`}>
      <div className="pu-card-b">
        <SignaturePad value={signature} onChange={onSignature} />
      </div>
    </Card>
  )
  const confirm = (
    <PuButton variant="green" block disabled={!signature || busy} onClick={onConfirm}>
      {confirmTitle}
    </PuButton>
  )
  const cancel = { label: managerMode ? 'Cancel' : 'Back', onClick: onCancel }
  // The list link stays the band's back link; the sheet's own Back / Cancel sits beside it, as before.
  const bandBack = outerBack ?? cancel
  const bandActions = outerBack ? (
    <PuButton variant="ghost-dark" size="sm" onClick={onCancel}>
      {cancel.label}
    </PuButton>
  ) : undefined
  if (managerMode) {
    return (
      <>
        <PageBand back={bandBack} eyebrow={heading} title="Sign Off" subtitle={periodTitle} actions={bandActions} />
        <Note tone="info">Sign as {signerName} to finalise this timesheet.</Note>
        {signatureCard}
        {confirm}
      </>
    )
  }
  return (
    <>
      <PageBand
        back={bandBack}
        eyebrow={heading}
        title="Sign Timesheet"
        actions={bandActions}
        aside={
          <>
            <span>Timesheet total</span>
            <b>{money(total, currency)}</b>
          </>
        }
      >
        <StatRow
          items={[
            { value: money(hoursAmount, currency), label: 'Hours' },
            { value: money(priceWorkAmount, currency), label: 'Price work' },
            { value: money(expensesAmount, currency), label: 'Expenses' },
          ]}
        />
      </PageBand>
      <div className="pu-grid2">
        <Card title="You're approving">
          {summaryRows ? (
            <>
            <p className="pu-label pu-pad" style={{ paddingBottom: 0 }}>Bookings and leave</p>
            <DataTable
              columns={[
                { key: 'day', label: 'Day' },
                { key: 'booking', label: 'Booking' },
                { key: 'calc', label: 'Calculation' },
                { key: 'amount', label: 'Amount', align: 'right' },
              ]}
            >
              {summaryRows}
            </DataTable>
            </>
          ) : null}
          <div className="pu-totals">
            <Row label="Period" value={periodTitle} />
            <Row label="Hours" value={money(hoursAmount, currency)} />
            <Row label="Price work" value={money(priceWorkAmount, currency)} />
            <Row label="Expenses" value={money(expensesAmount, currency)} />
            <div className="r big">
              <span>Timesheet total</span>
              <span>{money(total, currency)}</span>
            </div>
          </div>
        </Card>
        <div className="pu-col">
          {signatureCard}
          <Note tone="red">By signing you confirm these hours match the work you carried out.</Note>
          {confirm}
        </div>
      </div>
    </>
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
  const currency = useOrganizationCurrency()
  if (!line) return null
  const paid = paidBookedHours('customHours', start, end, policy, breakRemoved, line.date)
  const ot = overtimeHoursBeyondPaidStandard(line.date, 'customHours', start, end, policy, breakRemoved)
  const otHoursText = overtimeHoursText(line.date, 'customHours', start, end, policy, breakRemoved)
  const amount = revisedPayrollAmount({
    row: line,
    startTime: start,
    endTime: end,
    breakRemoved,
    policy,
  })
  return (
    <Modal
      labelledBy="ts-edit-hours-title"
      title="Edit Hours"
      tile={<IconTile tone="blue" size="sm"><ClockIcon /></IconTile>}
      headerStart={
        <PuButton size="sm" onClick={onCancel}>
          Cancel
        </PuButton>
      }
      footer={
        <PuButton variant="primary" onClick={onSave}>
          Save
        </PuButton>
      }
    >
      <p className="pu-sub" style={{ textAlign: 'center' }}>
        {abbreviatedDate(line.date, timeZone)} · {line.jobNumber} {line.projectName}
      </p>
      <div>
        <HoursTimelinePicker
          start={start}
          end={end}
          breakRemoved={breakRemoved}
          policy={policy}
          date={line.date}
          onStart={onStart}
          onEnd={onEnd}
          onBreak={onBreak}
          showBreak={!line.isOvertimeLine}
        />
      </div>
      {line.isOvertimeLine ? (
        <label className="pu-form-label">
          Overtime multiplier
          <input value={otText} onChange={(event) => onOt(event.target.value)} className="pu-inp" inputMode="decimal" />
        </label>
      ) : null}
      <div className="pu-totals" style={{ border: '1px solid var(--pu-line-2)', borderRadius: 12 }}>
        <div className="r">
          <span>Paid hours</span>
          <b>{formatTimesheetHours(paid)}h</b>
        </div>
        <div className="r">
          <span>Overtime</span>
          <b>{otHoursText ?? `${formatTimesheetHours(ot)}h`}</b>
        </div>
        <div className="r big">
          <span>Revised amount</span>
          <span>{money(amount, currency)}</span>
        </div>
      </div>
    </Modal>
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
  const currency = useOrganizationCurrency()
  return (
    <Modal
      size="sm"
      labelledBy="ts-amount-edit-title"
      title={title}
      tile={<IconTile tone="blue" size="sm"><ReceiptPercentIcon /></IconTile>}
      headerStart={
        <PuButton size="sm" onClick={onCancel}>
          Cancel
        </PuButton>
      }
      footer={
        <PuButton variant="primary" onClick={onSave}>
          Save
        </PuButton>
      }
    >
      <p className="pu-sub" style={{ fontSize: 14 }}>{subtitle}</p>
      <label className="pu-field" style={{ minWidth: 0 }}>
        {currencySymbol(currency)}
        <input value={amountText} onChange={(event) => onAmount(event.target.value)} inputMode="decimal" aria-label="Revised amount" />
      </label>
      <span className="pu-sub">Original: {money(originalAmount, currency)}</span>
    </Modal>
  )
}

function ExtraForm({
  mode,
  jobs,
  managers,
  timeZone,
  onCancel,
  onSave,
}: {
  mode: 'priceWork' | 'expense'
  jobs: Array<{ jobNumber: string; siteName: string }>
  managers: Array<{ firstName: string; surname: string; email: string }>
  timeZone: string
  onCancel: () => void
  onSave: (entry: {
    priceWork?: TimesheetDraft['priceWorkEntries'][number]
    expense?: TimesheetDraft['expenseEntries'][number]
  }) => Promise<void>
}) {
  const currency = useOrganizationCurrency()
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
  // Rulebook 1.30.1: a new price work entry needs a job number (`priceWorkJobNumberError`).
  const jobNumberError = mode === 'priceWork' ? priceWorkJobNumberError(jobNumber) : null
  const canSave = value != null && (mode === 'priceWork' ? !jobNumberError : Boolean(receiptName))
  const jobSuggestions = extraFormJobSuggestions(jobs, jobNumber)
  const managerSuggestions = extraFormManagerSuggestions(managers, agreedManagerName)

  const priceWork = mode === 'priceWork'
  return (
    <div className="pu-modal-wrap">
      <form
        className="pu-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ts-extra-form-title"
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
        <div className="pu-modal-h">
          <IconTile tone={priceWork ? 'purple' : 'green'} size="sm">
            {priceWork ? <BriefcaseIcon /> : <ReceiptPercentIcon />}
          </IconTile>
          <h2 id="ts-extra-form-title">{priceWork ? 'Add Price Work' : 'Add Expense'}</h2>
          <PuButton size="sm" onClick={onCancel}>
            Cancel
          </PuButton>
        </div>
        <div className="pu-modal-b">
          <label className="pu-form-label">
            {mode === 'expense' ? 'Expense name' : 'Price work name'}
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="pu-inp" />
          </label>
          <label className="pu-form-label">
            Description
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="pu-inp" />
          </label>
          <div className="pu-form-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <label className="pu-form-label">
                <span>
                  Job number{priceWork ? <span className="req"> (required)</span> : null}
                </span>
                <input
                  value={jobNumber}
                  onChange={(e) => setJobNumber(e.target.value)}
                  maxLength={mode === 'priceWork' ? PRICE_WORK_JOB_NUMBER_MAX : undefined}
                  required={mode === 'priceWork'}
                  className={`pu-inp${jobNumberError && (title.trim() || amount.trim()) ? ' invalid' : ''}`}
                />
              </label>
              {jobNumberError && (title.trim() || amount.trim()) ? <span className="pu-err">{jobNumberError}</span> : null}
              {jobSuggestions.length > 0 ? (
                <div className="pu-sugg">
                  {jobSuggestions.map((job) => (
                    <button key={`${job.jobNumber}-${job.siteName}`} type="button" onClick={() => setJobNumber(job.jobNumber)}>
                      {job.jobNumber}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="pu-form-label">
              Amount
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={formatMoney(0, currency)}
                inputMode="decimal"
                className="pu-inp"
                required
              />
            </label>
          </div>
          <div className="pu-form-row">
            <label className="pu-form-label">
              {mode === 'expense' ? 'Date' : 'Start date'}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pu-inp" />
            </label>
            {priceWork ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <label className="pu-form-label" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 18 }}>
                  Add end date
                  <input type="checkbox" checked={includeEndDate} onChange={(e) => setIncludeEndDate(e.target.checked)} />
                </label>
                {includeEndDate ? (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pu-inp"
                    aria-label="End date"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          {priceWork ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="pu-form-label">
                Manager who agreed this
                <input value={agreedManagerName} onChange={(e) => setAgreedManagerName(e.target.value)} className="pu-inp" />
              </label>
              {managerSuggestions.length > 0 ? (
                <div className="pu-sugg">
                  {managerSuggestions.map((name) => (
                    <button key={name} type="button" onClick={() => setAgreedManagerName(name)}>
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <label className="pu-dashed">
              <span aria-hidden="true">📎</span>
              <span>Upload receipt</span>
              <span style={{ marginLeft: 'auto' }}>
                {receiptName ? <Chip tone="blue">{receiptName}</Chip> : <Chip tone="red">Required</Chip>}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file || !file.type.startsWith('image/')) {
                    setReceiptName(null)
                    event.target.value = ''
                    return
                  }
                  setReceiptName(timesheetReceiptStoredName(file.name))
                }}
              />
            </label>
          )}
        </div>
        <div className="pu-modal-f">
          <PuButton type="submit" variant="primary" disabled={!canSave}>
            {mode === 'expense' ? 'Add expense' : 'Add price work'}
          </PuButton>
        </div>
      </form>
    </div>
  )
}
