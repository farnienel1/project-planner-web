/**
 * Feedback sounds (docs/design/feedback/feedback-sounds-haptics-guide.md, the spec).
 *
 * A short sound after the person's own action has already succeeded or been refused. Not a business rule (rulebook
 * §15, platform-specific): it changes no data, payload, flow, toast or navigation. `feedback(event)` is synchronous,
 * returns nothing, never throws and never awaits in the caller's path; every failure is swallowed.
 *
 * Screens name an event; the event decides the sound (`FEEDBACK_EVENT_SOUNDS`, guide §4). Screens never pick sounds.
 * Client only and SSR-safe: nothing touches `window` or creates an `AudioContext` until the browser calls in.
 */

/** The seven sounds of guide §2 (`public/sounds/pp-<name>.webm` / `.mp3`). */
export const FEEDBACK_SOUNDS = ['success', 'sent', 'approved', 'resolved', 'removed', 'error', 'queued'] as const
export type FeedbackSound = (typeof FEEDBACK_SOUNDS)[number]

/**
 * Sounds made in code with the Web Audio API, no file (guide §2.1). `welcome`: the slow chord after signing in
 * (owner 24 Nov, "a nice slow harmony when you first log in — unique, generated"). `chime`: a short two-note tone when
 * a new notification arrives while the app is open (owner 25 Nov, guide §2.2).
 */
export const FEEDBACK_SYNTH_SOUNDS = ['welcome', 'chime'] as const
export type FeedbackSynthSound = (typeof FEEDBACK_SYNTH_SOUNDS)[number]
export type FeedbackSoundName = FeedbackSound | FeedbackSynthSound

/**
 * Guide §4: every event and its sound (null = no sound; `warningShown` is an iOS haptic only, `savedOffline` is the
 * iOS offline queue). `satisfies` keeps the table exhaustive: a new event without a row does not compile, and the unit
 * test compares this table with the guide's own table.
 */
export const FEEDBACK_EVENT_SOUNDS = {
  bookingSaved: 'success',
  bookingEdited: 'success',
  bookingRequested: 'sent',
  bookingApproved: 'approved',
  bookingDeclined: 'removed',
  bookingDeleted: 'removed',
  leaveRequested: 'sent',
  leaveBooked: 'success',
  leaveApproved: 'approved',
  leaveDeclined: 'removed',
  warningResolved: 'resolved',
  allWarningsClear: 'approved',
  timesheetSigned: 'approved',
  timesheetSaved: 'success',
  userInvited: 'sent',
  leaveEdited: 'success',
  leaveRemoved: 'removed',
  overtimeSent: 'sent',
  overtimeReturned: 'approved',
  claimsApproved: 'approved',
  claimsDeclined: 'removed',
  savedOffline: 'queued',
  actionRefused: 'error',
  warningShown: null,
  signedIn: 'welcome',
  notificationReceived: 'chime',
} as const satisfies Record<string, FeedbackSoundName | null>

export type FeedbackEvent = keyof typeof FEEDBACK_EVENT_SOUNDS

/** Guide §5: `localStorage` key, this browser only. */
export const FEEDBACK_SOUNDS_STORAGE_KEY = 'pp.feedback.sounds'
/** Owner decision 1 (16 Nov): sounds are on by default. */
export const FEEDBACK_SOUNDS_DEFAULT = true
/** Guide §1.3: at most one feedback sound every 400 ms. */
export const FEEDBACK_THROTTLE_MS = 400
/** Guide §1.4 / owner decision 12: web gain 0.35. */
export const FEEDBACK_GAIN = 0.35
/** A sound whose file is still loading plays only if it is ready this soon after the action; otherwise it is skipped. */
export const FEEDBACK_LATE_LIMIT_MS = 1_000

export const FEEDBACK_SETTING_LABEL = 'Sounds'
export const FEEDBACK_SETTING_HELP = 'Applies to this browser only.'
export const FEEDBACK_SAMPLE_LABEL = 'Play a sample'

/** The sound an event plays (null: none). */
export function feedbackSoundFor(event: FeedbackEvent): FeedbackSoundName | null {
  return FEEDBACK_EVENT_SOUNDS[event] ?? null
}

/** Owner decision 11: `allWarningsClear` replaces `warningResolved` when the viewer's own list reached zero. */
export function warningResolvedEvent(activeWarningsLeft: number): FeedbackEvent {
  return activeWarningsLeft === 0 ? 'allWarningsClear' : 'warningResolved'
}

/**
 * Owner decision 2: the price work / expense review's Approve plays approved when any saved decision approves an
 * item, declined when every saved decision rejects; nothing saved (no writes) plays nothing (decision 4).
 */
export function claimsReviewEvent(writes: ReadonlyArray<{ fields: Record<string, unknown> }>): FeedbackEvent | null {
  if (writes.length === 0) return null
  return writes.some((write) => write.fields?.decision === 'approved') ? 'claimsApproved' : 'claimsDeclined'
}

// ─── The welcome chord (guide §2.1) ────────────────────────────────────────────────────────────────────────────────

/**
 * The sign-in chord: five soft sine voices of a D major 9 chord (D3, A3, F♯4, C♯5, E5) entering one after another and
 * swelling, then fading out. Made in code at play time (no audio file, no samples), so it is ours and licence-free.
 * iOS makes the same notes from these numbers (guide §2.1).
 */
export const WELCOME_CHORD = {
  /** Hz, lowest first. */
  notes: [146.83, 220.0, 369.99, 554.37, 659.25],
  /** Each voice's relative level (the low notes softer so the chord stays light). */
  levels: [0.55, 0.7, 0.85, 0.8, 0.65],
  /** Seconds between one voice entering and the next. */
  staggerSec: 0.16,
  /** Seconds each voice takes to swell to its level. */
  attackSec: 0.55,
  /** Second partial (an octave up) relative to the voice. */
  octaveLevel: 0.12,
  /** Whole sound, first voice in to silence. */
  totalSec: 2.6,
  /** Master level relative to `FEEDBACK_GAIN`. */
  masterScale: 0.75,
} as const

type WelcomeParam = {
  value: number
  setValueAtTime: (value: number, when: number) => unknown
  linearRampToValueAtTime: (value: number, when: number) => unknown
  exponentialRampToValueAtTime: (value: number, when: number) => unknown
}

/** The Web Audio parts the chord uses (so tests can stand in for them). */
export type WelcomeAudioContext = {
  currentTime: number
  destination: unknown
  createGain: () => { gain: WelcomeParam; connect: (node: unknown) => unknown }
  createOscillator: () => {
    type: string
    frequency: { value: number }
    connect: (node: unknown) => unknown
    start: (when?: number) => void
    stop: (when?: number) => void
  }
}

/** Schedules the welcome chord on `ctx` from `startAt` (seconds, context time). Returns the number of oscillators. */
export function scheduleWelcomeChord(ctx: WelcomeAudioContext, startAt: number, gain = FEEDBACK_GAIN): number {
  const chord = WELCOME_CHORD
  const end = startAt + chord.totalSec
  const master = ctx.createGain()
  master.gain.setValueAtTime(gain * chord.masterScale, startAt)
  master.connect(ctx.destination)
  let oscillators = 0
  chord.notes.forEach((frequency, index) => {
    const enter = startAt + index * chord.staggerSec
    const level = (chord.levels[index] ?? 0.6) / chord.notes.length
    const voice = ctx.createGain()
    voice.gain.setValueAtTime(0.0001, enter)
    voice.gain.linearRampToValueAtTime(level, enter + chord.attackSec)
    // A long, smooth fade to silence at the end (never a click).
    voice.gain.exponentialRampToValueAtTime(0.0001, end)
    voice.connect(master)
    for (const [multiple, partial] of [
      [1, 1],
      [2, chord.octaveLevel],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency * multiple
      if (partial === 1) {
        osc.connect(voice)
      } else {
        const partialGain = ctx.createGain()
        partialGain.gain.setValueAtTime(partial, enter)
        partialGain.connect(voice)
        osc.connect(partialGain)
      }
      osc.start(enter)
      osc.stop(end + 0.05)
      oscillators += 1
    }
  })
  return oscillators
}

// ─── The notification chime (guide §2.2) ───────────────────────────────────────────────────────────────────────────

/**
 * The new-notification tone (owner 25 Nov): two soft sine notes a fourth apart (E5 then A5), each with a quick rise
 * and a gentle fade, about 0.7 s in all. Made in code at play time (no file, no samples), so it is ours.
 */
export const NOTIFICATION_CHIME = {
  /** Hz, in the order played. */
  notes: [659.25, 880.0],
  /** Seconds between the first note and the second. */
  gapSec: 0.14,
  /** Seconds each note takes to rise. */
  attackSec: 0.015,
  /** Seconds each note takes to fade to silence. */
  releaseSec: 0.5,
  /** Second partial (an octave up) relative to the note. */
  octaveLevel: 0.15,
  /** Each note's level relative to `FEEDBACK_GAIN`. */
  noteScale: 0.6,
} as const

/** Schedules the chime on `ctx` from `startAt` (seconds, context time). Returns the number of oscillators. */
export function scheduleNotificationChime(ctx: WelcomeAudioContext, startAt: number, gain = FEEDBACK_GAIN): number {
  const chime = NOTIFICATION_CHIME
  let oscillators = 0
  chime.notes.forEach((frequency, index) => {
    const enter = startAt + index * chime.gapSec
    const end = enter + chime.attackSec + chime.releaseSec
    const voice = ctx.createGain()
    voice.gain.setValueAtTime(0.0001, enter)
    voice.gain.linearRampToValueAtTime(gain * chime.noteScale, enter + chime.attackSec)
    voice.gain.exponentialRampToValueAtTime(0.0001, end)
    voice.connect(ctx.destination)
    for (const [multiple, partial] of [
      [1, 1],
      [2, chime.octaveLevel],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency * multiple
      if (partial === 1) {
        osc.connect(voice)
      } else {
        const partialGain = ctx.createGain()
        partialGain.gain.setValueAtTime(partial, enter)
        partialGain.connect(voice)
        osc.connect(partialGain)
      }
      osc.start(enter)
      osc.stop(end + 0.05)
      oscillators += 1
    }
  })
  return oscillators
}

// ─── Setting ───────────────────────────────────────────────────────────────────────────────────────────────────────

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

/** Whether sounds are on in this browser. Unreadable or unset storage gives the default (on). */
export function feedbackSoundsEnabled(storage: StorageLike | null = browserStorage()): boolean {
  try {
    const stored = storage?.getItem(FEEDBACK_SOUNDS_STORAGE_KEY)
    if (stored === 'off' || stored === 'false' || stored === '0') return false
    if (stored === 'on' || stored === 'true' || stored === '1') return true
    return FEEDBACK_SOUNDS_DEFAULT
  } catch {
    return FEEDBACK_SOUNDS_DEFAULT
  }
}

/** Saves the setting in this browser. Returns false when storage is unavailable (the setting then stays the default). */
export function setFeedbackSoundsEnabled(on: boolean, storage: StorageLike | null = browserStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(FEEDBACK_SOUNDS_STORAGE_KEY, on ? 'on' : 'off')
    return true
  } catch {
    return false
  }
}

// ─── Player ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The parts of the Web Audio API the player uses (so tests can stand in for it). */
export type FeedbackAudioContext = {
  state: string
  currentTime: number
  destination: unknown
  resume: () => Promise<void>
  decodeAudioData: (data: ArrayBuffer) => Promise<unknown>
  createGain: () => { gain: { value: number }; connect: (node: unknown) => unknown }
  createBufferSource: () => { buffer: unknown; connect: (node: unknown) => unknown; start: (when?: number) => void }
}

export type FeedbackPlayerDeps = {
  now: () => number
  enabled: () => boolean
  /** Creates the one `AudioContext`; null when the browser has none. */
  createContext: () => FeedbackAudioContext | null
  /** Fetches a sound file's bytes. */
  fetchBytes: (url: string) => Promise<ArrayBuffer>
  /** `HTMLMediaElement.canPlayType` for a MIME type ('' / 'maybe' / 'probably'). */
  canPlayType: (mime: string) => string
  /** Runs work when the browser is idle (never during first load). */
  whenIdle: (task: () => void) => void
  debug?: (message: string, error?: unknown) => void
}

export type FeedbackPlayer = {
  play: (event: FeedbackEvent) => void
  /** Plays a sound directly, ignoring the setting (the Settings "Play a sample" button). */
  sample: (sound?: FeedbackSoundName) => void
  /** Creates / resumes the context inside a user gesture (browser autoplay rules) and schedules loading. */
  unlock: () => void
  /** True once the context is running (the gesture listeners can then come off). */
  unlocked: () => boolean
  /** Starts fetching and decoding the files (idempotent). */
  preload: () => void
}

/** The file to use: Opus in WebM where the browser plays it, else MP3 (Safari). */
export function feedbackSoundUrl(sound: FeedbackSound, canPlayType: (mime: string) => string): string {
  let webm = ''
  try {
    webm = canPlayType('audio/webm; codecs="opus"')
  } catch {
    webm = ''
  }
  return `/sounds/pp-${sound}.${webm === 'probably' || webm === 'maybe' ? 'webm' : 'mp3'}`
}

export function createFeedbackPlayer(deps: FeedbackPlayerDeps): FeedbackPlayer {
  const debug = (message: string, error?: unknown) => {
    try {
      deps.debug?.(message, error)
    } catch {
      // never throw
    }
  }
  let context: FeedbackAudioContext | null = null
  let contextFailed = false
  let lastPlayedAt = Number.NEGATIVE_INFINITY
  let preloadScheduled = false
  const buffers = new Map<FeedbackSound, unknown>()
  const loading = new Map<FeedbackSound, Promise<unknown>>()

  const ensureContext = (): FeedbackAudioContext | null => {
    if (context || contextFailed) return context
    try {
      context = deps.createContext()
      if (!context) contextFailed = true
    } catch (error) {
      contextFailed = true
      debug('feedback: no audio context', error)
    }
    return context
  }

  const decode = async (ctx: FeedbackAudioContext, url: string) => ctx.decodeAudioData(await deps.fetchBytes(url))

  const load = (sound: FeedbackSound): Promise<unknown> => {
    const existing = loading.get(sound)
    if (existing) return existing
    const ctx = ensureContext()
    if (!ctx) return Promise.resolve(null)
    const preferred = feedbackSoundUrl(sound, deps.canPlayType)
    const promise = decode(ctx, preferred)
      .catch((error) => {
        // A browser that says it plays WebM but cannot decode it: try the MP3 once.
        if (!preferred.endsWith('.webm')) throw error
        return decode(ctx, `/sounds/pp-${sound}.mp3`)
      })
      .then((buffer) => {
        buffers.set(sound, buffer)
        return buffer
      })
      .catch((error) => {
        loading.delete(sound)
        debug(`feedback: could not load ${sound}`, error)
        return null
      })
    loading.set(sound, promise)
    return promise
  }

  const preload = () => {
    try {
      if (!ensureContext()) return
      for (const sound of FEEDBACK_SOUNDS) void load(sound)
    } catch (error) {
      debug('feedback: preload failed', error)
    }
  }

  const start = (sound: FeedbackSound, buffer: unknown) => {
    const ctx = context
    if (!ctx || !buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = FEEDBACK_GAIN
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(0)
    debug(`feedback: played ${sound}`)
  }

  const playSynth = (ctx: FeedbackAudioContext, sound: FeedbackSynthSound) => {
    const askedAt = deps.now()
    const go = () => {
      try {
        // Only with audio actually running: a page the browser has not let play stays silent (never queued for later).
        if (ctx.state !== 'running' || deps.now() - askedAt > FEEDBACK_LATE_LIMIT_MS) return
        const synth = ctx as unknown as Partial<WelcomeAudioContext>
        if (typeof synth.createOscillator !== 'function') return
        const schedule = sound === 'chime' ? scheduleNotificationChime : scheduleWelcomeChord
        schedule(ctx as unknown as WelcomeAudioContext, ctx.currentTime + 0.02)
        debug(`feedback: played ${sound}`)
      } catch (error) {
        debug(`feedback: ${sound} failed`, error)
      }
    }
    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(go)
        .catch((error) => debug('feedback: resume refused', error))
      return
    }
    go()
  }

  const playSound = (sound: FeedbackSoundName) => {
    const ctx = ensureContext()
    if (!ctx) return
    if (sound === 'welcome' || sound === 'chime') {
      playSynth(ctx, sound)
      return
    }
    if (ctx.state === 'suspended') void ctx.resume().catch((error) => debug('feedback: resume refused', error))
    const ready = buffers.get(sound)
    if (ready) {
      start(sound, ready)
      return
    }
    const askedAt = deps.now()
    void load(sound).then((buffer) => {
      try {
        if (buffer && deps.now() - askedAt <= FEEDBACK_LATE_LIMIT_MS) start(sound, buffer)
      } catch (error) {
        debug('feedback: late play failed', error)
      }
    })
  }

  return {
    play(event) {
      try {
        const sound = feedbackSoundFor(event)
        if (!sound) return
        if (!deps.enabled()) return
        const now = deps.now()
        if (now - lastPlayedAt < FEEDBACK_THROTTLE_MS) return
        lastPlayedAt = now
        playSound(sound)
      } catch (error) {
        debug(`feedback: ${String(event)} failed`, error)
      }
    },
    sample(sound = 'success') {
      try {
        lastPlayedAt = deps.now()
        playSound(sound)
      } catch (error) {
        debug('feedback: sample failed', error)
      }
    },
    unlock() {
      try {
        const ctx = ensureContext()
        if (ctx && ctx.state === 'suspended') void ctx.resume().catch((error) => debug('feedback: resume refused', error))
        if (!preloadScheduled && ctx) {
          preloadScheduled = true
          deps.whenIdle(preload)
        }
      } catch (error) {
        debug('feedback: unlock failed', error)
      }
    },
    unlocked() {
      try {
        return context?.state === 'running'
      } catch {
        return false
      }
    },
    preload,
  }
}

// ─── The browser's player ──────────────────────────────────────────────────────────────────────────────────────────

let browserPlayer: FeedbackPlayer | null = null

function browserDeps(): FeedbackPlayerDeps {
  return {
    now: () => Date.now(),
    enabled: () => feedbackSoundsEnabled(),
    createContext: () => {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const Ctor = w.AudioContext ?? w.webkitAudioContext
      return Ctor ? (new Ctor() as unknown as FeedbackAudioContext) : null
    },
    fetchBytes: async (url) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.arrayBuffer()
    },
    canPlayType: (mime) => {
      try {
        return document.createElement('audio').canPlayType(mime)
      } catch {
        return ''
      }
    },
    whenIdle: (task) => {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback
      if (typeof idle === 'function') idle(task, { timeout: 3_000 })
      else window.setTimeout(task, 1_000)
    },
    debug: (message, error) => {
      if (process.env.NODE_ENV === 'development') console.debug(message, error ?? '')
    },
  }
}

/** The page's one player; null during server rendering (nothing is created there). */
function player(): FeedbackPlayer | null {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null
    browserPlayer ??= createFeedbackPlayer(browserDeps())
    return browserPlayer
  } catch {
    return null
  }
}

/**
 * Plays the event's sound after the person's own action succeeded or was refused. Call it once per action, after the
 * existing success / error handling. Never from a listener, page load or autosave. Never throws.
 */
export function feedback(event: FeedbackEvent): void {
  try {
    player()?.play(event)
  } catch {
    // Feedback can never break an action (guide §7).
  }
}

/**
 * The one sound not caused by the person's own action (owner 25 Nov, guide §4 `notificationReceived`): a new inbox row
 * arrived while the app is open. Called only by the notification pop-up for a row created after the page loaded —
 * never on the inbox's first load or a reconnect. Follows the Sounds setting and the throttle. Never throws.
 */
export function notificationArrivedSound(): void {
  try {
    player()?.play('notificationReceived')
  } catch {
    // never throw
  }
}

/** The Settings "Play a sample" button: plays even when sounds are off, so the person can hear what they would get. */
export function playFeedbackSample(): void {
  try {
    player()?.sample('success')
  } catch {
    // never throw
  }
}

/**
 * The gestures that unlock audio. iOS Safari does not count a touch `pointerdown` as a user gesture, so the context is
 * also resumed on `pointerup`, `touchend` and `click` (and `keydown` for keyboards).
 */
export const FEEDBACK_UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const

/** The parts of `window` / `document` the unlock listeners use (so tests can stand in for them). */
export type FeedbackUnlockTarget = {
  addEventListener: (type: string, listener: () => void, options: { capture: true; passive: true }) => void
  removeEventListener: (type: string, listener: () => void, capture: true) => void
}

/**
 * Listens for the gestures in `FEEDBACK_UNLOCK_EVENTS` (capture, passive) and calls `unlock` inside each one. Once
 * `unlocked()` is true the listeners come off. When the page becomes visible again (`visibility`, e.g. `document`'s
 * `visibilitychange`) and audio is no longer running — iOS suspends it in the background — they go back on. Returns
 * the clean-up. Never throws.
 */
export function attachFeedbackUnlock(
  target: FeedbackUnlockTarget,
  unlock: () => void,
  unlocked: () => boolean,
  visibility?: FeedbackUnlockTarget
): () => void {
  let attached = false
  const detach = () => {
    if (!attached) return
    attached = false
    for (const type of FEEDBACK_UNLOCK_EVENTS) {
      try {
        target.removeEventListener(type, onGesture, true)
      } catch {
        // never throw
      }
    }
  }
  const settle = () => {
    try {
      if (unlocked()) detach()
    } catch {
      // never throw
    }
  }
  function onGesture() {
    try {
      unlock()
    } catch {
      // never throw from a page listener
    }
    settle()
    // `resume()` settles a moment later: check again so the listeners come off after the first gesture that worked.
    try {
      setTimeout(settle, 50)
    } catch {
      // never throw
    }
  }
  const attach = () => {
    if (attached) return
    attached = true
    for (const type of FEEDBACK_UNLOCK_EVENTS) {
      try {
        target.addEventListener(type, onGesture, { capture: true, passive: true })
      } catch {
        // never throw
      }
    }
  }
  const onVisible = () => {
    try {
      if (!unlocked()) attach()
    } catch {
      // never throw
    }
  }
  attach()
  try {
    visibility?.addEventListener('visibilitychange', onVisible, { capture: true, passive: true })
  } catch {
    // never throw
  }
  return () => {
    detach()
    try {
      visibility?.removeEventListener('visibilitychange', onVisible, true)
    } catch {
      // never throw
    }
  }
}

/**
 * Unlocks audio inside the person's gesture (browser autoplay rules: the context is created, or resumed after the
 * browser suspended it, during a gesture) and loads the files once while the browser is idle. Mounted once by the app
 * shell; returns the clean-up. Someone with sounds off never gets an `AudioContext`.
 */
export function installFeedbackUnlock(): () => void {
  try {
    if (typeof window === 'undefined') return () => undefined
    return attachFeedbackUnlock(
      window,
      () => {
        if (feedbackSoundsEnabled()) player()?.unlock()
      },
      () => player()?.unlocked() ?? false,
      typeof document === 'undefined' ? undefined : document
    )
  } catch {
    return () => undefined
  }
}

/** Unlocks inside a gesture now (the Settings toggle turning sounds on, or "Play a sample"). */
export function unlockFeedbackSounds(): void {
  try {
    player()?.unlock()
  } catch {
    // never throw
  }
}

// ─── The sign-in chord ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Owner 24 Nov: the welcome chord plays once when the person finishes signing in on this device, never on a reload.
 * Browsers let audio start only inside the person's own press, and the code screen leaves with a full page load
 * (which stops any sound), so the chord is played on the sign-in page itself: the press arms it (`primeWelcomeSound`,
 * which also starts audio), and once the server confirms the sign-in the screen plays it (`playPrimedWelcomeSound`)
 * and holds the page for `WELCOME_NAVIGATION_HOLD_MS` before moving on. The arm lives in this page's memory only, so
 * a reload (or a sign-in that finishes without a press in this page) plays nothing; an arm older than
 * `WELCOME_PRIMED_MAX_AGE_MS` is dropped rather than played late.
 */
export const WELCOME_PRIMED_MAX_AGE_MS = 30_000
/** How long the sign-in page waits after starting the chord before it navigates (the chord is cut by the page load). */
export const WELCOME_NAVIGATION_HOLD_MS = 1_200

/** A press arms the chord; one success plays it at most once. Pure, so tests can drive it. */
export function createWelcomeGate() {
  let armedAt: number | null = null
  return {
    arm(now: number) {
      armedAt = now
    },
    /** True once for an arm made within the limit; always clears it. */
    take(now: number): boolean {
      const at = armedAt
      armedAt = null
      return at != null && now - at >= 0 && now - at <= WELCOME_PRIMED_MAX_AGE_MS
    },
  }
}

const welcomeGate = createWelcomeGate()

/**
 * Call inside the person's sign-in press (the submit, passkey or code button): arms the chord and creates / resumes
 * audio while the browser allows it, only when sounds are on in this browser. Never throws.
 */
export function primeWelcomeSound(): void {
  try {
    if (!feedbackSoundsEnabled()) return
    welcomeGate.arm(Date.now())
    player()?.unlock()
  } catch {
    // never throw
  }
}

/**
 * The server confirmed the sign-in: plays the chord now if a press in this page armed it (and sounds are on).
 * Returns true when it played, so the caller can hold the page briefly before it navigates. Never throws.
 */
export function playPrimedWelcomeSound(): boolean {
  try {
    if (!welcomeGate.take(Date.now())) return false
    if (!feedbackSoundsEnabled()) return false
    player()?.play('signedIn')
    return true
  } catch {
    return false
  }
}
