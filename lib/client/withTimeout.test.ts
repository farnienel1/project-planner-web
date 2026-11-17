import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TimeoutError,
  isTimeoutError,
  withAbortTimeout,
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

// Review of #371: an invite email that times out is cancelled, not left running.

test('withAbortTimeout: aborts the work and rejects with a timeout error when time is up', async () => {
  let aborted = false
  await assert.rejects(
    withAbortTimeout(
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true
            reject(new Error('AbortError'))
          })
        }),
      10,
      'too slow'
    ),
    (error: unknown) => isTimeoutError(error) && /too slow/.test(String(error))
  )
  assert.equal(aborted, true)
})

test('withAbortTimeout: work done in time is returned and never aborted', async () => {
  let signalSeen: AbortSignal | null = null
  const value = await withAbortTimeout(
    async (signal) => {
      signalSeen = signal
      return 7
    },
    50,
    'too slow'
  )
  assert.equal(value, 7)
  await new Promise((r) => setTimeout(r, 70))
  assert.equal((signalSeen as AbortSignal | null)?.aborted, false)
})
