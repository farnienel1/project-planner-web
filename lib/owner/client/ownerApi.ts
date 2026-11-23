'use client'

import { useCallback, useEffect, useState } from 'react'
import { getClientAuthHeaders } from '@/lib/security/clientAuthHeaders'
import type { OwnerCounts } from '@/lib/owner/ownerCounts'
import type { OwnerSearchResult } from '@/lib/owner/directory'
import type { CommandCentre } from '@/lib/owner/commandCentre'

/**
 * The server keeps directory rows for 200 s per instance (OWNER_DIRECTORY_CACHE_MS) and clears them on owner changes, but another instance may
 * still hold old rows. After an owner change each directory route and search asks once for fresh rows (`refresh=1`),
 * per path: the first request to one path never clears the flag for another (re-review of #348, final check).
 */
let directoryGeneration = 0
const refreshedGeneration = new Map<string, number>()

export function markOwnerDirectoryStale(): void {
  directoryGeneration += 1
}

/** True when this path has not yet asked for fresh rows since the last owner change. */
export function ownerPathNeedsRefresh(path: string): boolean {
  return readsOwnerDirectory(path) && (refreshedGeneration.get(path) ?? 0) < directoryGeneration
}

/** Records that this path read fresh rows for the given owner change (only after a successful answer). */
export function ownerPathRefreshed(path: string, generation: number): void {
  if ((refreshedGeneration.get(path) ?? 0) < generation) refreshedGeneration.set(path, generation)
}

/** Tests only. */
export function resetOwnerDirectoryStaleForTests(): void {
  directoryGeneration = 0
  refreshedGeneration.clear()
}

/** True for the routes that read the cached directory (the Overview builds its figures from it too, PR 2). */
export function readsOwnerDirectory(path: string): boolean {
  return path.startsWith('/api/owner/directory/') || path === '/api/owner/search' || path === '/api/owner/overview'
}

/** The query for a request: `refresh` is added once per path after an owner change, for the directory routes only. */
export function ownerQueryParams(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  stale: boolean
): Record<string, string | number | boolean | undefined> {
  return stale && readsOwnerDirectory(path) ? { ...params, refresh: true } : params
}

/** GET an owner route with the signed-in owner's token and the MFA cookie. Throws the route's own message. */
export async function ownerGet<T>(path: string, rawParams: Record<string, string | number | boolean | undefined> = {}, signal?: AbortSignal): Promise<T> {
  const generation = directoryGeneration
  const usedStale = ownerPathNeedsRefresh(path)
  const params = ownerQueryParams(path, rawParams, usedStale)
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue
    query.set(key, value === true ? '1' : String(value))
  }
  const response = await fetch(`${path}${query.size ? `?${query.toString()}` : ''}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: await getClientAuthHeaders(),
    signal,
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  if (usedStale) ownerPathRefreshed(path, generation)
  return data
}

export type OwnerCountsState = { counts: OwnerCounts | null; error: string | null; refresh: () => void }

/** Headline counts (spec §2: when the page opens, then every 60 s, plus refresh). */
export function useOwnerCounts(includeTestData: boolean, enabled = true): OwnerCountsState {
  const [counts, setCounts] = useState<OwnerCounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((value) => value + 1), [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    ownerGet<OwnerCounts>('/api/owner/counts', { includeTestData }, controller.signal)
      .then((value) => {
        setCounts(value)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not load the counts.')
      })
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [includeTestData, enabled, tick])
  return { counts, error, refresh }
}

export async function ownerSearchRequest(q: string, includeTestData: boolean, signal?: AbortSignal): Promise<OwnerSearchResult> {
  return ownerGet<OwnerSearchResult>('/api/owner/search', { q, includeTestData }, signal)
}

export type OwnerActivityResponse = {
  period: string
  values: Record<'bookings' | 'projects' | 'smallWorks' | 'tasksCompleted', Record<string, number | null>>
  organisationsCounted: number
  failedOrganisations: string[]
  countedAt: string
}

export type OwnerActivityState = { activity: OwnerActivityResponse | null; error: string | null; loading: boolean; refresh: () => void }

/**
 * Activity counts read from the records themselves (bookings, projects, small works, completed tasks), per console
 * period. Read when the page opens, when the period or test-data choice changes, every 5 minutes while the tab is
 * visible (the server keeps a read for 60 s), and on Refresh (which counts again).
 * While the first read is running, or after it failed, `activity` is null: the page shows "—", never 0.
 */
export function useOwnerActivity(period: string, includeTestData: boolean, enabled = true): OwnerActivityState {
  const [activity, setActivity] = useState<OwnerActivityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // `forced` asks the server to count again (Refresh) instead of its 60-second cache.
  const [tick, setTick] = useState<{ n: number; forced: boolean }>({ n: 0, forced: false })
  const refresh = useCallback(() => setTick((value) => ({ n: value.n + 1, forced: true })), [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoading(true)
    ownerGet<OwnerActivityResponse>('/api/owner/activity', { period, includeTestData, refresh: tick.forced }, controller.signal)
      .then((value) => {
        setActivity(value)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setActivity(null)
        setError(err instanceof Error ? err.message : 'Could not count the activity.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    // Re-count every 5 minutes, but not while the tab is hidden (review of #366: cost).
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      setTick((value) => ({ n: value.n + 1, forced: false }))
    }, 5 * 60_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [period, includeTestData, enabled, tick])
  return { activity, error, loading, refresh }
}

export type OwnerOverviewResponse = CommandCentre & {
  period: string
  range: { start: string; end: string; label: string }
  /** Set when the owner actions could not be read (the rest of the page still shows). */
  auditError: string | null
  /** The directory reached its read cap: figures may be short, and the page says so. */
  truncated: boolean
  countedAt: string
}

/** How often an open, visible Overview reads again (review of #433, S1). */
export const OVERVIEW_POLL_MS = 180_000

export type OwnerOverviewState = { overview: OwnerOverviewResponse | null; error: string | null; loading: boolean; refresh: () => void }

/**
 * The Overview (spec §4.1, §2 "live"): read when the page opens or the period / test-data choice changes, every
 * OVERVIEW_POLL_MS while the tab is visible (review of #433, S1: the server keeps the directory a little longer, 200 s,
 * so a poll rarely reads the collections again), and on Refresh (which reads again).
 * The last good answer stays on screen while a new one loads; after a failure the error is shown with it.
 */
export function useOwnerOverview(period: string, includeTestData: boolean, enabled = true): OwnerOverviewState {
  const [overview, setOverview] = useState<OwnerOverviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState<{ n: number; forced: boolean }>({ n: 0, forced: false })
  const refresh = useCallback(() => setTick((value) => ({ n: value.n + 1, forced: true })), [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoading(true)
    ownerGet<OwnerOverviewResponse>('/api/owner/overview', { period, includeTestData, refresh: tick.forced }, controller.signal)
      .then((value) => {
        setOverview(value)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not load the overview.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      setTick((value) => ({ n: value.n + 1, forced: false }))
    }, OVERVIEW_POLL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [period, includeTestData, enabled, tick])
  return { overview, error, loading, refresh }
}
