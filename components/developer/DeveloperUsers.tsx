'use client'

import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { CONSOLE_PERIODS, type ConsolePeriodId } from '@/lib/analytics/consolePeriod'
import { ownerGet } from '@/lib/owner/client/ownerApi'
import {
  OWNER_PEOPLE_FILTERS,
  OWNER_PEOPLE_SORTS,
  type DirectoryPage,
  type OwnerPeopleFilter,
  type OwnerPeopleSort,
  type OwnerPersonRow,
} from '@/lib/owner/directory'

type PeopleResponse = DirectoryPage<OwnerPersonRow> & { truncated: boolean; seenLabel: string | null; joinedLabel: string | null }

const FILTER_LABEL: Record<OwnerPeopleFilter, string> = { all: 'Everyone', active: 'Active', inactive: 'Inactive', pending: 'Pending', test: 'Test' }
const SORT_LABEL: Record<OwnerPeopleSort, string> = { name: 'Name', lastSeen: 'Last seen', created: 'Newest' }
const SEGMENT_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive', pending: 'Pending' }

function periodParam(raw: string | null): ConsolePeriodId | null {
  return raw && CONSOLE_PERIODS.some((item) => item.id === raw) ? (raw as ConsolePeriodId) : null
}

function when(ms: number | null): string {
  if (!ms) return 'Never'
  return new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: LONDON_TIME_ZONE })
}

/**
 * People (spec §4.4, owner console PR 5): one row per person across every organisation, from the server directory
 * (rulebook `rosterPeople`, one per email). `?seen=<period>` / `?joined=<period>` are the lists the Overview's
 * "Active people" and "New people" tiles open; their total is the tile's figure. Each row opens the person page,
 * where the actions are.
 */
export function DeveloperUsersScreen() {
  const searchParams = useSearchParams()
  const seen = periodParam(searchParams.get('seen'))
  const joined = periodParam(searchParams.get('joined'))
  const { includeTestData, jumpQuery } = useConsolePrefs()
  const [query, setQuery] = useState(jumpQuery)
  const [debounced, setDebounced] = useState(jumpQuery)
  const [filter, setFilter] = useState<OwnerPeopleFilter>('all')
  const [sort, setSort] = useState<OwnerPeopleSort>(seen ? 'lastSeen' : joined ? 'created' : 'name')
  const [rows, setRows] = useState<OwnerPersonRow[]>([])
  const [page, setPage] = useState<PeopleResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => setQuery(jumpQuery), [jumpQuery])
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const params = useMemo(
    () => ({ q: debounced, filter, sort, includeTestData, seen: seen || undefined, joined: joined || undefined }),
    [debounced, filter, sort, includeTestData, seen, joined]
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    ownerGet<PeopleResponse>('/api/owner/directory/people', { ...params, refresh: tick > 0 }, controller.signal)
      .then((value) => {
        setPage(value)
        setRows(value.rows)
        setError('')
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load people.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [params, tick])

  const loadMore = async () => {
    if (!page?.nextCursor) return
    setLoading(true)
    try {
      const next = await ownerGet<PeopleResponse>('/api/owner/directory/people', { ...params, cursor: page.nextCursor })
      setPage(next)
      setRows((current) => [...current, ...next.rows])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more people.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !page && !error) return <LoadingSpinner label="Loading people…" />

  const windowLabel = page?.seenLabel ? `Seen ${page.seenLabel.toLowerCase()}` : page?.joinedLabel ? `Joined ${page.joinedLabel.toLowerCase()}` : null
  const fix = searchParams.get('fix')

  return (
    <DeveloperShell
      title="People"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => setTick((value) => value + 1)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-(--ink2)">
        One row per person across every organisation (people with the same email are one person). Emails are masked; open a
        person to reveal theirs (logged) and for the actions.
      </p>
      {fix ? (
        <p className="banner" data-hue="warn">
          Open support request for user {fix}.{' '}
          <Link className="font-semibold" href={`/developer/users/${encodeURIComponent(fix)}`}>
            Open this person
          </Link>{' '}
          to change their login email or send a password reset.
        </p>
      ) : null}
      {windowLabel ? (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="people-window">
          <span className="chip">{windowLabel}</span>
          <Link href="/developer/users" className="pu-link">
            Show everyone
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={query} onChange={setQuery} placeholder="Search name, email, user id or organisation" />
        <label className="flex items-center gap-1 text-sm">
          Show
          <select className="pp-in" value={filter} onChange={(event) => setFilter(event.target.value as OwnerPeopleFilter)} data-testid="people-filter">
            {OWNER_PEOPLE_FILTERS.map((value) => (
              <option key={value} value={value}>
                {FILTER_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          Sort
          <select className="pp-in" value={sort} onChange={(event) => setSort(event.target.value as OwnerPeopleSort)}>
            {OWNER_PEOPLE_SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABEL[value]}
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
      {page?.truncated ? (
        <p className="banner" data-hue="warn">
          The platform has more people than one read covers, so this list may be short.
        </p>
      ) : null}
      <p className="text-sm font-semibold" data-testid="people-total">
        {page ? `${page.total} ${page.total === 1 ? 'person' : 'people'}` : ''}
      </p>
      {page && page.total === 0 ? (
        <EmptyState title="No matching people" description="Try a different name, email or filter." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-(--soft) text-xs uppercase text-(--ink3)">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Organisations</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last seen</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-(--line)">
                  <td className="px-4 py-3">
                    <Link href={`/developer/users/${encodeURIComponent(row.id)}`} className="font-semibold">
                      {row.name}
                    </Link>
                    {row.ghost ? <span className="chip ml-2">No app login</span> : null}
                    {row.isTest ? <span className="chip ml-2">Test</span> : null}
                  </td>
                  <td className="px-4 py-3">{row.emailMasked || '—'}</td>
                  <td className="px-4 py-3">
                    {row.organizationIds.length
                      ? row.organizationIds.map((id, index) => (
                          <span key={id}>
                            {index ? ', ' : ''}
                            <Link href={`/developer/organisations/${encodeURIComponent(id)}`}>{row.organizationNames[index]}</Link>
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td className="px-4 py-3">{row.role}</td>
                  <td className="px-4 py-3">{SEGMENT_LABEL[row.segment] || row.segment}</td>
                  <td className="px-4 py-3 text-(--ink2)">{when(row.lastSeenAtMs)}</td>
                  <td className="px-4 py-3 text-(--ink2)">{when(row.createdAtMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page?.nextCursor ? (
        <button type="button" className="btn sm ghost w-fit" onClick={() => void loadMore()} disabled={loading}>
          {loading ? 'Loading…' : `Show more (${rows.length} of ${page.total})`}
        </button>
      ) : null}
    </DeveloperShell>
  )
}
