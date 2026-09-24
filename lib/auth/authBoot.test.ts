import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TimeoutError } from '../client/withTimeout.ts'
import {
  authLoadRetryDelayMs,
  isRetryableAuthLoadError,
  shouldHoldSignedOutCallback,
} from './authBoot.ts'

test('a null auth callback is ignored until persistence settles or a user is restored', () => {
  assert.equal(shouldHoldSignedOutCallback({ authReady: false, hasCurrentUser: false }), true)
  assert.equal(shouldHoldSignedOutCallback({ authReady: true, hasCurrentUser: true }), true)
  assert.equal(shouldHoldSignedOutCallback({ authReady: true, hasCurrentUser: false }), false)
})

test('first-login Firestore races are retried, real profile errors are not', () => {
  assert.equal(isRetryableAuthLoadError({ code: 'permission-denied' }), true)
  assert.equal(isRetryableAuthLoadError({ code: 'firestore/unavailable' }), true)
  assert.equal(isRetryableAuthLoadError({ code: 'auth/network-request-failed' }), true)
  assert.equal(isRetryableAuthLoadError(new TimeoutError('Sign in is taking too long.')), true)
  assert.equal(isRetryableAuthLoadError(new Error('Could not parse your user profile.')), false)
  assert.ok(authLoadRetryDelayMs(0) < authLoadRetryDelayMs(2))
})
