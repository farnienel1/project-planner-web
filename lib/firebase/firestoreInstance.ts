import type { FirebaseApp } from 'firebase/app'
import { getFirestore, initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore'

/**
 * The one Firestore instance for an app. `initializeFirestore` may run only once per app, so
 * config.ts (`db`) and ensureFirebase.ts (`getFirebaseDb`) both come through here and get the
 * same object.
 *
 * Memory cache only. A persistent IndexedDB cache was tried (rulebook 1.0.0, Nov 2026) and made
 * sign-in slow: at start-up the SDK serves every listener from the on-disk cache first, on one
 * queue, so with thousands of cached bookings the users/{uid} read that sign-in waits for took
 * ~5.4 s instead of ~0.3–1 s (browser benchmark against the emulator) and tripped its 3.5 s
 * timeout. Refresh speed comes from bounded booking listeners (`bookingLoadStart`) instead.
 */
const instances = new WeakMap<FirebaseApp, Firestore>()

export function firestoreFor(app: FirebaseApp): Firestore {
  const existing = instances.get(app)
  if (existing) return existing
  let instance: Firestore
  try {
    instance = initializeFirestore(app, { localCache: memoryLocalCache() })
  } catch {
    // Already initialised (hot reload, or another bundle copy): reuse that instance.
    instance = getFirestore(app)
  }
  instances.set(app, instance)
  scheduleOldCacheCleanup()
  return instance
}

let cleanupScheduled = false

/**
 * Delete the IndexedDB databases the earlier persistent cache left in this browser (`firestore/…`).
 * Best effort, once per page, after start-up; the memory cache never opens them. A tab still
 * running the old build keeps its database open, so the delete simply waits or is skipped.
 */
function scheduleOldCacheCleanup(): void {
  if (cleanupScheduled || typeof window === 'undefined') return
  cleanupScheduled = true
  window.setTimeout(() => {
    try {
      const idb = window.indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }
      if (!idb || typeof idb.databases !== 'function') return
      void idb
        .databases()
        .then((list) => {
          for (const entry of list) {
            if (entry.name && entry.name.startsWith('firestore/')) idb.deleteDatabase(entry.name)
          }
        })
        .catch(() => undefined)
    } catch {
      /* Storage blocked: nothing to clean. */
    }
  }, 10_000)
}
