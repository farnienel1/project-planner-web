'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { directoryActiveUsers, organisationActivityRows } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import { formatOwnerWhen, matchesOwnerSearch } from '@/lib/analytics/ownerDirectory'
import type { DateRangePreset } from '@/lib/analytics/events'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'

export function DeveloperOrganisationsScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const [query, setQuery] = useState('')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { organisations, users, events, loading, error, load, refresh } = useAnalyticsStore()
  const { suggestions, loadBoard } = useFeedbackStore()

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

  const rows = useMemo(
    () =>
      organisationActivityRows({
        organisations,
        users,
        events,
        ideas: suggestions.filter((row) => !row.hidden && !row.mergedIntoId),
        range,
      }),
    [organisations, users, events, suggestions, range]
  )

  const visible = useMemo(
    () => rows.filter((row) => matchesOwnerSearch([row.name, row.id], query)),
    [rows, query]
  )

  if (loading && organisations.length === 0 && users.length === 0 && !error) {
    return <LoadingSpinner label="Loading organisations…" />
  }

  return (
    <DeveloperShell
      title="Organisations"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-[var(--ink2)]">
        Every company that has completed organisation setup. User counts come from live account records.
      </p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <SearchField value={query} onChange={setQuery} placeholder="Search organisations" />
      <DeveloperStatus error={error} loading={loading && rows.length > 0} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Organisations" value={rows.length} />
        <MetricCard label="Registered users" value={users.length} href="/developer/users" />
        <MetricCard
          label="Active in range"
          value={Math.max(
            rows.reduce((sum, row) => sum + row.activeUsers, 0),
            directoryActiveUsers(users, range)
          )}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No organisations found"
          description="When companies complete setup they appear here."
        />
      ) : visible.length === 0 ? (
        <EmptyState title="No matching organisations" description="Try a different name or organisation id." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
              <tr>
                <th className="px-4 py-2">Organisation</th>
                <th className="px-4 py-2">Users</th>
                <th className="px-4 py-2">Active</th>
                {events.length > 0 ? <th className="px-4 py-2">Events</th> : null}
                <th className="px-4 py-2">Feedback</th>
                <th className="px-4 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <Link href={`/developer/organisations/${encodeURIComponent(row.id)}`} className="font-semibold">
                      {row.name}
                    </Link>
                    <p className="text-[11px] text-[var(--ink3)]">{row.id}</p>
                  </td>
                  <td className="px-4 py-3">{row.userCount}</td>
                  <td className="px-4 py-3">{row.activeUsers}</td>
                  {events.length > 0 ? <td className="px-4 py-3">{row.events}</td> : null}
                  <td className="px-4 py-3">{row.ideaCount}</td>
                  <td className="px-4 py-3 text-[var(--ink2)]">{formatOwnerWhen(row.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DeveloperShell>
  )
}
