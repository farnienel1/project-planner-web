import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientSafeMessage } from './sanitize.ts'

test('clientSafeMessage redacts secret-looking tokens', () => {
  assert.equal(
    clientSafeMessage(new Error('bad key sk_live_abc123XYZ and re_abc123'), 'fallback'),
    'bad key [redacted] and [redacted]'
  )
  assert.equal(clientSafeMessage(new Error('a'.repeat(400)), 'fallback'), 'fallback')
  assert.equal(clientSafeMessage('nope', 'fallback'), 'fallback')
})
