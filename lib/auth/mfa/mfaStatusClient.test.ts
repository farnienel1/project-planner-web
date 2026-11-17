import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { isMfaStatusUnavailable, mfaStatusRetryDelayMs, readMfaStatus, readMfaStatusWithRetry } from './mfaClient.ts'

/** The browser treats a 503 (or no network) from the status route as "try again", never as "not verified". */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function stubStatus(answers: Array<number | 'network'>) {
  let calls = 0
  globalThis.fetch = (async () => {
    const answer = answers[Math.min(calls, answers.length - 1)]
    calls += 1
    if (answer === 'network') throw new TypeError('fetch failed')
    if (answer === 503) return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 })
    return new Response(JSON.stringify({ pending: false, verified: true, next: '/dashboard' }), { status: answer })
  }) as typeof fetch
  return () => calls
}

test('readMfaStatus: a 503 throws "unavailable" instead of returning verified:false', async () => {
  stubStatus([503])
  await assert.rejects(readMfaStatus(), (error) => isMfaStatusUnavailable(error))
})

test('readMfaStatus: no network throws "unavailable"', async () => {
  stubStatus(['network'])
  await assert.rejects(readMfaStatus(), (error) => isMfaStatusUnavailable(error))
})

test('readMfaStatus: a 200 is read as before', async () => {
  stubStatus([200])
  assert.deepEqual(await readMfaStatus(), { pending: false, verified: true, next: '/dashboard' })
})

test('readMfaStatusWithRetry: retries 503s and returns the first real answer', async () => {
  const calls = stubStatus([503, 503, 200])
  const waits: number[] = []
  const status = await readMfaStatusWithRetry(5, async (ms) => {
    waits.push(ms)
  })
  assert.equal(status.verified, true)
  assert.equal(calls(), 3)
  assert.deepEqual(waits, [1000, 2000])
})

test('readMfaStatusWithRetry: stops after the given attempts (no endless loop) and rethrows "unavailable"', async () => {
  const calls = stubStatus([503])
  await assert.rejects(
    readMfaStatusWithRetry(3, async () => {}),
    (error) => isMfaStatusUnavailable(error)
  )
  assert.equal(calls(), 3)
})

test('mfaStatusRetryDelayMs backs off and is capped at 15s', () => {
  assert.equal(mfaStatusRetryDelayMs(0), 1000)
  assert.equal(mfaStatusRetryDelayMs(3), 8000)
  assert.equal(mfaStatusRetryDelayMs(10), 15000)
})
