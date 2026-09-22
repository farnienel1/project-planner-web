'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { resolveDateRange, formatDuration } from '@/lib/analytics/dateRange'
import {
  averageSessionDuration,
  dailyActiveUsers,
  directoryActiveUsers,
  eventDayCounts,
  featureUsageRows,
  inRange,
  retentionCohorts,
  signupFunnel,
  uniqueUsersChart,
} from '@/lib/analytics/aggregations'
import type { DateRangePreset } from '@/lib/analytics/events'
import { percentChange } from '@/lib/analytics/dateRange'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { ChangeHint, DeveloperShell, DeveloperStatus, MetricCard, MiniBars } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'

export function DeveloperAnalyticsScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { events, sessions, users, organisations, loading, error, warning, load, refresh } = useAnalyticsStore()

  useEffect(() => {
    void load()
  }, [load])

  const hasEvents = events.length > 0
  const eventActive = dailyActiveUsers(events, range)
  const seenActive = directoryActiveUsers(users, range)
  const active = Math.max(eventActive, seenActive)
  const prevActive = Math.max(
    dailyActiveUsers(events, { start: range.previousStart, end: range.previousEnd }),
    directoryActiveUsers(users, { start: range.previousStart, end: range.previousEnd })
  )
  const newUsers = users.filter((user) => inRange(user.createdAt, range.start, range.end))
  const funnel = signupFunnel(events, range)
  const retention = retentionCohorts(
    users.map((user) => ({ id: user.id, createdAt: user.createdAt })),
    events
  )
  const sessionCount = sessions.filter((session) => inRange(session.startedAt, range.start, range.end)).length

  if (loading && users.length === 0 && events.length === 0 && !error && !warning) {
    return <LoadingSpinner label="Loading analytics…" />
  }

  return (
    <DeveloperShell
      title="Analytics"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-[var(--ink2)]">
        Registered and active people come from live user records. Funnel, sessions and feature charts stay empty until
        product events can be read — those numbers are not estimated.
      </p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <DeveloperStatus error={error} warning={warning} loading={loading && users.length > 0} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Registered users" value={users.length} href="/developer/users" />
        <MetricCard
          label="Active users"
          value={active}
          hint={
            <>
              <ChangeHint current={active} previous={prevActive} />
              {hasEvents ? ` · ${eventActive} from events` : ' · from last-seen on user records'}
            </>
          }
        />
        <MetricCard label="New users" value={newUsers.length} />
        <MetricCard label="Organisations" value={organisations.length} href="/developer/organisations" />
        <MetricCard
          label="Avg session"
          value={hasEvents || sessionCount ? formatDuration(averageSessionDuration(sessions, range)) : '—'}
          hint={hasEvents || sessionCount ? `${sessionCount} sessions` : 'No product sessions recorded yet'}
        />
      </div>
      <section className="card pad">
        <h2 className="h2">{range.preset === 'all_time' ? 'Monthly active users' : 'Daily active users'}</h2>
        {!hasEvents ? (
          <EmptyState
            title="No product events yet"
            description="Active-user charts need productEvents. Registered users above are still the live directory."
          />
        ) : (
          <MiniBars points={uniqueUsersChart(events, range)} />
        )}
      </section>
      <section className="card pad">
        <h2 className="h2">New users</h2>
        <MiniBars
          points={eventDayCounts(
            newUsers.map((user) => ({
              id: user.id,
              userId: user.id,
              eventName: 'user_signed_up',
              createdAt: user.createdAt,
            })),
            range,
            'user_signed_up'
          )}
          hue="hs"
        />
      </section>
      <section className="card pad">
        <h2 className="h2">Signup funnel</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Unique people from recorded product events in this range. Empty stages mean those events have not been stored
          yet — not that nobody signed up.
        </p>
        {!hasEvents ? (
          <EmptyState
            title="Funnel needs product events"
            description={`${users.length} registered users exist in the directory. Signup, project and task steps appear after tracking events are readable.`}
          />
        ) : (
          <ol className="mt-4 space-y-2">
            {funnel.map((step, index) => (
              <li key={step.id} className="flex items-center justify-between rounded-xl bg-[var(--soft)] px-3 py-2">
                <span className="text-sm font-semibold">
                  {index + 1}. {step.label}
                </span>
                <span className="font-extrabold">{step.users}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="card pad">
        <h2 className="h2">Retention</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {retention.map((row) => (
            <div key={row.label} className="rounded-xl bg-[var(--soft)] p-3">
              <p className="eyebrow">{row.label}</p>
              <p className="text-2xl font-extrabold">{row.rate == null ? '—' : `${row.rate}%`}</p>
              <p className="text-xs text-[var(--ink3)]">
                {row.rate == null
                  ? hasEvents
                    ? 'Insufficient data (need 5+ users)'
                    : 'Needs product events to measure return visits'
                  : `${row.retained} of ${row.size} returned`}
              </p>
            </div>
          ))}
        </div>
      </section>
    </DeveloperShell>
  )
}

export function DeveloperUsageScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { events, users, organisations, loading, error, warning, load, refresh } = useAnalyticsStore()

  useEffect(() => {
    void load()
  }, [load])

  const rows = featureUsageRows(events, range, { start: range.previousStart, end: range.previousEnd })

  if (loading && events.length === 0 && users.length === 0 && !error && !warning) {
    return <LoadingSpinner />
  }

  return (
    <DeveloperShell
      title="Feature usage"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-[var(--ink2)]">
        Feature counts only appear when product events exist. {users.length} registered users across {organisations.length}{' '}
        organisations are already in the live directory.
      </p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <DeveloperStatus error={error} warning={warning} loading={loading && users.length > 0} />
      {rows.length === 0 ? (
        <EmptyState
          title="No feature events yet"
          description="This table stays empty until projects, tasks, schedule, materials and H&S generate productEvents. It does not invent usage from the user directory."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
              <tr>
                <th className="px-4 py-2">Feature</th>
                <th className="px-4 py-2">Users</th>
                <th className="px-4 py-2">Uses</th>
                <th className="px-4 py-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const change = percentChange(row.uses, row.previousUses)
                return (
                  <tr key={row.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-semibold">{row.label}</td>
                    <td className="px-4 py-3">{row.users}</td>
                    <td className="px-4 py-3">{row.uses}</td>
                    <td className="px-4 py-3">
                      {change == null ? '—' : change > 0 ? `↑ ${change}%` : change < 0 ? `↓ ${Math.abs(change)}%` : '→'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </DeveloperShell>
  )
}
