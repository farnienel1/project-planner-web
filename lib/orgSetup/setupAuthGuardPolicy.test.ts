import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shouldSendUnconfirmedFounderToCheckEmail } from './setupAuthGuardPolicy'

test('unconfirmed founder stays on the setup wizard so Stripe can open', () => {
  assert.equal(
    shouldSendUnconfirmedFounderToCheckEmail({ accountConfirmed: false, path: '/setup' }),
    false
  )
  assert.equal(
    shouldSendUnconfirmedFounderToCheckEmail({ accountConfirmed: false, path: '/setup/' }),
    false
  )
  assert.equal(
    shouldSendUnconfirmedFounderToCheckEmail({ accountConfirmed: false, path: '/setup?cancelled=1' }),
    false
  )
})

test('unconfirmed founder still goes to check-email off the wizard', () => {
  assert.equal(
    shouldSendUnconfirmedFounderToCheckEmail({ accountConfirmed: false, path: '/dashboard' }),
    true
  )
  assert.equal(
    shouldSendUnconfirmedFounderToCheckEmail({ accountConfirmed: false, path: '/setup/success' }),
    true
  )
})

test('confirmed accounts are never sent to check-email by this rule', () => {
  assert.equal(
    shouldSendUnconfirmedFounderToCheckEmail({ accountConfirmed: true, path: '/setup' }),
    false
  )
  assert.equal(
    shouldSendUnconfirmedFounderToCheckEmail({ accountConfirmed: undefined, path: '/dashboard' }),
    false
  )
})
