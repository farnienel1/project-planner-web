import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TimeoutError } from '../client/withTimeout.ts'
import { formatSetupError } from './formatSetupError.ts'
import { ExistingProjectPlannerLoginError } from './existingLogin.ts'
import { LiveOrgAlreadyMemberError } from './liveOrgLookup.ts'

test('email-already-in-use is leftover login copy, not the live-org paragraph', () => {
  const message = formatSetupError({ code: 'auth/email-already-in-use', message: 'auth/email-already-in-use' })
  assert.match(message, /already has a login/i)
  assert.match(message, /Sign in, then open Set up an organisation/)
  assert.doesNotMatch(message, /already part of an organisation/i)
  assert.doesNotMatch(message, /Switch organisation/)
  assert.doesNotMatch(message, /Use the password for that login/)
})

test('legacy already-exists copy is rewritten to leftover sign-in guidance', () => {
  const message = formatSetupError({
    message: 'An account with this email already exists. Sign in instead, or use a different email.',
  })
  assert.match(message, /already has a login/i)
  assert.doesNotMatch(message, /use a different email/i)
  assert.doesNotMatch(message, /already part of an organisation/i)
})

test('wrong password on setup points at leftover sign-in, not the live-org paragraph', () => {
  const message = formatSetupError({ code: 'auth/invalid-credential' })
  assert.match(message, /already has a login/i)
  assert.doesNotMatch(message, /already part of an organisation/i)
  assert.doesNotMatch(message, /Switch organisation/)
})

test('custom existing-login error uses the Switch organisation copy', () => {
  const message = formatSetupError(new ExistingProjectPlannerLoginError({ signedIn: true, isAdmin: true }))
  assert.match(message, /Switch organisation/)
  assert.doesNotMatch(message, /Use the password/)
})

test('live-org member error uses the Settings / switch organisation paragraph', () => {
  const message = formatSetupError(new LiveOrgAlreadyMemberError())
  assert.match(message, /already part of an organisation/i)
  assert.match(message, /Settings/)
  assert.match(message, /switch organisation/i)
})

test('stale Next chunk errors tell the user to refresh and retry Activate', () => {
  const message = formatSetupError(
    new Error('Failed to load chunk /_next/static/chunks/30kjy4zzj9grr.js from module 89014')
  )
  assert.match(message, /refresh this page/i)
  assert.match(message, /Activate/)
})

test('activation timeouts surface the timed-out step instead of hanging silently', () => {
  const message = formatSetupError(
    new TimeoutError('Activation is taking too long. Refresh and try Activate again.')
  )
  assert.match(message, /taking too long/i)
  assert.match(message, /Activate/)
})

test('permission-denied mentions leftover-auth age writes, not only deploying rules', () => {
  const message = formatSetupError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })
  assert.match(message, /ageConfirmed/)
  assert.match(message, /leftover login/i)
  assert.match(message, /firestore\.rules/)
})

test('email send failures still tell the user to resend from Check your email', () => {
  const message = formatSetupError(new Error('RESEND_API_KEY is not configured'))
  assert.match(message, /organisation was created/i)
  assert.match(message, /Resend/i)
})
