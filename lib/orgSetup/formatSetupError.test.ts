import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TimeoutError } from '../client/withTimeout.ts'
import { formatSetupError } from './formatSetupError.ts'

test('email-already-in-use tells the user they can add another organisation after sign-in', () => {
  const message = formatSetupError({ code: 'auth/email-already-in-use', message: 'auth/email-already-in-use' })
  assert.match(message, /already has a Project Planner account/i)
  assert.match(message, /add another/)
  assert.match(message, /as many organisations/i)
})

test('legacy already-exists copy is rewritten to the same guidance', () => {
  const message = formatSetupError({
    message: 'An account with this email already exists. Sign in instead, or use a different email.',
  })
  assert.match(message, /already has a Project Planner account/i)
  assert.doesNotMatch(message, /use a different email/i)
})

test('wrong password on setup points at using the existing login', () => {
  const message = formatSetupError({ code: 'auth/invalid-credential' })
  assert.match(message, /password for that login/)
  assert.match(message, /add another/)
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

test('email send failures still tell the user to resend from Check your email', () => {
  const message = formatSetupError(new Error('RESEND_API_KEY is not configured'))
  assert.match(message, /organisation was created/i)
  assert.match(message, /Resend/i)
})
