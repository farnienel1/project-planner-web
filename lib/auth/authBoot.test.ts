import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TimeoutError } from '../client/withTimeout.ts'
import {
  authLoadRetryDelayMs,
  authProfileLoadErrorMessage,
  isRetryableAuthLoadError,
  shouldHoldSignedOutCallback,
} from './authBoot.ts'

test('a null auth callback is ignored until persistence settles or a user is restored', () => {
  assert.equal(shouldHoldSignedOutCallback({ authReady: false, hasCurrentUser: false }), true)
  assert.equal(shouldHoldSignedOutCallback({ authReady: true, hasCurrentUser: true }), true)
  assert.equal(shouldHoldSignedOutCallback({ authReady: true, hasCurrentUser: false }), false)
})

test('profile load keeps a Firestore-shaped error that is not an Error instance', () => {
  assert.equal(
    authProfileLoadErrorMessage({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }),
    'Missing or insufficient permissions.'
  )
  assert.equal(
    authProfileLoadErrorMessage('not-an-error'),
    'Could not load your user profile from Firestore.'
  )
})

test('first-login Firestore races are retried, real profile errors are not', () => {
  assert.equal(isRetryableAuthLoadError({ code: 'permission-denied' }), true)
  assert.equal(isRetryableAuthLoadError({ code: 'firestore/unavailable' }), true)
  assert.equal(isRetryableAuthLoadError({ code: 'auth/network-request-failed' }), true)
  assert.equal(isRetryableAuthLoadError(new TimeoutError('Sign in is taking too long.')), true)
  assert.equal(isRetryableAuthLoadError(new Error('Could not parse your user profile.')), false)
  assert.ok(authLoadRetryDelayMs(0) < authLoadRetryDelayMs(2))
})
