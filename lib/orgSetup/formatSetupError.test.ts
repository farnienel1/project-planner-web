import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatSetupError } from './formatSetupError.ts'

test('email-already-in-use tells the user they can add another organisation after sign-in', () => {
  const message = formatSetupError({ code: 'auth/email-already-in-use', message: 'auth/email-already-in-use' })
  assert.match(message, /already has a Project Planner account/i)
  assert.match(message, /Set up a new organisation/)
  assert.match(message, /as many organisations/i)
})

test('wrong password on setup points at signing in rather than creating a second login', () => {
  const message = formatSetupError({ code: 'auth/invalid-credential' })
  assert.match(message, /existing password/)
  assert.match(message, /Change organisation/)
})
