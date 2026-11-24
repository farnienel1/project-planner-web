/**
 * The sign-in chord (guide §2.1, owner 24 Nov): the notes match the guide, it is made in code, it plays once after a
 * sign-in mark and never on a reload, and only while audio is running and sounds are on.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  FEEDBACK_EVENT_SOUNDS,
  WELCOME_CHORD,
  WELCOME_PENDING_MAX_AGE_MS,
  WELCOME_PENDING_STORAGE_KEY,
  consumeWelcomeSoundPending,
  createFeedbackPlayer,
  markWelcomeSoundPending,
  scheduleWelcomeChord,
  type FeedbackAudioContext,
  type WelcomeAudioContext,
} from './feedback'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const GUIDE = readFileSync(path.join(ROOT, 'docs', 'design', 'feedback', 'feedback-sounds-haptics-guide.md'), 'utf8')

function fakeContext(state = 'running') {
  const oscillators: { frequency: number; start: number; stop: number }[] = []
  const ramps: { kind: string; value: number; when: number }[] = []
  const param = () => ({
    value: 0,
    setValueAtTime: (value: number, when: number) => ramps.push({ kind: 'set', value, when }),
    linearRampToValueAtTime: (value: number, when: number) => ramps.push({ kind: 'linear', value, when }),
    exponentialRampToValueAtTime: (value: number, when: number) => ramps.push({ kind: 'exp', value, when }),
  })
  const ctx = {
    state,
    currentTime: 10,
    destination: {},
    resume: async () => {
      ctx.state = 'running'
    },
    decodeAudioData: async () => ({}),
    createBufferSource: () => ({ buffer: null, connect: () => null, start: () => undefined }),
    createGain: () => ({ gain: param(), connect: () => null }),
    createOscillator: () => {
      const entry = { frequency: 0, start: -1, stop: -1 }
      oscillators.push(entry)
      return {
        type: '',
        frequency: {
          get value() {
            return entry.frequency
          },
          set value(v: number) {
            entry.frequency = v
          },
        },
        connect: () => null,
        start: (when = 0) => {
          entry.start = when
        },
        stop: (when = 0) => {
          entry.stop = when
        },
      }
    },
  }
  return { ctx, oscillators, ramps }
}

test('the guide §2.1 table lists exactly the chord the code plays', () => {
  const section = GUIDE.slice(GUIDE.indexOf('### 2.1'), GUIDE.indexOf('## 3.'))
  const freqs = /\| Frequencies \(Hz\) \| ([^|]+) \|/.exec(section)?.[1].split(',').map((v) => Number(v.trim()))
  assert.deepEqual(freqs, [...WELCOME_CHORD.notes])
  assert.match(section, new RegExp(`one voice every ${WELCOME_CHORD.staggerSec} s`))
  assert.match(section, new RegExp(`over ${WELCOME_CHORD.attackSec} s`))
  assert.match(section, new RegExp(`at ${WELCOME_CHORD.totalSec} s`))
  assert.equal(FEEDBACK_EVENT_SOUNDS.signedIn, 'welcome')
})

test('the chord schedules two sines per note, staggered, all stopped after the fade', () => {
  const { ctx, oscillators, ramps } = fakeContext()
  const count = scheduleWelcomeChord(ctx as unknown as WelcomeAudioContext, 1)
  assert.equal(count, WELCOME_CHORD.notes.length * 2)
  const fundamentals = oscillators.filter((_, i) => i % 2 === 0)
  assert.deepEqual(fundamentals.map((o) => o.frequency), [...WELCOME_CHORD.notes])
  fundamentals.forEach((o, i) => assert.ok(Math.abs(o.start - (1 + i * WELCOME_CHORD.staggerSec)) < 1e-9))
  for (const o of oscillators) assert.ok(Math.abs(o.stop - (1 + WELCOME_CHORD.totalSec + 0.05)) < 1e-9)
  // Every voice fades to (near) silence exactly at the end: no click.
  const fades = ramps.filter((r) => r.kind === 'exp')
  assert.equal(fades.length, WELCOME_CHORD.notes.length)
  for (const fade of fades) assert.ok(fade.value <= 0.0001 && Math.abs(fade.when - (1 + WELCOME_CHORD.totalSec)) < 1e-9)
})

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

test('a sign-in mark plays once; a reload (no mark) and an old mark play nothing', () => {
  const storage = memoryStorage()
  assert.equal(consumeWelcomeSoundPending(storage, 1_000), false)
  markWelcomeSoundPending(storage, 1_000)
  assert.equal(storage.map.has(WELCOME_PENDING_STORAGE_KEY), true)
  assert.equal(consumeWelcomeSoundPending(storage, 2_000), true)
  assert.equal(consumeWelcomeSoundPending(storage, 2_001), false)
  markWelcomeSoundPending(storage, 1_000)
  assert.equal(consumeWelcomeSoundPending(storage, 1_000 + WELCOME_PENDING_MAX_AGE_MS + 1), false)
  assert.equal(storage.map.has(WELCOME_PENDING_STORAGE_KEY), false)
  assert.equal(consumeWelcomeSoundPending(null), false)
})

function player(ctx: FeedbackAudioContext, enabled = true) {
  return createFeedbackPlayer({
    now: () => 0,
    enabled: () => enabled,
    createContext: () => ctx,
    fetchBytes: async () => new ArrayBuffer(0),
    canPlayType: () => '',
    whenIdle: () => undefined,
  })
}

test('the player makes the chord in code (no file) and only while sounds are on', () => {
  const on = fakeContext('running')
  player(on.ctx as unknown as FeedbackAudioContext).play('signedIn')
  assert.equal(on.oscillators.length, WELCOME_CHORD.notes.length * 2)
  const off = fakeContext('running')
  player(off.ctx as unknown as FeedbackAudioContext, false).play('signedIn')
  assert.equal(off.oscillators.length, 0)
})

test('a page the browser will not let play stays silent (never queued)', async () => {
  const { ctx, oscillators } = fakeContext('suspended')
  ctx.resume = async () => undefined // still suspended
  player(ctx as unknown as FeedbackAudioContext).play('signedIn')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(oscillators.length, 0)
  const later = fakeContext('suspended')
  player(later.ctx as unknown as FeedbackAudioContext).play('signedIn')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(later.oscillators.length, WELCOME_CHORD.notes.length * 2)
})
