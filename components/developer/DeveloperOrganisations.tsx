'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { organisationActivityRows } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import type { DateRangePreset } from '@/lib/analytics/events'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { DeveloperShell, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'

function formatWhen(date?: Date) {
  if (!date) return 'No activity recorded yet'
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export function DeveloperOrganisationsScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('last_30')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { organisations, users, events, loading, error, load } = useAnalyticsStore()
  const { suggestions, loadBoard } = useFeedbackStore()

  useEffect(() => {
    void load(range.previousStart)
    void loadBoard(true)
  }, [load, loadBoard, range.previousStart])

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

  if (loading && organisations.length === 0 && users.length === 0) {
    return <LoadingSpinner label="Loading organisations…" />
  }

  return (
    <DeveloperShell title="Organisations">
      <p className="text-sm text-[var(--ink2)]">
        Every tenant using the live app. Counts come from Firestore organisations and users; activity only appears after
        product events are recorded.
      </p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Organisations" value={organisations.length || rows.length} />
        <MetricCard label="Registered users" value={users.length} />
        <MetricCard label="Active in range" value={rows.reduce((sum, row) => sum + row.activeUsers, 0)} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No organisations found"
          description="When companies complete setup they appear here. If this is empty after going live, publish firestore.rules so the owner login can list organizations."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
              <tr>
                <th className="px-4 py-2">Organisation</th>
                <th className="px-4 py-2">Users</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2">Events</th>
                <th className="px-4 py-2">Ideas</th>
                <th className="px-4 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-[11px] text-[var(--ink3)]">{row.id}</p>
                  </td>
                  <td className="px-4 py-3">{row.userCount}</td>
                  <td className="px-4 py-3">{row.activeUsers}</td>
                  <td className="px-4 py-3">{row.events}</td>
                  <td className="px-4 py-3">{row.ideaCount}</td>
                  <td className="px-4 py-3 text-[var(--ink2)]">{formatWhen(row.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DeveloperShell>
  )
}
