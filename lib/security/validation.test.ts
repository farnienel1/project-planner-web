import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampString, isStripeCheckoutSessionId, isValidEmail, isValidUuid } from './validation.ts'

test('isValidEmail accepts typical addresses and rejects junk', () => {
  assert.equal(isValidEmail('user@example.com'), true)
  assert.equal(isValidEmail('  USER@Example.COM  '), true)
  assert.equal(isValidEmail('not-an-email'), false)
  assert.equal(isValidEmail('a'.repeat(250) + '@x.com'), false)
})

test('isValidUuid accepts canonical and uppercase iOS-style IDs', () => {
  assert.equal(isValidUuid('550e8400-e29b-41d4-a716-446655440000'), true)
  assert.equal(isValidUuid('550E8400-E29B-41D4-A716-446655440000'), true)
  assert.equal(isValidUuid('not-a-uuid'), false)
  assert.equal(isValidUuid('550e8400e29b41d4a716446655440000'), false)
})

test('isStripeCheckoutSessionId only allows Stripe session ids', () => {
  assert.equal(isStripeCheckoutSessionId('cs_test_abc123XYZ'), true)
  assert.equal(isStripeCheckoutSessionId('cs_live_abc123XYZ'), true)
  assert.equal(isStripeCheckoutSessionId('sess_123'), false)
})

test('clampString trims and rejects empty or oversized values', () => {
  assert.equal(clampString('  hello  ', 10), 'hello')
  assert.equal(clampString('', 10), null)
  assert.equal(clampString('hello-world', 5), null)
  assert.equal(clampString(12, 10), null)
})
