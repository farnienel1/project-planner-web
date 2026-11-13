import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_GRACE_MS, probeReachability, shouldShowOfflineBanner } from './onlineStatus.ts'

const since = 1_000_000

test('the browser saying online never shows the banner', () => {
  assert.equal(
    shouldShowOfflineBanner({ navigatorOnline: true, offlineSinceMs: since, nowMs: since + 60_000, probe: 'failed' }),
    false
  )
})

test('a stuck navigator.onLine=false with a working connection never shows the banner', () => {
  assert.equal(
    shouldShowOfflineBanner({ navigatorOnline: false, offlineSinceMs: since, nowMs: since + 60_000, probe: 'ok' }),
    false
  )
})

test('no finished check yet: no banner', () => {
  assert.equal(
    shouldShowOfflineBanner({ navigatorOnline: false, offlineSinceMs: since, nowMs: since + 60_000, probe: null }),
    false
  )
})

test('a failed check inside the grace period: no banner yet', () => {
  assert.equal(
    shouldShowOfflineBanner({
      navigatorOnline: false,
      offlineSinceMs: since,
      nowMs: since + OFFLINE_GRACE_MS - 1,
      probe: 'failed',
    }),
    false
  )
})

test('offline for the grace period and a failed check: banner', () => {
  assert.equal(
    shouldShowOfflineBanner({
      navigatorOnline: false,
      offlineSinceMs: since,
      nowMs: since + OFFLINE_GRACE_MS,
      probe: 'failed',
    }),
    true
  )
})

test('probeReachability: any HTTP answer is ok, a network error is failed', async () => {
  const answered = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
  const broken = (async () => {
    throw new TypeError('Failed to fetch')
  }) as unknown as typeof fetch
  assert.equal(await probeReachability(answered), 'ok')
  assert.equal(await probeReachability(broken), 'failed')
})

test('probeReachability: a request that never answers times out as failed', async () => {
  const hanging = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })) as unknown as typeof fetch
  assert.equal(await probeReachability(hanging, 20), 'failed')
})
