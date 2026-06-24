/** Shared TTL + in-flight dedup for org-scoped Firestore loads. */

const DEFAULT_TTL_MS = 60_000

type CacheEntry = {
  orgId: string | null
  loadedAt: number
  inflight: Promise<void> | null
}

const entries = new Map<string, CacheEntry>()

function getEntry(key: string): CacheEntry {
  const existing = entries.get(key)
  if (existing) return existing
  const created: CacheEntry = { orgId: null, loadedAt: 0, inflight: null }
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
  if (entry.inflight && entry.orgId === organizationId && !options?.force) {
    await entry.inflight
    return
  }

  const promise = loader()
    .then(() => {
      entry.orgId = organizationId
      entry.loadedAt = Date.now()
    })
    .finally(() => {
      if (entry.inflight === promise) entry.inflight = null
    })

  entry.inflight = promise
  await promise
}

export function invalidateOrgLoad(key: string): void {
  const entry = getEntry(key)
  entry.loadedAt = 0
  entry.orgId = null
}
