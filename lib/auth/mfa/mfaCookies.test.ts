import { test } from 'node:test'
import assert from 'node:assert/strict'
import { codesMatch, decodeSigned, encodeSigned, hashMfaCode, resolveMfaSigningSecret } from './mfaCookies.ts'

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
