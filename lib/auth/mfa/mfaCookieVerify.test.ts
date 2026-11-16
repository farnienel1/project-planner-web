import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeSigned } from './mfaCookies.ts'
import { mfaOkAllowsDashboard, verifySignedMfaOk } from './mfaCookieVerify.ts'

test('mfaOkAllowsDashboard needs a uid and a future exp', () => {
  const now = 1_000_000
  assert.equal(mfaOkAllowsDashboard({ kind: 'ok', uid: 'u1', exp: now + 1 }, now), true)
  assert.equal(mfaOkAllowsDashboard({ kind: 'ok', uid: 'u1', exp: now }, now), false)
  assert.equal(mfaOkAllowsDashboard({ kind: 'ok', uid: '', exp: now + 1 }, now), false)
  assert.equal(mfaOkAllowsDashboard(null, now), false)
})

test('verifySignedMfaOk accepts a node-signed cookie and rejects junk, tamper, and expiry', async () => {
  const now = Date.now()
  const valid = encodeSigned({ kind: 'ok', uid: 'u1', exp: now + 60_000 })
  assert.deepEqual(await verifySignedMfaOk(valid, now), { uid: 'u1', exp: now + 60_000 })
  assert.equal(await verifySignedMfaOk('anything', now), null)
  assert.equal(await verifySignedMfaOk(valid.slice(0, -2) + 'ab', now), null)
  const expired = encodeSigned({ kind: 'ok', uid: 'u1', exp: now - 1 })
  assert.equal(await verifySignedMfaOk(expired, now), null)
})

test('review #340: a signed challenge cookie is never an MFA ok cookie', async () => {
  const now = Date.now()
  const challenge = encodeSigned({
    kind: 'challenge',
    uid: 'u1',
    email: 'a@example.com',
    codeHash: 'h',
    exp: now + 60_000,
    attempts: 0,
    lastSentAt: now,
  })
  assert.equal(await verifySignedMfaOk(challenge, now), null)
  assert.equal(mfaOkAllowsDashboard({ kind: 'challenge', uid: 'u1', exp: now + 1 }, now), false)
})

test('review #340: a challenge from before the purpose field (no kind) is refused as ok too', async () => {
  const now = Date.now()
  const legacyChallenge = encodeSigned({ uid: 'u1', email: 'a@example.com', codeHash: 'h', exp: now + 60_000, attempts: 0, lastSentAt: now })
  assert.equal(await verifySignedMfaOk(legacyChallenge, now), null)
  const legacyOk = encodeSigned({ uid: 'u1', exp: now + 60_000 })
  assert.equal(await verifySignedMfaOk(legacyOk, now), null)
  assert.equal(mfaOkAllowsDashboard({ uid: 'u1', exp: now + 1 }, now), false)
})
