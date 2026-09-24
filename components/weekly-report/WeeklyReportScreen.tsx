'use client'

import { useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import type { OrganizationDetails } from '@/lib/settings/organizationSettings'
import { formatInvoicingSubtitle } from '@/lib/settings/organizationSettings'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'
import { dayKey } from '@/lib/ios-parity/londonTime'
import {
  formatInvoicingPeriodDescription,
  formatReportPeriodLabel,
  listInvoicingPeriodOptions,
  resolveReportPeriod,
  type WeeklyReportPeriodMode,
} from '@/lib/weekly-report/invoicingPeriodUtils'
import { buildWeeklyReportData } from '@/lib/weekly-report/weeklyReportData'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
import {
  buildWeeklyReportHtml,
  buildWeeklyReportSpreadsheetXml,
  downloadWeeklyReportWorkbook,
  printWeeklyReport,
} from '@/lib/weekly-report/weeklyReportGenerator'
import { formatCurrency, formatDays } from '@/lib/weekly-report/weeklyReportPayroll'
import { loadWeeklyReportTimesheetFeed } from '@/lib/weekly-report/loadTimesheetFeed'
import type { ApprovedTimesheetWeek } from '@/lib/weekly-report/timesheetFeed'
import { loadOperativeDayRateHistory } from '@/lib/timesheets/dayRateHistoryStorage'
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

function mondayOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
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
  projects,
  smallWorks,
  holidays,
  orgDetails,
  loading,
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
  projects: Project[]
  smallWorks: Project[]
  holidays: HolidayBooking[]
  orgDetails: OrganizationDetails | null
  loading?: boolean
}) {
  const invoicing = orgDetails?.invoicing
  const timeZone = ianaTimeZoneForCountry(orgDetails?.countryCode)
  const invoicingOptions = useMemo(
    () => (invoicing ? listInvoicingPeriodOptions(invoicing, new Date(), 6, timeZone) : []),
    [invoicing, timeZone]
  )

  const thisWeekStart = mondayOf(new Date())
  const lastWeekStart = mondayOf(addDays(new Date(), -7))
  const defaultWeekStart = format(thisWeekStart, 'yyyy-MM-dd')
  const defaultCustomStart = invoicingOptions[0]
    ? dayKey(invoicingOptions[0].start, timeZone)
    : defaultWeekStart
  const defaultCustomEnd = invoicingOptions[0]
    ? dayKey(invoicingOptions[0].end, timeZone)
    : format(addDays(thisWeekStart, 6), 'yyyy-MM-dd')

  const [periodMode, setPeriodMode] = useState<WeeklyReportPeriodMode>('week')
  const [invoicingPeriodId, setInvoicingPeriodId] = useState<string>('')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [customStart, setCustomStart] = useState(defaultCustomStart)
  const [customEnd, setCustomEnd] = useState(defaultCustomEnd)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [timesheetWeeks, setTimesheetWeeks] = useState<ApprovedTimesheetWeek[]>([])

  const effectiveInvoicingPeriodId = invoicingPeriodId || invoicingOptions[0]?.id || ''

  const period = useMemo(
    () =>
      resolveReportPeriod({
        mode: periodMode,
        invoicing,
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
    projects,
    smallWorks,
    holidays,
    orgDetails,
    timesheetWeeks,
  ])

  const handleGenerateReport = async () => {
    if (!period) return
    setGenerating(true)
    try {
      if (organizationId && invoicing) {
        const history = await loadOperativeDayRateHistory(organizationId).catch(() => null)
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
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!report || !period) return
    const xml = buildWeeklyReportSpreadsheetXml(report)
    const filename = `WeeklyReport-${format(period.start, 'yyyyMMdd')}.xls`
    downloadWeeklyReportWorkbook(xml, filename)
  }

  const changePeriod = (next: () => void) => {
    setGenerated(false)
    setTimesheetWeeks([])
    next()
  }

  const shiftWeek = (direction: -1 | 1) => {
    changePeriod(() => {
      const next = addDays(new Date(weekStart), direction * 7)
      setWeekStart(format(mondayOf(next), 'yyyy-MM-dd'))
      setPeriodMode('week')
    })
  }

  const thisWeekRange = `${format(thisWeekStart, 'd MMM')} – ${format(addDays(thisWeekStart, 6), 'd MMM yyyy')}`
  const lastWeekRange = `${format(lastWeekStart, 'd MMM')} – ${format(addDays(lastWeekStart, 6), 'd MMM yyyy')}`
  const thisWeekSelected = periodMode === 'week' && weekStart === format(thisWeekStart, 'yyyy-MM-dd')
  const lastWeekSelected = periodMode === 'week' && weekStart === format(lastWeekStart, 'yyyy-MM-dd')

  return (
    <div className="stack" data-hue="rep">
      <div className="phead" data-hue="rep">
        <div>
          <h1>Weekly report</h1>
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
          <div className="big">{period ? formatReportPeriodLabel(period.start, period.end) : 'Choose a period'}</div>
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
                  setWeekStart(format(thisWeekStart, 'yyyy-MM-dd'))
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
                  setWeekStart(format(lastWeekStart, 'yyyy-MM-dd'))
                })
              }
            />
            <QuickRow
              label="Current invoicing period"
              subLabel={
                invoicing && invoicingOptions[0]
                  ? formatReportPeriodLabel(invoicingOptions[0].start, invoicingOptions[0].end)
                  : 'Set invoicing dates in Organisation settings'
              }
              selected={periodMode === 'invoicing'}
              disabled={!invoicing}
              onClick={() =>
                changePeriod(() => {
                  setPeriodMode('invoicing')
                  if (invoicingOptions[0]) setInvoicingPeriodId(invoicingOptions[0].id)
                })
              }
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
                    {formatReportPeriodLabel(option.start, option.end)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[var(--ink3)]">
                {formatInvoicingSubtitle(invoicing)} · {formatInvoicingPeriodDescription(invoicing)}
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

          <section>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink3)]">Custom Range</p>
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

          <p className="text-center text-[12px] leading-5 text-[var(--ink3)]">
            Choose a period, then generate to preview and download. This is separate from Home Warnings (live ops from
            today forward).
          </p>

          <section className="card pad" data-hue="rep" style={{ textAlign: 'center' }}>
            <h2 className="h2">Ready to generate</h2>
            {period ? (
              <p className="muted small" style={{ marginTop: 6 }}>
                {format(period.start, 'd MMM yyyy')} → {format(period.end, 'd MMM yyyy')}
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
              {generating ? 'Generating report…' : 'Generate report'}
            </button>
          </section>

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
                      formatCurrency(row.amount),
                    ]),
                    ['', '', '', '', 'Price Work Total', formatCurrency(report.priceWorkTotal)],
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
                      formatCurrency(row.amount),
                    ]),
                    ['', '', '', '', 'Expenses Total', formatCurrency(report.expenseTotal)],
                  ]
            }
            empty="No expenses in this period"
          />

          <ReportTable
            title="💷 Pay Summary"
            headers={['Person', 'Role', 'Rate Type', 'Days', 'Rate', 'Pay']}
            rows={[
              ...report.paySummary.flatMap((person) => [
                ...person.lines.map((line) => [
                  person.person,
                  person.role,
                  line.rateType,
                  formatDays(line.days),
                  formatCurrency(line.rate),
                  formatCurrency(line.pay),
                ]),
                ['', '', `${person.person} total`, '', '', formatCurrency(person.personTotal)],
              ]),
              ['', '', '', '', 'Grand Total', formatCurrency(report.grandTotal)],
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
