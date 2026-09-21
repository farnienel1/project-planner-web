import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WEB_IDLE_TIMEOUT_MS,
  WEB_IDLE_TOUCH_THROTTLE_MS,
  isWebIdleExpired,
  parseLastActivityAt,
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
