import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchingAuthUser } from './completeEmailSignIn.ts'

test('matchingAuthUser is case-insensitive and ignores surrounding space', () => {
  const user = { email: 'Ada@Company.com' } as never
  const auth = { currentUser: user }
  assert.equal(matchingAuthUser(auth, '  ada@company.com  '), user)
  assert.equal(matchingAuthUser(auth, 'other@company.com'), null)
  assert.equal(matchingAuthUser({ currentUser: null }, 'ada@company.com'), null)
})
