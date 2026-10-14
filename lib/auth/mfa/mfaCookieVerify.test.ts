import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeSigned } from './mfaCookies.ts'
import { mfaOkAllowsDashboard, verifySignedMfaOk } from './mfaCookieVerify.ts'

test('mfaOkAllowsDashboard needs a uid and a future exp', () => {
  const now = 1_000_000
  assert.equal(mfaOkAllowsDashboard({ uid: 'u1', exp: now + 1 }, now), true)
  assert.equal(mfaOkAllowsDashboard({ uid: 'u1', exp: now }, now), false)
  assert.equal(mfaOkAllowsDashboard({ uid: '', exp: now + 1 }, now), false)
  assert.equal(mfaOkAllowsDashboard(null, now), false)
})

test('verifySignedMfaOk accepts a node-signed cookie and rejects junk, tamper, and expiry', async () => {
  const now = Date.now()
  const valid = encodeSigned({ uid: 'u1', exp: now + 60_000 })
  assert.deepEqual(await verifySignedMfaOk(valid, now), { uid: 'u1', exp: now + 60_000 })
  assert.equal(await verifySignedMfaOk('anything', now), null)
  assert.equal(await verifySignedMfaOk(valid.slice(0, -2) + 'ab', now), null)
  const expired = encodeSigned({ uid: 'u1', exp: now - 1 })
  assert.equal(await verifySignedMfaOk(expired, now), null)
})
