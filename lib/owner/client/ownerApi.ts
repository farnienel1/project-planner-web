'use client'

import { useCallback, useEffect, useState } from 'react'
import { getClientAuthHeaders } from '@/lib/security/clientAuthHeaders'
import type { OwnerCounts } from '@/lib/owner/ownerCounts'
import type { OwnerSearchResult } from '@/lib/owner/directory'

/** GET an owner route with the signed-in owner's token and the MFA cookie. Throws the route's own message. */
export async function ownerGet<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}, signal?: AbortSignal): Promise<T> {
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
  return data
}

export type OwnerCountsState = { counts: OwnerCounts | null; error: string | null; loading: boolean; refresh: () => void }

/** Headline counts (spec §2: when the page opens, then every 60 s, plus refresh). */
export function useOwnerCounts(includeTestData: boolean, enabled = true): OwnerCountsState {
  const [counts, setCounts] = useState<OwnerCounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((value) => value + 1), [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoading(true)
    ownerGet<OwnerCounts>('/api/owner/counts', { includeTestData }, controller.signal)
      .then((value) => {
        setCounts(value)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not load the counts.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [includeTestData, enabled, tick])
  return { counts, error, loading, refresh }
}

export async function ownerSearchRequest(q: string, includeTestData: boolean, signal?: AbortSignal): Promise<OwnerSearchResult> {
  return ownerGet<OwnerSearchResult>('/api/owner/search', { q, includeTestData }, signal)
}
