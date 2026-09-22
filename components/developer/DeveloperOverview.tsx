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
  inRange,
  organisationActivityRows,
  uniqueUsersChart,
} from '@/lib/analytics/aggregations'
import type { DateRangePreset } from '@/lib/analytics/events'
import { ChangeHint, DeveloperShell, DeveloperStatus, MetricCard, MiniBars } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'

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
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { events, sessions, users, organisations, loading, error, warning, loadedAt, load, refresh } = useAnalyticsStore()
  const { suggestions, votes, error: boardError, loadBoard } = useFeedbackStore()

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

  const metrics = useMemo(() => {
    const currentEvents = events.filter((event) => inRange(event.createdAt, range.start, range.end))
    const eventActive = dailyActiveUsers(events, range)
    const seenActive = directoryActiveUsers(users, range)
    const active = Math.max(eventActive, seenActive)
    const prevActive = Math.max(
      dailyActiveUsers(events, { start: range.previousStart, end: range.previousEnd }),
      directoryActiveUsers(users, { start: range.previousStart, end: range.previousEnd })
    )
    const newUsers = users.filter((user) => inRange(user.createdAt, range.start, range.end)).length
    const prevNew = users.filter((user) => inRange(user.createdAt, range.previousStart, range.previousEnd)).length
    const returning = countUnique(
      currentEvents.filter((event) => event.eventName === 'user_logged_in' || event.eventName === 'dashboard_viewed').map((e) => e.userId)
    )
    const openRequests = suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.publicStatus !== 'released' && row.publicStatus !== 'not_planned')
    const awaiting = suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.productDecision === 'none')
    const avgSession = averageSessionDuration(sessions, range)
    const orgRows = organisationActivityRows({
      organisations,
      users,
      events,
      ideas: suggestions.filter((row) => !row.hidden && !row.mergedIntoId),
      range,
    })
    return {
      totalUsers: users.length,
      organisations: organisations.length || orgRows.length,
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
    }
  }, [events, sessions, users, organisations, suggestions, votes, range])

  if (loading && users.length === 0 && organisations.length === 0 && !error && !warning) {
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
      <DeveloperStatus error={error} warning={warning || boardError} loading={loading && (users.length > 0 || organisations.length > 0)} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Organisations" value={metrics.organisations} href="/developer/organisations" />
        <MetricCard label="Registered users" value={metrics.totalUsers} href="/developer/users" />
        <MetricCard
          label="Active in range"
          value={metrics.active}
          hint={
            <>
              <ChangeHint current={metrics.active} previous={metrics.prevActive} />
              {metrics.hasEvents
                ? ` · ${metrics.eventActive} from product events`
                : ' · from last-seen on user records'}
            </>
          }
        />
        <MetricCard
          label="New users"
          value={metrics.newUsers}
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
          hint={metrics.hasEvents ? 'People with a login or home view in range' : 'Needs product events'}
        />
        <MetricCard label="Awaiting review" value={metrics.awaiting} href="/developer/feedback?filter=review" />
        <MetricCard
          label="Projects / tasks created"
          value={metrics.hasEvents ? `${metrics.projects} / ${metrics.tasks}` : '—'}
          hint={metrics.hasEvents ? undefined : 'Needs product events'}
        />
        <MetricCard label="Votes" value={metrics.votes} href="/developer/feedback" />
      </div>
      <section className="card pad">
        <h2 className="h2">Organisations</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Every tenant recovered from organisation documents and live user records, ranked by registered users.
        </p>
        {metrics.topOrgs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink3)]">
            Organisations appear here as soon as a company completes setup. If this list is empty, refresh after publishing
            firestore.rules so the owner login can read every tenant.
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
        <h2 className="h2">{range.preset === 'all_time' ? 'Monthly active users' : 'Daily active users'}</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Unique people who generated a product event. Last-seen on user records still counts in the Active metric above.
        </p>
        <div className="mt-4">
          {!metrics.hasEvents ? (
            <EmptyState
              title="No product events yet"
              description="Organisation and user counts above still come from live account records. Feature charts fill in after people use the app with tracking enabled."
            />
          ) : (
            <MiniBars points={uniqueUsersChart(events, range)} />
          )}
        </div>
      </section>
    </DeveloperShell>
  )
}
