import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  LOGIN_TRACKED_KEY,
  PRODUCT_SESSION_ID_KEY,
  resetAnalyticsConsentMemoryForTests,
  setAnalyticsConsent,
} from './analyticsConsent.ts'
import { endSession, maybeTrackSignedInEvents, rememberSessionId, startOrTouchSession, trackEvent } from './trackEvent.ts'

function storage(map: Map<string, string>) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  }
}

async function withBrowser<T>(local: Map<string, string>, session: Map<string, string>, run: () => Promise<T> | T) {
  const previousWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    localStorage: storage(local),
    sessionStorage: storage(session),
    location: { pathname: '/dashboard' },
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  resetAnalyticsConsentMemoryForTests()
  try {
    return await run()
  } finally {
    resetAnalyticsConsentMemoryForTests()
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = previousWindow
  }
}

test('trackEvent, sessions and login tracking are no-ops when consent is unset or denied', async () => {
  const source = readFileSync(new URL('./trackEvent.ts', import.meta.url), 'utf8')
  assert.match(source, /export async function trackEvent[\s\S]*?\{\s*if \(!hasGrantedAnalyticsConsent\(\)\) return/)
  assert.match(source, /export async function startOrTouchSession[\s\S]*?\{\s*if \(!hasGrantedAnalyticsConsent\(\)\) return null/)
  assert.match(source, /export async function endSession[\s\S]*?\{\s*if \(!hasGrantedAnalyticsConsent\(\)\) return/)
  assert.match(source, /export function maybeTrackSignedInEvents[\s\S]*?\{\s*if \(!hasGrantedAnalyticsConsent\(\)\) return/)

  for (const stored of [undefined, 'denied'] as const) {
    const local = new Map<string, string>()
    if (stored) local.set(ANALYTICS_CONSENT_STORAGE_KEY, stored)
    const session = new Map<string, string>()
    await withBrowser(local, session, async () => {
      await trackEvent('page_viewed', { userId: 'user-1', organizationId: 'org-1', metadata: { path: '/dashboard' } })
      assert.equal(await startOrTouchSession({ userId: 'user-1', organizationId: 'org-1', path: '/dashboard' }), null)
      await endSession()
      rememberSessionId('must-not-write')
      maybeTrackSignedInEvents({ userId: 'user-1', organizationId: 'org-1', email: 'sam@example.com' })
      assert.equal(session.has(PRODUCT_SESSION_ID_KEY), false)
      assert.equal(session.has(LOGIN_TRACKED_KEY), false)
    })
  }
})

test('authStore waits for granted consent before login event writes', () => {
  const auth = readFileSync(new URL('../stores/authStore.ts', import.meta.url), 'utf8')
  assert.match(auth, /maybeTrackSignedInEvents/)
  assert.equal(auth.includes("sessionStorage.setItem('pp.loginTracked'"), false)
  assert.equal(auth.includes("trackEvent('user_logged_in'"), false)
})

test('granted consent still does not write a session id until Firestore creates one', async () => {
  const local = new Map<string, string>()
  const session = new Map<string, string>()
  await withBrowser(local, session, async () => {
    setAnalyticsConsent('granted')
    assert.equal(await startOrTouchSession({ userId: 'user-1' }), null)
    assert.equal(session.has(PRODUCT_SESSION_ID_KEY), false)
  })
})
