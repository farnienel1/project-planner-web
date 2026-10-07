import type { FirebaseApp } from 'firebase/app'
import { getAuth, indexedDBLocalPersistence, initializeAuth, inMemoryPersistence, type Auth } from 'firebase/auth'

import { scrubAuthTokenStorage } from '@/lib/auth/authTokenStorage'

function alreadyInitialized(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
  return code.includes('already-initialized')
}

/**
 * Browser auth uses IndexedDB, then memory. localStorage and sessionStorage
 * are not in the persistence list. Any Firebase auth blob already sitting in
 * those stores is removed before Auth starts.
 */
export function installWebAuth(app: FirebaseApp): Auth {
  if (typeof window === 'undefined') return getAuth(app)
  scrubAuthTokenStorage(window.localStorage)
  scrubAuthTokenStorage(window.sessionStorage)
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, inMemoryPersistence],
    })
  } catch (error) {
    if (alreadyInitialized(error)) return getAuth(app)
    throw error
  }
}
