import { test } from 'node:test'
import assert from 'node:assert/strict'

import { handleEmailSignUp, handlePasswordChange, type AuthDeps } from './authActions.ts'
import { resetCredentialRateLimitForTests } from './credentialRateLimit.ts'
import {
  PASSWORD_BREACH_TEXT,
  PASSWORD_RULE_TEXT,
  checkNewPassword,
  validateNewPassword,
} from './passwordPolicy.ts'

const STRONG = 'Orbit-Quartz-Plann3r!'

function deps(partial: Partial<AuthDeps> = {}): AuthDeps {
  return {
    now: () => Date.now(),
    signInWithPassword: async () => {
      throw new Error('sign-in should not run')
    },
    signUp: async () => {
      throw new Error('sign-up should not run')
    },
    sendReset: async () => ({ ok: true }),
    confirmReset: async () => ({ ok: true }),
    updatePassword: async () => ({ ok: true }),
    lookupIdToken: async () => ({ uid: 'user-1', email: 'ada@example.com', emailVerified: true }),
    mintSession: async () => null,
    breachLookup: async () => 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1',
    ...partial,
  }
}

test('password policy rejects weak new passwords and accepts a strong one', async () => {
  assert.equal(checkNewPassword('password').ok, false)
  assert.equal(checkNewPassword('alllowercase1!').ok, false)
  assert.equal(checkNewPassword('ALLUPPERCASE1!').ok, false)
  assert.equal(checkNewPassword('NoDigits!!!!!!').ok, false)
  assert.equal(checkNewPassword('NoSymbol123456').ok, false)
  const common = checkNewPassword('Password123!')
  assert.equal(common.ok, false)
  if (!common.ok) assert.match(common.message, /too common/i)

  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(STRONG)))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  const leaked = await validateNewPassword(STRONG, async (prefix) => {
    assert.equal(prefix, hash.slice(0, 5))
    assert.equal(prefix.length, 5)
    return `${hash.slice(5)}:4`
  })
  assert.equal(leaked.ok, false)
  if (!leaked.ok) assert.equal(leaked.message, PASSWORD_BREACH_TEXT)

  const skipped = await validateNewPassword(STRONG, async () => {
    throw new Error('ENOTFOUND api.pwnedpasswords.com')
  })
  assert.equal(skipped.ok, true)
  if (skipped.ok) assert.equal(skipped.breachCheck, 'skipped')

  const clear = await validateNewPassword(STRONG, async () => 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1')
  assert.equal(clear.ok, true)

  resetCredentialRateLimitForTests()
  let signUps = 0
  const weak = await handleEmailSignUp(
    { email: 'new@example.com', password: 'password', ip: '192.0.2.40' },
    deps()
  )
  assert.equal(weak.status, 400)
  if (weak.status === 400) assert.equal(weak.body.error, PASSWORD_RULE_TEXT)
  assert.equal(signUps, 0)

  const created = await handleEmailSignUp(
    { email: 'new@example.com', password: STRONG, ip: '192.0.2.41' },
    deps({
      signUp: async () => {
        signUps += 1
        return { ok: true, localId: 'uid', email: 'new@example.com', idToken: 'id', refreshToken: 'refresh-token-value' }
      },
    })
  )
  assert.equal(created.status, 200)
  assert.equal(created.body.refreshToken, undefined)
  assert.equal(signUps, 1)

  let checks = 0
  let updates = 0
  const rejected = await handlePasswordChange(
    { idToken: 'token', currentPassword: 'password', nextPassword: 'password', ip: '192.0.2.42' },
    deps({
      signInWithPassword: async () => {
        checks += 1
        return { ok: true, localId: 'uid', email: 'ada@example.com', idToken: 'id', refreshToken: 'refresh-token-value' }
      },
    })
  )
  assert.equal(rejected.status, 400)
  assert.equal(checks, 0)

  const changed = await handlePasswordChange(
    { idToken: 'token', currentPassword: 'password', nextPassword: STRONG, ip: '192.0.2.43' },
    deps({
      signInWithPassword: async () => {
        checks += 1
        return { ok: true, localId: 'uid', email: 'ada@example.com', idToken: 'id', refreshToken: 'refresh-token-value' }
      },
      updatePassword: async () => {
        updates += 1
        return { ok: true }
      },
    })
  )
  assert.equal(changed.status, 200)
  assert.equal(checks, 1)
  assert.equal(updates, 1)
  assert.equal(changed.body.refreshToken, undefined)
})
