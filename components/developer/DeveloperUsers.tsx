'use client'

import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import Link from 'next/link'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { CONSOLE_PERIODS, type ConsolePeriodId } from '@/lib/analytics/consolePeriod'
import { ownerGet } from '@/lib/owner/client/ownerApi'
import type { OwnerPersonOrganisation } from '@/lib/owner/person360'
import {
  OWNER_PEOPLE_FILTERS,
  OWNER_PEOPLE_SORTS,
  type DirectoryPage,
  type OwnerPeopleFilter,
  type OwnerPeopleSort,
  type OwnerPersonRow,
  type OwnerOrgRow,
} from '@/lib/owner/directory'

type OrgOption = Pick<OwnerOrgRow, 'id' | 'name' | 'isTest'>
type OrganisationsResponse = {
  personId: string
  organisations: OwnerPersonOrganisation[]
  membershipsRead: boolean
  serverKey: boolean
  membershipsError: string | null
  truncated: boolean
}
type Expanded = { loading: boolean; error: string; data: OrganisationsResponse | null }

const LEVEL_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', operative: 'Operative' }

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
  const router = useRouter()
  const pathname = usePathname()
  const [org, setOrgState] = useState(searchParams.get('org') || '')
  // The picked organisation is written back to the address, so the view can be shared or reloaded.
  const setOrg = (value: string) => {
    setOrgState(value)
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set('org', value)
    else next.delete('org')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([])
  const [orgOptionsError, setOrgOptionsError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, Expanded>>({})

  // The organisation picker: every organisation (test ones only with "Include test data"), by name.
  useEffect(() => {
    const controller = new AbortController()
    ownerGet<DirectoryPage<OwnerOrgRow>>('/api/owner/directory/orgs', { sort: 'name', limit: 200, includeTestData }, controller.signal)
      .then((value) => {
        setOrgOptions(value.rows.map((row) => ({ id: row.id, name: row.name, isTest: row.isTest })))
        setOrgOptionsError(value.nextCursor ? 'Only the first 200 organisations are in the picker; search for the rest.' : '')
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setOrgOptionsError(err instanceof Error ? err.message : 'Could not load the organisations.')
      })
    return () => controller.abort()
  }, [includeTestData])

  const toggle = (row: OwnerPersonRow) => {
    if (expanded[row.id]) {
      setExpanded((current) => {
        const next = { ...current }
        delete next[row.id]
        return next
      })
      return
    }
    setExpanded((current) => ({ ...current, [row.id]: { loading: true, error: '', data: null } }))
    ownerGet<OrganisationsResponse>(`/api/owner/people/${encodeURIComponent(row.id)}/organisations`)
      .then((data) => setExpanded((current) => (current[row.id] ? { ...current, [row.id]: { loading: false, error: '', data } } : current)))
      .catch((err: unknown) =>
        setExpanded((current) =>
          current[row.id]
            ? { ...current, [row.id]: { loading: false, error: err instanceof Error ? err.message : 'Could not load their organisations.', data: null } }
            : current
        )
      )
  }

  useEffect(() => setQuery(jumpQuery), [jumpQuery])
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const params = useMemo(
    () => ({ q: debounced, filter, sort, includeTestData, seen: seen || undefined, joined: joined || undefined, org: org || undefined }),
    [debounced, filter, sort, includeTestData, seen, joined, org]
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
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => {
            // Opened rows are read again after a refresh (their organisations may have changed).
            setExpanded({})
            setTick((value) => value + 1)
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <p className="text-sm text-(--ink2)">
        One row per account (people with the same email are one person). Open a row (▸) to see each organisation they
        belong to: their name, level, active state and line manager there. Pick an organisation to browse its people. Emails
        are masked; open a person to reveal theirs (logged) and for the actions.
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
          Organisation
          <select className="pp-in" value={org} onChange={(event) => setOrg(event.target.value)} data-testid="people-organisation">
            <option value="">Every organisation</option>
            {org && !orgOptions.some((option) => option.id === org) ? <option value={org}>{org}</option> : null}
            {orgOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.isTest ? ' (test)' : ''}
              </option>
            ))}
          </select>
        </label>
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
      {orgOptionsError ? <p className="text-xs text-(--ink3)">{orgOptionsError}</p> : null}
      {org ? (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="people-organisation-scope">
          <span className="chip">Members of {orgOptions.find((option) => option.id === org)?.name || org}</span>
          <Link href={`/developer/organisations/${encodeURIComponent(org)}`} className="pu-link">
            Open the organisation
          </Link>
          <button type="button" className="pu-link" onClick={() => setOrg('')}>
            Show every organisation
          </button>
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
        <EmptyState
          title="No matching people"
          description={
            org && !includeTestData && !orgOptions.some((option) => option.id === org)
              ? 'This organisation is not in the picker. If it is a test organisation, turn on Include test data to see its people.'
              : 'Try a different name, email or filter.'
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-(--soft) text-xs uppercase text-(--ink3)">
              <tr>
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">Open</span>
                </th>
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
                <Fragment key={row.id}>
                <tr className="border-t border-(--line)">
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="btn sm ghost"
                      aria-expanded={Boolean(expanded[row.id])}
                      aria-controls={`person-orgs-${row.id}`}
                      aria-label={`${expanded[row.id] ? 'Close' : 'Open'} ${row.name}'s organisations`}
                      onClick={() => toggle(row)}
                      data-testid="people-expand"
                    >
                      {expanded[row.id] ? '▾' : '▸'}
                    </button>
                  </td>
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
                {expanded[row.id] ? (
                  <tr id={`person-orgs-${row.id}`} className="bg-(--soft)">
                    <td />
                    <td colSpan={7} className="px-4 py-3 whitespace-normal">
                      <PersonOrganisations personId={row.id} state={expanded[row.id]} />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
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

/**
 * A person's organisations under their row: their name there (rulebook 1.82.0, the organisation's own name for them),
 * level, active state and line manager there. "Change name here" opens the person page with that organisation's name
 * change ready (the action itself, its reason, preview and audit, stays on the person page).
 */
function PersonOrganisations({ personId, state }: { personId: string; state: Expanded }) {
  if (state.loading) return <p className="text-sm text-(--ink3)">Loading their organisations…</p>
  if (state.error) {
    return (
      <p className="text-sm" role="alert" data-hue="red">
        {state.error}
      </p>
    )
  }
  const data = state.data
  if (!data) return null
  const person = `/developer/users/${encodeURIComponent(personId)}`
  return (
    <div className="space-y-2" data-testid="people-organisations">
      {data.organisations.length === 0 ? (
        <p className="text-sm text-(--ink3)">Not in any organisation.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-(--ink3)">
            <tr>
              <th className="py-1 pr-4">Organisation</th>
              <th className="py-1 pr-4">Name there</th>
              <th className="py-1 pr-4">Level</th>
              <th className="py-1 pr-4">Active</th>
              <th className="py-1 pr-4">Line manager</th>
              <th className="py-1">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.organisations.map((org) => (
              <tr key={org.id} className="border-t border-(--line)" data-testid="people-organisation-row">
                <td className="py-2 pr-4">
                  <Link href={`/developer/organisations/${encodeURIComponent(org.id)}`} className="font-semibold">
                    {org.name}
                  </Link>
                  {org.isTest ? <span className="chip ml-2">Test</span> : null}
                  {org.deletion === 'scheduled' ? <span className="chip ml-2">Scheduled for deletion</span> : null}
                  {org.lapsed ? <span className="chip ml-2">Subscription lapsed</span> : null}
                </td>
                <td className="py-2 pr-4">
                  {org.nameHere || '—'}
                  {org.nameFromOrganization ? null : <span className="ml-1 text-xs text-(--ink3)">(account name)</span>}
                </td>
                <td className="py-2 pr-4">
                  {LEVEL_LABEL[org.level] || org.level}
                  {org.isSuperAdmin ? ' · Super Admin' : ''}
                </td>
                <td className="py-2 pr-4">{org.active ? 'Active' : 'Inactive'}</td>
                <td className="py-2 pr-4">
                  {org.lineManager ? (
                    <>
                      <span className={org.lineManager.recorded ? '' : 'text-(--ink3)'} title={org.lineManager.names.join(', ') || undefined}>
                        {org.lineManager.label}
                      </span>
                      {org.lineManager.incomplete ? (
                        <span className="ml-1 text-xs text-(--ink3)">(not everyone was read; this may be someone the list did not reach)</span>
                      ) : null}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2">
                  <Link href={`${person}?changeName=${encodeURIComponent(org.id)}`} className="pu-link" data-testid="people-change-name">
                    Change name here
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.membershipsError ? <p className="text-xs text-(--ink3)">{data.membershipsError}</p> : null}
      {data.truncated ? (
        <p className="text-xs text-(--ink3)">
          The platform has more people than one read covers, so a name or line manager here may be missing.
        </p>
      ) : null}
      <Link href={person} className="pu-link text-sm">
        Open the person page (reveal email, actions, audit)
      </Link>
    </div>
  )
}
