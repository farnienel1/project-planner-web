import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEmailInUseError,
  isExistingAccountSignInError,
  shouldAttemptCreateUserAfterSignInFailure,
} from './authSetupErrors.ts'

test('detects Firebase email-already-in-use by code', () => {
  assert.equal(isEmailInUseError({ code: 'auth/email-already-in-use' }), true)
})

test('detects the previous setup copy about an existing email', () => {
  assert.equal(
    isEmailInUseError({
      message: 'An account with this email already exists. Sign in instead, or use a different email.',
    }),
    true
  )
})

test('detects Firebase already-in-use sentence without a code', () => {
  assert.equal(
    isEmailInUseError(new Error('Firebase: The email address is already in use by another account.')),
    true
  )
})

test('wrong password is treated as an existing-account sign-in problem', () => {
  assert.equal(isExistingAccountSignInError({ code: 'auth/invalid-credential' }), true)
  assert.equal(isEmailInUseError({ code: 'auth/invalid-credential' }), false)
})

test('failed sign-in may still be a new email, so createUser is worth trying', () => {
  assert.equal(shouldAttemptCreateUserAfterSignInFailure({ code: 'auth/invalid-credential' }), true)
  assert.equal(shouldAttemptCreateUserAfterSignInFailure({ code: 'auth/user-not-found' }), true)
  assert.equal(shouldAttemptCreateUserAfterSignInFailure({ code: 'auth/email-already-in-use' }), false)
})
