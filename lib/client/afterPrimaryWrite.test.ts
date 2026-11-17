import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterPrimaryWrite } from './afterPrimaryWrite.ts'

// Owner bug 17 Nov: a save's best-effort secondary write never holds the screen and never throws.

test('returns at once even when the secondary write never answers', () => {
  const started = Date.now()
  afterPrimaryWrite('notice', new Promise(() => {}))
  assert.ok(Date.now() - started < 50)
})

test('a refused secondary write is reported to onError, never thrown', async () => {
  const seen: unknown[] = []
  afterPrimaryWrite('notice', Promise.reject(new Error('Missing or insufficient permissions.')), (error) => seen.push(error))
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(seen.length, 1)
  assert.match(String(seen[0]), /insufficient permissions/)
})

test('a throwing onError is contained (no unhandled rejection)', async () => {
  afterPrimaryWrite('notice', Promise.reject(new Error('x')), () => {
    throw new Error('handler')
  })
  await new Promise((r) => setTimeout(r, 5))
})
