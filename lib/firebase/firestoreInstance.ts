import type { FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

/**
 * The one Firestore instance for an app. `initializeFirestore` may run only once per app, so
 * config.ts (`db`) and ensureFirebase.ts (`getFirebaseDb`) both come through here and get the
 * same object.
 *
 * In the browser the cache persists in IndexedDB and is shared across tabs, so a refresh paints
 * from the cache and the listeners only fetch what changed. Without IndexedDB (private window,
 * blocked storage, SSR) it stays in memory; the SDK itself also falls back to memory when the
 * persistent cache fails to open.
 */
const instances = new WeakMap<FirebaseApp, Firestore>()

function canPersist(): boolean {
  try {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

export function firestoreFor(app: FirebaseApp): Firestore {
  const existing = instances.get(app)
  if (existing) return existing
  let instance: Firestore
  try {
    instance = initializeFirestore(app, {
      localCache: canPersist()
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    })
  } catch {
    // Already initialised (hot reload, or another bundle copy): reuse that instance.
    instance = getFirestore(app)
  }
  instances.set(app, instance)
  return instance
}
