import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MFA_SETUP_GRANT_WINDOW_MS, mfaSetupGrantAllowed } from './mfaSetupGrant.ts'

const now = Date.parse('2026-10-14T09:00:00.000Z')

const denied = {
  isPlatformOwner: false,
  accountConfirmed: true,
  invitationEmailMatches: false,
  invitationIsUsed: false,
  invitationUsedAtMs: null,
  isOrgAdmin: false,
  orgCreatedAtMs: null,
  nowMs: now,
}

test('mfaSetupGrantAllowed: owner, unconfirmed, recent invite, or recent admin org', () => {
  assert.equal(mfaSetupGrantAllowed({ ...denied, isPlatformOwner: true }), true)
  assert.equal(mfaSetupGrantAllowed({ ...denied, accountConfirmed: false }), true)
  assert.equal(
    mfaSetupGrantAllowed({
      ...denied,
      invitationEmailMatches: true,
      invitationIsUsed: true,
      invitationUsedAtMs: now - 60_000,
    }),
    true
  )
  assert.equal(
    mfaSetupGrantAllowed({
      ...denied,
      isOrgAdmin: true,
      orgCreatedAtMs: now - 60_000,
    }),
    true
  )
})

test('mfaSetupGrantAllowed: stale invite or old company cannot skip 2FA', () => {
  assert.equal(mfaSetupGrantAllowed(denied), false)
  assert.equal(
    mfaSetupGrantAllowed({
      ...denied,
      invitationEmailMatches: true,
      invitationIsUsed: true,
      invitationUsedAtMs: now - MFA_SETUP_GRANT_WINDOW_MS - 1,
    }),
    false
  )
  assert.equal(
    mfaSetupGrantAllowed({
      ...denied,
      isOrgAdmin: true,
      orgCreatedAtMs: now - MFA_SETUP_GRANT_WINDOW_MS - 1,
    }),
    false
  )
  assert.equal(
    mfaSetupGrantAllowed({
      ...denied,
      invitationEmailMatches: false,
      invitationIsUsed: true,
      invitationUsedAtMs: now,
    }),
    false
  )
})
