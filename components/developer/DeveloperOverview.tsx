'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { resolveDateRange, formatDuration } from '@/lib/analytics/dateRange'
import {
  averageSessionDuration,
  countUnique,
  dailyActiveUsers,
  inRange,
  organisationActivityRows,
  uniqueUsersByDay,
} from '@/lib/analytics/aggregations'
import type { DateRangePreset } from '@/lib/analytics/events'
import { ChangeHint, DeveloperShell, MetricCard, MiniBars } from '@/components/developer/DeveloperShell'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'

const PRESETS: { id: DateRangePreset; label: string }[] = [
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
  const [preset, setPreset] = useState<DateRangePreset>('last_7')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { events, sessions, users, organisations, loading, error, loadedAt, load } = useAnalyticsStore()
  const { suggestions, votes, loadBoard } = useFeedbackStore()

  useEffect(() => {
    void load(range.previousStart)
    void loadBoard(true)
  }, [load, loadBoard, range.previousStart])

  const metrics = useMemo(() => {
    const currentEvents = events.filter((event) => inRange(event.createdAt, range.start, range.end))
    const active = dailyActiveUsers(events, range)
    const prevActive = dailyActiveUsers(events, { start: range.previousStart, end: range.previousEnd })
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
      topOrgs: orgRows.slice(0, 5),
    }
  }, [events, sessions, users, organisations, suggestions, votes, range])

  if (loading && events.length === 0) return <LoadingSpinner label="Loading analytics…" />

  return (
    <DeveloperShell
      title="Overview"
      actions={<p className="text-xs text-[var(--ink3)]">{loadedAt ? `Updated ${loadedAt.toLocaleTimeString('en-GB')}` : 'Live from recorded events'}</p>}
    >
      <DateRangePicker preset={preset} onChange={setPreset} />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Organisations" value={metrics.organisations} href="/developer/organisations" />
        <MetricCard label="Total users" value={metrics.totalUsers} href="/developer/analytics" />
        <MetricCard
          label="Active in range"
          value={metrics.active}
          hint={<ChangeHint current={metrics.active} previous={metrics.prevActive} />}
        />
        <MetricCard
          label="New users"
          value={metrics.newUsers}
          hint={<ChangeHint current={metrics.newUsers} previous={metrics.prevNew} />}
        />
        <MetricCard
          label="Sessions"
          value={metrics.sessions}
          hint={
            <>
              {formatDuration(metrics.avgSession)} avg · <ChangeHint current={metrics.sessions} previous={metrics.prevSessions} />
            </>
          }
        />
        <MetricCard label="Open requests" value={metrics.openRequests} href="/developer/feedback" />
        <MetricCard label="Returning users" value={metrics.returning} hint="People with a login or home view in range" />
        <MetricCard label="Awaiting review" value={metrics.awaiting} href="/developer/feedback?filter=review" />
        <MetricCard label="Projects / tasks created" value={`${metrics.projects} / ${metrics.tasks}`} />
        <MetricCard label="Votes" value={metrics.votes} />
      </div>
      <section className="card pad">
        <h2 className="h2">Most active organisations</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">Ranked by people who generated a product event in this range.</p>
        {metrics.topOrgs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink3)]">Organisations appear here after setup. Usage ranks fill in once events are recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {metrics.topOrgs.map((org) => (
              <li key={org.id} className="flex items-center justify-between rounded-xl bg-[var(--soft)] px-3 py-2 text-sm">
                <span className="font-semibold">{org.name}</span>
                <span className="text-[var(--ink3)]">
                  {org.activeUsers} active · {org.userCount} users
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card pad">
        <h2 className="h2">Daily active users</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">Unique people who generated a product event in this range.</p>
        <div className="mt-4">
          {events.length === 0 ? (
            <EmptyState title="No product events yet" description="Usage numbers appear after people use the live app with tracking enabled." />
          ) : (
            <MiniBars points={uniqueUsersByDay(events, range)} />
          )}
        </div>
      </section>
    </DeveloperShell>
  )
}
