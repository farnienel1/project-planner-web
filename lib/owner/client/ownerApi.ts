'use client'

import { useCallback, useEffect, useState } from 'react'
import { getClientAuthHeaders } from '@/lib/security/clientAuthHeaders'
import type { OwnerCounts } from '@/lib/owner/ownerCounts'
import type { OwnerSearchResult } from '@/lib/owner/directory'

/**
 * The server keeps directory rows for 60 s per instance and clears them on owner changes, but another instance may
 * still hold old rows. After an owner change the next directory or search request asks for fresh rows (`refresh=1`)
 * (re-review of #348).
 */
let directoryStale = false

export function markOwnerDirectoryStale(): void {
  directoryStale = true
}

/** True for the routes that read the cached directory. */
export function readsOwnerDirectory(path: string): boolean {
  return path.startsWith('/api/owner/directory/') || path === '/api/owner/search'
}

/** The query for a request: `refresh` is added once after an owner change, for the directory routes only. */
export function ownerQueryParams(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  stale: boolean
): Record<string, string | number | boolean | undefined> {
  return stale && readsOwnerDirectory(path) ? { ...params, refresh: true } : params
}

/** GET an owner route with the signed-in owner's token and the MFA cookie. Throws the route's own message. */
export async function ownerGet<T>(path: string, rawParams: Record<string, string | number | boolean | undefined> = {}, signal?: AbortSignal): Promise<T> {
  const usedStale = directoryStale && readsOwnerDirectory(path)
  const params = ownerQueryParams(path, rawParams, directoryStale)
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
  if (usedStale) directoryStale = false
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
