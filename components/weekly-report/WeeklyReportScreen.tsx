'use client'

import { useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import Link from 'next/link'
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
import {
  buildWeeklyReportHtml,
  downloadWeeklyReport,
  printWeeklyReport,
} from '@/lib/weekly-report/weeklyReportGenerator'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'

function StatCard({
  value,
  label,
  color,
  hint,
}: {
  value: number
  label: string
  color: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-700">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {action}
    </div>
  )
}

export function WeeklyReportScreen({
  organizationName,
  companyLogoURL,
  bookings,
  managerSiteBookings,
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

  const [periodMode, setPeriodMode] = useState<WeeklyReportPeriodMode>('invoicing')
  const [invoicingPeriodId, setInvoicingPeriodId] = useState<string>('')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [customStart, setCustomStart] = useState(defaultCustomStart)
  const [customEnd, setCustomEnd] = useState(defaultCustomEnd)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
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
      const filename = `weekly-report-${format(period.start, 'yyyy-MM-dd')}-to-${format(period.end, 'yyyy-MM-dd')}.html`
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
            <div className="flex items-start gap-4">
              {companyLogoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyLogoURL} alt="" className="h-12 w-auto max-w-[140px] object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white">
                  {organizationName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weekly report</p>
                <p className="text-xl font-semibold text-slate-900">{organizationName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Schedule summary, people, projects, and warnings for your selected period.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!report || generating}
              onClick={handleGenerateReport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
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

          {periodMode === 'invoicing' && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {invoicing ? (
                <>
                  <p className="text-sm text-slate-700">
                    Using your organisation payment run settings:{' '}
                    <span className="font-semibold">{formatInvoicingSubtitle(invoicing)}</span>
                    <span className="text-slate-500"> · {formatInvoicingPeriodDescription(invoicing)}</span>
                  </p>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Select invoicing period
                    <select
                      value={effectiveInvoicingPeriodId}
                      onChange={(e) => setInvoicingPeriodId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case text-slate-800"
                    >
                      {invoicingOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.isCurrent ? 'Current period · ' : ''}
                          {formatReportPeriodLabel(option.start, option.end)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <p className="text-sm text-amber-800">
                  Payment run settings are not loaded yet. Choose week or custom date range instead.
                </p>
              )}
            </div>
          )}

          {periodMode === 'week' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Previous week
              </button>
              <label className="text-sm font-medium text-slate-700">
                Week starting
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Next week
              </button>
            </div>
          )}

          {periodMode === 'custom' && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="text-sm font-medium text-slate-700">
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          )}

          {period ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <span className="font-semibold">Report period:</span> {formatReportPeriodLabel(period.start, period.end)}
              {periodMode === 'week' && <span className="text-blue-700"> · {period.label}</span>}
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Choose a valid date range to build the report.
            </div>
          )}
        </div>
      </div>

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard value={report.stats.totalBookings} label="Total bookings" color="text-blue-700" hint={`${report.stats.operativeBookings} operative · ${report.stats.managerBookings} manager`} />
            <StatCard value={report.stats.peopleBooked} label="People booked" color="text-slate-900" />
            <StatCard value={report.stats.projectsUsed} label="Projects used" color="text-indigo-700" />
            <StatCard
              value={report.stats.operativeClashes + report.stats.managerOverlaps + report.stats.unbookedLabour}
              label="Warnings in period"
              color="text-amber-700"
              hint={`${report.stats.operativeClashes} clashes · ${report.stats.managerOverlaps} overlaps · ${report.stats.unbookedLabour} unbooked`}
            />
          </div>

          <section className="space-y-3">
            <SectionHeader title="Schedule by day" />
            {report.dayGroups.every((group) => group.bookings.length === 0) ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No bookings in this period.
              </p>
            ) : (
              <div className="space-y-2">
                {report.dayGroups
                  .filter((group) => group.bookings.length > 0)
                  .map((group) => {
                    const key = group.date.toISOString()
                    const expanded = expandedDay === key
                    return (
                      <div key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => setExpandedDay(expanded ? null : key)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-50"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                            <p className="text-xs text-slate-500">
                              {group.bookings.length} booking{group.bookings.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className="text-slate-400">{expanded ? '▾' : '▸'}</span>
                        </button>
                        {expanded && (
                          <div className="border-t border-slate-100 px-4 py-3">
                            <div className="space-y-2">
                              {group.bookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"
                                >
                                  <div>
                                    <p className="font-semibold text-slate-900">{booking.personName}</p>
                                    <p className="text-slate-600">{booking.projectLabel}</p>
                                  </div>
                                  <div className="text-right text-slate-500">
                                    <p>{booking.timeRange || booking.timeSlot}</p>
                                    <p>{booking.personKind === 'manager' ? 'Manager' : 'Operative'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader title="People booked" />
            {report.people.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No people booked in this period.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {report.people.map((person) => (
                  <div key={person.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{person.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {person.kind === 'manager' ? 'Manager' : 'Operative'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {person.bookingCount} booking{person.bookingCount !== 1 ? 's' : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{person.projectLabels.join(' · ')}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader title="Projects" />
            {report.projects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No project activity in this period.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Project</th>
                      <th className="px-4 py-3 font-semibold">Bookings</th>
                      <th className="px-4 py-3 font-semibold">People</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.projects.map((project) => (
                      <tr key={project.projectId} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{project.label}</td>
                        <td className="px-4 py-3 text-slate-600">{project.bookingCount}</td>
                        <td className="px-4 py-3 text-slate-600">{project.peopleCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader
              title="Warnings"
              action={
                <Link href="/dashboard/warnings" className="text-xs font-semibold text-blue-600 hover:underline">
                  Open warnings hub →
                </Link>
              }
            />
            {report.operativeClashes.length === 0 &&
            report.managerClashes.length === 0 &&
            report.unbookedWarnings.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No warnings in this period.
              </p>
            ) : (
              <div className="space-y-2">
                {report.operativeClashes.map((warning) => (
                  <p key={warning.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    {warning.message}
                  </p>
                ))}
                {report.managerClashes.map((warning) => (
                  <p key={warning.id} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-900">
                    {warning.message}
                  </p>
                ))}
                {report.unbookedWarnings.map((warning) => (
                  <p key={warning.id} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                    {warning.message}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
