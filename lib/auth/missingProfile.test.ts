import assert from 'node:assert/strict'
import test from 'node:test'
import { MISSING_USER_PROFILE_MESSAGE } from './missingProfile.ts'

test('1.31.1: a stuck invitee is pointed to their invitation email', () => {
  assert.match(MISSING_USER_PROFILE_MESSAGE, /open the invitation email and finish setting up your account from its link/)
})
