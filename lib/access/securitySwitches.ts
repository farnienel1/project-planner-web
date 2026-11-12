/**
 * Rulebook 1.26.0 §18: the two security switches on `platformConfig/app` (`enforcedReads`, `privatePay`), as the
 * security rules read them. The decision is `securitySwitchOn` in `lib/canonical/platformConfig.ts`; this file only
 * listens to the one document and tells the stores when the value for the open organisation changes, so the web app
 * plans its reads and pay writes for the switch as it is now — on or off — and never asks for a read the rules refuse.
 *
 * The document is readable by anyone (§18). A failed read keeps the last value (off before any read), which is the
 * rules' own default when the document is missing.
 */
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  currentOrganizationId,
  ghostAccountsEnabled,
  dataCheckPanelEnabled,
  PLATFORM_CONFIG_APP_PATH,
  securitySwitchOn,
  type SecuritySwitch,
} from '@/lib/canonical'

let config: Record<string, unknown> | null = null
let unsubscribe: Unsubscribe | null = null
let loaded = false
let readyWaiters: Array<() => void> = []
const changeListeners = new Set<(name: SecuritySwitch) => void>()
const configListeners = new Set<() => void>()

/** How long a store waits for the first read before planning with the last value (ms). */
const FIRST_READ_WAIT_MS = 3000

function markLoaded() {
  if (loaded) return
  loaded = true
  for (const resolve of readyWaiters.splice(0)) resolve()
}

function start(): void {
  if (unsubscribe || !db) {
    if (!db) markLoaded()
    return
  }
  const [collectionName, documentId] = PLATFORM_CONFIG_APP_PATH.split('/')
  unsubscribe = onSnapshot(
    doc(db, collectionName, documentId),
    (snap) => {
      const previous = config
      config = snap.exists() ? ((snap.data() ?? {}) as Record<string, unknown>) : null
      markLoaded()
      notifyChanges(previous, config)
      notifyConfigListeners()
    },
    () => markLoaded()
  )
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

/** Resolves once `platformConfig/app` has been read once (or failed), or after a short wait. */
export function securitySwitchesReady(): Promise<void> {
  start()
  if (loaded) return Promise.resolve()
  return new Promise<void>((resolve) => {
    readyWaiters.push(resolve)
    setTimeout(resolve, FIRST_READ_WAIT_MS)
  })
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
 * Rulebook 1.38.0 §27 (owner change 11 Nov): whether the Data check panel may be shown for this organisation —
 * `dataCheckPanelEnabled(platformConfig/app, organizationId)`. Off before the first read and when missing. The check
 * itself always runs, silently.
 */
export function dataCheckPanelEnabledFor(organizationId?: string | null): boolean {
  start()
  return dataCheckPanelEnabled(config, organizationId ?? currentOrganizationId())
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
  const previous = config
  config = next
  loaded = true
  notifyChanges(previous, next)
  notifyConfigListeners()
}
