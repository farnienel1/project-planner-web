/**
 * Web auth must not keep session, refresh, ID, or custom tokens in
 * localStorage or sessionStorage. Firebase client persistence is IndexedDB,
 * with an in-memory fallback when IndexedDB is unavailable.
 */
export const CLIENT_AUTH_STORAGE = ['indexedDB', 'memory'] as const

const TOKEN_KEY_PREFIXES = ['firebase:authUser', 'firebase:persistence']

export function isAuthTokenStorageKey(key: string): boolean {
  return TOKEN_KEY_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))
}

type WebStorageLike = {
  length: number
  key: (index: number) => string | null
  removeItem: (key: string) => void
}

/** Drop leftover Firebase auth blobs. Does not write a replacement token. */
export function scrubAuthTokenStorage(storage: WebStorageLike | null | undefined): string[] {
  if (!storage) return []
  const removed: string[] = []
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (!key || !isAuthTokenStorageKey(key)) continue
    storage.removeItem(key)
    removed.push(key)
  }
  return removed
}
