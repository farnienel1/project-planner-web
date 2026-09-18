import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TimeoutError } from '../client/withTimeout.ts'
import { ACCOUNT_UNCONFIRMED_MESSAGE } from '../orgSetup/accountConfirmation.ts'
import { formatLoginError } from './formatLoginError.ts'

test('unconfirmed accounts keep the confirm-email copy', () => {
  assert.equal(formatLoginError(new Error(ACCOUNT_UNCONFIRMED_MESSAGE)), ACCOUNT_UNCONFIRMED_MESSAGE)
})

test('timeouts tell the user sign-in is slow instead of blaming the password', () => {
  const message = formatLoginError(new TimeoutError('Sign in is taking too long. Try again.'))
  assert.match(message, /taking too long/i)
  assert.equal(message.includes('password'), false)
})

test('wrong password stays a generic sign-in failure', () => {
  assert.match(formatLoginError(new Error('auth/wrong-password')), /email\/password/i)
})
