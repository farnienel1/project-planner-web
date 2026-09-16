'use client'

import { useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import type { OrganizationDetails } from '@/lib/settings/organizationSettings'
import { formatInvoicingSubtitle } from '@/lib/settings/organizationSettings'
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
  downloadWeeklyReport,
  printWeeklyReport,
} from '@/lib/weekly-report/weeklyReportGenerator'
import { formatCurrency, formatDays } from '@/lib/weekly-report/weeklyReportPayroll'
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
    <section className="overflow-hidden rounded-2xl border border-ios-border bg-ios-card">
      <div className="border-b border-ios-border bg-[#F7F8FA] px-4 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.3px] text-ios-ink">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-white text-left uppercase tracking-wide text-slate-500">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-slate-700">
                      {cell}
                    </td>
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
  const invoicingOptions = useMemo(
    () => (invoicing ? listInvoicingPeriodOptions(invoicing) : []),
    [invoicing]
  )

  const thisWeekStart = mondayOf(new Date())
  const lastWeekStart = mondayOf(addDays(new Date(), -7))
  const defaultWeekStart = format(thisWeekStart, 'yyyy-MM-dd')
  const defaultCustomStart = invoicingOptions[0]
    ? format(invoicingOptions[0].start, 'yyyy-MM-dd')
    : defaultWeekStart
  const defaultCustomEnd = invoicingOptions[0]
    ? format(invoicingOptions[0].end, 'yyyy-MM-dd')
    : format(addDays(thisWeekStart, 6), 'yyyy-MM-dd')

  const [periodMode, setPeriodMode] = useState<WeeklyReportPeriodMode>('week')
  const [invoicingPeriodId, setInvoicingPeriodId] = useState<string>('')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [customStart, setCustomStart] = useState(defaultCustomStart)
  const [customEnd, setCustomEnd] = useState(defaultCustomEnd)
  const [generating, setGenerating] = useState(false)
  const [showReport, setShowReport] = useState(false)

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
      }),
    [periodMode, invoicing, effectiveInvoicingPeriodId, weekStart, customStart, customEnd]
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
  ])

  const handleGenerateReport = () => {
    if (!report || !period) return
    setGenerating(true)
    setShowReport(true)
    try {
      const html = buildWeeklyReportHtml(report)
      const filename = `WeeklyReport-${format(period.start, 'yyyyMMdd')}.html`
      printWeeklyReport(html)
      downloadWeeklyReport(html, filename)
    } finally {
      setGenerating(false)
    }
  }

  const changePeriod = (next: () => void) => {
    next()
    setShowReport(false)
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
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-ios-border bg-ios-card">
        <div className="border-b border-ios-border bg-gradient-to-br from-[#0B1220] to-[#185FA5] px-5 py-5 text-white">
          <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-white/80">Project Planner</p>
          <p className="text-[22px] font-semibold tracking-tight">{organizationName}</p>
          <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-white/85">Weekly Report</p>
          {period ? (
            <p className="mt-2 text-[13px] text-white/85">
              Period: {formatReportPeriodLabel(period.start, period.end)}
            </p>
          ) : null}
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? (
            <p className="text-[12px] text-ios-muted">Refreshing bookings from Firebase… the picker is ready.</p>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-ios-border">
            <p className="bg-[#F7F8FA] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">
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
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Invoicing Period</p>
              <select
                value={effectiveInvoicingPeriodId}
                onChange={(e) =>
                  changePeriod(() => {
                    setInvoicingPeriodId(e.target.value)
                    setPeriodMode('invoicing')
                  })
                }
                className="w-full rounded-lg border border-ios-search-border bg-white px-3 py-2 text-sm text-ios-ink"
              >
                {invoicingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.isCurrent ? 'Current · ' : ''}
                    {formatReportPeriodLabel(option.start, option.end)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ios-muted">
                {formatInvoicingSubtitle(invoicing)} · {formatInvoicingPeriodDescription(invoicing)}
              </p>
            </section>
          ) : null}

          {periodMode === 'week' ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => shiftWeek(-1)} className="rounded-lg border border-ios-search-border bg-white px-3 py-2 text-sm font-semibold">
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
                className="rounded-lg border border-ios-search-border px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => shiftWeek(1)} className="rounded-lg border border-ios-search-border bg-white px-3 py-2 text-sm font-semibold">
                Next week
              </button>
            </div>
          ) : null}

          <section>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Custom Range</p>
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
                  className="mt-1 block rounded-lg border border-ios-search-border px-3 py-2 text-sm"
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
                  className="mt-1 block rounded-lg border border-ios-search-border px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>

          <p className="text-center text-[12px] leading-5 text-ios-muted">
            Period warnings and pay breakdown are calculated when you tap Generate — this is separate from Home
            Warnings (live ops from today forward).
          </p>

          <div className="space-y-3 text-center">
            {period ? (
              <p className="inline-flex items-center rounded-full border border-[#D6E3F0] bg-white px-3.5 py-1.5 text-[12px] font-medium text-ios-muted">
                {format(period.start, 'd MMM yyyy')} → {format(period.end, 'd MMM yyyy')}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!report || generating}
              onClick={handleGenerateReport}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] px-4 py-4 text-[16px] font-semibold text-white shadow-[0_5px_10px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? 'Generating Report…' : 'Generate Report'}
            </button>
            <p className="text-[11px] text-ios-muted">Generates a printable HTML report ready to share.</p>
          </div>
        </div>
      </div>

      {showReport && report ? (
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

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm">
            All Project Work: {formatDays(report.allProjectWorkTotal)}
          </div>

          <ReportTable
            title="🔧 Sub Contractors"
            headers={['Project', 'Job No.', 'Sub Contractor', 'Type', 'Time', 'Days']}
            rows={
              report.subContractorRows.length === 0
                ? [['—', '—', '—', '—', '—', '—']]
                : report.subContractorRows.map((row) => [
                    row.projectName,
                    row.jobNumber,
                    row.subContractor,
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
      ) : null}
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
      className="flex w-full items-center gap-3 border-t border-ios-border px-4 py-3 text-left disabled:opacity-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#E8F1FB] text-[#185FA5]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v10.5A1.5 1.5 0 0 1 19.5 20.25h-15A1.5 1.5 0 0 1 3 18.75V8.25A1.5 1.5 0 0 1 4.5 6.75Z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-[12px] text-ios-muted">{subLabel}</span>
      </span>
      <span className={`grid h-[22px] w-[22px] place-items-center rounded-full ${selected ? 'bg-[#185FA5]' : 'bg-[#D6E3F0]'}`}>
        {selected ? (
          <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        ) : null}
      </span>
    </button>
  )
}
