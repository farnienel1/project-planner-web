import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mintInterestUnsubscribeToken,
  normalizeInterestEmail,
  resolveInterestUnsubscribeSecret,
  resolveUnsubscribeToken,
  verifyInterestUnsubscribeToken,
} from './unsubscribeToken.ts'

test('production unsubscribe signing refuses a missing secret', () => {
  assert.throws(
    () => resolveInterestUnsubscribeSecret({ secret: '', nodeEnv: 'production' }),
    /INTEREST_UNSUBSCRIBE_SECRET is not configured/
  )
  assert.equal(
    resolveInterestUnsubscribeSecret({ secret: 'set-on-netlify', nodeEnv: 'production' }),
    'set-on-netlify'
  )
})

test('interest unsubscribe tokens round-trip and reject tampering or the wrong purpose', () => {
  const minted = mintInterestUnsubscribeToken('Ada@Example.com')
  assert.equal(minted.email, 'ada@example.com')
  assert.equal(minted.purpose, 'interest')
  assert.equal(minted.tokenId.length, 32)
  assert.deepEqual(verifyInterestUnsubscribeToken(minted.token), {
    email: 'ada@example.com',
    purpose: 'interest',
    tokenId: minted.tokenId,
  })
  assert.equal(verifyInterestUnsubscribeToken(minted.token.slice(0, -2) + 'ab'), null)
  assert.equal(verifyInterestUnsubscribeToken('not-a-token'), null)
  assert.equal(verifyInterestUnsubscribeToken(''), null)

  const [payload, sig] = minted.token.split('.')
  const tampered = Buffer.from(
    JSON.stringify({ email: 'ada@example.com', purpose: 'invite', tokenId: minted.tokenId }),
    'utf8'
  ).toString('base64url')
  assert.equal(verifyInterestUnsubscribeToken(`${tampered}.${sig}`), null)
  assert.equal(payload && sig ? true : false, true)
})

test('a raw email without a token is rejected', () => {
  assert.deepEqual(resolveUnsubscribeToken({ bodyEmail: 'ada@example.com' }), {
    ok: false,
    reason: 'email-only',
  })
  assert.deepEqual(resolveUnsubscribeToken({}), { ok: false, reason: 'missing-token' })
  assert.deepEqual(resolveUnsubscribeToken({ queryToken: 'abc.def', bodyEmail: 'ada@example.com' }), {
    ok: true,
    token: 'abc.def',
  })
})

test('emails are normalised before they become a document id', () => {
  assert.equal(normalizeInterestEmail('  Ada@Example.COM '), 'ada@example.com')
})
