'use client'

import { useMemo, useState } from 'react'
import type { OrganizationDetails, OrgInvoicingSettings } from '@/lib/settings/organizationSettings'
import { formatInvoicingSubtitle } from '@/lib/settings/organizationSettings'
import { formatMoney, organizationTimeZone, type AcceptedClashRecord } from '@/lib/canonical'
import { addLondonDays, dateFromDayKey, dayKey, startOfLondonWeek } from '@/lib/ios-parity/londonTime'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess } from '@/lib/permissions'
import { loadAcceptedBookingClashes, unapproveBookingClash } from '@/lib/warnings/acceptedClashStorage'
import { loadResolvedWarningKeys } from '@/lib/warnings/warningResolutionStorage'
import {
  formatInvoicingPeriodDescription,
  formatReportPeriodLabel,
  listInvoicingPeriodOptions,
  resolveReportPeriod,
  type WeeklyReportPeriodMode,
} from '@/lib/weekly-report/invoicingPeriodUtils'
import { invoicingQuickSelectLabel } from '@/lib/weekly-report/invoicingRead'
import { buildWeeklyReportData } from '@/lib/weekly-report/weeklyReportData'
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
import { buildWeeklyReportPdf, downloadWeeklyReportPdf } from '@/lib/weekly-report/weeklyReportPdf'
import { formatDays } from '@/lib/weekly-report/weeklyReportPayroll'
import { loadWeeklyReportTimesheetFeed } from '@/lib/weekly-report/loadTimesheetFeed'
import type { ApprovedTimesheetWeek } from '@/lib/weekly-report/timesheetFeed'
import { emptyDayRateHistory, loadOperativeDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import type { Booking, HolidayBooking, Operative, Project, Subcontractor, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'

function ReportTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string
  headers: string[]
  rows: string[][]
  empty: string
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
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const invoicing = orgDetails?.invoicing ?? fallbackInvoicing
  const timeZone = organizationTimeZone(orgDetails?.countryCode)
  const viewer = useAuthStore((state) => state.user)
  const canUnapprove = Boolean(viewer && hasAdminAccess(viewer))
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
  const [rateHistory, setRateHistory] = useState<OperativeDayRateHistoryCollection>(emptyDayRateHistory())
  // Clash approvals from both collections, read on Generate. Reports are built live and never stored.
  const [warningDecisions, setWarningDecisions] = useState<WeeklyReportWarningDecisions | null>(null)
  const [unapprovingKey, setUnapprovingKey] = useState<string | null>(null)
  const [unapproveError, setUnapproveError] = useState('')

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

  const report = useMemo(() => {
    if (!period) return null
    return buildWeeklyReportData({
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
    })
  }, [
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

  const loadWarningDecisions = async (): Promise<WeeklyReportWarningDecisions | null> => {
    if (!organizationId) return null
    const [resolvedKeys, acceptedClashes] = await Promise.all([
      loadResolvedWarningKeys(organizationId).catch(() => [] as string[]),
      loadAcceptedBookingClashes(organizationId).catch(() => [] as AcceptedClashRecord[]),
    ])
    return { resolvedKeys, acceptedClashes }
  }

  const handleUnapprove = async (row: WeeklyReportApprovedClashRow) => {
    if (!organizationId) return
    setUnapproveError('')
    setUnapprovingKey(row.resolutionKey)
    try {
      await unapproveBookingClash(organizationId, {
        bookingAId: row.bookingAId,
        bookingBId: row.bookingBId,
        resolutionKey: row.resolutionKey,
      })
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
        const weeks = await loadWeeklyReportTimesheetFeed({
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
          scheduleOptions: orgDetails?.myScheduleOptions,
          timeZone,
        })
        setTimesheetWeeks(weeks)
      } else {
        setTimesheetWeeks([])
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
    downloadWeeklyReportWorkbook(report, filename)
  }

  const handleDownloadPdf = async () => {
    if (!report || !period) return
    const bytes = await buildWeeklyReportPdf(report)
    downloadWeeklyReportPdf(bytes, `WeeklyReport-${dayKey(period.start, timeZone).replace(/-/g, '')}.pdf`)
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
  const money = (amount: number) => formatMoney(amount, report?.currencyCode)

  return (
    <div className="stack" data-hue="rep">
      <div className="phead" data-hue="rep">
        <div>
          <h1>Weekly Report</h1>
          <div className="sub">Updates as you change the period. Separate from live warnings.</div>
        </div>
        <div className="acts">
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

      <section className="hero" data-hue="rep">
        <div className="relative z-[1]">
          <p className="eb">{organizationName}</p>
          <div className="big">{period ? formatReportPeriodLabel(period.start, period.end, timeZone) : 'Choose a period'}</div>
          <p className="mt-1.5 opacity-85">Weekly report</p>
        </div>
      </section>

      <div className="space-y-5">
          {loading ? (
            <p className="text-[12px] text-[var(--ink3)]">Refreshing bookings from Firebase… the picker is ready.</p>
          ) : null}

          <section className="card overflow-hidden">
            <p className="bg-[var(--bg)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">
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
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">Invoicing Period</p>
              <select
                value={effectiveInvoicingPeriodId}
                onChange={(e) =>
                  changePeriod(() => {
                    setInvoicingPeriodId(e.target.value)
                    setPeriodMode('invoicing')
                  })
                }
                className="w-full rounded-lg border border-[var(--line2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              >
                {invoicingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.isCurrent ? 'Current · ' : ''}
                    {formatReportPeriodLabel(option.start, option.end, timeZone)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[var(--ink3)]">
                {formatInvoicingSubtitle(invoicing)} · {formatInvoicingPeriodDescription(invoicing)} · last two years
              </p>
            </section>
          ) : null}

          {periodMode === 'week' ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => shiftWeek(-1)} className="rounded-lg border border-[var(--line2)] bg-white px-3 py-2 text-sm font-semibold">
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
                className="rounded-lg border border-[var(--line2)] px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => shiftWeek(1)} className="rounded-lg border border-[var(--line2)] bg-white px-3 py-2 text-sm font-semibold">
                Next week
              </button>
            </div>
          ) : null}

          {periodMode === 'custom' ? (
            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">Custom range</p>
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
                    className="mt-1 block rounded-lg border border-[var(--line2)] px-3 py-2 text-sm"
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
                    className="mt-1 block rounded-lg border border-[var(--line2)] px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </section>
          ) : null}

          <p className="text-center text-[12px] leading-5 text-[var(--ink3)]">
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
          </section>

      {downloadOpen && report && period ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setDownloadOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-download-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="report-download-title" className="text-lg font-bold text-[var(--ink)]">
              Download report
            </h2>
            <p className="mt-1 text-sm text-[var(--ink3)]">
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
          <ReportTable
            title="⚠ Warnings Summary"
            headers={['Status', 'Priority', 'Type', 'Date', 'Description', 'Detail', 'For']}
            rows={
              report.warnings.length === 0
                ? [['No warnings in period', '', '', '', '', '', '']]
                : report.warnings.map((warning) => [
                    warning.status,
                    warning.priority,
                    warning.type,
                    warning.date,
                    warning.description,
                    warning.detail,
                    warning.forPerson,
                  ])
            }
            empty="No warnings in period"
          />

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

          {report.projectGroups.map((group) => (
            <ReportTable
              key={group.jobNumber}
              title={`🏗 Project Breakdown — ${group.projectName}`}
              headers={['Project', 'Job No.', 'Person', 'Trade', 'Role', 'Days']}
              rows={[
                ...group.rows.map((row) => [
                  group.projectName,
                  group.jobNumber,
                  row.person,
                  row.trade,
                  row.role,
                  formatDays(row.days),
                ]),
                ['', '', '', '', 'Project Total', formatDays(group.projectTotal)],
              ]}
              empty="No project bookings"
            />
          ))}

          <div className="card pad text-center">
            <b>All project work: {formatDays(report.allProjectWorkTotal)}</b>
          </div>

          <ReportTable
            title="🔧 Sub Contractors"
            headers={['Project', 'Job No.', 'Sub Contractor', 'People', 'Type', 'Time', 'Days']}
            rows={
              report.subContractorRows.length === 0
                ? [['—', '—', '—', '—', '—', '—', '—']]
                : report.subContractorRows.map((row) => [
                    row.projectName,
                    row.jobNumber,
                    row.subContractor,
                    row.people || '—',
                    row.type,
                    row.time,
                    formatDays(row.days),
                  ])
            }
            empty="No sub contractor bookings"
          />

          <ReportTable
            title="🌴 Annual Leave"
            headers={['Person', 'Role', 'Days', 'Type']}
            rows={[
              ...report.annualLeaveRows.map((row) => [row.person, row.role, formatDays(row.days), row.type]),
              ...(report.annualLeaveRows.length > 0
                ? [['', '', formatDays(report.annualLeaveTotal), 'Annual Leave Total']]
                : []),
            ]}
            empty="No annual leave in this period"
          />

          <ReportTable
            title="📅 Manager / Admin Additional Schedule"
            headers={['Person', 'Role', 'Location', 'Time', 'Days']}
            rows={[
              ...report.managerScheduleRows.map((row) => [
                row.person,
                row.role,
                row.location,
                row.time,
                formatDays(row.days),
              ]),
              ...(report.managerScheduleRows.length > 0
                ? [['', '', '', 'Total', formatDays(report.managerScheduleTotal)]]
                : []),
            ]}
            empty="No additional manager schedule"
          />

          <ReportTable
            title="🧱 Price Work"
            headers={['Person', 'Title', 'Job No.', 'Date', 'Details', 'Amount']}
            rows={
              report.priceWorkRows.length === 0
                ? []
                : [
                    ...report.priceWorkRows.map((row) => [
                      row.person,
                      row.title,
                      row.jobNumber,
                      row.date,
                      row.details,
                      money(row.amount),
                    ]),
                    ['', '', '', '', 'Price Work Total', money(report.priceWorkTotal)],
                  ]
            }
            empty="No price work in this period"
          />

          <ReportTable
            title="🧾 Expenses"
            headers={['Person', 'Title', 'Job No.', 'Date', 'Details', 'Amount']}
            rows={
              report.expenseRows.length === 0
                ? []
                : [
                    ...report.expenseRows.map((row) => [
                      row.person,
                      row.title,
                      row.jobNumber,
                      row.date,
                      row.details,
                      money(row.amount),
                    ]),
                    ['', '', '', '', 'Expenses Total', money(report.expenseTotal)],
                  ]
            }
            empty="No expenses in this period"
          />

          <ReportTable
            title="💷 Pay Summary"
            headers={['Person', 'Role', 'Rate Type', 'Hours / Days', 'Rate', 'Pay']}
            rows={[
              ...report.paySummary.flatMap((person) => [
                ...person.lines.map((line) => [
                  person.person,
                  person.role,
                  line.rateType,
                  line.quantityText ?? formatDays(line.days),
                  line.rateText ?? money(line.rate),
                  line.payLabel ?? money(line.pay),
                ]),
                ['', '', `${person.person} total`, '', '', person.personTotalLabel ?? money(person.personTotal)],
              ]),
              ['', '', '', '', 'Grand Total', money(report.grandTotal)],
            ]}
            empty="No pay data for this period"
          />
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
      className="flex w-full items-center gap-3 border-t border-[var(--line)] px-4 py-3 text-left disabled:opacity-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#E8F1FB] text-[var(--blue)]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v10.5A1.5 1.5 0 0 1 19.5 20.25h-15A1.5 1.5 0 0 1 3 18.75V8.25A1.5 1.5 0 0 1 4.5 6.75Z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-[12px] text-[var(--ink3)]">{subLabel}</span>
      </span>
      <span className={`grid h-[22px] w-[22px] place-items-center rounded-full ${selected ? 'bg-[var(--blue)]' : 'bg-[#D6E3F0]'}`}>
        {selected ? (
          <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        ) : null}
      </span>
    </button>
  )
}
