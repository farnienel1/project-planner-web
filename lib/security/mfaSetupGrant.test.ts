import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  authAccountCreatedRecently,
  MFA_SETUP_GRANT_WINDOW_MS,
  mfaSetupGrantAllowed,
} from './mfaSetupGrant.ts'

const now = Date.parse('2026-10-14T09:00:00.000Z')

/** A brand-new Firebase Auth account (created a minute ago), with no other allow path. */
const denied = {
  isPlatformOwner: false,
  accountConfirmed: true,
  invitationEmailMatches: false,
  invitationIsUsed: false,
  invitationUsedAtMs: null,
  isOrgAdmin: false,
  orgCreatedAtMs: null,
  authAccountCreatedAtMs: now - 60_000,
  nowMs: now,
}

/** The same caller, but their Firebase Auth account is older than the 24-hour window. */
const oldAccount = { ...denied, authAccountCreatedAtMs: now - MFA_SETUP_GRANT_WINDOW_MS - 1 }

test('mfaSetupGrantAllowed: owner, unconfirmed, recent invite, or recent admin org on a new account', () => {
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

test('C1: the platform owner cannot skip 2FA once their Auth account is over 24 hours old', () => {
  assert.equal(mfaSetupGrantAllowed({ ...oldAccount, isPlatformOwner: true }), false)
})

test('C2: accountConfirmed false (a self-writable field) cannot skip 2FA on an old account', () => {
  assert.equal(mfaSetupGrantAllowed({ ...oldAccount, accountConfirmed: false }), false)
})

test('C3: a just-created organisation (client-written createdAt) cannot skip 2FA on an old account', () => {
  assert.equal(
    mfaSetupGrantAllowed({ ...oldAccount, isOrgAdmin: true, orgCreatedAtMs: now - 60_000 }),
    false
  )
})

test('an invitation used just now cannot skip 2FA on an old account', () => {
  assert.equal(
    mfaSetupGrantAllowed({
      ...oldAccount,
      invitationEmailMatches: true,
      invitationIsUsed: true,
      invitationUsedAtMs: now - 60_000,
    }),
    false
  )
})

test('every skip path is refused when the Auth creation time could not be read', () => {
  const unknown = { ...denied, authAccountCreatedAtMs: null }
  assert.equal(mfaSetupGrantAllowed({ ...unknown, isPlatformOwner: true }), false)
  assert.equal(mfaSetupGrantAllowed({ ...unknown, accountConfirmed: false }), false)
  assert.equal(mfaSetupGrantAllowed({ ...unknown, isOrgAdmin: true, orgCreatedAtMs: now }), false)
  assert.equal(
    mfaSetupGrantAllowed({
      ...unknown,
      invitationEmailMatches: true,
      invitationIsUsed: true,
      invitationUsedAtMs: now,
    }),
    false
  )
})

test('authAccountCreatedRecently: inside the window only; future, NaN and null refused', () => {
  assert.equal(authAccountCreatedRecently(now - MFA_SETUP_GRANT_WINDOW_MS, now), true)
  assert.equal(authAccountCreatedRecently(now - MFA_SETUP_GRANT_WINDOW_MS - 1, now), false)
  assert.equal(authAccountCreatedRecently(now + 60_000, now), false)
  assert.equal(authAccountCreatedRecently(Number.NaN, now), false)
  assert.equal(authAccountCreatedRecently(null, now), false)
})
