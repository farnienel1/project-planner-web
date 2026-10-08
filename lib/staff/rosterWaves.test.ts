import assert from 'node:assert/strict'
import test from 'node:test'
import {
  catalogueRowNeedsRead,
  explicitAccountIds,
  rosterLoadFailure,
  shouldRetryRosterLoad,
} from './rosterWaves.ts'

function firestoreError(code: string): Error {
  const error = new Error(`Firestore: ${code}`)
  Object.assign(error, { code })
  return error
}

test('explicit account ids come from any of the catalogue id fields, trimmed and de-duplicated', () => {
  assert.deepEqual(explicitAccountIds({}), [])
  assert.deepEqual(explicitAccountIds({ userId: ' u1 ', uid: 'u1', linkedUserId: 'u2', userID: '' }), ['u1', 'u2'])
  assert.deepEqual(explicitAccountIds({ userId: 42, email: 'x@y.z' }), [])
})

test('a retryable users-query failure re-runs the whole load, except on the final attempt', () => {
  const denied = firestoreError('permission-denied')
  assert.equal(shouldRetryRosterLoad({ usersQueryFailure: denied, finalAttempt: false }), true)
  assert.equal(shouldRetryRosterLoad({ usersQueryFailure: denied, finalAttempt: true }), false)
  assert.equal(shouldRetryRosterLoad({ usersQueryFailure: firestoreError('unauthenticated'), finalAttempt: false }), true)
  assert.equal(shouldRetryRosterLoad({ usersQueryFailure: null, finalAttempt: false }), false)
  assert.equal(
    shouldRetryRosterLoad({ usersQueryFailure: firestoreError('invalid-argument'), finalAttempt: false }),
    false
  )
})

test('an empty roster surfaces the first real failure so the retry can see its code', () => {
  const denied = firestoreError('permission-denied')
  assert.equal(rosterLoadFailure({ collectedCount: 0, complete: false, firstFailure: denied }), denied)
  const generic = rosterLoadFailure({ collectedCount: 0, complete: false, firstFailure: 'boom' })
  assert.equal(generic?.message, 'Failed to load users')
  assert.equal(rosterLoadFailure({ collectedCount: 0, complete: false, firstFailure: null })?.message, 'Failed to load users')
})

test('a roster with people, or a complete empty company, is not a failure', () => {
  assert.equal(rosterLoadFailure({ collectedCount: 3, complete: false, firstFailure: new Error('x') }), null)
  assert.equal(rosterLoadFailure({ collectedCount: 0, complete: true, firstFailure: null }), null)
})

test('catalogue rows naming an account are still read when the first wave was complete', () => {
  assert.equal(catalogueRowNeedsRead({ complete: true, data: { name: 'Pat' } }), false)
  assert.equal(catalogueRowNeedsRead({ complete: true, data: { userId: 'u9' } }), true)
  assert.equal(catalogueRowNeedsRead({ complete: false, data: { name: 'Pat' } }), true)
})
