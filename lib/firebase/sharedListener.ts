/**
 * One live listener shared by every screen that asks for the same thing, kept open for a short while after the last
 * screen leaves.
 *
 * Moving between a person's profile, their Edit page and the next person used to stop and start the same
 * whole-collection listener each time, and each start waited for a fresh server answer. With this, a screen that
 * opens while the listener is still open gets the last snapshot at once and every later change as before. The data is
 * the same live data; only the waiting goes away.
 *
 * `key` must name everything the listener depends on (organisation, viewer, query plan): a different key stops the
 * old listener and starts a new one, so another company's or another viewer's rows are never handed on.
 */

type Unsubscribe = () => void

export type SharedListenerOptions = {
  /** How long the listener stays open after the last subscriber leaves. */
  keepAliveMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export type SharedListener<T> = {
  subscribe: (key: string, start: (emit: (value: T) => void) => Unsubscribe, onValue: (value: T) => void) => Unsubscribe
  /** Stops the open listener now (sign-out, tests). */
  reset: () => void
  /** Tests: the key of the open listener, if any. */
  activeKey: () => string | null
}

export const SHARED_LISTENER_KEEP_ALIVE_MS = 60_000

export function createSharedListener<T>(options: SharedListenerOptions = {}): SharedListener<T> {
  const keepAliveMs = options.keepAliveMs ?? SHARED_LISTENER_KEEP_ALIVE_MS
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))

  let entry: {
    key: string
    stop: Unsubscribe
    subscribers: Set<(value: T) => void>
    hasValue: boolean
    last: T | undefined
    idle: unknown
  } | null = null

  const stopEntry = () => {
    if (!entry) return
    const current = entry
    entry = null
    if (current.idle != null) clearTimer(current.idle)
    current.subscribers.clear()
    current.stop()
  }

  const subscribe: SharedListener<T>['subscribe'] = (key, start, onValue) => {
    if (entry && entry.key !== key) stopEntry()
    if (!entry) {
      const created = {
        key,
        stop: (() => undefined) as Unsubscribe,
        subscribers: new Set<(value: T) => void>(),
        hasValue: false,
        last: undefined as T | undefined,
        idle: null as unknown,
      }
      entry = created
      const stop = start((value) => {
        if (entry !== created) return
        created.hasValue = true
        created.last = value
        for (const subscriber of [...created.subscribers]) subscriber(value)
      })
      created.stop = stop
      // `start` may have been replaced by a nested subscribe; stop this one then.
      if (entry !== created) stop()
    }
    const current = entry
    if (current.idle != null) {
      clearTimer(current.idle)
      current.idle = null
    }
    current.subscribers.add(onValue)
    if (current.hasValue) onValue(current.last as T)
    let left = false
    return () => {
      if (left) return
      left = true
      if (entry !== current) return
      current.subscribers.delete(onValue)
      if (current.subscribers.size > 0) return
      current.idle = setTimer(() => {
        if (entry === current && current.subscribers.size === 0) stopEntry()
      }, keepAliveMs)
    }
  }

  return {
    subscribe,
    reset: stopEntry,
    activeKey: () => entry?.key ?? null,
  }
}
