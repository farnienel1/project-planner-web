/**
 * Feedback sounds module (docs/design/feedback/feedback-sounds-haptics-guide.md). These lock the event table to the
 * guide, the throttle, the setting, the storage fallback, that a failure never throws, and that nothing is created
 * during server rendering.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  FEEDBACK_EVENT_SOUNDS,
  FEEDBACK_GAIN,
  FEEDBACK_SOUNDS,
  FEEDBACK_SOUNDS_DEFAULT,
  FEEDBACK_SOUNDS_STORAGE_KEY,
  FEEDBACK_THROTTLE_MS,
  FEEDBACK_UNLOCK_EVENTS,
  attachFeedbackUnlock,
  claimsReviewEvent,
  createFeedbackPlayer,
  feedback,
  feedbackSoundFor,
  feedbackSoundUrl,
  feedbackSoundsEnabled,
  installFeedbackUnlock,
  playFeedbackSample,
  setFeedbackSoundsEnabled,
  warningResolvedEvent,
  type FeedbackAudioContext,
  type FeedbackEvent,
  type FeedbackPlayerDeps,
} from './feedback'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const GUIDE = path.join(ROOT, 'docs', 'design', 'feedback', 'feedback-sounds-haptics-guide.md')

/** The guide §4 table: `event` → sound (null for "none"). */
function guideTable(): Map<string, string | null> {
  const text = readFileSync(GUIDE, 'utf8')
  const section = text.slice(text.indexOf('## 4.'), text.indexOf('## 5.'))
  const rows = new Map<string, string | null>()
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim())
    const name = /^`([a-zA-Z]+)`$/.exec(cells[1] ?? '')?.[1]
    if (!name) continue
    const sound = cells[3]
    rows.set(name, sound === 'none' ? null : sound)
  }
  return rows
}

test('every event plays exactly the sound guide §4 gives it, and the table has no event the guide lacks', () => {
  const guide = guideTable()
  assert.ok(guide.size >= 18, 'the guide table was read')
  assert.deepEqual([...guide.keys()].sort(), Object.keys(FEEDBACK_EVENT_SOUNDS).sort())
  for (const [event, sound] of guide) {
    assert.equal(feedbackSoundFor(event as FeedbackEvent), sound, event)
  }
  // Spot checks of the guide's own rows.
  assert.equal(feedbackSoundFor('bookingSaved'), 'success')
  assert.equal(feedbackSoundFor('actionRefused'), 'error')
  assert.equal(feedbackSoundFor('allWarningsClear'), 'approved')
  assert.equal(feedbackSoundFor('warningShown'), null)
  assert.equal(feedbackSoundFor('savedOffline'), 'queued')
})

test('every sound has its web files and its master', () => {
  for (const sound of FEEDBACK_SOUNDS) {
    for (const file of [
      path.join(ROOT, 'public', 'sounds', `pp-${sound}.mp3`),
      path.join(ROOT, 'public', 'sounds', `pp-${sound}.webm`),
      path.join(ROOT, 'docs', 'design', 'feedback', 'sounds', `pp-${sound}.wav`),
    ]) {
      assert.ok(existsSync(file), file)
    }
  }
})

test('gain and throttle are the guide values', () => {
  assert.equal(FEEDBACK_GAIN, 0.35)
  assert.equal(FEEDBACK_THROTTLE_MS, 400)
  assert.equal(FEEDBACK_SOUNDS_STORAGE_KEY, 'pp.feedback.sounds')
  assert.equal(FEEDBACK_SOUNDS_DEFAULT, true)
})

test('warningResolvedEvent: zero left is allWarningsClear, otherwise warningResolved', () => {
  assert.equal(warningResolvedEvent(0), 'allWarningsClear')
  assert.equal(warningResolvedEvent(1), 'warningResolved')
  assert.equal(warningResolvedEvent(12), 'warningResolved')
})

test('claimsReviewEvent: any approval → approved, all rejected → declined, nothing saved → no sound', () => {
  assert.equal(claimsReviewEvent([]), null)
  assert.equal(claimsReviewEvent([{ fields: { decision: 'rejected' } }, { fields: { decision: 'approved' } }]), 'claimsApproved')
  assert.equal(claimsReviewEvent([{ fields: { decision: 'rejected' } }]), 'claimsDeclined')
})

// ─── A fake Web Audio for the player ──────────────────────────────────────────────────────────────────────────────

type Harness = {
  deps: FeedbackPlayerDeps
  played: Array<{ buffer: unknown; gain: number }>
  contexts: number
  clock: { now: number }
  setEnabled: (on: boolean) => void
  idleTasks: Array<() => void>
  fetched: string[]
}

function harness(options: { failDecode?: boolean; failCreate?: boolean; webm?: string } = {}): Harness {
  const played: Harness['played'] = []
  const clock = { now: 10_000 }
  let enabled = true
  const idleTasks: Array<() => void> = []
  const fetched: string[] = []
  const h: Harness = {
    played,
    contexts: 0,
    clock,
    idleTasks,
    fetched,
    setEnabled: (on) => {
      enabled = on
    },
    deps: {
      now: () => clock.now,
      enabled: () => enabled,
      createContext: () => {
        if (options.failCreate) throw new Error('no audio device')
        h.contexts += 1
        const ctx: FeedbackAudioContext = {
          state: 'running',
          currentTime: 0,
          destination: {},
          resume: async () => undefined,
          decodeAudioData: async (data) => {
            if (options.failDecode) throw new Error('cannot decode')
            return { decoded: data }
          },
          createGain: () => {
            const node = { gain: { value: 1 }, connect: () => node }
            return node
          },
          createBufferSource: () => {
            const gainHolder: { value: number } = { value: 1 }
            const source = {
              buffer: null as unknown,
              connect: (node: unknown) => {
                gainHolder.value = (node as { gain: { value: number } }).gain.value
                return node
              },
              start: () => {
                played.push({ buffer: source.buffer, gain: gainHolder.value })
              },
            }
            return source
          },
        }
        return ctx
      },
      fetchBytes: async (url) => {
        fetched.push(url)
        return new ArrayBuffer(4)
      },
      canPlayType: () => options.webm ?? 'probably',
      whenIdle: (task) => {
        idleTasks.push(task)
      },
    },
  }
  return h
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test('player: plays once at gain 0.35, after the file has loaded on demand', async () => {
  const h = harness()
  const player = createFeedbackPlayer(h.deps)
  player.play('bookingSaved')
  await flush()
  assert.equal(h.played.length, 1)
  assert.equal(h.played[0].gain, 0.35)
  assert.deepEqual(h.fetched, ['/sounds/pp-success.webm'])
})

test('player: throttle — at most one sound every 400 ms', async () => {
  const h = harness()
  const player = createFeedbackPlayer(h.deps)
  player.preload()
  await flush()
  player.play('bookingSaved')
  h.clock.now += 100
  player.play('actionRefused')
  h.clock.now += 299
  player.play('bookingDeleted')
  assert.equal(h.played.length, 1)
  h.clock.now += 1
  player.play('bookingDeleted')
  assert.equal(h.played.length, 2)
})

test('player: the setting off means silence (and no context is created)', async () => {
  const h = harness()
  h.setEnabled(false)
  const player = createFeedbackPlayer(h.deps)
  for (const event of Object.keys(FEEDBACK_EVENT_SOUNDS) as FeedbackEvent[]) player.play(event)
  await flush()
  assert.equal(h.played.length, 0)
  assert.equal(h.contexts, 0)
})

test('player: an event with no sound plays nothing', async () => {
  const h = harness()
  createFeedbackPlayer(h.deps).play('warningShown')
  await flush()
  assert.equal(h.played.length, 0)
})

test('player: "Play a sample" plays even with sounds off', async () => {
  const h = harness()
  h.setEnabled(false)
  createFeedbackPlayer(h.deps).sample()
  await flush()
  assert.equal(h.played.length, 1)
})

test('player: unlock creates one context and loads every file only when the browser is idle', async () => {
  const h = harness()
  const player = createFeedbackPlayer(h.deps)
  player.unlock()
  player.unlock()
  assert.equal(h.contexts, 1)
  assert.equal(h.fetched.length, 0, 'nothing fetched before idle')
  assert.equal(h.idleTasks.length, 1)
  h.idleTasks[0]()
  await flush()
  assert.equal(h.fetched.length, FEEDBACK_SOUNDS.length)
})

test('player: MP3 when the browser cannot play WebM Opus (Safari)', () => {
  assert.equal(feedbackSoundUrl('sent', () => ''), '/sounds/pp-sent.mp3')
  assert.equal(feedbackSoundUrl('sent', () => 'maybe'), '/sounds/pp-sent.webm')
  assert.equal(feedbackSoundUrl('sent', () => {
    throw new Error('no media')
  }), '/sounds/pp-sent.mp3')
})

test('player: audio failure never throws (no device, undecodable file, broken setting)', async () => {
  const noDevice = harness({ failCreate: true })
  const p1 = createFeedbackPlayer(noDevice.deps)
  assert.doesNotThrow(() => p1.play('bookingSaved'))
  assert.doesNotThrow(() => p1.unlock())
  assert.doesNotThrow(() => p1.sample())

  const undecodable = harness({ failDecode: true })
  const p2 = createFeedbackPlayer(undecodable.deps)
  assert.doesNotThrow(() => p2.play('bookingSaved'))
  await flush()
  await flush()
  assert.equal(undecodable.played.length, 0)
  // WebM failed, so the MP3 was tried once.
  assert.deepEqual(undecodable.fetched, ['/sounds/pp-success.webm', '/sounds/pp-success.mp3'])

  const broken = harness()
  broken.deps.enabled = () => {
    throw new Error('setting broke')
  }
  assert.doesNotThrow(() => createFeedbackPlayer(broken.deps).play('bookingSaved'))
})

test('player: a sound still loading after 1 s is skipped, never played late', async () => {
  const h = harness()
  let release: (value: ArrayBuffer) => void = () => undefined
  h.deps.fetchBytes = () => new Promise((resolve) => (release = resolve))
  const player = createFeedbackPlayer(h.deps)
  player.play('bookingSaved')
  h.clock.now += 1_500
  release(new ArrayBuffer(4))
  await flush()
  await flush()
  assert.equal(h.played.length, 0)
})

// ─── Setting storage ───────────────────────────────────────────────────────────────────────────────────────────────

test('setting: unset is the default (on); off and on round-trip', () => {
  const store = new Map<string, string>()
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
  assert.equal(feedbackSoundsEnabled(storage), true)
  assert.equal(setFeedbackSoundsEnabled(false, storage), true)
  assert.equal(store.get('pp.feedback.sounds'), 'off')
  assert.equal(feedbackSoundsEnabled(storage), false)
  setFeedbackSoundsEnabled(true, storage)
  assert.equal(feedbackSoundsEnabled(storage), true)
})

test('setting: storage unavailable or throwing falls back to the default and never throws', () => {
  const throwing = {
    getItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }
  assert.equal(feedbackSoundsEnabled(throwing), FEEDBACK_SOUNDS_DEFAULT)
  assert.equal(feedbackSoundsEnabled(null), FEEDBACK_SOUNDS_DEFAULT)
  assert.equal(setFeedbackSoundsEnabled(false, throwing), false)
  assert.equal(setFeedbackSoundsEnabled(false, null), false)
})

// ─── Server rendering ──────────────────────────────────────────────────────────────────────────────────────────────

test('server rendering: no window, no AudioContext is created and nothing throws', () => {
  assert.equal(typeof (globalThis as { window?: unknown }).window, 'undefined')
  let created = 0
  const globals = globalThis as { AudioContext?: unknown }
  const before = globals.AudioContext
  globals.AudioContext = class {
    constructor() {
      created += 1
    }
  }
  try {
    for (const event of Object.keys(FEEDBACK_EVENT_SOUNDS) as FeedbackEvent[]) feedback(event)
    playFeedbackSample()
    const remove = installFeedbackUnlock()
    remove()
    assert.equal(created, 0)
  } finally {
    globals.AudioContext = before
  }
})

test('the module imports nothing that reads or writes data (it cannot change a save)', () => {
  const source = readFileSync(path.join(ROOT, 'lib', 'feedbackSounds', 'feedback.ts'), 'utf8')
  assert.doesNotMatch(source, /^import /m)
})

/** A stand-in for `window` / `document` that records listeners and can fire them. */
function fakeTarget() {
  const listeners = new Map<string, Set<() => void>>()
  const options: Array<{ type: string; capture: boolean; passive: boolean }> = []
  return {
    listeners,
    options,
    addEventListener(type: string, listener: () => void, opts: { capture: true; passive: true }) {
      options.push({ type, capture: opts.capture, passive: opts.passive })
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener)
    },
    fire(type: string) {
      for (const l of [...(listeners.get(type) ?? [])]) l()
    },
    count() {
      return [...listeners.values()].reduce((n, set) => n + set.size, 0)
    },
  }
}

test('unlock: listens for pointerdown, pointerup, touchend, click and keydown (iOS Safari counts no touch pointerdown)', () => {
  assert.deepEqual([...FEEDBACK_UNLOCK_EVENTS], ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
  const target = fakeTarget()
  let calls = 0
  const off = attachFeedbackUnlock(target, () => calls++, () => false)
  for (const type of FEEDBACK_UNLOCK_EVENTS) assert.equal(target.listeners.get(type)?.size, 1, type)
  assert.ok(target.options.every((o) => o.capture && o.passive), 'capture mode, passive')
  // iOS Safari: the touch pointerdown does not resume the context; the touchend / click that follows must.
  target.fire('touchend')
  target.fire('click')
  assert.equal(calls, 2)
  off()
  assert.equal(target.count(), 0)
})

test('unlock: listeners come off once the context is running, and stay while it is still suspended', async () => {
  const target = fakeTarget()
  let running = false
  attachFeedbackUnlock(target, () => undefined, () => running)
  target.fire('pointerdown')
  assert.equal(target.count(), FEEDBACK_UNLOCK_EVENTS.length, 'still suspended: keep listening')
  // The resume() promise settles a moment after the gesture.
  target.fire('click')
  running = true
  await new Promise((done) => setTimeout(done, 80))
  assert.equal(target.count(), 0, 'running: every gesture listener removed')
})

test('unlock: back on when the page is visible again and iOS suspended audio in the background', () => {
  const target = fakeTarget()
  const doc = fakeTarget()
  let running = true
  attachFeedbackUnlock(target, () => undefined, () => running, doc)
  target.fire('click')
  assert.equal(target.count(), 0)
  doc.fire('visibilitychange')
  assert.equal(target.count(), 0, 'still running: nothing added')
  running = false
  doc.fire('visibilitychange')
  assert.equal(target.count(), FEEDBACK_UNLOCK_EVENTS.length)
  doc.fire('visibilitychange')
  assert.equal(target.count(), FEEDBACK_UNLOCK_EVENTS.length, 'never added twice')
})

test('unlock: a throwing unlock never escapes the page listener', () => {
  const target = fakeTarget()
  attachFeedbackUnlock(target, () => {
    throw new Error('no audio')
  }, () => {
    throw new Error('no audio')
  })
  assert.doesNotThrow(() => target.fire('touchend'))
})

test('player: unlocked() is false before any context and true once it runs', () => {
  const h = harness()
  const player = createFeedbackPlayer(h.deps)
  assert.equal(player.unlocked(), false)
  player.unlock()
  assert.equal(player.unlocked(), true)
})
