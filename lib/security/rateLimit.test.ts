import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit, resetRateLimitForTests } from './rateLimit.ts'

test('rateLimit allows up to the window cap then blocks', () => {
  resetRateLimitForTests()
  assert.equal(rateLimit('test:ip', 2, 60_000).ok, true)
  assert.equal(rateLimit('test:ip', 2, 60_000).ok, true)
  assert.equal(rateLimit('test:ip', 2, 60_000).ok, false)
  assert.equal(rateLimit('test:other', 2, 60_000).ok, true)
})
