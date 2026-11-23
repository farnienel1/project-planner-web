'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import {
  averageSessionDuration,
  countUnique,
  dailyActiveUsers,
  directoryActiveUsers,
  directoryDateChart,
  inRange,
  organisationActivityRows,
  uniqueUsersChart,
  activityLanes,
} from '@/lib/analytics/aggregations'
import { METRIC_DEFINITIONS, type DateRangePreset } from '@/lib/analytics/events'
import { DeveloperShell, DeveloperStatus, MetricCard, MiniBars } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { CONSOLE_PERIODS, consoleEventsCover, consoleEventsSince, deltaCopy, formatCount, formatGbpFromPence, resolveConsolePeriod } from '@/lib/analytics/consolePeriod'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { isTestOrganisation, isTestPerson, testOrganisationIds } from '@/lib/owner/testData'
import { loadSignedTimesheetValueTotals, otherCurrenciesNote, type SignedTimesheetValueTotals } from '@/lib/owner/signedTimesheetValue'
import { billingLabel, billingStatusLabel } from '@/lib/stripe/billing'
import { ANNUAL_PENCE, MONTHLY_PENCE } from '@/lib/stripe/plans'
import { csvEscapeCell } from '@/lib/security/spreadsheetCell'
import { useOwnerActivity } from '@/lib/owner/client/ownerApi'
import { activityCell, type ActivityMetricKey } from '@/lib/owner/activityDisplay'

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'all_time', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7', label: 'Last 7 days' },
  { id: 'last_30', label: 'Last 30 days' },
  { id: 'last_90', label: 'Last 90 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
]

const emptyTimesheets: SignedTimesheetValueTotals = {
  valuePence: 0,
  previousPence: 0,
  sheetCount: 0,
  hours: 0,
  labourNotCountedCount: 0,
  otherCurrencies: [],
  loaded: true,
}

export function DateRangePicker({
  preset,
  onChange,
}: {
  preset: DateRangePreset
  onChange: (preset: DateRangePreset) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`chip ${preset === item.id ? 'on' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function countEvents(
  events: { eventName: string; createdAt: Date }[],
  names: string[],
  start: Date,
  end: Date
) {
  const set = new Set(names)
  return events.filter((event) => set.has(event.eventName) && inRange(event.createdAt, start, end)).length
}

const ACTIVITY_ROW_DEFINITIONS: Record<ActivityMetricKey, string> = {
  bookings:
    'Labour, manager schedule and subcontractor bookings created in the period, counted from the bookings. Deleted bookings are not counted; moving a booking to another booking type, or Replace, creates a new booking. Bookings stored without a creation time are left out.',
  projects: 'Projects created in the period, counted from the projects (web and iPhone). Records without a creation time are left out.',
  smallWorks: 'Small works created in the period, counted from the small works (web and iPhone). Records without a creation time are left out.',
  tasksCompleted:
    'Tasks with a completion time in the period. The iPhone app does not yet set or clear the completion time when a task’s status changes, so tasks completed on the iPhone may be missing and tasks reopened there may still count.',
}

const ACTIVITY_ROW_LABELS = new Set(['Bookings made', 'Projects created', 'Small works created', 'Tasks completed'])

function sumCells(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b
}

function activityText(value: number | null, loading: boolean): string {
  if (value !== null) return formatCount(value)
  return loading ? '…' : '—'
}

function activityHint(
  activity: Parameters<typeof activityCell>[0],
  metric: ActivityMetricKey | ActivityMetricKey[],
  period: string,
  state: { error: string | null; loading: boolean }
): string {
  if (state.error) return `Could not count: ${state.error}`
  if (!activity) return state.loading ? 'Counting…' : '—'
  const metrics = Array.isArray(metric) ? metric : [metric]
  const sum = (rangeId: string) =>
    metrics.reduce<number | null>((total, id) => sumCells(total, activityCell(activity, id, rangeId)), 0)
  const current = sum(period)
  const previous = activity.period === period ? sum('previous') : null
  if (activity.failedOrganisations.length) {
    return `${activity.failedOrganisations.length} organisation${activity.failedOrganisations.length === 1 ? '' : 's'} could not be counted`
  }
  if (current === null || previous === null) return '—'
  return deltaCopy(current, previous).text
}

function activityRowTitle(label: string, state: { error: string | null; loading: boolean }): string {
  if (!ACTIVITY_ROW_LABELS.has(label)) return 'Not loaded for this period. Choose it in the period selector to count it.'
  if (state.error) return `Could not count: ${state.error}`
  return state.loading ? 'Counting…' : 'Could not be counted for every organisation.'
}

export function DeveloperOverviewScreen() {
  const period = useConsolePrefs((state) => state.period)
  const periodRange = useMemo(() => resolveConsolePeriod(period), [period])
  const { events, sessions, users, organisations, loading, error, loadedAt, load, refresh, eventsSince, eventsTruncated } =
    useAnalyticsStore()
  const eventsLoaded = useMemo(
    () => (eventsSince === undefined ? null : { since: eventsSince, truncated: eventsTruncated }),
    [eventsSince, eventsTruncated]
  )
  const { suggestions, votes, loadBoard } = useFeedbackStore()
  const includeTestData = useConsolePrefs((state) => state.includeTestData)
  const testOrgIds = useMemo(() => testOrganisationIds(organisations), [organisations])
  const visibleUsers = includeTestData ? users : users.filter((user) => !isTestPerson(user, testOrgIds))
  const visibleOrgs = includeTestData ? organisations : organisations.filter((org) => !isTestOrganisation(org))
  const [timesheetValue, setTimesheetValue] = useState<SignedTimesheetValueTotals>({
    ...emptyTimesheets,
    loaded: false,
  })

  // Bookings, projects, small works and completed tasks are counted from the records themselves (server count()),
  // never from product events: no app writes `schedule_edited`, and the iPhone writes no product events at all.
  const ownerActivity = useOwnerActivity(period, includeTestData)
  const activity = ownerActivity.activity

  const orgIdsKey = visibleOrgs.map((org) => org.id).sort().join(',')

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

  useEffect(() => {
    let cancelled = false
    if (loading && !orgIdsKey) return
    if (!orgIdsKey) {
      setTimesheetValue(emptyTimesheets)
      return
    }
    const orgUsers = includeTestData ? users : users.filter((user) => !isTestPerson(user, testOrgIds))
    void loadSignedTimesheetValueTotals({
      organizationIds: orgIdsKey.split(',').filter(Boolean),
      users: orgUsers,
      start: periodRange.start,
      end: periodRange.end,
      previousStart: periodRange.previousStart,
      previousEnd: periodRange.previousEnd,
    })
      .then((result) => {
        if (!cancelled) setTimesheetValue({ ...result, loaded: true })
      })
      .catch((err) => {
        if (!cancelled) {
          setTimesheetValue({
            ...emptyTimesheets,
            loaded: true,
            error: err instanceof Error ? err.message : 'Could not read timesheets',
          })
        }
      })
    const watchdog = window.setTimeout(() => {
      if (!cancelled) {
        setTimesheetValue((current) => (current.loaded ? current : { ...emptyTimesheets, loaded: true }))
      }
    }, 20000)
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
    }
  }, [orgIdsKey, includeTestData, users, testOrgIds, loading, periodRange.start, periodRange.end, periodRange.previousStart, periodRange.previousEnd])

  const periodMetrics = useMemo(() => {
    const start = periodRange.start
    const end = periodRange.end
    const prevStart = periodRange.previousStart
    const prevEnd = periodRange.previousEnd
    const logins = countEvents(events, ['login', 'user_logged_in'], start, end)
    const prevLogins = countEvents(events, ['login', 'user_logged_in'], prevStart, prevEnd)
    const signed = countEvents(events, ['timesheet_signed', 'timesheet_approved'], start, end)
    const newUsers = visibleUsers.filter((user) => inRange(user.createdAt, start, end)).length
    const prevNewUsers = visibleUsers.filter((user) => inRange(user.createdAt, prevStart, prevEnd)).length
    const newOrgs = visibleOrgs.filter((org) => org.createdAt && inRange(org.createdAt, start, end)).length
    const prevOrgs = visibleOrgs.filter((org) => org.createdAt && inRange(org.createdAt, prevStart, prevEnd)).length
    const active = Math.max(dailyActiveUsers(events, periodRange), directoryActiveUsers(visibleUsers, periodRange))
    return { logins, prevLogins, signed, newUsers, prevNewUsers, newOrgs, prevOrgs, active }
  }, [events, visibleUsers, visibleOrgs, periodRange])

  const scoreboard = useMemo(() => {
    const columns = CONSOLE_PERIODS.map((item) => ({ id: item.id, label: item.label, range: resolveConsolePeriod(item.id) }))
    // Event rows count only periods the loaded events fully cover (PR 1: events load for the chosen period only).
    const covered = columns.map((col) => consoleEventsCover(eventsLoaded, col.range.start))
    const eventValues = (names: string[]) =>
      columns.map((col, index) => (covered[index] ? countEvents(events, names, col.range.start, col.range.end) : null))
    const rows: { label: string; values: (number | null)[]; money?: boolean; definition?: string }[] = [
      {
        label: 'Logins',
        values: eventValues(['login', 'user_logged_in']),
      },
      {
        label: 'New users',
        values: columns.map((col) => visibleUsers.filter((user) => inRange(user.createdAt, col.range.start, col.range.end)).length),
      },
      {
        label: 'New organisations',
        values: columns.map((col) => visibleOrgs.filter((org) => org.createdAt && inRange(org.createdAt, col.range.start, col.range.end)).length),
      },
      ...(['bookings', 'projects', 'smallWorks', 'tasksCompleted'] as ActivityMetricKey[]).map((metric) => ({
        label: { bookings: 'Bookings made', projects: 'Projects created', smallWorks: 'Small works created', tasksCompleted: 'Tasks completed' }[metric],
        values: columns.map((col) => activityCell(activity, metric, col.id)),
        definition: ACTIVITY_ROW_DEFINITIONS[metric],
      })),
      {
        label: 'Timesheets signed (events)',
        values: eventValues(['timesheet_signed', 'timesheet_approved']),
      },
    ]
    return { columns, rows }
  }, [events, visibleUsers, visibleOrgs, eventsLoaded, activity])

  const revenue = useMemo(() => {
    let mrr = 0
    let monthly = 0
    let annual = 0
    let trial = 0
    let pastDue = 0
    let cancelling = 0
    for (const org of visibleOrgs) {
      const billing = org.billing
      if (!billing) continue
      if (billing.status === 'trialing') trial += 1
      if (billing.status === 'past_due') pastDue += 1
      if (billing.cancelAtPeriodEnd) cancelling += 1
      if (billing.status === 'active' || billing.status === 'trialing') {
        mrr += billing.mrrPence || (billing.billingInterval === 'year' ? Math.round(ANNUAL_PENCE / 12) : billing.billingInterval === 'month' ? MONTHLY_PENCE : 0)
        if (billing.billingInterval === 'year') annual += 1
        if (billing.billingInterval === 'month') monthly += 1
      }
    }
    return { mrr, monthly, annual, trial, pastDue, cancelling }
  }, [visibleOrgs])

  const alerts = useMemo(() => {
    const items: { id: string; text: string; href: string }[] = []
    for (const org of visibleOrgs) {
      const billing = org.billing
      if (billing?.status === 'past_due') {
        items.push({ id: `due-${org.id}`, text: `${org.name}: payment failed`, href: `/developer/organisations/${org.id}` })
      }
      if (billing?.cancelAtPeriodEnd) {
        items.push({ id: `cancel-${org.id}`, text: `${org.name}: cancels at period end`, href: `/developer/organisations/${org.id}` })
      }
      if (billing?.status === 'trialing' && billing.trialEnd) {
        const days = Math.ceil((billing.trialEnd.getTime() - Date.now()) / 86400000)
        if (days <= 3 && days >= 0) {
          items.push({ id: `trial-${org.id}`, text: `${org.name}: trial ends in ${days} day${days === 1 ? '' : 's'}`, href: `/developer/organisations/${org.id}` })
        }
      }
    }
    return items.slice(0, 8)
  }, [visibleOrgs])

  const metrics = useMemo(() => {
    const range = periodRange
    const currentEvents = events.filter((event) => inRange(event.createdAt, range.start, range.end))
    const eventActive = dailyActiveUsers(events, range)
    const seenActive = directoryActiveUsers(visibleUsers, range)
    const active = Math.max(eventActive, seenActive)
    const orgRows = organisationActivityRows({
      organisations: visibleOrgs,
      users: visibleUsers,
      events,
      ideas: suggestions.filter((row) => !row.hidden && !row.mergedIntoId),
      range,
    })
    return {
      totalUsers: visibleUsers.length,
      organisations: visibleOrgs.length || orgRows.length,
      active,
      avgSession: averageSessionDuration(sessions, range),
      openRequests: suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.publicStatus !== 'released' && row.publicStatus !== 'not_planned').length,
      votes: votes.length,
      topOrgs: orgRows.slice(0, 8),
      hasEvents: events.length > 0,
      lanes: activityLanes(visibleUsers),
      returning: countUnique(currentEvents.filter((event) => event.eventName === 'user_logged_in' || event.eventName === 'dashboard_viewed').map((e) => e.userId)),
    }
  }, [events, sessions, visibleUsers, visibleOrgs, suggestions, votes, periodRange])

  const hours = timesheetValue.hours || 0
  const avgPerHour = hours > 0 ? timesheetValue.valuePence / hours : 0
  const avgPerOrg = visibleOrgs.length ? timesheetValue.valuePence / visibleOrgs.length : 0

  if (loading && users.length === 0 && organisations.length === 0 && !error) {
    return <LoadingSpinner label="Loading live organisations…" />
  }

  const kpis = [
    {
      label: 'Bookings made',
      value: activityText(activityCell(activity, 'bookings', period), ownerActivity.loading),
      hint: activityHint(activity, 'bookings', period, ownerActivity),
      definition: 'Labour, manager schedule and subcontractor bookings created in this period, counted from the bookings themselves. Deleted bookings are not counted; moving a booking to another booking type, or Replace, creates a new booking and counts again. Bookings stored without a creation time are left out.',
    },
    { label: 'Timesheets signed', value: formatCount(timesheetValue.loaded ? timesheetValue.sheetCount : periodMetrics.signed), hint: timesheetValue.loaded ? `${timesheetValue.sheetCount} fully signed sheets` : 'Reading sheets…', definition: METRIC_DEFINITIONS['Timesheets signed'] || 'Fully signed timesheets in the selected period.' },
    { label: 'Timesheet value', value: timesheetValue.loaded ? formatGbpFromPence(timesheetValue.valuePence) : '…', hint: deltaCopy(timesheetValue.valuePence, timesheetValue.previousPence).text, definition: 'Invoice total (timesheetTotals) of fully signed timesheets of GBP organisations: the signed snapshot when stored, else price work and expenses only. Other currencies are listed, never added.' },
    { label: 'Hours on timesheets', value: timesheetValue.loaded ? formatCount(hours) : '…', hint: hours ? `${formatGbpFromPence(avgPerHour)} / hour` : 'Hours on signed sheets', definition: 'Paid hours (timesheetTotals) of the signed lines of fully signed timesheets of GBP organisations; sheets without a signed snapshot add none.' },
    {
      label: 'Projects created',
      value: activityText(sumCells(activityCell(activity, 'projects', period), activityCell(activity, 'smallWorks', period)), ownerActivity.loading),
      hint: activityHint(activity, ['projects', 'smallWorks'], period, ownerActivity),
      definition: 'Projects and small works created in this period, counted from the jobs themselves (web and iPhone).',
    },
    { label: 'Logins', value: formatCount(periodMetrics.logins), hint: deltaCopy(periodMetrics.logins, periodMetrics.prevLogins).text, definition: 'login / user_logged_in events' },
    { label: 'New users', value: formatCount(periodMetrics.newUsers), hint: deltaCopy(periodMetrics.newUsers, periodMetrics.prevNewUsers).text, definition: METRIC_DEFINITIONS['New user'] },
    { label: 'New organisations', value: formatCount(periodMetrics.newOrgs), hint: deltaCopy(periodMetrics.newOrgs, periodMetrics.prevOrgs).text, definition: 'Organisation documents created in the period' },
  ]

  return (
    <DeveloperShell
      title="Overview"
      eventsFrom={consoleEventsSince(period)}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-(--ink3)">
            {loadedAt ? `Updated ${loadedAt.toLocaleTimeString('en-GB')}` : 'Live directory from organisations and users'}
          </p>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              void refresh()
              ownerActivity.refresh()
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[1.2fr_2fr]">
        <div className="card pad text-white" style={{ background: 'linear-gradient(160deg,#1D4ED8,#0F2447)' }}>
          <p className="text-sm font-bold text-white/80">Timesheet value signed · {periodRange.label}</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight">
            {timesheetValue.loaded ? formatGbpFromPence(timesheetValue.valuePence) : '…'}
          </p>
          <p className="mt-2 text-sm text-white/80">
            {timesheetValue.loaded
              ? `${timesheetValue.sheetCount} fully signed timesheet${timesheetValue.sheetCount === 1 ? '' : 's'} in this period${
                  timesheetValue.labourNotCountedCount ? ` · ${timesheetValue.labourNotCountedCount} without a signed snapshot (price work and expenses only)` : ''}${
                  timesheetValue.otherCurrencies.length ? ` · ${otherCurrenciesNote(timesheetValue.otherCurrencies)}` : ''
                }${timesheetValue.error ? ` · ${timesheetValue.error}` : ''}`
              : 'Reading signed timesheets across organisations…'}
          </p>
          {timesheetValue.loaded && timesheetValue.previousPence > 0 ? (
            <p className="mt-2 text-sm text-white/80">{deltaCopy(timesheetValue.valuePence, timesheetValue.previousPence).text}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              [formatCount(hours), 'Hours signed'],
              [hours ? formatGbpFromPence(avgPerHour) : '—', 'Avg £ / hour'],
              [visibleOrgs.length ? formatGbpFromPence(avgPerOrg) : '—', 'Avg / organisation'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                <p className="text-lg font-extrabold">{value}</p>
                <p className="text-[11px] text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {kpis.slice(0, 4).map((card) => (
            <div key={card.label} className="card pad">
              <p className="eyebrow flex items-center gap-1">
                {card.label}
                <span title={card.definition} className="cursor-help text-[11px] font-bold text-(--ink3)">
                  ⓘ
                </span>
              </p>
              <p className="mt-1 text-2xl font-extrabold">{card.value}</p>
              <p className="mt-1 text-xs text-(--ink3)">{card.hint}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.slice(4).map((card) => (
          <div key={card.label} className="card pad">
            <p className="eyebrow flex items-center gap-1">
              {card.label}
              <span title={card.definition} className="cursor-help text-[11px] font-bold text-(--ink3)">
                ⓘ
              </span>
            </p>
            <p className="mt-1 text-2xl font-extrabold">{card.value}</p>
            <p className="mt-1 text-xs text-(--ink3)">{card.hint}</p>
          </div>
        ))}
      </div>
      <DeveloperStatus error={error} loading={loading && (users.length > 0 || organisations.length > 0)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Organisations" value={metrics.organisations} href="/developer/organisations" />
        <MetricCard label="Registered users" value={metrics.totalUsers} href="/developer/users" />
        <MetricCard label="MRR (from billing)" value={formatGbpFromPence(revenue.mrr)} hint={`${revenue.monthly} monthly · ${revenue.annual} annual · ${revenue.trial} trial`} />
        <MetricCard label="Open requests" value={metrics.openRequests} href="/developer/feedback" />
      </div>
      <section className="card pad overflow-x-auto">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="h2">Platform scoreboard</h2>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              const header = ['Metric', ...scoreboard.columns.map((col) => col.label)].map(csvEscapeCell).join(',')
              const lines = scoreboard.rows.map((row) => [row.label, ...row.values.map((value) => (value === null ? '' : value))].map(csvEscapeCell).join(','))
              const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = 'owner-console-scoreboard.csv'
              link.click()
              URL.revokeObjectURL(url)
            }}
          >
            Export CSV
          </button>
        </div>
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="text-xs uppercase text-(--ink3)">
              <th className="px-2 py-2 text-left">Metric</th>
              {scoreboard.columns.map((col) => (
                <th key={col.id} className={`px-2 py-2 text-right ${col.id === period ? 'text-(--blue)' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoreboard.rows.map((row) => (
              <tr key={row.label} className="border-t border-(--line)">
                <td className="px-2 py-2 font-semibold" title={row.definition}>{row.label}</td>
                {row.values.map((value, index) => (
                  <td
                    key={scoreboard.columns[index].id}
                    className={`px-2 py-2 text-right ${scoreboard.columns[index].id === period ? 'bg-(--soft) font-bold' : ''}`}
                  >
                    {value === null ? (
                      <span title={activityRowTitle(row.label, ownerActivity)}>—</span>
                    ) : (
                      formatCount(value)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-(--line)">
              <td className="px-2 py-2 font-semibold">Timesheet value (selected period)</td>
              {scoreboard.columns.map((col) => (
                <td key={col.id} className={`px-2 py-2 text-right ${col.id === period ? 'bg-(--soft) font-bold' : ''}`}>
                  {col.id === period && timesheetValue.loaded ? formatGbpFromPence(timesheetValue.valuePence) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
      <section className="card pad">
        <h2 className="h2">Needs attention</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-(--ink3)">No billing alerts yet. Payment failed, trials ending and cancellations appear here from organizations/{'{id}'}.billing.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link href={alert.href} className="block rounded-xl bg-(--soft) px-3 py-2 text-sm font-semibold">
                  {alert.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card pad">
        <h2 className="h2">Most active organisations</h2>
        {metrics.topOrgs.length === 0 ? (
          <p className="mt-3 text-sm text-(--ink3)">Organisations appear here as soon as a company completes setup.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {metrics.topOrgs.map((org) => {
              const full = visibleOrgs.find((row) => row.id === org.id)
              return (
                <li key={org.id}>
                  <Link
                    href={`/developer/organisations/${encodeURIComponent(org.id)}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-(--soft) px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-semibold">{org.name}</span>
                      <span className="ml-2 text-[11px] text-(--ink3)">{billingLabel(full?.billing)} · {billingStatusLabel(full?.billing)}</span>
                    </span>
                    <span className="text-(--ink3)">
                      {org.userCount} users
                      {org.activeUsers ? ` · ${org.activeUsers} active` : ''}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className="card pad">
        <h2 className="h2">Logins</h2>
        <p className="mt-1 text-xs text-(--ink3)">From product events when they exist; otherwise last-seen on user records.</p>
        <div className="mt-4">
          <MiniBars points={metrics.hasEvents ? uniqueUsersChart(events, periodRange) : directoryDateChart(visibleUsers, periodRange, 'lastSeenAt')} />
        </div>
      </section>
      <section className="card pad">
        <h2 className="h2">New users</h2>
        <div className="mt-4">
          {users.length === 0 ? (
            <EmptyState title="No users yet" description="Accounts appear here as organisations complete setup." />
          ) : (
            <MiniBars points={directoryDateChart(visibleUsers, periodRange, 'createdAt')} hue="hs" />
          )}
        </div>
      </section>
      <section className="card pad">
        <h2 className="h2">Live activity</h2>
        <p className="mt-1 text-xs text-(--ink3)">Last 50 product events. Names and emails are not stored in metadata.</p>
        <ul className="mt-3 space-y-1 text-sm">
          {events.slice(0, 50).length === 0 ? (
            <li className="text-(--ink3)">No product events recorded yet.</li>
          ) : (
            [...events]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 50)
              .map((event) => (
                <li key={event.id} className="flex flex-wrap justify-between gap-x-3 rounded-lg px-2 py-1 hover:bg-(--soft)">
                  <span>{event.eventName.replace(/_/g, ' ')}</span>
                  <span className="text-(--ink3)">{event.createdAt.toLocaleString('en-GB')}</span>
                </li>
              ))
          )}
        </ul>
      </section>
      <section className="card pad">
        <h2 className="h2">Last seen</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {metrics.lanes.map((row) => (
            <li key={row.id} className="rounded-xl bg-(--soft) px-3 py-2">
              <p className="eyebrow">{row.label}</p>
              <p className="text-2xl font-extrabold">{row.count}</p>
            </li>
          ))}
        </ul>
      </section>
    </DeveloperShell>
  )
}
