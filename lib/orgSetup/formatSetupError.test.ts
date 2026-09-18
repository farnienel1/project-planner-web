import { test } from 'node:test'
import assert from 'node:assert/strict'
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
