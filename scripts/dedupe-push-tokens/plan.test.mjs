import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { keepNewestPlan, mergeRemovals, storedTokenList, storedValuesMatching, tokenSuffix, validationMessage, validationResult } from './plan.mjs'

const require = createRequire(import.meta.url)
const { isTerminalPushTokenFailure, isCredentialPushFailure } = require('../../functions/prunePushTokens.js')
const rules = { isTerminal: isTerminalPushTokenFailure, isCredential: isCredentialPushFailure }

test('push token clean-up: stored order kept, duplicates and blanks dropped, values exactly as stored', () => {
  assert.deepEqual(storedTokenList(['  a ', 'b', 'a', '', null, 'c']), ['  a ', 'b', 'c'])
  assert.deepEqual(storedTokenList('single'), ['single'])
  assert.deepEqual(storedTokenList(undefined), [])
  assert.equal(tokenSuffix('x'.repeat(30) + '0123456789'), '0123456789')
})

test('push token clean-up: the dry-run message names only the token and carries no text', () => {
  assert.deepEqual(validationMessage('t1'), { token: 't1', data: { pushTokenCheck: '1' } })
})

test('push token clean-up: only tokens FCM rejects as dead are removed', () => {
  const tokens = ['live', 'gone', 'bad', 'busy']
  const responses = [
    { success: true },
    { success: false, error: { code: 'messaging/registration-token-not-registered' } },
    { success: false, error: { code: 'messaging/invalid-registration-token' } },
    { success: false, error: { code: 'messaging/server-unavailable' } },
  ]
  assert.deepEqual(validationResult(tokens, responses, rules), {
    dead: ['gone', 'bad'],
    otherFailures: ['busy'],
    credentialProblem: false,
  })
})

test('push token clean-up: a credential failure is flagged and never counted as a dead token', () => {
  const tokens = ['a', 'b']
  const responses = [
    { success: false, error: { code: 'messaging/third-party-auth-error' } },
    { success: false, error: { code: 'messaging/registration-token-not-registered' } },
  ]
  const result = validationResult(tokens, responses, rules)
  assert.equal(result.credentialProblem, true)
  assert.deepEqual(result.dead, ['b'])
})

test('push token clean-up: invalid-argument about the payload is not a dead token', () => {
  const result = validationResult(
    ['a'],
    [{ success: false, error: { code: 'messaging/invalid-argument', message: 'Invalid JSON payload' } }],
    rules
  )
  assert.deepEqual(result.dead, [])
  assert.deepEqual(result.otherFailures, ['a'])
})

test('push token clean-up: --keep-newest keeps the first stored token only', () => {
  assert.deepEqual(keepNewestPlan(['newest', 'b', 'c', 'newest']), { keep: ['newest'], remove: ['b', 'c'] })
  assert.deepEqual(keepNewestPlan(['only']), { keep: ['only'], remove: [] })
  assert.deepEqual(keepNewestPlan([]), { keep: [], remove: [] })
})

test('push token clean-up: removals for one document are merged without repeats', () => {
  let planned = new Map()
  planned = mergeRemovals(planned, 'u1', ['a', 'b'])
  planned = mergeRemovals(planned, 'u1', ['b', 'c'])
  planned = mergeRemovals(planned, 'u2', [])
  assert.deepEqual([...planned.entries()], [['u1', ['a', 'b', 'c']]])
})

test('push token clean-up: removals name the exact stored strings (arrayRemove matches exactly)', () => {
  const stored = [' tok ', 'tok', 'other', 7]
  assert.deepEqual(storedValuesMatching(stored, ['tok']), [' tok ', 'tok'])
  assert.deepEqual(storedValuesMatching(stored, [' other']), ['other'])
  assert.deepEqual(storedValuesMatching(stored, []), [])
  const planned = mergeRemovals(new Map(), 'u1', storedValuesMatching(stored, ['tok']))
  assert.deepEqual(planned.get('u1'), [' tok ', 'tok'])
})
