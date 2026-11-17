/**
 * Rulebook 1.26.0 §18: the two security switches on `platformConfig/app` (`enforcedReads`, `privatePay`), as the
 * security rules read them. The decision is `securitySwitchOn` in `lib/canonical/platformConfig.ts`; this file only
 * listens to the one document and tells the stores when the value for the open organisation changes, so the web app
 * plans its reads and pay writes for the switch as it is now — on or off — and never asks for a read the rules refuse.
 *
 * The document is readable by anyone (§18). The switches are known only after a server answer, or a cached copy of the
 * document (review #342 item 2); until then — and after a read error, which is retried — `securitySwitchesLoaded` is
 * false and pay screens wait, never treating "not read" as "off".
 */
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  appUpdateRequired,
  currentOrganizationId,
  ghostAccountsEnabled,
  operativeOwnLeaveEnabled,
  dataCheckPanelEnabled,
  PLATFORM_CONFIG_APP_PATH,
  securitySwitchOn,
  type SecuritySwitch,
} from '@/lib/canonical'

let config: Record<string, unknown> | null = null
let unsubscribe: Unsubscribe | null = null
let loaded = false
// Tests only: hold the "not read yet" state (with no Firestore in tests, `start` would mark it read at once).
let holdUnreadForTests = false
let readyWaiters: Array<() => void> = []
const changeListeners = new Set<(name: SecuritySwitch) => void>()
const configListeners = new Set<() => void>()

/** How long a store waits for the first read before planning with the last value (ms). */
const FIRST_READ_WAIT_MS = 3000

const loadedWaiters: Array<() => void> = []

function markLoaded() {
  if (loaded) return
  loaded = true
  for (const resolve of readyWaiters.splice(0)) resolve()
  for (const resolve of loadedWaiters.splice(0)) resolve()
}

let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryBaseMs = 2000
let retryMaxMs = 60_000
let retryDelayMs = retryBaseMs
// Re-review #342 item 4: the first read has not arrived after this long — pay screens say "couldn't load settings"
// with Retry instead of waiting with nothing to press. Never read as "off".
let firstReadTimeoutMs = 10_000
let firstReadTimer: ReturnType<typeof setTimeout> | null = null
let timedOut = false

/** One snapshot of `platformConfig/app` as the listener sees it. */
export type PlatformConfigSnapshot = { exists: boolean; fromCache: boolean; data: Record<string, unknown> | null }
type PlatformConfigSubscriber = (onNext: (snapshot: PlatformConfigSnapshot) => void, onError: () => void) => () => void
let subscriberForTests: PlatformConfigSubscriber | null = null

function firestoreSubscriber(): PlatformConfigSubscriber | null {
  if (!db) return null
  const firestore = db
  const [collectionName, documentId] = PLATFORM_CONFIG_APP_PATH.split('/')
  return (onNext, onError) =>
    onSnapshot(
      doc(firestore, collectionName, documentId),
      // Metadata changes too, so the server's confirmation of a cached copy (or of a missing document) is seen.
      { includeMetadataChanges: true },
      (snap) =>
        onNext({
          exists: snap.exists(),
          fromCache: snap.metadata.fromCache,
          data: snap.exists() ? ((snap.data() ?? {}) as Record<string, unknown>) : null,
        }),
      () => onError()
    )
}

/**
 * Review #342 item 2: whether a snapshot of `platformConfig/app` tells what the switches are. A server answer does (a
 * missing document there means every switch is off). A snapshot from the device cache does only when it holds the
 * document — a cache with no copy of it says nothing, so the switches stay unknown (never "off") until the server
 * answers.
 */
export function platformConfigSnapshotIsKnown(snapshot: { exists: boolean; fromCache: boolean }): boolean {
  return !snapshot.fromCache || snapshot.exists
}

function scheduleRetry(): void {
  if (retryTimer || holdUnreadForTests) return
  const delay = retryDelayMs
  retryDelayMs = Math.min(retryDelayMs * 2, retryMaxMs)
  retryTimer = setTimeout(() => {
    retryTimer = null
    start()
  }, delay)
}

function startFirstReadTimer(): void {
  if (loaded || firstReadTimer || timedOut) return
  firstReadTimer = setTimeout(() => {
    firstReadTimer = null
    if (loaded) return
    timedOut = true
    notifyConfigListeners()
  }, firstReadTimeoutMs)
  ;(firstReadTimer as { unref?: () => void }).unref?.()
}

function start(): void {
  if (holdUnreadForTests) return
  // Re-review #342 item 3: while a retry is waiting, nothing re-subscribes early — the backoff holds.
  if (unsubscribe || retryTimer) return
  const subscribe = subscriberForTests ?? firestoreSubscriber()
  if (!subscribe) {
    markLoaded()
    return
  }
  startFirstReadTimer()
  let errored = false
  const stop = subscribe(
    (snap) => {
      if (!platformConfigSnapshotIsKnown(snap)) return
      retryDelayMs = retryBaseMs
      const previous = config
      config = snap.exists ? snap.data ?? {} : null
      timedOut = false
      if (firstReadTimer) {
        clearTimeout(firstReadTimer)
        firstReadTimer = null
      }
      markLoaded()
      notifyChanges(previous, config)
      notifyConfigListeners()
    },
    () => {
      // Review #342 item 2: an error is "unknown", never "off": keep the last value read (if any) and try again.
      errored = true
      unsubscribe?.()
      unsubscribe = null
      scheduleRetry()
    }
  )
  unsubscribe = errored ? null : stop
  if (errored) stop()
}

/** Re-review #342 item 4: the first read timed out (see `retrySecuritySwitches`). Never means "off". */
export function securitySwitchesTimedOut(): boolean {
  start()
  return !loaded && timedOut
}

/** Retry now (the "couldn't load settings — Retry" button): drop the waiting retry and subscribe again. */
export function retrySecuritySwitches(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryDelayMs = retryBaseMs
  if (!loaded) {
    timedOut = false
    unsubscribe?.()
    unsubscribe = null
  }
  notifyConfigListeners()
  start()
}

function notifyChanges(previous: Record<string, unknown> | null, next: Record<string, unknown> | null) {
  const organizationId = currentOrganizationId()
  for (const name of ['enforcedReads', 'privatePay'] as const) {
    if (securitySwitchOn(previous, organizationId, name) === securitySwitchOn(next, organizationId, name)) continue
    for (const listener of changeListeners) {
      try {
        listener(name)
      } catch {
        // A listener's failure never stops the others.
      }
    }
  }
}

/**
 * Resolves only once `platformConfig/app` has been read (no time-out): for work that must run once the switches are
 * known and never decide on "unknown" (timesheet reminders, review #342 item 6).
 */
export function whenSecuritySwitchesLoaded(): Promise<void> {
  start()
  if (loaded) return Promise.resolve()
  return new Promise<void>((resolve) => {
    loadedWaiters.push(resolve)
  })
}

/** Resolves once `platformConfig/app` has been read once, or after a short wait (then `securitySwitchesLoaded` says which). */
export function securitySwitchesReady(): Promise<void> {
  start()
  if (loaded) return Promise.resolve()
  return new Promise<void>((resolve) => {
    readyWaiters.push(resolve)
    setTimeout(resolve, FIRST_READ_WAIT_MS)
  })
}

/** Whether `platformConfig/app` has been read once (or the read failed). Before that every switch reads off. */
export function securitySwitchesLoaded(): boolean {
  start()
  return loaded
}

/** `securitySwitchOn(platformConfig/app, organizationId, name)`; the open organisation when none is given. */
export function securitySwitchOnFor(name: SecuritySwitch, organizationId?: string | null): boolean {
  start()
  return securitySwitchOn(config, organizationId ?? currentOrganizationId(), name)
}

/** §17: whether job and booking reads are scoped for this organisation (passed as `enforced` to the plans). */
export function enforcedReadsFor(organizationId?: string | null): boolean {
  return securitySwitchOnFor('enforcedReads', organizationId)
}

/** §8 / §16: whether pay is private for this organisation (rate history per person; no pay on shared documents). */
export function privatePayFor(organizationId?: string | null): boolean {
  return securitySwitchOnFor('privatePay', organizationId)
}

function notifyConfigListeners() {
  for (const listener of configListeners) {
    try {
      listener()
    } catch {
      // A listener's failure never stops the others.
    }
  }
}

/**
 * Rulebook 1.34.0 §11 / §18 (owner decision 7 Nov "1b"): whether the Ghost account toggle may be shown for this
 * organisation — `ghostAccountsEnabled(platformConfig/app, organizationId)`. Off before the first read and when the
 * document or field is missing.
 */
export function ghostAccountsEnabledFor(organizationId?: string | null): boolean {
  start()
  return ghostAccountsEnabled(config, organizationId ?? currentOrganizationId())
}

/**
 * Rulebook 1.56.0 §9 / §18: whether operatives read only their own leave in this organisation —
 * `operativeOwnLeaveEnabled(platformConfig/app, organizationId)`. Off before the first read and when the document or
 * field is missing (everyone then reads every leave record, as before 1.56.0). The leave listener re-plans on every
 * read of `platformConfig/app` (`onPlatformConfigChange`).
 */
export function operativeOwnLeaveFor(organizationId?: string | null): boolean {
  start()
  return operativeOwnLeaveEnabled(config, organizationId ?? currentOrganizationId())
}

/**
 * Rulebook 1.38.0 §27 (owner change 11 Nov): whether the Data check panel may be shown for this organisation —
 * `dataCheckPanelEnabled(platformConfig/app, organizationId)`. Off before the first read and when missing. The check
 * itself always runs, silently.
 */
export function dataCheckPanelEnabledFor(organizationId?: string | null): boolean {
  start()
  return dataCheckPanelEnabled(config, organizationId ?? currentOrganizationId())
}

/**
 * Rulebook §18 (`appUpdateRequired`): whether this web build is older than `platformConfig/app.minimumWebVersion`.
 * False before the first read, with no document or field, or an unreadable version — the gate never blocks by mistake.
 */
export function webUpdateRequiredFor(runningBuild: string | null | undefined): boolean {
  start()
  return appUpdateRequired({ platform: 'web', runningBuild: runningBuild ?? '' }, config)
}

/** Called on every read of `platformConfig/app` (any field). Returns the unsubscribe. */
export function onPlatformConfigChange(listener: () => void): () => void {
  start()
  configListeners.add(listener)
  return () => configListeners.delete(listener)
}

/** Called when a switch changes for the open organisation. Returns the unsubscribe. */
export function onSecuritySwitchChange(listener: (name: SecuritySwitch) => void): () => void {
  start()
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}

/** Tests only. */
export function setSecuritySwitchConfigForTests(next: Record<string, unknown> | null): void {
  holdUnreadForTests = false
  const previous = config
  config = next
  markLoaded()
  notifyChanges(previous, next)
  notifyConfigListeners()
}

/**
 * Tests only: a stand-in for the `platformConfig/app` listener, short retry / time-out delays, and a fresh unread state.
 * Pass null to go back to Firestore.
 */
export function setPlatformConfigSubscriberForTests(
  subscriber: PlatformConfigSubscriber | null,
  delays?: { retryBaseMs?: number; retryMaxMs?: number; firstReadTimeoutMs?: number }
): void {
  unsubscribe?.()
  unsubscribe = null
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  if (firstReadTimer) clearTimeout(firstReadTimer)
  firstReadTimer = null
  timedOut = false
  holdUnreadForTests = false
  loaded = false
  config = null
  subscriberForTests = subscriber
  retryBaseMs = delays?.retryBaseMs ?? 2000
  retryMaxMs = delays?.retryMaxMs ?? 60_000
  firstReadTimeoutMs = delays?.firstReadTimeoutMs ?? 10_000
  retryDelayMs = retryBaseMs
}

/** Tests only: `platformConfig/app` not read yet (every switch unknown). */
export function setSecuritySwitchesUnreadForTests(): void {
  holdUnreadForTests = true
  loaded = false
  config = null
}
