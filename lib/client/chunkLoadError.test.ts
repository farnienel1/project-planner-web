import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isChunkLoadError } from './chunkLoadError.ts'

test('detects Next/Turbopack failed-to-load-chunk errors', () => {
  assert.equal(
    isChunkLoadError(new Error('Failed to load chunk /_next/static/chunks/30kjy4zzj9grr.js from module 89014')),
    true
  )
  assert.equal(isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 123 failed' }), true)
  assert.equal(isChunkLoadError(new Error('Permission denied')), false)
})
