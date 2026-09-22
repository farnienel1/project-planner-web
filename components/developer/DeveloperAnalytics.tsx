'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { resolveDateRange, formatDuration, percentChange } from '@/lib/analytics/dateRange'
import {
  averageSessionDuration,
  dailyActiveUsers,
  directoryActiveUsers,
  directoryDateChart,
  featureUsageRows,
  inRange,
  lastSeenRetention,
  roleMix,
  uniqueUsersChart,
} from '@/lib/analytics/aggregations'
import type { DateRangePreset } from '@/lib/analytics/events'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { ChangeHint, DeveloperShell, DeveloperStatus, MetricCard, MiniBars } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'

export function DeveloperAnalyticsScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { events, sessions, users, organisations, loading, error, load, refresh } = useAnalyticsStore()

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
  const retention = lastSeenRetention(users)
  const roles = roleMix(users)
  const sessionCount = sessions.filter((session) => inRange(session.startedAt, range.start, range.end)).length

  if (loading && users.length === 0 && events.length === 0 && !error) {
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
        These numbers are the live user directory across every organisation. Feature taps are extra and only appear when
        they have actually been stored.
      </p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <DeveloperStatus error={error} loading={loading && users.length > 0} />
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
          value={sessionCount ? formatDuration(averageSessionDuration(sessions, range)) : '—'}
          hint={sessionCount ? `${sessionCount} sessions` : 'Sessions appear when web tracking is stored'}
        />
      </div>
      <section className="card pad">
        <h2 className="h2">{range.preset === 'all_time' ? 'New users by month' : 'New users'}</h2>
        <MiniBars points={directoryDateChart(users, range, 'createdAt')} hue="hs" />
      </section>
      <section className="card pad">
        <h2 className="h2">{range.preset === 'all_time' ? 'Last seen by month' : 'Last seen'}</h2>
        <MiniBars
          points={hasEvents ? uniqueUsersChart(events, range) : directoryDateChart(users, range, 'lastSeenAt')}
        />
      </section>
      <section className="card pad">
        <h2 className="h2">Roles</h2>
        {roles.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink3)]">Role mix appears once users are loaded.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {roles.map((row) => (
              <li key={row.id} className="rounded-xl bg-[var(--soft)] px-3 py-2">
                <p className="eyebrow">{row.label}</p>
                <p className="text-2xl font-extrabold">{row.count}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card pad">
        <h2 className="h2">Retention</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Share of people whose last-seen is at least 1 / 7 / 30 days after they were created. Needs 5+ accounts in each
          cohort.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {retention.map((row) => (
            <div key={row.label} className="rounded-xl bg-[var(--soft)] p-3">
              <p className="eyebrow">{row.label}</p>
              <p className="text-2xl font-extrabold">{row.rate == null ? '—' : `${row.rate}%`}</p>
              <p className="text-xs text-[var(--ink3)]">
                {row.rate == null ? 'Insufficient data (need 5+ users)' : `${row.retained} of ${row.size} returned`}
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
  const { events, users, organisations, loading, error, load, refresh } = useAnalyticsStore()

  useEffect(() => {
    void load()
  }, [load])

  const rows = featureUsageRows(events, range, { start: range.previousStart, end: range.previousEnd })

  if (loading && events.length === 0 && users.length === 0 && !error) {
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
        {users.length} registered users across {organisations.length} organisations. Feature taps are listed only when they
        have been stored for the web app.
      </p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <DeveloperStatus error={error} loading={loading && users.length > 0} />
      {rows.length === 0 ? (
        <EmptyState
          title="No feature taps stored yet"
          description="This table fills in when the web app records project, task, schedule, materials or H&S use. It does not invent numbers from the user list."
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
