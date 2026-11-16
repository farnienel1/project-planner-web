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
} as const satisfies Record<string, FeedbackSound | null>

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
export function feedbackSoundFor(event: FeedbackEvent): FeedbackSound | null {
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
  sample: (sound?: FeedbackSound) => void
  /** Creates / resumes the context inside a user gesture (browser autoplay rules) and schedules loading. */
  unlock: () => void
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

  const playSound = (sound: FeedbackSound) => {
    const ctx = ensureContext()
    if (!ctx) return
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

/** The Settings "Play a sample" button: plays even when sounds are off, so the person can hear what they would get. */
export function playFeedbackSample(): void {
  try {
    player()?.sample('success')
  } catch {
    // never throw
  }
}

/**
 * Unlocks audio inside the person's `pointerdown` / `keydown` (browser autoplay rules: the context is created, or
 * resumed after the browser suspended it, during a gesture) and loads the files once while the browser is idle.
 * Mounted once by the app shell; returns the clean-up. Each call after the first is a cheap no-op unless the context
 * was suspended. Someone with sounds off never gets an `AudioContext`.
 */
export function installFeedbackUnlock(): () => void {
  try {
    if (typeof window === 'undefined') return () => undefined
    const onGesture = () => {
      try {
        if (feedbackSoundsEnabled()) player()?.unlock()
      } catch {
        // never throw from a page listener
      }
    }
    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true })
    window.addEventListener('keydown', onGesture, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
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
