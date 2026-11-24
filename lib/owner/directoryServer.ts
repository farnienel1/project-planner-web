/**
 * Server side of the owner directory: reads `organizations` and `users` with the owner's own ID token over Firestore
 * REST (the security rules let the verified owner read them) and turns them into rows. Nothing is sent to the browser
 * but the page it asked for (PLAN A1: no full collection downloads in the browser).
 */
import { firestoreListCollection, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { DIRECTORY_SCAN_CAP, ownerOrgRows, ownerPeopleRows, type OwnerOrgRow, type OwnerPersonRow, type PlainDoc } from '@/lib/owner/directory'

export type OwnerDirectoryData = {
  orgRows: OwnerOrgRow[]
  peopleRows: OwnerPersonRow[]
  /** True when a collection reached DIRECTORY_SCAN_CAP: the page says so instead of hiding the rest. */
  truncated: boolean
  /** Documents read on the server for this request (shown in the PR's before/after read counts). */
  documentsRead: number
}

async function readAll(token: string, collection: string): Promise<PlainDoc[]> {
  const rows = await firestoreListCollection(token, collection, DIRECTORY_SCAN_CAP)
  return rows.map((row) => ({ id: row.id, data: restFieldsToPlain(row.fields) }))
}

/**
 * Review of #348 (M1): the built rows are kept for OWNER_DIRECTORY_CACHE_MS in this server process, so a burst of
 * searches or page turns reads the collections once, not once per request. Only the platform owner reaches these
 * routes (the guard runs first), so the cache never serves anyone else. Owner actions that change a person or an
 * organisation clear it (`clearOwnerDirectoryCache`); `refresh: true` reads again.
 */
/**
 * Review of #433 (S1): a little longer than the Overview's 180-second poll, so an open Overview tab reads the
 * collections at most once per server cache life instead of on almost every poll (each read lists every organisation
 * and users document).
 */
export const OWNER_DIRECTORY_CACHE_MS = 200_000

type CacheEntry<T> = { at: number; value: Promise<T> }
let orgCache: CacheEntry<Omit<OwnerDirectoryData, 'peopleRows'>> | null = null
let directoryCache: CacheEntry<OwnerDirectoryData> | null = null

export function clearOwnerDirectoryCache(): void {
  orgCache = null
  directoryCache = null
}

function fresh<T>(entry: CacheEntry<T> | null, nowMs: number): entry is CacheEntry<T> {
  return Boolean(entry && nowMs - entry.at < OWNER_DIRECTORY_CACHE_MS)
}

export type OwnerDirectoryRead<T> = T & { cachedAt: string; fromCache: boolean }

async function cached<T>(
  get: () => CacheEntry<T> | null,
  put: (entry: CacheEntry<T> | null) => void,
  build: () => Promise<T>,
  options: { refresh?: boolean; nowMs?: number }
): Promise<OwnerDirectoryRead<T>> {
  const now = options.nowMs ?? Date.now()
  const existing = get()
  if (!options.refresh && fresh(existing, now)) {
    return { ...(await existing.value), cachedAt: new Date(existing.at).toISOString(), fromCache: true }
  }
  const entry: CacheEntry<T> = { at: now, value: build() }
  put(entry)
  try {
    const value = await entry.value
    return { ...value, cachedAt: new Date(now).toISOString(), fromCache: false }
  } catch (error) {
    // A failed read is never kept.
    if (get() === entry) put(null)
    throw error
  }
}

export async function loadOwnerOrganisations(token: string, options: { refresh?: boolean; nowMs?: number } = {}) {
  return cached(
    () => orgCache,
    (entry) => {
      orgCache = entry
    },
    async () => {
      const docs = await readAll(token, 'organizations')
      return { orgRows: ownerOrgRows(docs, options.nowMs ?? Date.now()), truncated: docs.length >= DIRECTORY_SCAN_CAP, documentsRead: docs.length }
    },
    options
  )
}

export async function loadOwnerDirectory(token: string, options: { refresh?: boolean; nowMs?: number } = {}) {
  return cached(
    () => directoryCache,
    (entry) => {
      directoryCache = entry
    },
    async () => {
      const [orgDocs, userDocs] = await Promise.all([readAll(token, 'organizations'), readAll(token, 'users')])
      const orgRows = ownerOrgRows(orgDocs, options.nowMs ?? Date.now())
      return {
        orgRows,
        peopleRows: ownerPeopleRows(userDocs, orgRows, orgDocs),
        truncated: orgDocs.length >= DIRECTORY_SCAN_CAP || userDocs.length >= DIRECTORY_SCAN_CAP,
        documentsRead: orgDocs.length + userDocs.length,
      }
    },
    options
  )
}
