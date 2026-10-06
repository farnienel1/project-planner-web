import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WEB_IDLE_TIMEOUT_MS,
  WEB_IDLE_TOUCH_THROTTLE_MS,
  clearWebIdleActivity,
  isWebIdleExpired,
  noteWebIdleActivity,
  parseLastActivityAt,
  readWebIdleLastActivity,
  replayIdleSession,
  shouldTouchActivity,
} from './webIdleSession.ts'

test('parseLastActivityAt reads unix ms and rejects junk', () => {
  assert.equal(parseLastActivityAt(null), null)
  assert.equal(parseLastActivityAt(''), null)
  assert.equal(parseLastActivityAt('nope'), null)
  assert.equal(parseLastActivityAt('0'), null)
  assert.equal(parseLastActivityAt('1710000000000'), 1710000000000)
})

test('idle is false until 30 minutes have passed since last click', () => {
  const last = 1_000_000
  assert.equal(isWebIdleExpired(last, last), false)
  assert.equal(isWebIdleExpired(last + WEB_IDLE_TIMEOUT_MS - 1, last), false)
  assert.equal(isWebIdleExpired(last + WEB_IDLE_TIMEOUT_MS, last), true)
  assert.equal(isWebIdleExpired(last + WEB_IDLE_TIMEOUT_MS + 60_000, last), true)
})

test('a missing stamp is not treated as idle so a first restore can start the clock', () => {
  assert.equal(isWebIdleExpired(Date.now(), null), false)
})

test('activity writes are throttled so clicks do not hammer storage', () => {
  const last = 5_000_000
  assert.equal(shouldTouchActivity(last, last), false)
  assert.equal(shouldTouchActivity(last + WEB_IDLE_TOUCH_THROTTLE_MS - 1, last), false)
  assert.equal(shouldTouchActivity(last + WEB_IDLE_TOUCH_THROTTLE_MS, last), true)
  assert.equal(shouldTouchActivity(last, null), true)
})

test('activity before 30 minutes does not sign out at the login deadline', () => {
  const loginAt = 1_000_000
  const activityAt = loginAt + 25 * 60 * 1000
  const stillUsing = replayIdleSession(
    [
      { at: loginAt, type: 'login' },
      { at: activityAt, type: 'activity' },
    ],
    loginAt + WEB_IDLE_TIMEOUT_MS
  )
  assert.equal(stillUsing.signedOut, false)
  assert.equal(stillUsing.lastActivityAt, activityAt)
  assert.equal(isWebIdleExpired(activityAt + WEB_IDLE_TIMEOUT_MS - 1, activityAt), false)
  assert.equal(isWebIdleExpired(activityAt + WEB_IDLE_TIMEOUT_MS, activityAt), true)
})

test('30 minutes without activity signs out', () => {
  const loginAt = 1_000_000
  const idle = replayIdleSession([{ at: loginAt, type: 'login' }], loginAt + WEB_IDLE_TIMEOUT_MS)
  assert.equal(idle.signedOut, true)
  assert.equal(idle.lastActivityAt, loginAt)
  const justBefore = replayIdleSession([{ at: loginAt, type: 'login' }], loginAt + WEB_IDLE_TIMEOUT_MS - 1)
  assert.equal(justBefore.signedOut, false)
})

test('activity inside the storage throttle still moves the idle deadline', () => {
  const local = new Map<string, string>()
  const session = new Map<string, string>()
  const previous = globalThis.window
  const storage = (bucket: Map<string, string>) => ({
    getItem: (key: string) => (bucket.has(key) ? bucket.get(key)! : null),
    setItem: (key: string, value: string) => {
      bucket.set(key, value)
    },
    removeItem: (key: string) => {
      bucket.delete(key)
    },
  })
  globalThis.window = {
    localStorage: storage(local),
    sessionStorage: storage(session),
  } as unknown as Window & typeof globalThis
  try {
    clearWebIdleActivity()
    const loginAt = 5_000_000
    noteWebIdleActivity(loginAt)
    const activityAt = loginAt + 1_000
    noteWebIdleActivity(activityAt)
    const last = readWebIdleLastActivity()
    assert.equal(last, activityAt)
    assert.equal(isWebIdleExpired(loginAt + WEB_IDLE_TIMEOUT_MS, last), false)
    assert.equal(isWebIdleExpired(activityAt + WEB_IDLE_TIMEOUT_MS - 1, last), false)
    assert.equal(isWebIdleExpired(activityAt + WEB_IDLE_TIMEOUT_MS, last), true)
  } finally {
    clearWebIdleActivity()
    if (previous === undefined) {
      delete (globalThis as { window?: unknown }).window
    } else {
      globalThis.window = previous
    }
  }
})
