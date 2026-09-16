'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
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

  const defaultWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const defaultCustomStart = invoicingOptions[0]
    ? format(invoicingOptions[0].start, 'yyyy-MM-dd')
    : defaultWeekStart
  const defaultCustomEnd = invoicingOptions[0]
    ? format(invoicingOptions[0].end, 'yyyy-MM-dd')
    : format(addDays(new Date(defaultWeekStart), 6), 'yyyy-MM-dd')

  const [periodMode, setPeriodMode] = useState<WeeklyReportPeriodMode>('week')
  const [invoicingPeriodId, setInvoicingPeriodId] = useState<string>('')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [customStart, setCustomStart] = useState(defaultCustomStart)
  const [customEnd, setCustomEnd] = useState(defaultCustomEnd)
  const [generating, setGenerating] = useState(false)

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
    try {
      const html = buildWeeklyReportHtml(report)
      const filename = `WeeklyReport-${format(period.start, 'yyyyMMdd')}.html`
      printWeeklyReport(html)
      downloadWeeklyReport(html, filename)
    } finally {
      setGenerating(false)
    }
  }

  const shiftWeek = (direction: -1 | 1) => {
    const next = addDays(new Date(weekStart), direction * 7)
    setWeekStart(format(startOfWeek(next, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  }

  const selectThisWeek = () => {
    setPeriodMode('week')
    setWeekStart(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  }

  const selectLastWeek = () => {
    setPeriodMode('week')
    setWeekStart(format(startOfWeek(addDays(new Date(), -7), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  }

  const selectCurrentInvoicing = () => {
    setPeriodMode('invoicing')
    if (invoicingOptions[0]) setInvoicingPeriodId(invoicingOptions[0].id)
  }

  if (loading) return <LoadingSpinner label="Opening weekly report…" />

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-ios-border bg-ios-card">
        <div className="border-b border-ios-border bg-gradient-to-br from-[#185FA5] to-[#378ADD] px-5 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.4px] text-white/80">Project Planner</p>
              <p className="text-[22px] font-semibold tracking-tight">{organizationName}</p>
              <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-white/85">Weekly Report</p>
              {period && (
                <p className="mt-2 text-[13px] text-white/85">
                  Period: {formatReportPeriodLabel(period.start, period.end)}
                </p>
              )}
              {report && (
                <p className="text-[12px] text-white/75">Invoicing period: {report.invoicingPeriodLabel}</p>
              )}
            </div>
            <button
              type="button"
              disabled={!report || generating}
              onClick={handleGenerateReport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#185FA5] shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <section>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Quick Select</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectThisWeek}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                  periodMode === 'week' && weekStart === defaultWeekStart
                    ? 'border-transparent bg-ios-chip-green text-ios-icon-green'
                    : 'border-ios-search-border bg-white text-ios-ink'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={selectLastWeek}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                  periodMode === 'week' && weekStart !== defaultWeekStart
                    ? 'border-transparent bg-ios-chip-green text-ios-icon-green'
                    : 'border-ios-search-border bg-white text-ios-ink'
                }`}
              >
                Last Week
              </button>
              <button
                type="button"
                onClick={selectCurrentInvoicing}
                disabled={!invoicing}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-50 ${
                  periodMode === 'invoicing'
                    ? 'border-transparent bg-ios-chip-green text-ios-icon-green'
                    : 'border-ios-search-border bg-white text-ios-ink'
                }`}
              >
                Current invoicing period
              </button>
            </div>
          </section>

          {periodMode === 'invoicing' && invoicing && (
            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Invoicing Period</p>
              <select
                value={effectiveInvoicingPeriodId}
                onChange={(e) => setInvoicingPeriodId(e.target.value)}
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
          )}

          {periodMode === 'week' && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => shiftWeek(-1)} className="rounded-lg border border-ios-search-border bg-white px-3 py-2 text-sm font-semibold">
                Previous week
              </button>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="rounded-lg border border-ios-search-border px-3 py-2 text-sm" />
              <button type="button" onClick={() => shiftWeek(1)} className="rounded-lg border border-ios-search-border bg-white px-3 py-2 text-sm font-semibold">
                Next week
              </button>
            </div>
          )}

          <section>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.4px] text-ios-muted">Custom Range</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[13px] font-medium">
                Start
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value)
                    setPeriodMode('custom')
                  }}
                  className="mt-1 block rounded-lg border border-ios-search-border px-3 py-2 text-sm"
                />
              </label>
              <label className="text-[13px] font-medium">
                End
                <input
                  type="date"
                  min={customStart}
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value)
                    setPeriodMode('custom')
                  }}
                  className="mt-1 block rounded-lg border border-ios-search-border px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>
        </div>
      </div>

      {report && (
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
      )}
    </div>
  )
}
