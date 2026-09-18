import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TimeoutError,
  isTimeoutError,
  withTimeout,
  withTimeoutFallback,
} from './withTimeout.ts'

test('withTimeout resolves when the work finishes in time', async () => {
  const value = await withTimeout(Promise.resolve(7), 100, 'too slow')
  assert.equal(value, 7)
})

test('withTimeout rejects with TimeoutError when the work never finishes', async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 20, 'too slow'),
    (error: unknown) => error instanceof TimeoutError && error.message === 'too slow'
  )
})

test('isTimeoutError recognises TimeoutError', () => {
  assert.equal(isTimeoutError(new TimeoutError('slow')), true)
  assert.equal(isTimeoutError(new Error('other')), false)
})

test('withTimeoutFallback returns the fallback instead of throwing', async () => {
  const value = await withTimeoutFallback(new Promise<number>(() => {}), 20, 3)
  assert.equal(value, 3)
})
