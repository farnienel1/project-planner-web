'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  MAX_STORED_PUSH_TOKENS,
  tokenSuffix,
  isTerminalPushTokenFailure,
  nextStoredPushTokens,
  tokensToRemoveAfterSend,
} = require('./prunePushTokens')

// Live sendEach failures — suffixes only. Never print the full tokens.
const DEAD_APNS_A = `dead-token-nRdb68cBqg`
const DEAD_APNS_B = `dead-token-uVbSMai8lA`
const LIVE = 'live-token-accepted01'

test('two invalid + one valid token leaves only the accepted token', () => {
  const stored = [DEAD_APNS_A, LIVE, DEAD_APNS_B]
  const responses = [
    { success: false, error: { message: 'Invalid APNs credential' } },
    { success: true, messageId: 'ok' },
    { success: false, error: { code: 'messaging/invalid-registration-token', message: 'Invalid registration token' } },
  ]
  assert.deepEqual(nextStoredPushTokens(stored, responses), [LIVE])
  assert.deepEqual(tokensToRemoveAfterSend(stored, responses), [DEAD_APNS_A, DEAD_APNS_B])
})

test('unregistered is also dropped; a non-terminal error is kept', () => {
  const quota = 'keep-quota-token'
  const stored = [DEAD_APNS_A, quota, LIVE]
  const responses = [
    { success: false, error: { message: 'Requested entity was not found. UNREGISTERED' } },
    { success: false, error: { code: 'messaging/quota-exceeded', message: 'Quota exceeded' } },
    { success: true },
  ]
  assert.deepEqual(nextStoredPushTokens(stored, responses), [quota, LIVE])
})

test('one terminal failure does not replace the stored array with []', () => {
  const stored = [LIVE, DEAD_APNS_A]
  const responses = [
    { success: true },
    { success: false, error: { message: 'Invalid APNs credential' } },
  ]
  const next = nextStoredPushTokens(stored, responses)
  assert.deepEqual(next, [LIVE])
  assert.notDeepEqual(next, [])
})

test('terminal matcher covers the three sendEach codes and ignores network noise', () => {
  assert.equal(isTerminalPushTokenFailure({ message: 'Invalid APNs credential' }), true)
  assert.equal(isTerminalPushTokenFailure({ code: 'messaging/registration-token-not-registered' }), true)
  assert.equal(isTerminalPushTokenFailure({ message: 'Invalid registration token' }), true)
  assert.equal(isTerminalPushTokenFailure({ message: 'The network connection was lost.' }), false)
})

test('suffix helper never returns more than the last 10 characters', () => {
  assert.equal(tokenSuffix(DEAD_APNS_A), 'nRdb68cBqg')
  assert.equal(tokenSuffix(DEAD_APNS_B), 'uVbSMai8lA')
  assert.ok(tokenSuffix(DEAD_APNS_A).length <= 10)
})

test('cap stays at the iOS write limit without dropping an accepted token under the cap', () => {
  assert.equal(MAX_STORED_PUSH_TOKENS, 8)
  const many = Array.from({ length: 10 }, (_, i) => `older-token-${i}`)
  many[2] = DEAD_APNS_A
  const responses = many.map((token) =>
    token === DEAD_APNS_A
      ? { success: false, error: { message: 'Invalid APNs credential' } }
      : { success: true }
  )
  const next = nextStoredPushTokens(many, responses)
  assert.equal(next.includes(DEAD_APNS_A), false)
  assert.ok(next.length <= 8)
})
