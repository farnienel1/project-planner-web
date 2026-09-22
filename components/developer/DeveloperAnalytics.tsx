'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { resolveDateRange, formatDuration } from '@/lib/analytics/dateRange'
import {
  averageSessionDuration,
  dailyActiveUsers,
  eventDayCounts,
  featureUsageRows,
  inRange,
  retentionCohorts,
  signupFunnel,
  uniqueUsersByDay,
} from '@/lib/analytics/aggregations'
import type { DateRangePreset } from '@/lib/analytics/events'
import { percentChange } from '@/lib/analytics/dateRange'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { ChangeHint, DeveloperShell, MetricCard, MiniBars } from '@/components/developer/DeveloperShell'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'

export function DeveloperAnalyticsScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('last_30')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { events, sessions, users, loading, error, load } = useAnalyticsStore()

  useEffect(() => {
    void load(range.previousStart)
  }, [load, range.previousStart])

  const dau = uniqueUsersByDay(events, range)
  const newUsers = users.filter((user) => inRange(user.createdAt, range.start, range.end))
  const funnel = signupFunnel(events, range)
  const retention = retentionCohorts(
    users.map((user) => ({ id: user.id, createdAt: user.createdAt })),
    events
  )

  if (loading && events.length === 0) return <LoadingSpinner label="Loading analytics…" />

  return (
    <DeveloperShell title="Users & engagement">
      <DateRangePicker preset={preset} onChange={setPreset} />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Registered users" value={users.length} />
        <MetricCard
          label="Active users"
          value={dailyActiveUsers(events, range)}
          hint={<ChangeHint current={dailyActiveUsers(events, range)} previous={dailyActiveUsers(events, { start: range.previousStart, end: range.previousEnd })} />}
        />
        <MetricCard label="New users" value={newUsers.length} />
        <MetricCard
          label="Avg session"
          value={formatDuration(averageSessionDuration(sessions, range))}
          hint={`${sessions.filter((session) => inRange(session.startedAt, range.start, range.end)).length} sessions`}
        />
      </div>
      <section className="card pad">
        <h2 className="h2">Daily active users</h2>
        <MiniBars points={dau} />
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
        <p className="mt-1 text-xs text-[var(--ink3)]">Unique people in this date range. Empty stages mean those events have not been recorded yet.</p>
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
      </section>
      <section className="card pad">
        <h2 className="h2">Retention</h2>
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
  const [preset, setPreset] = useState<DateRangePreset>('last_30')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { events, loading, error, load } = useAnalyticsStore()

  useEffect(() => {
    void load(range.previousStart)
  }, [load, range.previousStart])

  const rows = featureUsageRows(events, range, { start: range.previousStart, end: range.previousEnd })

  if (loading && events.length === 0) return <LoadingSpinner />

  return (
    <DeveloperShell title="Feature usage">
      <DateRangePicker preset={preset} onChange={setPreset} />
      {error ? <ErrorBanner message={error} /> : null}
      {rows.length === 0 ? (
        <EmptyState title="No feature events yet" description="This table fills in as people use projects, tasks, schedule, materials and H&S." />
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
