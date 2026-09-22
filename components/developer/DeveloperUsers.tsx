'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { directoryActiveUsers } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import { formatOwnerWhen, matchesOwnerSearch, ownerPersonName, ownerRoleLabel } from '@/lib/analytics/ownerDirectory'
import { rosterStatusLabel } from '@/lib/staff/userRosterUtils'
import { DateRangePicker } from '@/components/developer/DeveloperOverview'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import type { DateRangePreset } from '@/lib/analytics/events'

export function DeveloperUsersScreen() {
  const [preset, setPreset] = useState<DateRangePreset>('all_time')
  const [query, setQuery] = useState('')
  const range = useMemo(() => resolveDateRange(preset), [preset])
  const { organisations, users, loading, error, load, refresh } = useAnalyticsStore()

  useEffect(() => {
    void load()
  }, [load])

  const orgName = useMemo(() => {
    const map = new Map(organisations.map((org) => [org.id, org.name]))
    return (id: string) => map.get(id) || 'Unknown organisation'
  }, [organisations])

  const visible = useMemo(
    () =>
      [...users]
        .sort((a, b) => ownerPersonName(a).localeCompare(ownerPersonName(b)))
        .filter((user) =>
          matchesOwnerSearch(
            [ownerPersonName(user), user.email, orgName(user.organizationId), user.organizationId, user.role],
            query
          )
        ),
    [users, query, orgName]
  )

  if (loading && users.length === 0 && !error) {
    return <LoadingSpinner label="Loading users…" />
  }

  return (
    <DeveloperShell
      title="Users"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-[var(--ink2)]">
        Every live account across every organisation. Search by name, email or tenant.
      </p>
      <DateRangePicker preset={preset} onChange={setPreset} />
      <SearchField value={query} onChange={setQuery} placeholder="Search users, emails or organisations" />
      <DeveloperStatus error={error} loading={loading && users.length > 0} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Registered users" value={users.length} />
        <MetricCard label="Active in range" value={directoryActiveUsers(users, range)} hint="From last-seen on user records" />
        <MetricCard label="Organisations" value={organisations.length} href="/developer/organisations" />
      </div>
      {users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Accounts appear here as soon as someone completes organisation setup."
        />
      ) : visible.length === 0 ? (
        <EmptyState title="No matching users" description="Try a different name, email or organisation." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--soft)] text-xs uppercase text-[var(--ink3)]">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Organisation</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-semibold">{ownerPersonName(user)}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <Link href={`/developer/organisations/${encodeURIComponent(user.organizationId)}`} className="font-semibold">
                      {orgName(user.organizationId)}
                    </Link>
                    <p className="text-[11px] text-[var(--ink3)]">{user.organizationId}</p>
                  </td>
                  <td className="px-4 py-3">{ownerRoleLabel(user.role)}</td>
                  <td className="px-4 py-3">{rosterStatusLabel(user)}</td>
                  <td className="px-4 py-3 text-[var(--ink2)]">{formatOwnerWhen(user.lastSeenAt, 'Never')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DeveloperShell>
  )
}
