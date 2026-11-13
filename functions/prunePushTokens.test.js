'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  MAX_STORED_PUSH_TOKENS,
  tokenSuffix,
  isTerminalPushTokenFailure,
  isCredentialPushFailure,
  sendFailureSummaries,
  pruneDeadPushTokens,
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
    { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'Requested entity was not found.' } },
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
    { success: false, error: { code: 'messaging/invalid-registration-token' } },
  ]
  const next = nextStoredPushTokens(stored, responses)
  assert.deepEqual(next, [LIVE])
  assert.notDeepEqual(next, [])
})

test('terminal matcher covers the token-level codes and ignores network noise', () => {
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
      ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
      : { success: true }
  )
  const next = nextStoredPushTokens(many, responses)
  assert.equal(next.includes(DEAD_APNS_A), false)
  assert.ok(next.length <= 8)
})

test('project-level credential failures never prune a token', () => {
  const credentialErrors = [
    { message: 'Invalid APNs credential' },
    { code: 'messaging/third-party-auth-error', message: 'Auth error from APNS or Web Push Service' },
    { code: 'messaging/mismatched-credential', message: 'SenderId mismatch' },
    { code: 'messaging/invalid-apns-credentials' },
    { errorInfo: { code: 'messaging/third-party-auth-error', message: 'x' } },
  ]
  for (const error of credentialErrors) {
    assert.equal(isCredentialPushFailure(error), true, JSON.stringify(error))
    assert.equal(isTerminalPushTokenFailure(error), false, JSON.stringify(error))
  }
  const stored = [DEAD_APNS_A, LIVE, DEAD_APNS_B]
  const responses = stored.map(() => ({ success: false, error: { code: 'messaging/third-party-auth-error' } }))
  assert.deepEqual(tokensToRemoveAfterSend(stored, responses), [])
  assert.deepEqual(nextStoredPushTokens(stored, responses), stored)
})

test('invalid-argument prunes only when it is about the registration token', () => {
  assert.equal(
    isTerminalPushTokenFailure({ code: 'messaging/invalid-argument', message: 'The registration token is not a valid FCM registration token' }),
    true
  )
  assert.equal(isTerminalPushTokenFailure({ code: 'messaging/invalid-argument', message: 'Invalid JSON payload received.' }), false)
})

test('failure summaries carry suffix and code only, never the full token', () => {
  const rows = sendFailureSummaries(
    [LIVE, DEAD_APNS_A],
    [{ success: true }, { success: false, error: { code: 'messaging/third-party-auth-error', message: 'Auth error' } }]
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].tokenSuffix, 'nRdb68cBqg')
  assert.equal(rows[0].code, 'messaging/third-party-auth-error')
  assert.equal(rows[0].credentialProblem, true)
  assert.equal(rows[0].pruned, false)
  assert.equal(JSON.stringify(rows).includes(DEAD_APNS_A), false)
})

test('a credential failure is logged as an error and writes nothing', async () => {
  const errors = []
  let writes = 0
  const db = { doc: () => ({ update: async () => { writes++ } }) }
  const logger = { error: (...args) => errors.push(args), info: () => {} }
  const removed = await pruneDeadPushTokens({
    db,
    userId: 'u1',
    tokens: [DEAD_APNS_A],
    responses: [{ success: false, error: { message: 'Invalid APNs credential' } }],
    logger,
  })
  assert.deepEqual(removed, [])
  assert.equal(writes, 0)
  assert.equal(errors.length, 1)
  assert.match(errors[0][0], /PUSH CREDENTIAL ERROR/)
})
