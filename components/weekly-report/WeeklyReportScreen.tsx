'use client'

import { useMemo, useState } from 'react'
import type { OrganizationDetails, OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { formatInvoicingSubtitle } from '@/lib/settings/organizationSettings'
import { canOpenWeeklyReport, organizationTimeZone, PAYRUN_SNAPSHOT_LABEL, type AcceptedClashRecord } from '@/lib/canonical'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { PayrunSnapshot } from '@/components/weekly-report/PayrunSnapshot'
import { addLondonDays, dateFromDayKey, dayKey, startOfLondonWeek } from '@/lib/ios-parity/londonTime'
import { useAuthStore } from '@/lib/stores/authStore'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { hasAdminAccess } from '@/lib/permissions'
import { loadAcceptedBookingClashes, unapproveBookingClash, unapproveBookingClashPairs } from '@/lib/warnings/acceptedClashStorage'
import { loadWarningResolutionKeys, loadWarningResolutions } from '@/lib/warnings/warningResolutionStorage'
import { loadClashUndoDocs } from '@/lib/warnings/clashUndoDocs'
import {
  formatInvoicingPeriodDescription,
  formatReportPeriodLabel,
  listInvoicingPeriodOptions,
  resolveReportPeriod,
  type WeeklyReportPeriodMode,
} from '@/lib/weekly-report/invoicingPeriodUtils'
import { invoicingQuickSelectLabel } from '@/lib/weekly-report/invoicingRead'
import { buildWeeklyReportData } from '@/lib/weekly-report/weeklyReportData'
import { PAY_PROFILES_FAILED_MESSAGE, retryPayProfiles, usePayProfilesStatus, usePayStatusOf } from '@/lib/pay/usePayProfilesStatus'
import { reportGatePeople, reportPayGate } from '@/lib/pay/reportPayGate'
import { useOrgBankHolidays } from '@/components/annual-leave/useOrgBankHolidays'
import type {
  SubcontractorBookingRow,
  WeeklyReportApprovedClashRow,
  WeeklyReportWarningDecisions,
} from '@/lib/weekly-report/weeklyReportData'
import {
  APPROVED_CLASH_HEADERS,
  buildWeeklyReportHtml,
  downloadWeeklyReportWorkbook,
  printWeeklyReport,
} from '@/lib/weekly-report/weeklyReportGenerator'
import { WEEKLY_REPORT_SECTION_ICONS, weeklyReportSections } from '@/lib/weekly-report/weeklyReportSections'
import type { WeeklyReportPaySheet } from '@/lib/canonical'
import { loadWeeklyReportTimesheetFeed } from '@/lib/weekly-report/loadTimesheetFeed'
import type { ApprovedTimesheetWeek } from '@/lib/weekly-report/timesheetFeed'
import { emptyDayRateHistory, loadOperativeDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import type { Booking, HolidayBooking, Operative, Project, Subcontractor, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { bookingCoverageCoversDay } from '@/lib/timesheets/timesheetBookingChanges'


// The PDF builders (pdf-lib) load only when a PDF is made.
const buildWeeklyReportPdf: typeof import('@/lib/weekly-report/weeklyReportPdf').buildWeeklyReportPdf = (...args) => import('@/lib/weekly-report/weeklyReportPdf').then((module) => module.buildWeeklyReportPdf(...args))

function ReportTable({
  title,
  headers,
  rows,
  empty,
  tones = [],
  note,
}: {
  title: string
  headers: string[]
  rows: string[][]
  empty: string
  /** 1.51.0: `warn` (amber check line), `good`, `total`. */
  tones?: ReadonlyArray<string | null>
  note?: string
}) {
  return (
    <section className="card overflow-hidden">
      <div className="card-h">
        <h2 className="h2">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="card-b muted small">{empty}</p>
      ) : (
        <div className="tablewrap card-b">
          <table className="t">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  style={
                    tones[index] === 'warn'
                      ? { background: 'var(--amber-bg, #fef3c7)', color: 'var(--amber-ink, #92400e)', fontWeight: 600 }
                      : tones[index] === 'total'
                        ? { fontWeight: 700 }
                        : undefined
                  }
                >
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {note ? <p className="card-b muted small">{note}</p> : null}
    </section>
  )
}

/** Monday (organisation zone) of the week containing `date`. Weeks start on Monday. */
function mondayOf(date: Date, timeZone: string): Date {
  return startOfLondonWeek(date, timeZone)
}

/** `d MMM` or `d MMM yyyy` in the organisation zone, never the browser zone. */
function formatOrgDay(date: Date, timeZone: string, withYear = false): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(date)
}

export function WeeklyReportScreen({
  organizationId,
  organizationName,
  companyLogoURL,
  bookings,
  managerSiteBookings,
  subcontractorBookings,
  subcontractors,
  operatives,
  users,
  userIdAliases,
  projects,
  smallWorks,
  holidays,
  orgDetails,
  loading,
  invoicingReadFinished = true,
  fallbackInvoicing = null,
}: {
  organizationId?: string
  organizationName: string
  companyLogoURL?: string
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  subcontractorBookings: SubcontractorBookingRow[]
  subcontractors: Subcontractor[]
  operatives: Operative[]
  users: User[]
  /** Same-email profile id → kept id, from the roster (as Daily Overview passes it). */
  userIdAliases?: Record<string, string>
  projects: Project[]
  smallWorks: Project[]
  holidays: HolidayBooking[]
  orgDetails: OrganizationDetails | null
  loading?: boolean
  /** False while the organisation invoicing read has not finished and nothing remembered is available. */
  invoicingReadFinished?: boolean
  fallbackInvoicing?: OrgInvoicingSettings | null
}) {
  // Rulebook 1.47.0 (review #325 items 3, 6): what the booking listeners hold, so a signed sheet is read as changed only
  // when its whole pay run is loaded.
  const bookingCoverage = useBookingStore((state) => state.coverage)
  const managerCoverage = useManagerScheduleStore((state) => state.coverage)
  const invoicing = orgDetails?.invoicing ?? fallbackInvoicing
  const timeZone = organizationTimeZone(orgDetails?.countryCode)
  const viewer = useAuthStore((state) => state.user)
  const canUnapprove = Boolean(viewer && hasAdminAccess(viewer))
  // Rulebook 1.33.0 §7: Payrun Snapshot, admins only (the Weekly report's own gate).
  const canOpenSnapshot = Boolean(viewer && canOpenWeeklyReport(viewer))
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const { data: organizationDocument } = useOrganizationDocument()
  const invoicingOptions = useMemo(
    () => (invoicing ? listInvoicingPeriodOptions(invoicing, new Date(), undefined, timeZone) : []),
    [invoicing, timeZone]
  )
  const invoicingQuick = invoicingQuickSelectLabel({
    invoicing,
    periodLabel: invoicingOptions[0]
      ? formatReportPeriodLabel(invoicingOptions[0].start, invoicingOptions[0].end, timeZone)
      : null,
    readFinished: invoicingReadFinished,
  })

  const thisWeekStart = mondayOf(new Date(), timeZone)
  const lastWeekStart = addLondonDays(thisWeekStart, -7, timeZone)
  const defaultWeekStart = dayKey(thisWeekStart, timeZone)
  const defaultCustomStart = invoicingOptions[0]
    ? dayKey(invoicingOptions[0].start, timeZone)
    : defaultWeekStart
  const defaultCustomEnd = invoicingOptions[0]
    ? dayKey(invoicingOptions[0].end, timeZone)
    : dayKey(addLondonDays(thisWeekStart, 6, timeZone), timeZone)

  const [periodMode, setPeriodMode] = useState<WeeklyReportPeriodMode>('week')
  const [invoicingPeriodId, setInvoicingPeriodId] = useState<string>('')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [customStart, setCustomStart] = useState(defaultCustomStart)
  const [customEnd, setCustomEnd] = useState(defaultCustomEnd)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [timesheetWeeks, setTimesheetWeeks] = useState<ApprovedTimesheetWeek[]>([])
  // Rulebook 1.51.0 (Q2): each self-employed person's payment runs in the range, for the invoice check line.
  const [timesheetSheets, setTimesheetSheets] = useState<WeeklyReportPaySheet[]>([])
  const [rateHistory, setRateHistory] = useState<OperativeDayRateHistoryCollection>(emptyDayRateHistory())
  // Clash approvals from both collections, read on Generate. Reports are built live and never stored.
  const [warningDecisions, setWarningDecisions] = useState<WeeklyReportWarningDecisions | null>(null)
  const [unapprovingKey, setUnapprovingKey] = useState<string | null>(null)
  const [unapproveError, setUnapproveError] = useState('')
  // The workbook and PDF libraries load on demand; a failed load (e.g. offline) is shown, never silent.
  const [downloadError, setDownloadError] = useState('')

  const effectiveInvoicingPeriodId = invoicingPeriodId || invoicingOptions[0]?.id || ''

  const period = useMemo(
    () =>
      resolveReportPeriod({
        mode: periodMode,
        invoicing: invoicing ?? undefined,
        invoicingPeriodId: effectiveInvoicingPeriodId,
        weekStart,
        customStart,
        customEnd,
        timeZone,
      }),
    [periodMode, invoicing, effectiveInvoicingPeriodId, weekStart, customStart, customEnd, timeZone]
  )

  // Rulebook 1.53.0 (B7): the region's bank holidays in the range; the report waits for them (as My Profile does), so
  // a bank holiday inside a week of leave is never counted as a leave day.
  const bankFallback = useMemo(() => new Date(), [])
  const bankRangeStart = period?.start ?? bankFallback
  const bankRangeEnd = period?.end ?? bankRangeStart
  const bank = useOrgBankHolidays(bankRangeStart, bankRangeEnd)
  const bankHolidayDayKeys = useMemo(() => bank.holidays.map((holiday) => holiday.date), [bank.holidays])
  // Pay strip: pay and employment types are read from the pay profiles while `privatePay` is on; the report waits for
  // the pay laid over the roster (`payProfilesStatusFor`), never pricing a stripped users document.
  // Final check #342 item 3: built only when every person in it has known pay — refused, naming who is still loading or
  // could not be read (`reportPayGate`), never priced from a stripped record.
  const payStatusOrg = usePayProfilesStatus(organizationId)
  const payStatusOf = usePayStatusOf(organizationId)
  // Review #342: the report is worked out once the organisation's pay status is ready, then only the people it actually
  // prices (`pricedUserIds`: its bookings, approved weeks and timesheets in the range) are waited for. Someone with no
  // bookings in the range (offline, added since the last read) never blocks it.
  const orgPayReady = payStatusOrg === 'ready'
  const candidateReport = useMemo(() => {
    if (!period || !bank.loaded || !orgPayReady) return null
    return buildWeeklyReportData({
      bankHolidayDayKeys,
      organizationName,
      companyLogoURL,
      period,
      bookings,
      managerSiteBookings,
      subcontractorBookings,
      subcontractors,
      operatives,
      users,
      projects,
      smallWorks,
      holidays,
      orgDetails,
      timesheetWeeks,
      history: rateHistory,
      userIdAliases,
      warningDecisions,
      timesheetSheets,
      // Rulebook 1.32.0 §7 / §8: rates and pay only for viewers `canViewPersonPay` allows (inside `weeklyReportPayRows`);
      // the screen and every export use this one report, and the grand total covers visible rows only.
      viewer: viewer ? ({ ...viewer, isPlatformOwner: isPlatformOwnerEmail(viewer.email) } as never) : null,
    })
  }, [
    orgPayReady,
    bank.loaded,
    bankHolidayDayKeys,
    timesheetSheets,
    viewer,
    period,
    organizationName,
    companyLogoURL,
    bookings,
    managerSiteBookings,
    subcontractorBookings,
    subcontractors,
    operatives,
    users,
    userIdAliases,
    projects,
    smallWorks,
    holidays,
    orgDetails,
    timesheetWeeks,
    rateHistory,
    warningDecisions,
  ])
  // 16 Nov scan (rulebook §8, `catalogueOperativePaySubjects`): the catalogue operatives it prices are waited for too.
  const pricedPeople = useMemo(
    () => [
      ...reportGatePeople(users, candidateReport?.pricedUserIds ?? []).map((person) => ({
        id: person.id,
        formerUserIds: person.formerUserIds,
        name: `${person.firstName ?? ''} ${person.surname ?? ''}`.trim() || person.email || person.id,
      })),
      ...reportGatePeople(operatives, candidateReport?.pricedCatalogueOperativeIds ?? []).map((row) => ({
        id: row.id,
        catalogueOperative: true,
        name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || row.email || row.id,
      })),
    ],
    [candidateReport, users, operatives]
  )
  const payGate = reportPayGate({
    organizationStatus: payStatusOrg,
    people: pricedPeople,
    statusOf: payStatusOf,
    nameOf: (person) => person.name,
  })
  const payStatus = payGate.status
  const payReady = payStatus === 'ready'
  const builtReport = payReady ? candidateReport : null
  const report = builtReport

  const loadWarningDecisions = async (): Promise<WeeklyReportWarningDecisions | null> => {
    if (!organizationId) return null
    const [keys, acceptedClashes] = await Promise.all([
      loadWarningResolutionKeys(organizationId).catch(() => ({ resolvedKeys: [] as string[], approvedKeys: [] as string[] })),
      loadAcceptedBookingClashes(organizationId).catch(() => [] as AcceptedClashRecord[]),
    ])
    return { resolvedKeys: keys.resolvedKeys, approvedKeys: keys.approvedKeys, acceptedClashes }
  }

  const handleUnapprove = async (row: WeeklyReportApprovedClashRow) => {
    if (!organizationId) return
    setUnapproveError('')
    setUnapprovingKey(row.resolutionKey)
    try {
      // Rulebook 1.53.0 (review of #331): the approval documents as stored, so undo also removes the other app's
      // copies (matched ignoring case and order, `clashDocumentsToRemove`).
      // A failed load stops the undo with an error and deletes nothing (`loadClashUndoDocs`).
      const docs = await loadClashUndoDocs({
        acceptedClashes: () => loadAcceptedBookingClashes(organizationId),
        resolutions: () => loadWarningResolutions(organizationId),
      })
      if (row.pairs && row.pairs.length > 0) {
        // Operative cluster: remove every pair's approval (`operativeClashGroups`).
        await unapproveBookingClashPairs(organizationId, row.pairs, docs)
      } else {
        await unapproveBookingClash(
          organizationId,
          { bookingAId: row.bookingAId, bookingBId: row.bookingBId, resolutionKey: row.resolutionKey },
          docs
        )
      }
      setWarningDecisions(await loadWarningDecisions())
    } catch (error) {
      setUnapproveError(error instanceof Error ? error.message : 'Could not remove this approval.')
    } finally {
      setUnapprovingKey(null)
    }
  }

  const handleGenerateReport = async () => {
    if (!period) return
    setGenerating(true)
    try {
      setWarningDecisions(await loadWarningDecisions())
      if (organizationId && invoicing) {
        const history = await loadOperativeDayRateHistory(organizationId).catch(() => emptyDayRateHistory())
        setRateHistory(history)
        const load = await loadWeeklyReportTimesheetFeed({
          organizationId,
          users,
          operatives,
          rangeStart: period.start,
          rangeEnd: period.end,
          invoicing,
          bookings,
          managerSiteBookings,
          projects,
          smallWorks,
          history: history || undefined,
          payrollPolicy: orgDetails?.payrollTimePolicy,
          payrollPolicyPrior: orgDetails?.payrollTimePolicyPrior,
          payrollPolicyEffectiveFrom: orgDetails?.payrollTimePolicyEffectiveFrom,
          payrollPolicyState: orgDetails?.payrollTimePolicyState ?? null,
          scheduleOptions: orgDetails?.myScheduleOptions,
          timeZone,
          // Rulebook 1.47.0 (review #325 item 6): a signed sheet is read as changed only when its pay run is loaded.
          bookingsCoverFrom: (startDayKey) =>
            bookingCoverageCoversDay(bookingCoverage, organizationId, startDayKey) &&
            bookingCoverageCoversDay(managerCoverage, organizationId, startDayKey),
        })
        setTimesheetWeeks(load.weeks)
        setTimesheetSheets(load.sheets)
      } else {
        setTimesheetWeeks([])
        setTimesheetSheets([])
      }
      setGenerated(true)
      setDownloadOpen(true)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!report || !period) return
    const filename = `WeeklyReport-${dayKey(period.start, timeZone).replace(/-/g, '')}.xlsx`
    setDownloadError('')
    void downloadWeeklyReportWorkbook(report, filename).catch(() =>
      setDownloadError('The Excel file could not be made. Check your connection and try again.')
    )
  }

  const handleDownloadPdf = async () => {
    if (!report || !period) return
    setDownloadError('')
    try {
      const bytes = await buildWeeklyReportPdf(report)
      const { downloadWeeklyReportPdf } = await import('@/lib/weekly-report/weeklyReportPdf')
      downloadWeeklyReportPdf(bytes, `WeeklyReport-${dayKey(period.start, timeZone).replace(/-/g, '')}.pdf`)
    } catch {
      setDownloadError('The PDF could not be made. Check your connection and try again.')
    }
  }

  const changePeriod = (next: () => void) => {
    setGenerated(false)
    setTimesheetWeeks([])
    next()
  }

  const shiftWeek = (direction: -1 | 1) => {
    changePeriod(() => {
      const next = addLondonDays(dateFromDayKey(weekStart, timeZone), direction * 7, timeZone)
      setWeekStart(dayKey(mondayOf(next, timeZone), timeZone))
      setPeriodMode('week')
    })
  }

  const thisWeekKey = dayKey(thisWeekStart, timeZone)
  const lastWeekKey = dayKey(lastWeekStart, timeZone)
  const thisWeekRange = `${formatOrgDay(thisWeekStart, timeZone)} – ${formatOrgDay(addLondonDays(thisWeekStart, 6, timeZone), timeZone, true)}`
  const lastWeekRange = `${formatOrgDay(lastWeekStart, timeZone)} – ${formatOrgDay(addLondonDays(lastWeekStart, 6, timeZone), timeZone, true)}`
  const thisWeekSelected = periodMode === 'week' && weekStart === thisWeekKey
  const lastWeekSelected = periodMode === 'week' && weekStart === lastWeekKey

  return (
    <div className="stack" data-hue="rep">
      <div className="phead" data-hue="rep">
        <div>
          <h1>Weekly Report</h1>
          <div className="sub">Updates as you change the period. Separate from live warnings.</div>
          {downloadError ? (
            <p role="alert" className="small" style={{ color: 'var(--red, #b91c1c)', marginTop: 6 }}>
              {downloadError}
            </p>
          ) : null}
        </div>
        <div className="acts">
          {canOpenSnapshot && organizationId ? (
            <button type="button" className={snapshotOpen ? 'btn primary' : 'btn'} onClick={() => setSnapshotOpen((open) => !open)}>
              {PAYRUN_SNAPSHOT_LABEL}
            </button>
          ) : null}
          {generated && report ? (
            <>
              <button type="button" className="btn" onClick={() => printWeeklyReport(buildWeeklyReportHtml(report))}>
                Print
              </button>
              <button type="button" className="btn primary" onClick={handleDownload}>
                Download weekly report
              </button>
            </>
          ) : null}
        </div>
      </div>

      {snapshotOpen && canOpenSnapshot && organizationId ? (
        <PayrunSnapshot
          organizationId={organizationId}
          organization={organizationDocument}
          users={users}
          timeZone={timeZone}
          bookings={bookings}
          managerSiteBookings={managerSiteBookings}
          projects={projects}
          smallWorks={smallWorks}
          operatives={operatives}
          // Rulebook 1.47.0 (review #325 item 3): Timesheet cells follow a sheet reopened by a booking change.
          changeInputs={{
            payrollPolicy: orgDetails?.payrollTimePolicy ?? null,
            payrollPolicyState: orgDetails?.payrollTimePolicyState ?? null,
            scheduleOptions: orgDetails?.myScheduleOptions ?? null,
            history: rateHistory ?? null,
            coversFrom: (startDayKey) =>
              bookingCoverageCoversDay(bookingCoverage, organizationId, startDayKey) &&
              bookingCoverageCoversDay(managerCoverage, organizationId, startDayKey),
          }}
        />
      ) : null}

      <section className="hero" data-hue="rep">
        <div className="relative z-1">
          <p className="eb">{organizationName}</p>
          <div className="big">{period ? formatReportPeriodLabel(period.start, period.end, timeZone) : 'Choose a period'}</div>
          <p className="mt-1.5 opacity-85">Weekly report</p>
        </div>
      </section>

      <div className="space-y-5">
          {loading ? (
            <p className="text-[12px] text-(--ink3)">Refreshing bookings from Firebase… the picker is ready.</p>
          ) : null}

          <section className="card overflow-hidden">
            <p className="bg-(--bg) px-4 py-2 text-[11px] font-medium uppercase tracking-[0.4px] text-(--ink3)">
              Quick Select
            </p>
            <QuickRow
              label="This Week"
              subLabel={thisWeekRange}
              selected={thisWeekSelected}
              onClick={() =>
                changePeriod(() => {
                  setPeriodMode('week')
                  setWeekStart(thisWeekKey)
                })
              }
            />
            <QuickRow
              label="Last Week"
              subLabel={lastWeekRange}
              selected={lastWeekSelected}
              onClick={() =>
                changePeriod(() => {
                  setPeriodMode('week')
                  setWeekStart(lastWeekKey)
                })
              }
            />
            <QuickRow
              label="Current invoicing period"
              subLabel={invoicingQuick.label}
              selected={periodMode === 'invoicing'}
              disabled={!invoicingQuick.enabled}
              onClick={() =>
                changePeriod(() => {
                  setPeriodMode('invoicing')
                  if (invoicingOptions[0]) setInvoicingPeriodId(invoicingOptions[0].id)
                })
              }
            />
            <QuickRow
              label="Custom range"
              subLabel={
                periodMode === 'custom' && period
                  ? formatReportPeriodLabel(period.start, period.end, timeZone)
                  : 'Choose a start and end date'
              }
              selected={periodMode === 'custom'}
              onClick={() => changePeriod(() => setPeriodMode('custom'))}
            />
          </section>

          {periodMode === 'invoicing' && invoicing ? (
            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-(--ink3)">Invoicing Period</p>
              <select
                value={effectiveInvoicingPeriodId}
                onChange={(e) =>
                  changePeriod(() => {
                    setInvoicingPeriodId(e.target.value)
                    setPeriodMode('invoicing')
                  })
                }
                className="w-full rounded-lg border border-(--line2) bg-white px-3 py-2 text-sm text-(--ink)"
              >
                {invoicingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.isCurrent ? 'Current · ' : ''}
                    {formatReportPeriodLabel(option.start, option.end, timeZone)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-(--ink3)">
                {formatInvoicingSubtitle(invoicing)} · {formatInvoicingPeriodDescription(invoicing)} · last two years
              </p>
            </section>
          ) : null}

          {periodMode === 'week' ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => shiftWeek(-1)} className="rounded-lg border border-(--line2) bg-white px-3 py-2 text-sm font-semibold">
                Previous week
              </button>
              <input
                type="date"
                value={weekStart}
                onChange={(e) =>
                  changePeriod(() => {
                    setWeekStart(e.target.value)
                    setPeriodMode('week')
                  })
                }
                className="rounded-lg border border-(--line2) px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => shiftWeek(1)} className="rounded-lg border border-(--line2) bg-white px-3 py-2 text-sm font-semibold">
                Next week
              </button>
            </div>
          ) : null}

          {periodMode === 'custom' ? (
            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-(--ink3)">Custom range</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[13px] font-medium">
                  Start
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) =>
                      changePeriod(() => {
                        setCustomStart(e.target.value)
                        setPeriodMode('custom')
                      })
                    }
                    className="mt-1 block rounded-lg border border-(--line2) px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-[13px] font-medium">
                  End
                  <input
                    type="date"
                    min={customStart}
                    value={customEnd}
                    onChange={(e) =>
                      changePeriod(() => {
                        setCustomEnd(e.target.value)
                        setPeriodMode('custom')
                      })
                    }
                    className="mt-1 block rounded-lg border border-(--line2) px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </section>
          ) : null}

          <p className="text-center text-[12px] leading-5 text-(--ink3)">
            Choose a period, then generate to preview and download. This is separate from Home Warnings (live ops from
            today forward).
          </p>

          <section className="card pad" data-hue="rep" style={{ textAlign: 'center' }}>
            <h2 className="h2">Ready to generate</h2>
            {period ? (
              <p className="muted small" style={{ marginTop: 6 }}>
                {formatOrgDay(period.start, timeZone, true)} → {formatOrgDay(period.end, timeZone, true)}
              </p>
            ) : null}
            <p className="muted small" style={{ marginTop: 8 }}>
              Creates a weekly report in the same Excel layout as iOS, with warnings, each project, named sub
              contractors, leave, manager schedule and pay. Preview it here, then download.
            </p>
            <button
              type="button"
              disabled={!report || generating}
              onClick={handleGenerateReport}
              className="btn primary block"
              style={{ marginTop: 16 }}
            >
              {generating ? 'Generating report…' : 'Generate Report'}
            </button>
            {period && payStatus === 'loading' ? (
              <p className="muted small" style={{ marginTop: 8 }}>
                {payGate.message ?? 'Loading…'}{' '}
                {payGate.message ? (
                  <button type="button" className="btn" onClick={() => retryPayProfiles(organizationId, 'ready')}>
                    Retry
                  </button>
                ) : null}
              </p>
            ) : null}
            {period && payStatus === 'failed' ? (
              <p className="small" style={{ marginTop: 8, color: 'var(--red)' }}>
                {payGate.message ?? PAY_PROFILES_FAILED_MESSAGE}{' '}
                <button type="button" className="btn" onClick={() => retryPayProfiles(organizationId, 'ready')}>
                  Retry
                </button>
              </p>
            ) : null}
          </section>

      {downloadOpen && report && period ? (
        <div
          className="fixed inset-0 z-80 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setDownloadOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-(--card) p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-download-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="report-download-title" className="text-lg font-bold text-(--ink)">
              Download report
            </h2>
            <p className="mt-1 text-sm text-(--ink3)">
              {formatOrgDay(period.start, timeZone, true)} → {formatOrgDay(period.end, timeZone, true)}. The preview stays on this page.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  void handleDownloadPdf().finally(() => setDownloadOpen(false))
                }}
              >
                PDF
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  handleDownload()
                  setDownloadOpen(false)
                }}
              >
                Excel
              </button>
              <button type="button" className="btn ghost" onClick={() => setDownloadOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {generated && report ? (
        <>
          {/* Rulebook 1.51.0 (Q4f): the same sections and rows as the PDF, HTML and Excel exports. */}
          {weeklyReportSections(report).map((section, index) =>
            section.key === 'approvedClashes' ? (
              <div key={`${section.key}-${index}`}>
          <section className="card overflow-hidden">
            <div className="card-h">
              <h2 className="h2">✅ Approved clashes</h2>
            </div>
            {unapproveError ? <p className="card-b small" style={{ color: 'var(--red, #b91c1c)' }}>{unapproveError}</p> : null}
            {report.approvedClashes.length === 0 ? (
              <p className="card-b muted small">No clashes approved in this period</p>
            ) : (
              <div className="tablewrap card-b">
                <table className="t">
                  <thead>
                    <tr>
                      {APPROVED_CLASH_HEADERS.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                      {canUnapprove ? <th aria-label="Actions" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {report.approvedClashes.map((row) => (
                      <tr key={`${row.resolutionKey}|${row.bookingAId}|${row.bookingBId}`}>
                        <td>{row.date}</td>
                        <td>{row.priority}</td>
                        <td>{row.type}</td>
                        <td>{row.person}</td>
                        <td>{row.detail}</td>
                        {canUnapprove ? (
                          <td>
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={unapprovingKey === row.resolutionKey}
                              onClick={() => void handleUnapprove(row)}
                            >
                              {unapprovingKey === row.resolutionKey ? 'Removing…' : 'Remove approval'}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
              </div>
            ) : (
              <ReportTable
                key={`${section.key}-${index}`}
                title={`${WEEKLY_REPORT_SECTION_ICONS[section.key]} ${section.title}`}
                headers={section.headers}
                rows={section.rows}
                empty={section.empty}
                tones={section.tones}
                note={section.note}
              />
            )
          )}
        </>
      ) : (
          <div className="empty card pad">
            <h3>Generate to preview</h3>
            <p>
              The breakdown appears here after you generate: warnings summary, each project, sub contractors, annual
              leave and manager schedule.
            </p>
          </div>
      )}
    </div>
    </div>
  )
}

function QuickRow({
  label,
  subLabel,
  selected,
  disabled,
  onClick,
}: {
  label: string
  subLabel: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 border-t border-(--line) px-4 py-3 text-left disabled:opacity-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#E8F1FB] text-(--blue)">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v10.5A1.5 1.5 0 0 1 19.5 20.25h-15A1.5 1.5 0 0 1 3 18.75V8.25A1.5 1.5 0 0 1 4.5 6.75Z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-[12px] text-(--ink3)">{subLabel}</span>
      </span>
      <span className={`grid h-[22px] w-[22px] place-items-center rounded-full ${selected ? 'bg-(--blue)' : 'bg-[#D6E3F0]'}`}>
        {selected ? (
          <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        ) : null}
      </span>
    </button>
  )
}
