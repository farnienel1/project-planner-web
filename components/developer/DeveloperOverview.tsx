'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { resolveDateRange, formatDuration } from '@/lib/analytics/dateRange'
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
import { ChangeHint, DeveloperShell, DeveloperStatus, MetricCard, MiniBars } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { CONSOLE_PERIODS, type ConsolePeriodId, deltaCopy, formatCount, formatGbpFromPence, resolveConsolePeriod } from '@/lib/analytics/consolePeriod'
import { isTestRecord, useConsolePrefs } from '@/lib/analytics/consolePrefs'

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

export function DeveloperOverviewScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const [period, setPeriod] = useState<ConsolePeriodId>('month')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const periodRange = useMemo(() => resolveConsolePeriod(period), [period])
  const { events, sessions, users, organisations, loading, error, loadedAt, load, refresh } = useAnalyticsStore()
  const { suggestions, votes, loadBoard } = useFeedbackStore()
  const includeTestData = useConsolePrefs((state) => state.includeTestData)
  const visibleUsers = includeTestData ? users : users.filter((user) => !isTestRecord(user))
  const visibleOrgs = includeTestData ? organisations : organisations.filter((org) => !isTestRecord(org))

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

  const metrics = useMemo(() => {
    const currentEvents = events.filter((event) => inRange(event.createdAt, range.start, range.end))
    const eventActive = dailyActiveUsers(events, range)
    const seenActive = directoryActiveUsers(visibleUsers, range)
    const active = Math.max(eventActive, seenActive)
    const prevActive = Math.max(
      dailyActiveUsers(events, { start: range.previousStart, end: range.previousEnd }),
      directoryActiveUsers(visibleUsers, { start: range.previousStart, end: range.previousEnd })
    )
    const newUsers = visibleUsers.filter((user) => inRange(user.createdAt, range.start, range.end)).length
    const prevNew = visibleUsers.filter((user) => inRange(user.createdAt, range.previousStart, range.previousEnd)).length
    const returning = countUnique(
      currentEvents.filter((event) => event.eventName === 'user_logged_in' || event.eventName === 'dashboard_viewed').map((e) => e.userId)
    )
    const openRequests = suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.publicStatus !== 'released' && row.publicStatus !== 'not_planned')
    const awaiting = suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.productDecision === 'none')
    const avgSession = averageSessionDuration(sessions, range)
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
      prevActive,
      eventActive,
      seenActive,
      newUsers,
      prevNew,
      returning,
      sessions: sessions.filter((session) => inRange(session.startedAt, range.start, range.end)).length,
      prevSessions: sessions.filter((session) => inRange(session.startedAt, range.previousStart, range.previousEnd)).length,
      avgSession,
      openRequests: openRequests.length,
      votes: votes.length,
      awaiting: awaiting.length,
      projects: currentEvents.filter((event) => event.eventName === 'project_created' || event.eventName === 'small_work_created').length,
      tasks: currentEvents.filter((event) => event.eventName === 'task_created').length,
      topOrgs: orgRows.slice(0, 8),
      hasEvents: events.length > 0,
      lanes: activityLanes(visibleUsers),
    }
  }, [events, sessions, visibleUsers, visibleOrgs, suggestions, votes, range])

  if (loading && users.length === 0 && organisations.length === 0 && !error) {
    return <LoadingSpinner label="Loading live organisations…" />
  }

  return (
    <DeveloperShell
      title="Overview"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-[var(--ink3)]">
            {loadedAt ? `Updated ${loadedAt.toLocaleTimeString('en-GB')}` : 'Live directory from organisations and users'}
          </p>
          <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      }
    >
      <DateRangePicker preset={preset} onChange={setPreset} />
      <div className="pills flex flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-white p-1">
        {CONSOLE_PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={period === item.id}
            className={`rounded-[10px] px-3 py-2 text-sm font-semibold ${period === item.id ? 'bg-[var(--blue)] text-white' : 'text-[var(--ink3)]'}`}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_2fr]">
        <div className="card pad text-white" style={{ background: 'linear-gradient(160deg,#1D4ED8,#0F2447)' }}>
          <p className="text-sm font-bold text-white/80">Timesheet value signed · {periodRange.label}</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight">{formatGbpFromPence(0)}</p>
          <p className="mt-2 text-sm text-white/80">
            Stored on each fully signed timesheet (frozen at signing). Live totals need the Cloud Function rollup; this
            page does not invent £ figures from the browser.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Logins', events.filter((event) => inRange(event.createdAt, periodRange.start, periodRange.end) && (event.eventName === 'login' || event.eventName === 'user_logged_in')).length],
            ['Projects created', events.filter((event) => inRange(event.createdAt, periodRange.start, periodRange.end) && event.eventName === 'project_created').length],
            ['Tasks completed', events.filter((event) => inRange(event.createdAt, periodRange.start, periodRange.end) && event.eventName === 'task_completed').length],
            ['New organisations', organisations.filter((org) => org.createdAt && inRange(org.createdAt, periodRange.start, periodRange.end)).length],
          ].map(([label, value]) => (
            <div key={String(label)} className="card pad">
              <p className="eyebrow">{label}</p>
              <p className="mt-1 text-2xl font-extrabold">{formatCount(Number(value))}</p>
              <p className="mt-1 text-xs text-[var(--ink3)]">{deltaCopy(Number(value), 0).text}</p>
            </div>
          ))}
        </div>
      </div>
      <DeveloperStatus error={error} loading={loading && (users.length > 0 || organisations.length > 0)} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Organisations" value={metrics.organisations} href="/developer/organisations" />
        <MetricCard label="Registered users" value={metrics.totalUsers} href="/developer/users" />
        <MetricCard
          label="Active in range"
          value={metrics.active}
          definition={METRIC_DEFINITIONS['Active user']}
          hint={<ChangeHint current={metrics.active} previous={metrics.prevActive} />}
        />
        <MetricCard
          label="New users"
          value={metrics.newUsers}
          definition={METRIC_DEFINITIONS['New user']}
          hint={<ChangeHint current={metrics.newUsers} previous={metrics.prevNew} />}
        />
        <MetricCard
          label="Sessions"
          value={metrics.hasEvents || metrics.sessions ? metrics.sessions : '—'}
          hint={
            metrics.hasEvents || metrics.sessions ? (
              <>
                {formatDuration(metrics.avgSession)} avg · <ChangeHint current={metrics.sessions} previous={metrics.prevSessions} />
              </>
            ) : (
              'No product sessions recorded yet'
            )
          }
        />
        <MetricCard label="Open requests" value={metrics.openRequests} href="/developer/feedback" />
        <MetricCard
          label="Returning users"
          value={metrics.hasEvents ? metrics.returning : '—'}
          definition={METRIC_DEFINITIONS['Returning user']}
          hint={metrics.hasEvents ? undefined : 'Needs product events'}
        />
        <MetricCard label="Awaiting review" value={metrics.awaiting} href="/developer/feedback?filter=review" />
        <MetricCard
          label="Projects / tasks created"
          value={metrics.hasEvents ? `${metrics.projects} / ${metrics.tasks}` : '—'}
          definition={METRIC_DEFINITIONS['Projects / tasks created']}
          hint={metrics.hasEvents ? undefined : 'Needs product events — historic jobs are not invented'}
        />
        <MetricCard label="Votes" value={metrics.votes} href="/developer/feedback" />
      </div>
      <section className="card pad">
        <h2 className="h2">Last seen</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {metrics.lanes.map((row) => (
            <li key={row.id} className="rounded-xl bg-[var(--soft)] px-3 py-2">
              <p className="eyebrow">{row.label}</p>
              <p className="text-2xl font-extrabold">{row.count}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="card pad">
        <h2 className="h2">Organisations</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Every tenant recovered from organisation documents and live user records, ranked by registered users.
        </p>
        {metrics.topOrgs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink3)]">
            Organisations appear here as soon as a company completes setup.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {metrics.topOrgs.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/developer/organisations/${encodeURIComponent(org.id)}`}
                  className="flex items-center justify-between rounded-xl bg-[var(--soft)] px-3 py-2 text-sm"
                >
                  <span className="font-semibold">{org.name}</span>
                  <span className="text-[var(--ink3)]">
                    {org.userCount} users
                    {org.activeUsers ? ` · ${org.activeUsers} active` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card pad">
        <h2 className="h2">{range.preset === 'all_time' ? 'New users by month' : 'New users'}</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">From live user records, not estimated.</p>
        <div className="mt-4">
          {users.length === 0 ? (
            <EmptyState title="No users yet" description="Accounts appear here as organisations complete setup." />
          ) : (
            <MiniBars points={directoryDateChart(users, range, 'createdAt')} hue="hs" />
          )}
        </div>
      </section>
      <section className="card pad">
        <h2 className="h2">{range.preset === 'all_time' ? 'Last seen by month' : 'Last seen'}</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          People whose user record has a last-seen timestamp in this range
          {metrics.hasEvents ? ', plus unique product-event users when those exist.' : '.'}
        </p>
        <div className="mt-4">
          <MiniBars
            points={
              metrics.hasEvents
                ? uniqueUsersChart(events, range)
                : directoryDateChart(users, range, 'lastSeenAt')
            }
          />
        </div>
      </section>
    </DeveloperShell>
  )
}
