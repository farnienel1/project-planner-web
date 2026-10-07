import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { CLIENT_AUTH_STORAGE, isAuthTokenStorageKey, scrubAuthTokenStorage } from './authTokenStorage.ts'
import { toPublicAuthBody } from './publicAuthBody.ts'
import { decodeAppSession, mintWebSession, privateSessionSecret, webSessionCookieOptions } from './webSession.ts'

test('auth tokens are not written to localStorage by our storage code', () => {
  const data = new Map<string, string>([
    ['firebase:authUser:abc:[DEFAULT]', '{"stsTokenManager":{"refreshToken":"leftover"}}'],
    ['firebase:persistence:abc:[DEFAULT]', 'LOCAL'],
    ['pp-theme', 'dark'],
  ])
  const storage = {
    get length() {
      return data.size
    },
    key(index: number) {
      return [...data.keys()][index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem() {
      throw new Error('auth code must not write web storage')
    },
  }
  const removed = scrubAuthTokenStorage(storage)
  assert.equal(data.has('firebase:authUser:abc:[DEFAULT]'), false)
  assert.equal(data.has('firebase:persistence:abc:[DEFAULT]'), false)
  assert.equal(data.get('pp-theme'), 'dark')
  assert.equal(removed.length, 2)
  assert.equal(isAuthTokenStorageKey('webIdleSession.lastActivityAt.v1'), false)
  assert.deepEqual(CLIENT_AUTH_STORAGE, ['indexedDB', 'memory'])

  const persistence = readFileSync(new URL('../firebase/clientAuthPersistence.ts', import.meta.url), 'utf8')
  const browser = readFileSync(new URL('./browserAuthActions.ts', import.meta.url), 'utf8')
  assert.equal(persistence.includes('localStorage.setItem'), false)
  assert.equal(persistence.includes('sessionStorage.setItem'), false)
  assert.equal(persistence.includes('browserLocalPersistence'), false)
  assert.match(persistence, /indexedDBLocalPersistence/)
  assert.match(persistence, /inMemoryPersistence/)
  assert.equal(browser.includes('localStorage.setItem'), false)
  assert.equal(browser.includes('refreshToken'), false)
})

test('public auth responses and session cookies do not carry refresh tokens', async () => {
  const previous = {
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    MFA_SIGNING_SECRET: process.env.MFA_SIGNING_SECRET,
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  }
  process.env.AUTH_SESSION_SECRET = 'unit-test-session-secret'
  delete process.env.MFA_SIGNING_SECRET
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'client-firebase-key'
  try {
    const body = toPublicAuthBody({
      ok: true,
      refreshToken: 'should-not-leave-the-server',
      idToken: 'should-not-leave-the-server',
      password: 'should-not-leave-the-server',
    })
    assert.deepEqual(body, { ok: true })

    const minted = await mintWebSession({
      idToken: 'id-token-value',
      uid: 'user-1',
      email: 'ada@example.com',
      emailVerified: true,
    })
    assert.ok(minted)
    assert.equal(minted.value.includes('id-token-value'), false)
    assert.equal(minted.value.includes('refresh'), false)
    const decoded = decodeAppSession(minted.value, 'unit-test-session-secret')
    assert.equal(decoded?.uid, 'user-1')
    assert.equal(decoded?.email, 'ada@example.com')
    assert.equal(Object.prototype.hasOwnProperty.call(decoded, 'refreshToken'), false)
    assert.equal(decodeAppSession(`${minted.value}x`, 'unit-test-session-secret'), null)

    const options = webSessionCookieOptions(minted.maxAgeSec, true)
    assert.equal(options.httpOnly, true)
    assert.equal(options.secure, true)
    assert.equal(options.sameSite, 'lax')

    process.env.AUTH_SESSION_SECRET = 'client-firebase-key'
    assert.equal(privateSessionSecret(), null)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
