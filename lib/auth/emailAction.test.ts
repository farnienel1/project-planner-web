import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatPasswordResetError,
  isPasswordResetAction,
  loginPathForResetEmail,
  minPasswordLengthForEmail,
  parseEmailActionSearch,
} from './emailAction.ts'

function search(entries: Record<string, string>) {
  return {
    get(name: string) {
      return entries[name] ?? null
    },
  }
}

test('parseEmailActionSearch reads Firebase reset-password links', () => {
  const action = parseEmailActionSearch(
    search({
      mode: 'resetPassword',
      oobCode: 'abc123',
      continueUrl: 'https://www.projectplanner.us/developer-login',
    })
  )
  assert.equal(action.mode, 'resetPassword')
  assert.equal(action.oobCode, 'abc123')
  assert.equal(isPasswordResetAction(action), true)
})

test('owner reset returns to developer login', () => {
  assert.equal(loginPathForResetEmail('info@projectplanner.us'), '/developer-login')
  assert.equal(minPasswordLengthForEmail('Info@ProjectPlanner.us'), 10)
  assert.equal(loginPathForResetEmail('user@contractor.com'), '/login')
  assert.equal(minPasswordLengthForEmail('user@contractor.com'), 8)
})

test('expired action codes are explained in plain language', () => {
  assert.match(formatPasswordResetError({ code: 'auth/expired-action-code', message: 'expired' }), /expired/i)
  assert.match(formatPasswordResetError({ code: 'auth/invalid-action-code', message: 'invalid' }), /already been used/i)
})
