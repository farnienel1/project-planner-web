import assert from 'node:assert/strict'
import test from 'node:test'
import { emailSuppressionCreateBody, isInterestEmailSuppressed } from './suppressionStore.ts'

test('suppression documents store email, source, tokenId and createdAt', () => {
  const createdAt = new Date('2026-10-16T12:00:00.000Z')
  const { fields } = emailSuppressionCreateBody(
    { email: 'Ada@Example.com', source: 'interest', tokenId: 'token-1' },
    createdAt
  )
  assert.equal((fields.email as { stringValue: string }).stringValue, 'ada@example.com')
  assert.equal((fields.source as { stringValue: string }).stringValue, 'interest')
  assert.equal((fields.tokenId as { stringValue: string }).stringValue, 'token-1')
  assert.equal((fields.createdAt as { timestampValue: string }).timestampValue, createdAt.toISOString())
})

test('suppression check skips on 404, skips sending on a stored row, and fails closed on a read error', async () => {
  const previousHost = process.env.FIRESTORE_EMULATOR_HOST
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes(encodeURIComponent('missing@example.com'))) return new Response('', { status: 404 })
    if (url.includes(encodeURIComponent('down@example.com'))) throw new Error('network down')
    return new Response(
      JSON.stringify({
        fields: {
          email: { stringValue: 'ada@example.com' },
          source: { stringValue: 'interest' },
          tokenId: { stringValue: 't1' },
          createdAt: { timestampValue: '2026-10-16T12:00:00.000Z' },
        },
      }),
      { status: 200 }
    )
  }) as typeof fetch
  try {
    assert.equal(await isInterestEmailSuppressed('missing@example.com'), false)
    assert.equal(await isInterestEmailSuppressed('ada@example.com'), true)
    assert.equal(await isInterestEmailSuppressed('down@example.com'), true)
  } finally {
    globalThis.fetch = originalFetch
    if (previousHost === undefined) delete process.env.FIRESTORE_EMULATOR_HOST
    else process.env.FIRESTORE_EMULATOR_HOST = previousHost
  }
})

test('manual source is a distinct stored value', () => {
  const { fields } = emailSuppressionCreateBody({
    email: 'ada@example.com',
    source: 'manual',
    tokenId: 'owner',
  })
  assert.equal((fields.source as { stringValue: string }).stringValue, 'manual')
})
