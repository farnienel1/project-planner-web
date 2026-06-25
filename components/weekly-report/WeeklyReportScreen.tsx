'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { SetupSegmentedControl } from '@/components/setup/setupFormPrimitives'
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
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

  if (loading) return <LoadingSpinner label="Loading weekly report…" />

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">PROJECTPLANNER</p>
              <p className="text-xl font-semibold text-slate-900">{organizationName}</p>
              <p className="text-sm font-bold tracking-wide text-slate-800">WEEKLY REPORT</p>
              {period && (
                <p className="mt-2 text-sm text-slate-600">
                  Period: {formatReportPeriodLabel(period.start, period.end)}
                </p>
              )}
              {report && (
                <p className="text-sm text-slate-600">Invoicing period: {report.invoicingPeriodLabel}</p>
              )}
            </div>
            <button
              type="button"
              disabled={!report || generating}
              onClick={handleGenerateReport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate report'}
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <SetupSegmentedControl
            value={periodMode}
            onChange={setPeriodMode}
            options={[
              { value: 'invoicing', label: 'Invoicing period' },
              { value: 'week', label: 'Week' },
              { value: 'custom', label: 'Date range' },
            ]}
          />

          {periodMode === 'invoicing' && invoicing && (
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Select invoicing period
              <select
                value={effectiveInvoicingPeriodId}
                onChange={(e) => setInvoicingPeriodId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case text-slate-800"
              >
                {invoicingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.isCurrent ? 'Current · ' : ''}
                    {formatReportPeriodLabel(option.start, option.end)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] normal-case text-slate-500">
                {formatInvoicingSubtitle(invoicing)} · {formatInvoicingPeriodDescription(invoicing)}
              </span>
            </label>
          )}

          {periodMode === 'week' && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => shiftWeek(-1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                Previous week
              </button>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={() => shiftWeek(1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                Next week
              </button>
            </div>
          )}

          {periodMode === 'custom' && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-slate-700">
                From
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                To
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
          )}
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
