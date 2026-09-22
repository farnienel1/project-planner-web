'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { directoryActiveUsers, organisationActivityRows } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import { formatOwnerWhen, matchesOwnerSearch, ownerPersonName, ownerRoleLabel } from '@/lib/analytics/ownerDirectory'
import { rosterStatusLabel } from '@/lib/staff/userRosterUtils'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import type { DateRangePreset } from '@/lib/analytics/events'

export function DeveloperOrganisationDetailScreen({ organisationId }: { organisationId: string }) {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const [query, setQuery] = useState('')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { organisations, users, events, loading, error, warning, load } = useAnalyticsStore()
  const { suggestions, loadBoard } = useFeedbackStore()

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

  const orgUsers = useMemo(
    () => users.filter((user) => user.organizationId === organisationId),
    [users, organisationId]
  )
  const org = organisations.find((row) => row.id === organisationId)
  const activity = useMemo(
    () =>
      organisationActivityRows({
        organisations: org ? [org] : organisations.filter((row) => row.id === organisationId),
        users: orgUsers,
        events: events.filter((event) => event.organizationId === organisationId),
        ideas: suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.organizationId === organisationId),
        range,
      })[0],
    [org, organisations, organisationId, orgUsers, events, suggestions, range]
  )

  const visibleUsers = useMemo(
    () =>
      [...orgUsers]
        .sort((a, b) => ownerPersonName(a).localeCompare(ownerPersonName(b)))
        .filter((user) =>
          matchesOwnerSearch([ownerPersonName(user), user.email, user.role, rosterStatusLabel(user)], query)
        ),
    [orgUsers, query]
  )

  if (loading && users.length === 0 && organisations.length === 0 && !error && !warning) {
    return <LoadingSpinner label="Loading organisation…" />
  }

  const name = org?.name || activity?.name || 'Unknown organisation'
  if (!org && orgUsers.length === 0 && !loading) {
    return (
      <DeveloperShell title="Organisation" back={{ href: '/developer/organisations', label: 'Organisations' }}>
        <EmptyState title="Organisation not found" description="It may have been removed, or the owner console cannot read that tenant yet." />
      </DeveloperShell>
    )
  }

  return (
    <DeveloperShell title={name} back={{ href: '/developer/organisations', label: 'Organisations' }}>
      <p className="text-xs text-[var(--ink3)]">{organisationId}</p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <DeveloperStatus error={error} warning={warning} loading={loading} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Registered users" value={orgUsers.length} />
        <MetricCard label="Active in range" value={Math.max(activity?.activeUsers || 0, directoryActiveUsers(orgUsers, range))} />
        <MetricCard label="Product events" value={activity?.events || 0} hint={events.length ? undefined : 'No product events recorded yet'} />
        <MetricCard label="Ideas" value={activity?.ideaCount || 0} />
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h2">Users</h2>
          <SearchField value={query} onChange={setQuery} placeholder="Search this organisation" />
        </div>
        {orgUsers.length === 0 ? (
          <EmptyState
            title="No users on this organisation"
            description="Live user records for this tenant will appear here as soon as they exist in Firestore."
          />
        ) : visibleUsers.length === 0 ? (
          <EmptyState title="No matching users" description="Try a different name or email." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 font-semibold">{ownerPersonName(user)}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{ownerRoleLabel(user.role)}</td>
                    <td className="px-4 py-3">{rosterStatusLabel(user)}</td>
                    <td className="px-4 py-3 text-[var(--ink2)]">{formatOwnerWhen(user.lastSeenAt, 'Never')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[var(--ink3)]">
          <Link href="/developer/users">All users</Link>
        </p>
      </section>
    </DeveloperShell>
  )
}
