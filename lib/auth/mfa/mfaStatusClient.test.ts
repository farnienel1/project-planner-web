import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isMfaSetupError,
  isMfaStatusUnavailable,
  MFA_BOUNCE_LIMIT,
  MFA_BOUNCE_WINDOW_MS,
  mfaBounceDecision,
  mfaStatusRetryDelayMs,
  readMfaStatus,
  readMfaStatusWithRetry,
} from './mfaClient.ts'

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

/** Review of #359, item 2: a server setup error is its own answer, never "trying again" and never retried. */
test('readMfaStatus: a 503 setup error throws MfaSetupError, and the retry helper does not retry it', async () => {
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(JSON.stringify({ error: 'setup', retry: false }), { status: 503 })
  }) as typeof fetch
  await assert.rejects(readMfaStatus(), (error) => isMfaSetupError(error) && !isMfaStatusUnavailable(error))
  calls = 0
  await assert.rejects(readMfaStatusWithRetry(5, async () => {}), (error) => isMfaSetupError(error))
  assert.equal(calls, 1)
})

/** Review of #359, item 1: the code screen stops sending the person to the app after repeated bounces. */
test('mfaBounceDecision: allows up to the limit within the window, then stops; old trips expire', () => {
  const now = 1_000_000
  let history: number[] = []
  for (let i = 0; i < MFA_BOUNCE_LIMIT; i += 1) {
    const decision = mfaBounceDecision(history, now + i * 1000)
    assert.equal(decision.allowed, true)
    history = decision.history
  }
  const blocked = mfaBounceDecision(history, now + 5000)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.history.length, MFA_BOUNCE_LIMIT)
  // After the window, trips are forgotten and one more is allowed.
  const later = mfaBounceDecision(blocked.history, now + 5000 + MFA_BOUNCE_WINDOW_MS)
  assert.equal(later.allowed, true)
  assert.equal(later.history.length, 1)
  // Junk and future stamps are ignored.
  assert.equal(mfaBounceDecision([Number.NaN, now + 999_999], now).history.length, 1)
})
