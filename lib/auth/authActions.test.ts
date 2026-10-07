import { test } from 'node:test'
import assert from 'node:assert/strict'

import { handleEmailSignIn, type AuthDeps } from './authActions.ts'
import { AUTH_FAILURE_WINDOW_MS, resetCredentialRateLimitForTests } from './credentialRateLimit.ts'
import { checkNewPassword } from './passwordPolicy.ts'

const REFRESH = 'refresh-token-value'

function deps(partial: Partial<AuthDeps> & Pick<AuthDeps, 'signInWithPassword'>): AuthDeps {
  return {
    now: () => Date.now(),
    signUp: async () => {
      throw new Error('sign-up is not part of login')
    },
    sendReset: async () => ({ ok: true }),
    confirmReset: async () => ({ ok: true }),
    updatePassword: async () => ({ ok: true }),
    lookupIdToken: async () => null,
    mintSession: async () => ({ value: 'http-only-session', maxAgeSec: 60 }),
    ...partial,
  }
}

test('login allows a weak existing password and rate limits repeated failures', async () => {
  resetCredentialRateLimitForTests()
  assert.equal(checkNewPassword('password').ok, false)

  const allowed = await handleEmailSignIn(
    { email: 'weak@example.com', password: 'password', ip: '192.0.2.10' },
    deps({
      signInWithPassword: async () => ({
        ok: true,
        localId: 'uid-1',
        email: 'weak@example.com',
        idToken: 'id-token-value',
        refreshToken: REFRESH,
      }),
    })
  )
  assert.equal(allowed.status, 200)
  assert.equal(allowed.body.ok, true)
  assert.equal(allowed.body.refreshToken, undefined)
  assert.equal(allowed.body.idToken, undefined)
  assert.equal(JSON.stringify(allowed.body).includes(REFRESH), false)
  assert.notEqual(allowed.cookie?.value, REFRESH)

  let now = 1_700_000_000_000
  let calls = 0
  const failing = deps({
    now: () => now,
    signInWithPassword: async () => {
      calls += 1
      return { ok: false, code: 'INVALID_PASSWORD' }
    },
  })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await handleEmailSignIn({ email: 'ada@example.com', password: 'nope', ip: '192.0.2.11' }, failing)
    assert.equal(failed.status, 401)
  }
  assert.equal(calls, 5)
  const blocked = await handleEmailSignIn({ email: 'ada@example.com', password: 'nope', ip: '192.0.2.11' }, failing)
  assert.equal(blocked.status, 429)
  assert.match(String(blocked.body.error), /Too many failed attempts/)
  assert.equal(calls, 5)

  const otherAccount = await handleEmailSignIn(
    { email: 'other@example.com', password: 'later', ip: '198.51.100.20' },
    deps({
      now: () => now,
      signInWithPassword: async () => ({
        ok: true,
        localId: 'uid-2',
        email: 'other@example.com',
        idToken: 'id',
        refreshToken: REFRESH,
      }),
    })
  )
  assert.equal(otherAccount.status, 200)

  now += AUTH_FAILURE_WINDOW_MS + 1
  calls = 0
  const later = await handleEmailSignIn(
    { email: 'ada@example.com', password: 'correct-existing', ip: '192.0.2.11' },
    deps({
      now: () => now,
      signInWithPassword: async () => {
        calls += 1
        return { ok: true, localId: 'uid-1', email: 'ada@example.com', idToken: 'id', refreshToken: REFRESH }
      },
    })
  )
  assert.equal(later.status, 200)
  assert.equal(calls, 1)
  assert.equal(later.body.refreshToken, undefined)

  resetCredentialRateLimitForTests()
  now = 1_700_000_000_000
  const mixed = deps({
    now: () => now,
    signInWithPassword: async (_email, password) => {
      if (password === 'correct-existing') {
        return { ok: true, localId: 'uid-1', email: 'ada@example.com', idToken: 'id', refreshToken: REFRESH }
      }
      return { ok: false, code: 'INVALID_PASSWORD' }
    },
  })
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.equal((await handleEmailSignIn({ email: 'ada@example.com', password: 'nope', ip: '192.0.2.12' }, mixed)).status, 401)
  }
  assert.equal((await handleEmailSignIn({ email: 'ada@example.com', password: 'correct-existing', ip: '192.0.2.12' }, mixed)).status, 200)
  assert.equal((await handleEmailSignIn({ email: 'ada@example.com', password: 'correct-existing', ip: '192.0.2.12' }, mixed)).status, 200)
})
