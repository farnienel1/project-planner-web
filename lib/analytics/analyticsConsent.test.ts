import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  LOGIN_TRACKED_KEY,
  PRODUCT_SESSION_ID_KEY,
  clearAnalyticsConsent,
  clearProductAnalyticsRuntime,
  getAnalyticsConsent,
  hasGrantedAnalyticsConsent,
  resetAnalyticsConsentMemoryForTests,
  setAnalyticsConsent,
} from './analyticsConsent.ts'

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

function withBrowser(local: Map<string, string>, session: Map<string, string>, run: () => void) {
  const previousWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    localStorage: storage(local),
    sessionStorage: storage(session),
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  resetAnalyticsConsentMemoryForTests()
  try {
    run()
  } finally {
    resetAnalyticsConsentMemoryForTests()
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = previousWindow
  }
}

test('analytics consent is stored as granted or denied and is unset until chosen', () => {
  assert.equal(ANALYTICS_CONSENT_STORAGE_KEY, 'pp.analyticsConsent.v1')
  const local = new Map<string, string>()
  const session = new Map<string, string>()
  withBrowser(local, session, () => {
    assert.equal(getAnalyticsConsent(), null)
    assert.equal(hasGrantedAnalyticsConsent(), false)
    setAnalyticsConsent('granted')
    assert.equal(getAnalyticsConsent(), 'granted')
    assert.equal(hasGrantedAnalyticsConsent(), true)
    assert.equal(local.get(ANALYTICS_CONSENT_STORAGE_KEY), 'granted')
    setAnalyticsConsent('denied')
    assert.equal(getAnalyticsConsent(), 'denied')
    assert.equal(hasGrantedAnalyticsConsent(), false)
    assert.equal(local.get(ANALYTICS_CONSENT_STORAGE_KEY), 'denied')
    clearAnalyticsConsent()
    assert.equal(getAnalyticsConsent(), null)
    assert.equal(local.has(ANALYTICS_CONSENT_STORAGE_KEY), false)
  })
})

test('invalid stored consent is treated as unset', () => {
  const local = new Map<string, string>([[ANALYTICS_CONSENT_STORAGE_KEY, 'yes']])
  withBrowser(local, new Map(), () => {
    assert.equal(getAnalyticsConsent(), null)
    assert.equal(hasGrantedAnalyticsConsent(), false)
  })
})

test('reject and clear remove product session and login-tracked keys', () => {
  const local = new Map<string, string>()
  const session = new Map<string, string>([
    [PRODUCT_SESSION_ID_KEY, 'sess-1'],
    [LOGIN_TRACKED_KEY, '1'],
  ])
  withBrowser(local, session, () => {
    setAnalyticsConsent('denied')
    assert.equal(session.has(PRODUCT_SESSION_ID_KEY), false)
    assert.equal(session.has(LOGIN_TRACKED_KEY), false)
    session.set(PRODUCT_SESSION_ID_KEY, 'sess-2')
    session.set(LOGIN_TRACKED_KEY, '1')
    clearAnalyticsConsent()
    assert.equal(session.has(PRODUCT_SESSION_ID_KEY), false)
    assert.equal(session.has(LOGIN_TRACKED_KEY), false)
    session.set(PRODUCT_SESSION_ID_KEY, 'sess-3')
    clearProductAnalyticsRuntime()
    assert.equal(session.has(PRODUCT_SESSION_ID_KEY), false)
  })
})

test('consent helpers do not throw without window', () => {
  const previousWindow = (globalThis as { window?: unknown }).window
  delete (globalThis as { window?: unknown }).window
  resetAnalyticsConsentMemoryForTests()
  try {
    assert.equal(getAnalyticsConsent(), null)
    assert.equal(hasGrantedAnalyticsConsent(), false)
    setAnalyticsConsent('granted')
    clearAnalyticsConsent()
    clearProductAnalyticsRuntime()
  } finally {
    resetAnalyticsConsentMemoryForTests()
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = previousWindow
  }
})
