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
  /**
   * `start` receives `emit` for each snapshot and `fail` for a listener error: a failed listener is stopped and
   * forgotten at once, so it is never handed to a later subscriber (the next one starts afresh).
   */
  subscribe: (
    key: string,
    start: (emit: (value: T) => void, fail: () => void) => Unsubscribe,
    onValue: (value: T) => void
  ) => Unsubscribe
  /** Stops the open listener now (sign-out, tests). */
  reset: () => void
  /** Stops the open listener unless `keep(key)` says it still belongs (an organisation switch). */
  resetUnless: (keep: (key: string) => boolean) => void
  /** Tests: the key of the open listener, if any. */
  activeKey: () => string | null
}

export const SHARED_LISTENER_KEEP_ALIVE_MS = 60_000

export function createSharedListener<T>(options: SharedListenerOptions = {}): SharedListener<T> {
  const keepAliveMs = options.keepAliveMs ?? SHARED_LISTENER_KEEP_ALIVE_MS
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))

  type Entry = {
    key: string
    stop: Unsubscribe | null
    stopped: boolean
    subscribers: Set<(value: T) => void>
    hasValue: boolean
    last: T | undefined
    idle: unknown
  }
  /** The one entry a new subscriber may share. A failed or superseded entry is never here. */
  let entry: Entry | null = null

  const stopListener = (target: Entry) => {
    if (target.stopped) return
    target.stopped = true
    if (target.idle != null) clearTimer(target.idle)
    target.idle = null
    target.subscribers.clear()
    target.stop?.()
  }

  /** Take `target` out of sharing; it keeps serving the screens already on it and stops when the last one leaves. */
  const retire = (target: Entry) => {
    if (entry === target) entry = null
    if (target.subscribers.size === 0 && target.stop) stopListener(target)
  }

  const stopEntry = () => {
    if (!entry) return
    const current = entry
    entry = null
    stopListener(current)
  }

  const subscribe: SharedListener<T>['subscribe'] = (key, start, onValue) => {
    if (entry && entry.key !== key) retire(entry)
    let current = entry
    if (!current) {
      const created: Entry = { key, stop: null, stopped: false, subscribers: new Set(), hasValue: false, last: undefined, idle: null }
      entry = created
      created.stop = start(
        (value) => {
          if (created.stopped) return
          created.hasValue = true
          created.last = value
          for (const subscriber of [...created.subscribers]) subscriber(value)
        },
        () => retire(created)
      )
      // Failed while starting (before anyone was on it): stop it; this subscriber gets nothing, as a dead listener.
      if (entry !== created) {
        stopListener(created)
        return () => undefined
      }
      current = created
    }
    return attach(current, onValue)
  }

  function attach(current: Entry, onValue: (value: T) => void): Unsubscribe {
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
      current.subscribers.delete(onValue)
      if (current.stopped || current.subscribers.size > 0) return
      if (entry !== current) {
        stopListener(current)
        return
      }
      current.idle = setTimer(() => {
        if (entry === current && current.subscribers.size === 0) stopEntry()
      }, keepAliveMs)
    }
  }

  return {
    subscribe,
    reset: stopEntry,
    resetUnless: (keep) => {
      if (entry && !keep(entry.key)) stopEntry()
    },
    activeKey: () => entry?.key ?? null,
  }
}
