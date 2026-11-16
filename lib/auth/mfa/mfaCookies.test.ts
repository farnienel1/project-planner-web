import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  codesMatch,
  decodeMfaChallenge,
  decodeMfaOk,
  decodeSigned,
  encodeMfaOk,
  encodeSigned,
  hashMfaCode,
  resolveMfaSigningSecret,
} from './mfaCookies.ts'

test('production MFA refuses to sign without MFA_SIGNING_SECRET', () => {
  assert.throws(
    () => resolveMfaSigningSecret({ secret: '', nodeEnv: 'production' }),
    /MFA_SIGNING_SECRET is not configured/
  )
  assert.equal(resolveMfaSigningSecret({ secret: 'set-on-netlify', nodeEnv: 'production' }), 'set-on-netlify')
})

test('non-production MFA does not fall back to the public Firebase key', () => {
  assert.equal(resolveMfaSigningSecret({ secret: '', nodeEnv: 'development' }), 'project-planner-mfa-dev')
})


test('signed MFA cookies round-trip and reject tampering', () => {
  const token = encodeSigned({ uid: 'u1', exp: 123 })
  assert.deepEqual(decodeSigned<{ uid: string; exp: number }>(token), { uid: 'u1', exp: 123 })
  assert.equal(decodeSigned(token.slice(0, -2) + 'ab'), null)
})

test('code hashes compare in constant time', () => {
  const hash = hashMfaCode('123456', 'u1')
  assert.equal(codesMatch(hash, hashMfaCode('123456', 'u1')), true)
  assert.equal(codesMatch(hash, hashMfaCode('000000', 'u1')), false)
  assert.equal(codesMatch(hash, hashMfaCode('123456', 'u2')), false)
})

test('review #340: decodeMfaOk accepts only an ok cookie for the given time', () => {
  const now = Date.now()
  const ok = encodeMfaOk('u1', now + 60_000)
  assert.deepEqual(decodeMfaOk(ok, now), { kind: 'ok', uid: 'u1', exp: now + 60_000 })
  assert.equal(decodeMfaOk(encodeMfaOk('u1', now - 1), now), null)
  const challenge = encodeSigned({ kind: 'challenge', uid: 'u1', email: 'a@example.com', codeHash: 'h', exp: now + 60_000, attempts: 0, lastSentAt: now })
  assert.equal(decodeMfaOk(challenge, now), null)
  assert.equal(decodeMfaOk(encodeSigned({ uid: 'u1', exp: now + 60_000 }), now), null)
})

test('review #340: an ok cookie can never be used as a challenge', () => {
  const now = Date.now()
  assert.equal(decodeMfaChallenge(encodeMfaOk('u1', now + 60_000)), null)
  assert.equal(decodeMfaChallenge(encodeSigned({ uid: 'u1', exp: now + 60_000, codeHash: 'h', email: 'a@example.com' })), null)
  const challenge = { kind: 'challenge', uid: 'u1', email: 'a@example.com', codeHash: 'h', exp: now + 60_000, attempts: 0, lastSentAt: now }
  assert.deepEqual(decodeMfaChallenge(encodeSigned(challenge)), challenge)
})

test('owner console PR 1: an ok cookie carries iat when given, and only then', () => {
  const now = Date.now()
  assert.deepEqual(decodeMfaOk(encodeMfaOk('u1', now + 60_000, now - 5), now), { kind: 'ok', uid: 'u1', exp: now + 60_000, iat: now - 5 })
  assert.equal('iat' in (decodeMfaOk(encodeMfaOk('u1', now + 60_000), now) || {}), false)
})
