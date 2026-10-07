/** Shared TTL + in-flight dedup for org-scoped Firestore loads. */

import { authLoadRetryDelayMs, isRetryableAuthLoadError } from '@/lib/auth/authBoot'
import { captureOrganizationContext, organizationContextStillCurrent } from '@/lib/canonical'
import { waitForAuthToken } from '@/lib/firebase/waitForAuthToken'

const DEFAULT_TTL_MS = 60_000
const LOAD_ATTEMPTS = 3

type CacheEntry = {
  orgId: string | null
  loadedAt: number
  inflight: Promise<void> | null
  /** Org the in-flight promise is loading. Set before `orgId`, which is only recorded after success. */
  inflightOrgId: string | null
}

/** The loader finished without applying data. Do not cache that as a successful empty load. */
export class OrgLoadNotCached extends Error {
  constructor() {
    super('Organisation load was not applied')
    this.name = 'OrgLoadNotCached'
  }
}

const entries = new Map<string, CacheEntry>()

function getEntry(key: string): CacheEntry {
  const existing = entries.get(key)
  if (existing) return existing
  const created: CacheEntry = { orgId: null, loadedAt: 0, inflight: null, inflightOrgId: null }
  entries.set(key, created)
  return created
}

export function shouldSkipOrgLoad(
  key: string,
  organizationId: string,
  options?: { force?: boolean; ttlMs?: number }
): boolean {
  if (options?.force) return false
  const entry = getEntry(key)
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS
  if (entry.orgId !== organizationId) return false
  if (!entry.loadedAt) return false
  return Date.now() - entry.loadedAt < ttl
}

export async function runOrgLoad(
  key: string,
  organizationId: string,
  loader: () => Promise<void>,
  options?: { force?: boolean; ttlMs?: number }
): Promise<void> {
  if (shouldSkipOrgLoad(key, organizationId, options)) return

  const entry = getEntry(key)
  // `orgId` is still null while the first load is running. Join that promise anyway,
  // or a second caller starts a parallel fetch that can finish empty and replace the roster.
  if (entry.inflight && entry.inflightOrgId === organizationId && !options?.force) {
    await entry.inflight
    return
  }

  const promise = (async () => {
    const captured = captureOrganizationContext()
    let lastError: unknown
    for (let attempt = 0; attempt < LOAD_ATTEMPTS; attempt += 1) {
      try {
        await waitForAuthToken()
        await loader()
        if (!organizationContextStillCurrent(organizationId, captured)) {
          entry.loadedAt = 0
          entry.orgId = null
          return
        }
        entry.orgId = organizationId
        entry.loadedAt = Date.now()
        return
      } catch (error) {
        lastError = error
        if (error instanceof OrgLoadNotCached) return
        entry.loadedAt = 0
        if (attempt === LOAD_ATTEMPTS - 1 || !isRetryableAuthLoadError(error)) break
        await new Promise((resolve) => setTimeout(resolve, authLoadRetryDelayMs(attempt)))
      }
    }
    console.warn('Organisation data load failed:', lastError)
  })().finally(() => {
    if (entry.inflight === promise) {
      entry.inflight = null
      entry.inflightOrgId = null
    }
  })

  entry.inflight = promise
  entry.inflightOrgId = organizationId
  await promise
}

export function isOrgLoadInFlight(key: string, organizationId: string): boolean {
  const entry = entries.get(key)
  return Boolean(entry?.inflight && entry.inflightOrgId === organizationId)
}

export function invalidateOrgLoad(key: string): void {
  const entry = getEntry(key)
  entry.loadedAt = 0
  entry.orgId = null
}

/**
 * A warm load cache means "this tab already applied the snapshot", not "the store
 * still has it". After a refresh of the store module the cache can still be warm
 * while users, operatives, and projects are empty. Skipping then leaves Warnings
 * with nothing to scan. Force one fetch when this store has not applied the org.
 */
export function optionsForUnappliedOrg<T extends { force?: boolean } | undefined>(
  key: string,
  organizationId: string,
  applied: boolean,
  options: T
): T {
  if (applied || options?.force) return options
  if (!shouldSkipOrgLoad(key, organizationId, options)) return options
  return { ...(options ?? {}), force: true } as T
}
