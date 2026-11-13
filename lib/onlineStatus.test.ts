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

import {
  INITIAL_ONLINE_STATUS,
  OFFLINE_RECHECK_MS,
  REACHABILITY_PATH,
  STUCK_FLAG_BACKOFF_MS,
  browserOnlineForChecks,
  onlineStatusStep,
  registerOnlineStatusOwner,
  setConfirmedOffline,
  type OnlineStatusState,
} from './onlineStatus.ts'

const t0 = 5_000_000
const off = { navigatorOnline: false as const }

test('reducer: the browser saying offline starts the grace timer without a request', () => {
  const r = onlineStatusStep(INITIAL_ONLINE_STATUS, { type: 'recheck', ...off, nowMs: t0 })
  assert.equal(r.state.offlineSinceMs, t0)
  assert.equal(r.state.showBanner, false)
  assert.deepEqual(r.effects, { probe: false, schedule: OFFLINE_GRACE_MS })
})

test('reducer: grace timer fires, the request fails, the banner shows and re-checks every 10s', () => {
  let s = onlineStatusStep(INITIAL_ONLINE_STATUS, { type: 'recheck', ...off, nowMs: t0 }).state
  const fired = onlineStatusStep(s, { type: 'timer', ...off, nowMs: t0 + OFFLINE_GRACE_MS, hidden: false })
  assert.equal(fired.effects.probe, true)
  s = fired.state
  const failed = onlineStatusStep(s, { type: 'probeResult', probe: 'failed', ...off, nowMs: t0 + OFFLINE_GRACE_MS + 50 })
  assert.equal(failed.state.showBanner, true)
  assert.equal(failed.effects.schedule, OFFLINE_RECHECK_MS)
})

test('reducer: a failed request inside the grace period waits out the rest of it', () => {
  let s = onlineStatusStep(INITIAL_ONLINE_STATUS, { type: 'recheck', ...off, nowMs: t0 }).state
  s = onlineStatusStep(s, { type: 'recheck', ...off, nowMs: t0 + 1_000 }).state // focus: probe now
  assert.equal(s.probing, true)
  const r = onlineStatusStep(s, { type: 'probeResult', probe: 'failed', ...off, nowMs: t0 + 1_000 })
  assert.equal(r.state.showBanner, false)
  assert.equal(r.effects.schedule, OFFLINE_GRACE_MS - 1_000)
})

test('reducer: an ok request hides the banner and backs off 10s, 30s, 60s while the flag stays stuck', () => {
  let s: OnlineStatusState = { offlineSinceMs: t0, probing: true, showBanner: true, okStreak: 0 }
  const waits: Array<number | null | 'keep'> = []
  for (let i = 0; i < 4; i++) {
    const r = onlineStatusStep(s, { type: 'probeResult', probe: 'ok', ...off, nowMs: t0 + i })
    assert.equal(r.state.showBanner, false)
    waits.push(r.effects.schedule)
    s = { ...r.state, probing: true }
  }
  assert.deepEqual(waits, [...STUCK_FLAG_BACKOFF_MS, 60_000])
})

test('reducer: after a stuck-flag period a real disconnect needs a fresh grace period and a second failure', () => {
  let s: OnlineStatusState = { offlineSinceMs: t0, probing: true, showBanner: false, okStreak: 2 }
  const first = onlineStatusStep(s, { type: 'probeResult', probe: 'failed', ...off, nowMs: t0 + 40_000 })
  assert.equal(first.state.showBanner, false)
  assert.equal(first.effects.schedule, OFFLINE_GRACE_MS)
  s = onlineStatusStep(first.state, { type: 'timer', ...off, nowMs: t0 + 44_000, hidden: false }).state
  const second = onlineStatusStep(s, { type: 'probeResult', probe: 'failed', ...off, nowMs: t0 + 44_100 })
  assert.equal(second.state.showBanner, true)
})

test('reducer: the browser saying online during a request hides at once and the late result changes nothing', () => {
  const s: OnlineStatusState = { offlineSinceMs: t0, probing: true, showBanner: true, okStreak: 0 }
  const online = onlineStatusStep(s, { type: 'recheck', navigatorOnline: true, nowMs: t0 + 1 })
  assert.equal(online.state.showBanner, false)
  assert.equal(online.state.offlineSinceMs, null)
  assert.deepEqual(online.effects, { probe: false, schedule: null })
  const late = onlineStatusStep(online.state, { type: 'probeResult', probe: 'failed', navigatorOnline: true, nowMs: t0 + 2 })
  assert.deepEqual(late.state, INITIAL_ONLINE_STATUS)
})

test('reducer: a hidden tab makes no scheduled request; showing it re-checks', () => {
  const s: OnlineStatusState = { offlineSinceMs: t0, probing: false, showBanner: true, okStreak: 0 }
  const hidden = onlineStatusStep(s, { type: 'timer', ...off, nowMs: t0 + 10_000, hidden: true })
  assert.deepEqual(hidden.effects, { probe: false, schedule: null })
  assert.equal(hidden.state.showBanner, true)
  const shown = onlineStatusStep(hidden.state, { type: 'recheck', ...off, nowMs: t0 + 20_000 })
  assert.equal(shown.effects.probe, true)
})

test('reducer: a second recheck while a request is in flight starts no second request', () => {
  const s: OnlineStatusState = { offlineSinceMs: t0, probing: true, showBanner: false, okStreak: 0 }
  const r = onlineStatusStep(s, { type: 'recheck', ...off, nowMs: t0 + 1 })
  assert.deepEqual(r.effects, { probe: false, schedule: 'keep' })
})

test('shared status: background checks read the banner while the hook is mounted, navigator after unmount', () => {
  assert.equal(browserOnlineForChecks(false), false) // nothing mounted: navigator's word
  registerOnlineStatusOwner(true)
  assert.equal(browserOnlineForChecks(false), true) // stuck false, not confirmed: the check still runs
  setConfirmedOffline(true)
  assert.equal(browserOnlineForChecks(true), false)
  registerOnlineStatusOwner(false) // unmount clears the shared status
  assert.equal(browserOnlineForChecks(true), true)
  assert.equal(browserOnlineForChecks(false), false)
  setConfirmedOffline(false)
})

test('probeReachability asks a path the middleware skips', async () => {
  let asked = ''
  const capture = (async (url: string) => {
    asked = url
    return new Response(null, { status: 404 })
  }) as unknown as typeof fetch
  await probeReachability(capture)
  assert.ok(asked.startsWith(`${REACHABILITY_PATH}?`))
})
