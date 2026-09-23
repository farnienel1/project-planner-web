import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mfaGateMatches, mfaVerifyHref, postSignOutHref, safePostMfaPath } from './mfaConstants.ts'

test('honours developer vs organisation destinations and rejects open redirects', () => {
  assert.equal(safePostMfaPath('/developer', '/dashboard'), '/developer')
  assert.equal(safePostMfaPath('/developer/account?first=1', '/dashboard'), '/developer')
  assert.equal(safePostMfaPath('/dashboard/timesheets', '/developer'), '/dashboard')
  assert.equal(safePostMfaPath('https://evil.example', '/developer'), '/developer')
  assert.equal(safePostMfaPath('', '/developer'), '/developer')
  assert.equal(safePostMfaPath('', '/dashboard'), '/dashboard')
})

test('verification gate does not match a missing uid (avoids login \u2194 MFA bounce)', () => {
  assert.equal(mfaGateMatches('uid-1', 'uid-1'), true)
  assert.equal(mfaGateMatches('uid-1', 'uid-2'), false)
  assert.equal(mfaGateMatches('uid-1', ''), false)
  assert.equal(mfaGateMatches('uid-1', null), false)
  assert.equal(mfaGateMatches('', 'uid-1'), false)
  assert.equal(mfaGateMatches(null, null), false)
})

test('developer login next is not rewritten to the organisation dashboard', () => {
  assert.equal(mfaVerifyHref('/developer'), '/auth/mfa?next=%2Fdeveloper')
  assert.equal(mfaVerifyHref('/dashboard'), '/auth/mfa?next=%2Fdashboard')
  assert.equal(postSignOutHref('/developer'), '/developer-login')
  assert.equal(postSignOutHref('/developer/organisations'), '/developer-login')
  assert.equal(postSignOutHref('/dashboard'), '/login')
})
