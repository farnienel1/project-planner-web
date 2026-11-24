'use client'

import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { ownerGet } from '@/lib/owner/client/ownerApi'
import type { ClientErrorGroup } from '@/lib/canonical'

type ErrorsResponse = { total: number; organisations: string[]; groups: ClientErrorGroup[] }

function when(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: LONDON_TIME_ZONE })
}

/**
 * Errors (owner console, D7, rulebook §32): the newest anonymous error reports from web and iPhone, grouped by
 * message, route and build with a count, newest first. Filters: platform and organisation. Read through the
 * owner-only route `/api/owner/errors`; nothing here is written.
 */
export function DeveloperErrorsScreen() {
  const [platform, setPlatform] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [data, setData] = useState<ErrorsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const { organisations, load: loadOrganisations } = useAnalyticsStore()

  useEffect(() => {
    void loadOrganisations()
  }, [loadOrganisations])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await ownerGet<ErrorsResponse>('/api/owner/errors', { platform, organizationId }))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the error reports.')
    } finally {
      setLoading(false)
    }
  }, [platform, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const orgName = useMemo(() => {
    const names = new Map(organisations.map((org) => [org.id, org.name]))
    return (id: string) => (id ? names.get(id) || id : 'No organisation open')
  }, [organisations])

  const groups = data?.groups ?? []
  const reports = groups.reduce((sum, group) => sum + group.count, 0)

  return (
    <DeveloperShell
      title="Errors"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-(--ink2)">
        Anonymous error reports from web and iPhone: a message, the screen&apos;s route and the build — no names, emails or
        ids. At most 20 per person a day, each error once per session. Kept for 30 days.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm">
          Platform
          <select className="pp-in" value={platform} onChange={(event) => setPlatform(event.target.value)} data-testid="errors-platform">
            <option value="">All</option>
            <option value="web">Web</option>
            <option value="ios">iPhone</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          Organisation
          <select className="pp-in" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} data-testid="errors-org">
            <option value="">All</option>
            {(data?.organisations ?? []).map((id) => (
              <option key={id || '-'} value={id || '-'}>
                {orgName(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p className="banner" data-hue="red" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? (
        <LoadingSpinner label="Loading error reports…" />
      ) : groups.length === 0 ? (
        <EmptyState title="No error reports" description="Nothing has been reported for these filters in the last 30 days." />
      ) : (
        <>
          <p className="text-sm font-semibold" data-testid="errors-total">
            {reports} {reports === 1 ? 'report' : 'reports'} · {groups.length} {groups.length === 1 ? 'error' : 'different errors'}
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-(--soft) text-xs uppercase text-(--ink3)">
                <tr>
                  <th className="px-4 py-2">Message</th>
                  <th className="px-4 py-2">Route</th>
                  <th className="px-4 py-2">Build</th>
                  <th className="px-4 py-2">Platform</th>
                  <th className="px-4 py-2">Count</th>
                  <th className="px-4 py-2">Last seen</th>
                  <th className="px-4 py-2">Organisations</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.key} className="border-t border-(--line) align-top">
                    <td className="px-4 py-3 break-words" style={{ maxWidth: 420 }}>
                      {group.message}
                      <div className="text-xs text-(--ink3)">{group.sources.join(', ')}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{group.route}</td>
                    <td className="px-4 py-3">{group.build || '—'}</td>
                    <td className="px-4 py-3">{group.platform === 'ios' ? 'iPhone' : 'Web'}</td>
                    <td className="px-4 py-3 font-semibold">{group.count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-(--ink2)">
                      {when(group.lastMs)}
                      {group.firstMs && group.firstMs !== group.lastMs ? <div className="text-xs">first {when(group.firstMs)}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      {group.organizationIds.map((id, index) => (
                        <span key={id || '-'}>
                          {index ? ', ' : ''}
                          {id ? <Link href={`/developer/organisations/${encodeURIComponent(id)}`}>{orgName(id)}</Link> : orgName(id)}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.total >= 1000 ? (
            <p className="text-xs text-(--ink3)">Showing the newest 1,000 reports.</p>
          ) : null}
        </>
      )}
    </DeveloperShell>
  )
}
