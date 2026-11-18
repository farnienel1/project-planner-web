'use client'

import { formatMoney } from '@/lib/canonical/money'
import { useOrganizationCurrency, useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { auth } from '@/lib/firebase/config'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  forgetExportedTimesheetHistory,
  isUnresolvedTimesheetPerson,
  loadExportedTimesheetHistory,
  loadTimesheetDraft,
  loadTimesheetDraftAt,
  loadTimesheetQueueSheets,
  type TimesheetQueueStoredSheet,
  stampTimesheetExport,
  timesheetDocId,
  timesheetSourceDocumentId,
  type ExportedTimesheetHistoryRow,
  timesheetVersionChain,
  timesheetVersionChainFor,
} from '@/lib/timesheets/timesheetStorage'
import { timesheetRevisionCopy } from '@/lib/timesheets/timesheetRevisionCopy'
import { TIMESHEET_EARLIER_VERSIONS_LABEL, TIMESHEET_ORIGINAL_VERSION_LABEL, timesheetRevisionLabel } from '@/lib/canonical'
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
import { useSnapshotAutoRepair } from '@/lib/timesheets/useSnapshotAutoRepair'
import type { RepairSheet } from '@/lib/timesheets/snapshotAutoRepair'
import {
  RECENT_PAY_RUN_COUNT,
  payRunKey,
  payRunsStartDayKey,
  recentPayRuns,
  timesheetMemberIds,
  userTimesheetQueueRows,
  type PayRun,
  type TimesheetQueueBucketRow,
  type TimesheetQueueRow,
} from '@/lib/timesheets/timesheetQueue'
import { applyWeeklyReportOverride } from '@/lib/timesheets/weeklyReportOverride'
import { exportedTimesheetRosterGroups, subjectForUser, timesheetRosterGroups, userIdsSharingEmail } from '@/lib/timesheets/timesheetWeekUtils'
import { formatPaymentPeriodLine, listSelectablePayPeriods, organizationCreatedAt, payRunListStartDayKey, periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { collectTimesheetPayroll } from '@/lib/timesheets/timesheetPayrollCollector'
import { periodBookingChanges, type BookingChangeCatalogue } from '@/lib/timesheets/timesheetBookingChanges'
import {
  invoiceLinesForTimesheet,
  invoiceLinesTotal,
  paymentRunDateStamp,
  pdfBytesToBase64,
  signatureNotes,
  timesheetExportFileName,
} from '@/lib/timesheets/timesheetExport'
import { buildTimesheetInvoicePdf, timesheetPdfBlob } from '@/lib/timesheets/invoicePdf'
import { downloadPdf } from '@/lib/pdf/downloadPdf'
import { timesheetDayKeysForPeriod } from '@/lib/timesheets/timesheetPayrollPolicy'
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
import type { PayProfilesStatus } from '@/lib/pay/payProfileOverlay'
import { PAY_DETAILS_NOT_LOADED_LABEL } from '@/components/pay/PayStatusNotice'
import { EXPORT_PAY_UNKNOWN_SKIPPED_MESSAGE, exportedPdfPayRefusal } from '@/lib/timesheets/exportPayGate'
import {
  EXPORT_REBUILT_CONFIRM,
  EXPORT_RECOVER_HINT,
  exportRebuiltPdfNote,
  exportSummaryMessage,
  exportedPdfIsRebuilt,
  mapWithConcurrency,
  runTimesheetExport,
} from '@/lib/timesheets/timesheetExportRun'
import { EXPORT_DELIVERY_TAB_ID, exportDeliveryLiveElsewhere, exportDeliveryNotice, exportDeliveryPending, useExportDeliveryStore } from '@/lib/timesheets/exportDelivery'

/** Review of #363: PDFs built and backed up at once during an export's delivery. */
const EXPORT_DELIVERY_CONCURRENCY = 3
import type { PayrollTimePolicyState } from '@/lib/canonical'
import { UNRESOLVED_BOOKING_PERSON_CHIP } from '@/lib/canonical'
import { SIGNED_TIMESHEET_EXPORT_SKIPPED_MESSAGE, TIMESHEET_LATE_EXTRAS_EXPORT_SKIPPED_MESSAGE, signedTimesheetActions } from '@/lib/canonical'

/** Third review #325: Export left a sheet out because the bookings or pay inputs were still loading. */
const EXPORT_INPUTS_LOADING_SKIPPED_MESSAGE = 'Not exported — the bookings or pay settings were still loading; export again.'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

export type TeamTimesheetTab = 'awaiting' | 'signed' | 'exported'

/**
 * Review of #368 (S4): Download PDF for an exported sheet of nobody in the organisation is drawn from its stored signed
 * snapshot; an older sheet exported without one cannot be rebuilt (there is no person, rate or booking list to price it).
 */
const UNRESOLVED_PDF_NO_SNAPSHOT_MESSAGE =
  "This sheet was exported before signed copies were kept and its person is no longer in the organisation, so its PDF can't be rebuilt."

/** 17 Nov follow-up: beside an exported sheet whose stored person is nobody in the organisation (as Data health's chip). */
const UNKNOWN_TIMESHEET_PERSON_CHIP = UNRESOLVED_BOOKING_PERSON_CHIP

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
  queuePeriods,
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
  payStatusOf,
}: {
  payInputs: TimesheetInputsState
  /**
   * Review #342 items 1, 5 and re-review 1–2: each person's pay status. Not `ready` (loading or failed): no figures on
   * their row, skipped by Export, Download PDF refused. Missing: everyone ready (privatePay off, as before).
   */
  payStatusOf?: (member: User) => PayProfilesStatus
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  projects?: Project[]
  smallWorks?: Project[]
  periodStart: Date
  periodEnd: Date
  /**
   * The recent pay runs (newest first, the current one included) whose frozen-empty snapshots are repaired in the
   * background. Rulebook 1.66.0 §8 (owner decision 17 Nov): Awaiting / Signed off list every stored sheet, however old,
   * whatever this holds. Missing: the current run only.
   */
  queuePeriods?: ReadonlyArray<PayRun>
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
  // Rulebook 1.66.0 §8: every stored sheet of the listed people (under every id they go by), however old.
  const [queueSheets, setQueueSheets] = useState<TimesheetQueueStoredSheet[]>([])
  const [exportedRows, setExportedRows] = useState<ExportedTimesheetHistoryRow[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Review of #363: an export's background delivery for this organisation (survives navigation and a reload).
  const deliveryEntry = useExportDeliveryStore((state) => (organization?.id ? state.entries[organization.id] ?? null : null))
  const deliveryPending = useExportDeliveryStore((state) => exportDeliveryPending(state, organization?.id))
  const loadDelivery = useExportDeliveryStore((state) => state.load)
  const dismissDelivery = useExportDeliveryStore((state) => state.dismiss)
  useEffect(() => {
    if (organization?.id) loadDelivery(organization.id)
  }, [organization?.id, loadDelivery])
  const deliveryHere = useExportDeliveryStore((state) => Boolean(organization?.id && state.live[organization.id]))
  const deliveryNowMs = useExportDeliveryStore((state) => state.nowMs)
  const deliveryElsewhere = exportDeliveryLiveElsewhere(deliveryEntry, EXPORT_DELIVERY_TAB_ID, deliveryNowMs)
  const deliveryNotice = exportDeliveryNotice(deliveryEntry, deliveryHere, deliveryElsewhere)
  // Exports leave UTR and VAT out unless an admin ticks the box (rulebook).
  const [exportTaxIds, setExportTaxIds] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exportedSearch, setExportedSearch] = useState('')
  const [exportedSort, setExportedSort] = useState<'firstName' | 'lastName' | 'dateNewest' | 'dateOldest'>('dateNewest')
  const [exportedRunKey, setExportedRunKey] = useState('all')
  const paintedListKey = useRef('')
  const reloadGeneration = useRef(0)

  // The recent pay runs the background snapshot repair covers, newest first (the current run when none are given).
  const runs = useMemo<PayRun[]>(() => {
    const list = queuePeriods && queuePeriods.length > 0 ? [...queuePeriods] : [{ start: periodStart, end: periodEnd }]
    return list.sort((a, b) => b.start.getTime() - a.start.getTime())
  }, [queuePeriods, periodStart, periodEnd])

  const groups = useMemo(() => {
    if (!user) return [] as User[][]
    // Rulebook 1.31.0: the Exported list is `exportedTimesheetHistorySubjects` (own sheets read-only, inactive people
    // in scope); the other tabs stay `userTimesheetSubjects`.
    return teamTab === 'exported' ? exportedTimesheetRosterGroups(user, users) : timesheetRosterGroups(user, users)
  }, [user, users, teamTab])

  const roster = useMemo(() => groups.flat(), [groups])

  const reload = useCallback(async () => {
    if (!organization?.id) return
    const generation = ++reloadGeneration.current
    const stale = () => generation !== reloadGeneration.current
    const userIds = roster.map((row) => row.id)
    if (teamTab === 'exported') {
      if (userIds.length === 0 && !hasAdminAccess(user)) {
        setExportedRows([])
        setRecordsLoading(false)
        return
      }
      setRecordsLoading(true)
      setLoadError(null)
      try {
        // 17 Nov follow-up (guardrail 3): sheets under any id a listed person goes by; admins also see a sheet whose
        // person is nobody in the organisation, as "Unknown person · …", never dropped.
        setExportedRows(
          await loadExportedTimesheetHistory({
            organizationId: organization.id,
            users: roster,
            roster: users,
            includeUnresolved: hasAdminAccess(user),
          })
        )
      } catch {
        setLoadError('Timesheets did not finish loading. Check the connection and try again.')
      } finally {
        setRecordsLoading(false)
      }
      return
    }

    const listKey = `${organization.id}|${teamTab}`
    if (paintedListKey.current !== listKey) {
      paintedListKey.current = listKey
      setQueueSheets([])
      setRecordsLoading(true)
    }
    setLoadError(null)
    try {
      // 17 Nov follow-up (guardrail 1): every id each listed person goes by (`personIdSet`), so a sheet filed under a
      // former invite id or a second users document is found and listed under the person.
      const aliasIds = roster.flatMap((member) => timesheetMemberIds(member, users))
      // Rulebook 1.66.0 §8 (owner decision 17 Nov): every stored sheet, however old — never a window of recent runs.
      const loaded = await loadTimesheetQueueSheets({
        organizationId: organization.id,
        userIds: aliasIds,
        timeZone,
        // Admins: the recent runs are also read by `weekStartKey`, so a sheet stored under another spelling of an id (or
        // with no `userId`) stays listed for them (guardrail 3).
        recentRunStartDayKeys: hasAdminAccess(user)
          ? recentPayRuns(invoicing, new Date(), timeZone, RECENT_PAY_RUN_COUNT).map((run) => periodStartKey(run.start, timeZone))
          : undefined,
      })
      if (stale()) return
      setQueueSheets(loaded)
    } catch {
      if (!stale()) setLoadError('Timesheets did not finish loading. Check the connection and try again.')
    } finally {
      if (!stale()) setRecordsLoading(false)
    }
  }, [organization?.id, roster, user, users, timeZone, teamTab, invoicing])

  useEffect(() => {
    void reload()
  }, [reload])

  // Rulebook 1.32.0 §8: the export never includes the exporter's own sheet; say so when theirs is signed and waiting.
  const [ownSheet, setOwnSheet] = useState<{ signed: boolean; exported: boolean; draft: TimesheetDraft } | null>(null)
  useEffect(() => {
    if (teamTab !== 'signed' || !organization?.id || !user?.id) {
      setOwnSheet(null)
      return
    }
    let live = true
    loadTimesheetDraft(organization.id, user.id, periodStart, timeZone, periodEnd)
      .then((draft) => live && setOwnSheet({ signed: Boolean(draft.operativeSignedAt), exported: Boolean(draft.exportedAt), draft }))
      .catch(() => live && setOwnSheet(null))
    return () => {
      live = false
    }
  }, [teamTab, organization?.id, user?.id, periodStart, periodEnd, timeZone])

  // Rulebook 1.47.0 §8 (`signedTimesheetBookingChanges`): a signed, unexported sheet whose bookings changed is back
  // with the person (not Awaiting or Signed off) until they sign again; then it is Awaiting the counter-signature again.
  const bookingsReady = payInputs.ready
  const changeCatalogue: BookingChangeCatalogue = {
    users,
    liveLoaded: bookingsReady,
    bookings,
    managerSiteBookings,
    operatives,
    projects,
    smallWorks,
    payrollPolicy,
    payrollPolicyPrior,
    payrollPolicyEffectiveFrom,
    payrollPolicyState,
    timeZone,
    history,
    scheduleOptions,
  }
  const changeCatalogueRef = useRef(changeCatalogue)
  // Review #325 nit: the people Export left out because their bookings changed since they signed.
  const changedSkippedRef = useRef<string[]>([])
  const lateSkippedRef = useRef<string[]>([])
  // Third review #325: the people Export left out because the bookings or pay inputs were still loading.
  const inputsSkippedRef = useRef<string[]>([])
  changeCatalogueRef.current = changeCatalogue
  // Rulebook 1.66.0 §8: the list checks booking changes over the same window as the hub tile (the last
  // RECENT_PAY_RUN_COUNT pay runs, `recentPayRuns`), so both count the same rows. Older runs read their bookings as not
  // changed (their waiting late extras still count). Export keeps its own full check before it stamps a sheet.
  const queueChangeFromDayKey = useMemo(
    () => payRunsStartDayKey(recentPayRuns(invoicing, new Date(), timeZone, RECENT_PAY_RUN_COUNT), timeZone),
    [invoicing, timeZone]
  )
  // Rulebook 1.66.0 §8 (owner decision 17 Nov): one row per person and pay run over every stored sheet, however old
  // (`userTimesheetQueue`; the bucket is `timesheetListBucket` with that sheet's booking change — a run outside the
  // window above reads as not changed).
  const queueRows = useMemo<TimesheetQueueBucketRow[]>(
    () =>
      teamTab === 'exported' || !user
        ? []
        : userTimesheetQueueRows({
            viewer: user,
            users,
            sheets: queueSheets,
            invoicing,
            timeZone,
            bookingChange: (member, draft, run) =>
              periodBookingChanges(
                { ...changeCatalogueRef.current, coversPeriod: (period) => periodStartKey(period.start, timeZone) >= queueChangeFromDayKey },
                member,
                draft,
                run
              ),
          }),
    // The catalogue is read through a ref; re-run when the bookings or pay inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queueSheets, teamTab, user, users, invoicing, timeZone, bookings, managerSiteBookings, bookingsReady, queueChangeFromDayKey]
  )
  const visible = useMemo<TimesheetQueueRow[]>(
    () => queueRows.filter((row) => row.bucket === teamTab),
    [queueRows, teamTab]
  )

  // Each listed person's own pay status (review #342 item 1). Declared before `useSnapshotAutoRepair`, which calls it
  // while rendering (its `payKey`): declared after it, the first render with a loaded sheet threw "Cannot access
  // 'payStatusFor' before initialization" and took the whole User Timesheets screen into the error boundary (17 Nov).
  const payStatusFor = (member: User): PayProfilesStatus => (payStatusOf ? payStatusOf(member) : 'ready')

  // Owner item 5 (17 Nov follow-up): every sheet of the loaded pay runs whose snapshot was frozen with no labour lines is
  // rebuilt in the background (`useSnapshotAutoRepair`; signatures kept, never an exported sheet), once the bookings and
  // pay inputs have loaded — never waiting for someone to open that one sheet.
  const repairSheets = useMemo<RepairSheet[]>(() => {
    if (teamTab === 'exported') return []
    // The recent pay runs only (as before 1.66.0); an exported sheet is never repaired.
    const recent = new Set(runs.map((run) => payRunKey(run, timeZone)))
    return queueRows
      .filter((row) => row.bucket !== 'exported' && recent.has(payRunKey(row.period, timeZone)))
      .map((row) => ({ member: row.member, period: row.period, draft: row.draft, documentId: timesheetSourceDocumentId(row.draft) }))
  }, [teamTab, runs, queueRows, timeZone])
  useSnapshotAutoRepair({
    organizationId: organization?.id,
    viewer: user,
    catalogue: changeCatalogue,
    sheets: repairSheets,
    ready: payInputs.ready,
    payStatusOf: payStatusFor,
    onRepaired: () => void reload(),
  })

  // Review #325 nit: the viewer's own sheet is not "signed" while its bookings changed since they signed (1.47.0).
  const ownSheetChange = ownSheet && user ? periodBookingChanges(changeCatalogueRef.current, user, ownSheet.draft, { start: periodStart, end: periodEnd }) : null
  const ownSheetNotice = ownSheet
    ? timesheetExportOwnSheetNotice({ ownSheetSigned: ownSheet.signed && ownSheetChange?.waitingFor !== 'person', ownSheetExported: ownSheet.exported })
    : null

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
  const payUnknownFor = (member: User): boolean => payStatusFor(member) !== 'ready'

  /**
   * Rulebook 1.43.0 (review r318): one sheet of an export, prepared without writing anything — re-read fresh (the
   * stamp and the invoice are built from this copy); a sheet already exported is left exactly as it is; a fresh copy
   * the person has not signed is left out; the snapshot is built (rebuilt if frozen empty,
   * `timesheetSnapshotNeedsRebuild`) BEFORE `exportedAt` is set, because an exported snapshot is never rebuilt.
   */
  type PreparedSheet = { draft: TimesheetDraft; documentId: string | null; member: User; period: PayRun }
  const prepareExport = async (row: TimesheetQueueRow, exportedAt: Date): Promise<PreparedSheet | { skip: 'exported' } | null> => {
    if (!organization?.id || !user) return null
    const { member, period } = row
    const periodStart = period.start
    const periodEnd = period.end
    // 17 Nov follow-up: re-read exactly the document the row listed (its own pay run and stored id — a sheet filed under
    // a former invite id or a second users document included); the person's own id only when the row has none.
    const ownerIds = timesheetMemberIds(member, users)
    const listedId = timesheetSourceDocumentId(row.draft)
    const full =
      (listedId ? await loadTimesheetDraftAt(organization.id, listedId, timeZone, ownerIds) : null) ??
      (await loadTimesheetDraft(organization.id, member.id, periodStart, timeZone, periodEnd, ownerIds))
    if (full.exportedAt) return { skip: 'exported' }
    if (!full.operativeSignedAt) return null
    // Second review #325: never export when the booking change cannot be read (bookings or pay inputs not loaded —
    // `periodBookingChanges` is then null, which must not count as "unchanged").
    if (!payInputsRef.current.ready || !changeCatalogueRef.current.liveLoaded) {
      // Third review #325: never silently — the summary names who was left out and why.
      inputsSkippedRef.current.push(displayName(member))
      return null
    }
    // Rulebook 1.47.0 §8 (`signedTimesheetActions`): never export a sheet whose bookings changed since it was signed —
    // its snapshot is stale until the person signs again and the line manager counter-signs again.
    // 1.54.0: nor one whose late extras (added after sign-off) wait for the line manager.
    const change = periodBookingChanges(changeCatalogueRef.current, member, full, { start: periodStart, end: periodEnd })
    if (!signedTimesheetActions(change).mayExport) {
      ;(change?.bookingsChanged === false ? lateSkippedRef : changedSkippedRef).current.push(displayName(member))
      return null
    }
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
    return { draft: { ...built, exportedAt }, documentId: timesheetSourceDocumentId(full) ?? listedId, member, period }
  }

  const stampExport = async (sheet: PreparedSheet): Promise<boolean> => {
    if (!organization?.id) return false
    // Rulebook 1.54.0 (third review of #337): only the export fields, in a transaction that re-reads the sheet — a late
    // extra added, edited or deleted since it was prepared is never written back over, and such a sheet is not stamped.
    const result = await stampTimesheetExport({
      organizationId: organization.id,
      userId: sheet.member.id,
      // 17 Nov follow-up: the row's own pay run and stored document, never the screen's current run.
      weekStart: sheet.period.start,
      draft: sheet.draft,
      timeZone,
      documentId: sheet.documentId,
    })
    if (result === 'stamped') return true
    if (result === 'late-extras-waiting') lateSkippedRef.current.push(displayName(sheet.member))
    return false
  }

  /**
   * One exported sheet's PDF, from its saved snapshot (`weeklyReportOverride`) — the same builder for Export and for
   * the Exported tab's Download (rulebook 1.43.0, review r318: an undelivered sheet is always recoverable; nothing is
   * re-stamped or re-priced).
   */
  const buildExportPdf = async (
    member: User,
    agreed: TimesheetDraft,
    start: Date,
    end: Date,
    extraNotes: string[] = [],
    /** Rulebook 1.55.0: the version's stored document id (its REV number, invoice number and difference). */
    documentId?: string | null
  ) => {
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
      timesheetDays: timesheetDayKeysForPeriod(member, start, end, timeZone),
    })
    const includeTaxIds = exportIncludesSensitiveFields({
      requested: exportTaxIds,
      canView: Boolean(
        user &&
          canViewSensitiveProfile({
            viewerRole: staffAccountRole(user),
            viewerUserId: user.id,
            subjectUserId: member.id,
          })
      ),
    })
    const taxIds = includeTaxIds ? await loadTaxIds(member.id, member).catch(() => null) : null
    const pdf = buildTimesheetInvoicePdf({
      organizationName: organization?.name || 'Organisation',
      subject: subjectForUser(member, operatives),
      weekStart: start,
      weekEnd: end,
      amount: invoiceLinesTotal(lines),
      vatNumber: taxIds?.vatNumber || undefined,
      utrNumber: taxIds?.utrNumber || undefined,
      timeZone,
      lines,
      notes: [...signatureNotes(agreed, timeZone), ...extraNotes],
      documentTitle: 'Timesheet',
      periodMetaLabel: 'PAYMENT RUN',
      totalLabel: 'Total timesheet amount',
      emptyStateMessage: 'No work entries were found for this timesheet period.',
      currencyCode: currency,
      // Rulebook 1.55.0: "TS-…-REV1" and "REV 1 · +£44.12 from the previous version".
      ...(() => {
        const chain = timesheetVersionChain(agreed).length > 0 ? timesheetVersionChain(agreed) : timesheetVersionChainFor(documentId)
        // Review of #344: the invoice number comes from the stored sheet of this version, never the current users id.
        const copy = timesheetRevisionCopy({
          documentId:
            documentId ||
            timesheetSourceDocumentId(agreed) ||
            chain.find((version) => version.revision === (agreed.revision ?? 0))?.documentId ||
            timesheetDocId(member.id, start, timeZone),
          chain,
          total: invoiceLinesTotal(lines),
          currency,
        })
        return { invoiceNumber: copy.invoiceNumber, revisionNote: copy.note }
      })(),
    })
    return { pdf, fileName: timesheetExportFileName(displayName(member), paymentRunDateStamp(start, end, timeZone)) }
  }

  /** Exported tab → Download PDF: rebuilds the PDF from the stored, exported sheet (never re-stamps it). */
  const downloadExportedPdf = async (row: ExportedTimesheetHistoryRow, period: { start: Date; end: Date }) => {
    if (!organization?.id) return
    if (!payInputs.ready) {
      setExportMessage(payInputs.message)
      return
    }
    // Re-review #342 item 1: a PDF is never rebuilt from a record whose pay is not known (it would be the stripped one).
    // Review of #368 (S4): a sheet whose person is nobody in the organisation has no pay record to read; its PDF is
    // drawn only from the stored signed snapshot (below), which needs no pay read.
    const unresolved = isUnresolvedTimesheetPerson(row.user)
    const refusal = unresolved ? null : exportedPdfPayRefusal(payStatusFor(row.user), displayName(row.user))
    if (refusal) {
      setExportMessage(refusal)
      return
    }
    try {
      // 17 Nov follow-up: the stored document the row came from (a sheet under a former id or an unknown person too).
      const full =
        (row.documentId ? await loadTimesheetDraftAt(organization.id, row.documentId, timeZone, timesheetMemberIds(row.user, users)) : null) ??
        (await loadTimesheetDraft(organization.id, row.user.id, period.start, timeZone, period.end))
      // Rulebook 1.55.0: an earlier version (or a later open revision) is built from the listed copy of this version.
      const sheet = full.exportedAt && (full.revision ?? 0) === (row.draft.revision ?? 0) ? full : row.draft
      // Review r318: a sheet exported before signed copies were kept has no snapshot — its PDF is rebuilt from today's
      // bookings, rates and working hours, so say so before downloading and on the PDF.
      const rebuilt = exportedPdfIsRebuilt(sheet)
      if (rebuilt && unresolved) {
        setExportMessage(UNRESOLVED_PDF_NO_SNAPSHOT_MESSAGE)
        return
      }
      if (rebuilt && typeof window !== 'undefined' && !window.confirm(EXPORT_REBUILT_CONFIRM)) return
      const extraNotes = rebuilt ? [exportRebuiltPdfNote(formatStampInZone(new Date(), timeZone))] : []
      const { pdf, fileName } = await buildExportPdf(row.user, sheet, period.start, period.end, extraNotes, sheet === full ? null : row.documentId)
      // Download PDF saves the file (no share sheet): the PDF is built after an await, so a share sheet could not open.
      downloadPdf(pdf, fileName)
    } catch (error) {
      setExportMessage(`Couldn't build the PDF for ${displayName(row.user)}${error instanceof Error ? ` (${error.message})` : ''}.`)
    }
  }

  const exportSigned = async () => {
    if (!organization?.id || !user || visible.length === 0) return
    // Never export or freeze `weeklyReportOverride` from default settings / an empty pay history.
    if (!payInputs.ready) {
      setExportMessage(payInputs.message)
      return
    }
    // Rulebook 1.54.1 (§16): the export email goes to the signed-in sign-in (Firebase Auth) address — the one the
    // route sends to — never the profile copy, which can differ while an email change waits for verification.
    const recipientEmail = (auth?.currentUser?.email || user.email)?.trim()
    setExporting(true)
    setExportMessage(null)
    // 17 Nov follow-up: the export can hold several pay runs; the email names each one (the route caps the text).
    const exportRuns = Array.from(new Map(visible.map((row) => [payRunKey(row.period, timeZone), row.period])).values())
    const stamp = exportRuns.map((run) => paymentRunDateStamp(run.start, run.end, timeZone)).join(', ')
    const periodLine = exportRuns.map((run) => formatPaymentPeriodLine(run.start, run.end, timeZone)).join('; ')
    const downloadLinks: Array<{ fileName: string; url: string }> = []
    const pdfAttachments: Array<{ fileName: string; content: string }> = []
    const backupSkipped: string[] = []
    const notSent: string[] = []
    let emailProblem: string | null = null
    let stampedCount = 0
    const exportedAt = new Date()
    const runKey = `${exportedAt.getTime()}|${exportRuns.map((run) => payRunKey(run, timeZone)).join(',')}`
    const emptyProblemOf = () => emailProblem
    changedSkippedRef.current = []
    lateSkippedRef.current = []
    inputsSkippedRef.current = []
    // Review #342 item 1: a person whose pay could not be read is never exported on a stripped record; named below.
    const payUnknownSkipped = visible
      .filter((row) => payStatusFor(row.member) === 'failed')
      .map((row) => displayName(row.member))
    // Re-review #342 item 5: pay still loading — skipped as "still loading" (export again), never exported stripped.
    for (const row of visible) {
      if (payStatusFor(row.member) === 'loading') inputsSkippedRef.current.push(displayName(row.member))
    }
    const reasonOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'unknown error')
    // 17 Nov (owner: "Sending timesheets…" stayed on long after the export was done): the button finishes as soon as
    // the sheets are stamped exported; the PDFs, backups and the email go on in the background, each PDF built and
    // backed up at the same time, and the message says what is still being sent, then what was sent.
    const summaryNow = (run: { stamped: Array<{ name: string }>; skipped: string[]; stopped: { reason: string; error?: unknown } | null }, sending: boolean) =>
      [
        sending
          ? `${run.stamped.length} exported. Sending the PDF${run.stamped.length === 1 ? '' : 's'}${recipientEmail ? ` to ${recipientEmail}` : ''}…`
          : exportSummaryMessage({
              stamped: run.stamped.map((row) => row.name),
              notSent,
              emailProblem,
              recipientEmail: recipientEmail || null,
              sentCount: pdfAttachments.length,
              backupSkipped,
              skipped: run.skipped,
              stampError: run.stopped?.reason === 'stamp' ? reasonOf(run.stopped.error) : null,
            }),
        sending && run.skipped.length > 0 ? `Already exported, left as it was: ${run.skipped.join(', ')}.` : '',
        changedSkippedRef.current.length > 0 ? `${SIGNED_TIMESHEET_EXPORT_SKIPPED_MESSAGE} (${changedSkippedRef.current.join(', ')})` : '',
        lateSkippedRef.current.length > 0 ? `${TIMESHEET_LATE_EXTRAS_EXPORT_SKIPPED_MESSAGE} (${lateSkippedRef.current.join(', ')})` : '',
        inputsSkippedRef.current.length > 0 ? `${EXPORT_INPUTS_LOADING_SKIPPED_MESSAGE} (${inputsSkippedRef.current.join(', ')})` : '',
        payUnknownSkipped.length > 0 ? `${EXPORT_PAY_UNKNOWN_SKIPPED_MESSAGE} (${payUnknownSkipped.join(', ')})` : '',
      ]
        .filter(Boolean)
        .join(' ')
    try {
      const run = await runTimesheetExport({
        members: visible.filter((row) => !payUnknownFor(row.member)),
        memberId: (row) => row.key,
        memberName: (row) => (exportRuns.length > 1 ? `${displayName(row.member)} (${formatPaymentPeriodLine(row.period.start, row.period.end, timeZone)})` : displayName(row.member)),
        // Rulebook 1.43.0 (review r318): every person is prepared (and the gate checked) before anyone is stamped.
        gateReady: () => payInputsRef.current.ready,
        prepare: (row) => prepareExport(row, exportedAt),
        stamp: (row) => stampExport(row.sheet),
        forgetHistory: forgetExportedTimesheetHistory,
        deliverInBackground: true,
        // Every sheet that was stamped gets its PDF, backup and email — also when a later stamp failed. Each person is
        // delivered on their own: one failure never skips the people after them.
        deliver: async (rows) => {
          stampedCount = rows.length
          // Review of #363: at most EXPORT_DELIVERY_CONCURRENCY PDFs built and backed up at once; every list below
          // follows the order of the people exported, never the order the uploads finished.
          const built = await mapWithConcurrency(rows, EXPORT_DELIVERY_CONCURRENCY, async (row) => {
            try {
              const { pdf, fileName } = await buildExportPdf(row.sheet.member, row.sheet.draft, row.sheet.period.start, row.sheet.period.end, [], row.sheet.documentId)
              let link: { fileName: string; url: string } | null = null
              try {
                const url = await uploadFile(timesheetExportPath(organization.id, fileName), timesheetPdfBlob(pdf), 'application/pdf')
                link = { fileName, url }
              } catch {
                link = null
              }
              return { name: row.name, link, attachment: { fileName, content: pdfBytesToBase64(pdf) }, error: null as string | null }
            } catch (error) {
              return { name: row.name, link: null, attachment: null, error: reasonOf(error) }
            }
          })
          for (const result of built) {
            if (result.error != null) notSent.push(`${result.name} (${result.error})`)
            else if (!result.link) backupSkipped.push(result.name)
            if (result.link) downloadLinks.push(result.link)
            if (result.attachment) pdfAttachments.push(result.attachment)
          }
          if (!recipientEmail) {
            emailProblem = 'no email address on your account'
            return
          }
          if (pdfAttachments.length === 0) return
          // Review of #368: the email names only the pay runs whose sheets were actually exported.
          const sentRuns = Array.from(
            new Map(rows.map((row) => [payRunKey(row.sheet.period, timeZone), row.sheet.period])).values()
          ).sort((a, b) => a.start.getTime() - b.start.getTime())
          const sentStamp = sentRuns.map((run) => paymentRunDateStamp(run.start, run.end, timeZone)).join(', ')
          const sentPeriodLine = sentRuns.map((run) => formatPaymentPeriodLine(run.start, run.end, timeZone)).join('; ')
          try {
            const response = await fetch('/api/timesheets/export-email', {
              method: 'POST',
              headers: await jsonAuthHeaders(),
              body: JSON.stringify({
                organizationId: organization.id,
                recipientEmail,
                recipientName: `${user.firstName} ${user.surname}`.trim() || user.email,
                organizationName: organization.name || 'Organisation',
                weekTitle: sentPeriodLine || periodLine,
                paymentRunStamp: sentStamp || stamp,
                timesheetCount: pdfAttachments.length,
                attachmentNames: pdfAttachments.map((attachment) => attachment.fileName),
                downloadLinks,
                pdfAttachments,
              }),
            })
            if (!response.ok) {
              const payload = (await response.json().catch(() => ({}))) as { error?: string }
              emailProblem = payload.error || 'email delivery failed'
            }
          } catch (error) {
            emailProblem = reasonOf(error)
          }
        },
      })
      if (run.stopped?.reason === 'gate') {
        setExportMessage(EXPORT_STOPPED_MESSAGE)
        return
      }
      setExportMessage(summaryNow(run, Boolean(run.delivery)))
      if (run.delivery) {
        // Review of #363: the result is kept per organisation (survives navigation and a reload) and Export stays off
        // until this delivery finishes; the browser asks before the tab is closed while it is sending.
        const deliveries = useExportDeliveryStore.getState()
        const orgId = organization.id
        const shared = deliveries.start(orgId, runKey, summaryNow(run, true))
        void run.delivery
          .then(() => {
            // Another tab owned the shared notice when this run started: its result is shown in this tab only.
            if (!shared) setExportMessage(summaryNow(run, false))
            const failed = notSent.length > 0 || Boolean(emptyProblemOf())
            useExportDeliveryStore.getState().finish(orgId, runKey, failed ? 'failed' : 'done', summaryNow(run, false))
          })
          .catch((error: unknown) => {
            const failure = `${run.stamped.length} exported. Something went wrong while sending (${reasonOf(error)}). ${EXPORT_RECOVER_HINT}`
            if (!shared) setExportMessage(failure)
            useExportDeliveryStore.getState().finish(orgId, runKey, 'failed', failure)
          })
      }
      if (run.stamped.length > 0) router.replace(timesheetsTeamHref({ tab: 'exported' }))
    } catch (error) {
      // After anything was stamped the summary above is the answer; only a failure before any stamp is "Export failed".
      if (stampedCount > 0) {
        setExportMessage(`${stampedCount} exported. Something went wrong afterwards (${reasonOf(error)}). ${EXPORT_RECOVER_HINT}`)
        router.replace(timesheetsTeamHref({ tab: 'exported' }))
      } else {
        setExportMessage(error instanceof Error ? error.message : 'Export failed.')
      }
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
      <>
      {deliveryNotice ? (
        <Note tone={deliveryEntry?.status === 'done' ? 'info' : deliveryEntry?.status === 'failed' || !deliveryPending ? 'amber' : 'info'} role="status">
          {deliveryNotice}{' '}
          {!deliveryPending && organization?.id ? (
            <button type="button" className="pu-link" onClick={() => dismissDelivery(organization.id)}>
              Dismiss
            </button>
          ) : null}
        </Note>
      ) : null}
      {exportMessage && exportMessage !== deliveryNotice ? <Note tone="info" role="status">{exportMessage}</Note> : null}
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
        onDownload={(row, period) => void downloadExportedPdf(row, period)}
        payStatusOf={payStatusFor}
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
      </>
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
        </EmptyState>
      </Card>
    )
  }

  return (
    <>
      <Card>
      <MemberTable viewer={user} payRun>
        {visible.map((row) => {
          const { member, draft, period } = row
          const summary = summaryFor(member, draft, period.start, period.end)
          return (
            <MemberRow
              key={row.key}
              payRunLine={formatPaymentPeriodLine(period.start, period.end, timeZone)}
              member={member}
              users={users}
              viewer={user}
              pill={teamTab === 'signed' ? 'Signed off' : 'Pending'}
              pillHue={teamTab === 'signed' ? 'green' : 'warn'}
              revisionLabel={timesheetRevisionLabel(draft?.revision ?? 0)}
              summary={summary}
              payStatus={payStatusFor(member)}
              onClick={() =>
                router.push(
                  timesheetsTeamHref({
                    tab: teamTab,
                    user: member.id,
                    period: periodStartKey(period.start, timeZone),
                    periodEnd: dayKey(period.end, timeZone),
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
          <PuButton variant="primary" block disabled={exporting || deliveryPending || !payInputs.ready} onClick={() => void exportSigned()}>
            {exporting ? 'Exporting timesheets…' : deliveryPending ? 'Sending the last export…' : `Email and export ${visible.length} timesheet${visible.length === 1 ? '' : 's'}`}
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
function MemberTable({ viewer, exported, payRun, children }: { viewer: User | null; exported?: boolean; payRun?: boolean; children: ReactNode }) {
  const columns: DataColumn[] = [
    { key: 'person', label: 'Person' },
    // 17 Nov follow-up: Awaiting / Signed off list several pay runs; each row shows its own.
    ...(payRun && !exported ? [{ key: 'run', label: 'Pay run' }] : []),
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
  onDownload,
  revisionLabel = '',
  payStatus = 'ready',
  payRunLine,
  unresolved = false,
}: {
  /** 17 Nov follow-up: the row's own pay run (Awaiting / Signed off). */
  payRunLine?: string
  /** 17 Nov follow-up: an exported sheet whose person is nobody in the organisation — no profile to open. */
  unresolved?: boolean
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
  onDownload?: () => void
  /** Rulebook 1.55.0: "REV N" beside the status of a revision. */
  revisionLabel?: string
  /** Review #342 items 1, 5 and 7: this person's pay — not `ready`: no figures; `failed`: a red chip too. */
  payStatus?: PayProfilesStatus
}) {
  const currency = useOrganizationCurrency()
  const payUnknown = payStatus !== 'ready'
  const role = unresolved ? '—' : member.permissions?.operativeMode ? 'Operative' : hasAdminAccess(member) ? 'Admin' : 'Manager'
  const lineManager = (() => {
    if (!hasAdminAccess(viewer)) return null
    if (unresolved) return '—'
    const managerId = member.assignedManagerUserIds?.[0] || member.assignedManagerUserId
    if (!managerId) return 'Unassigned'
    const manager = users.find((row) => row.id === managerId)
    return manager ? displayName(manager) : 'Unknown'
  })()
  const name = displayName(member)
  const exportedColumns = periodLine !== undefined
  return (
    <tr className={unresolved ? undefined : 'click'} onClick={unresolved ? undefined : onClick}>
      <td>
        <span className="pu-who">
          <IconTile tone={unresolved ? 'amber' : role === 'Operative' ? 'green' : role === 'Admin' ? 'purple' : 'blue'} size="sm" round>
            {unresolved ? '?' : initials(name)}
          </IconTile>
          <span>
            {unresolved ? (
              <>
                <b>{name}</b> <Chip tone="amber">{UNKNOWN_TIMESHEET_PERSON_CHIP}</Chip>
              </>
            ) : (
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
            )}
          </span>
        </span>
      </td>
      {payRunLine !== undefined && !exportedColumns ? (
        <td style={{ color: 'var(--pu-blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>{payRunLine}</td>
      ) : null}
      {exportedColumns ? (
        <>
          <td style={{ color: 'var(--pu-blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>{periodLine}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{exportedAt && timeZone ? formatStampInZone(exportedAt, timeZone) : ''}</td>
        </>
      ) : null}
      <td className="num">{payUnknown ? '—' : formatQueueHours(summary.hours)}</td>
      <td className="num">{payUnknown ? '—' : formatQueueHours(summary.overtimeHours)}</td>
      <td className="num">{payUnknown ? '—' : formatMoney(summary.priceWork, currency)}</td>
      <td className="num">{payUnknown ? '—' : formatMoney(summary.expenses, currency)}</td>
      <td>{role}</td>
      {lineManager != null ? <td>{lineManager}</td> : null}
      <td>
        <Chip tone={pillHue === 'warn' ? 'amber' : pillHue === 'green' ? 'green' : 'slate'}>{pill}</Chip>
        {revisionLabel ? (
          <span style={{ marginLeft: 8 }}>
            <Chip tone="slate">{revisionLabel}</Chip>
          </span>
        ) : null}
        {payStatus === 'failed' ? (
          <span style={{ marginLeft: 8 }}>
            <Chip tone="red">{PAY_DETAILS_NOT_LOADED_LABEL}</Chip>
          </span>
        ) : null}
        {onDownload ? (
          <button
            type="button"
            className="pu-rowbtn"
            style={{ marginLeft: 8, fontWeight: 600, textDecoration: 'underline' }}
            onClick={(event) => {
              event.stopPropagation()
              onDownload()
            }}
          >
            Download PDF
          </button>
        ) : null}
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
  onDownload,
  payStatusOf,
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
  /** Rebuild and download the PDF of an exported sheet from its stored snapshot (rulebook 1.43.0, review r318). */
  onDownload?: (row: ExportedTimesheetHistoryRow, period: { start: Date; end: Date }) => void
  /** Re-review #342 item 1: a person whose pay is not known shows no figures (Download PDF refuses too). */
  payStatusOf?: (member: User) => PayProfilesStatus
}) {
  const observed = rows.map((row) => exportedRowPeriod(row, invoicing, timeZone))
  // Owner item 6 (17 Nov follow-up): the picker starts at the organisation's creation day (else the earliest exported
  // sheet); every run with an exported sheet is still listed.
  // The stored `createdAt` of the live organisation document (the session copy reads a missing one as "now").
  const createdAt = organizationCreatedAt(useOrganizationDocument().data)
  const fromDayKey = payRunListStartDayKey({
    createdAt,
    storedDayKeys: observed.map((period) => dayKey(period.start, timeZone)),
    timeZone,
  })
  const runs = listSelectablePayPeriods(invoicing, new Date(), 120, timeZone, observed, fromDayKey)
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
            const main = (
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
                onDownload={onDownload ? () => onDownload(row, period) : undefined}
                revisionLabel={timesheetRevisionLabel(row.draft.revision ?? 0)}
                payStatus={payStatusOf ? payStatusOf(row.user) : 'ready'}
                unresolved={isUnresolvedTimesheetPerson(row.user)}
              />
            )
            const earlier = row.earlierVersions ?? []
            if (earlier.length === 0) return main
            // Rulebook 1.55.0 §8: the earlier exported versions of this pay run, read only, under the latest.
            return (
              <Fragment key={row.id}>
                {main}
                <tr>
                  <td colSpan={12} className="pu-sub">
                    {TIMESHEET_EARLIER_VERSIONS_LABEL}:{' '}
                    {earlier.map((version, index) => (
                      <span key={version.documentId}>
                        {index > 0 ? ' · ' : ''}
                        {timesheetRevisionLabel(version.revision) || TIMESHEET_ORIGINAL_VERSION_LABEL}
                        {onDownload ? (
                          <button
                            type="button"
                            className="pu-rowbtn"
                            style={{ marginLeft: 6, textDecoration: 'underline' }}
                            onClick={() => onDownload({ ...row, draft: version.draft, documentId: version.documentId, earlierVersions: [] }, period)}
                          >
                            Download PDF
                          </button>
                        ) : null}
                      </span>
                    ))}
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </MemberTable>
      )}
    </Card>
  )
}
