/**
 * Rulebook 1.26.0 §8 / §16: the web roster reads pay pay-profile first. Which pay profiles this viewer reads is
 * `payProfileReadPlan` (admins the whole collection, everyone else one document per person whose pay they may see,
 * `canViewPersonPay`); each roster users document is laid over with its pay profile by `overlayPayProfile` before it
 * is parsed. So once `privatePay` is on (no new pay on users documents) and after the strip (no pay left on them),
 * timesheets, Manage Users, invoices and the weekly report still show pay to the people who may see it — and to
 * nobody else, because the rules refuse their reads.
 *
 * An invited person's pay may sit on the pay profile of their invite placeholder (written at Add User while
 * `privatePay` is on); a users document is laid over with the profile of its own id first, else of one of its
 * `formerUserIds`.
 *
 * Only while `privatePay` is on for the organisation (`securitySwitchOn`). While it is off, older app builds still write
 * pay only to `users` / `operatives` / `managers`, so a pay profile can be stale: the roster is read from those
 * documents unchanged, exactly as before 1.26.0. The people profile (`UserProfileSummary`) follows the same gate
 * through `readsPersonPayProfile` / `personPayRecord`.
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  onPlatformConfigChange,
  privatePayFor,
  securitySwitchesLoaded,
  securitySwitchesReady,
} from '@/lib/access/securitySwitches'
import { loadPayProfile } from '@/lib/pay/payProfileService'
import {
  PAY_PROFILES_COLLECTION,
  catalogueOperativePaySubjects,
  overlayPayProfile,
  parsePayProfileDocument,
  payEditorStartingValues,
  payProfileReadPlan,
  type CatalogueOperativeRow,
  type PayProfileDocument,
  type PaySubject,
  type PayViewer,
} from '@/lib/canonical'

let cacheOrganizationId = ''
// Rulebook 1.27.0 §8 (`catalogueOperativePaySubjects`): the open organisation's `operatives` rows as stored, so the
// pay-profile and rate-history plans include the catalogue operatives (rows with no app account).
let operativeRowsOrganizationId = ''
let operativeRows: CatalogueOperativeRow[] = []

/**
 * Records the `operatives` rows of `organizationId` as read (`{ id, ...data }`). Returns true when the set of rows that
 * could be catalogue operatives changed, so the caller re-reads the pay profiles.
 */
export function noteOperativeRows(organizationId: string, rows: ReadonlyArray<CatalogueOperativeRow>): boolean {
  const key = (list: ReadonlyArray<CatalogueOperativeRow>) =>
    JSON.stringify(list.map((row) => [row.id, row.email ?? '', row.linkedUserId ?? '', row.userId ?? '', row.uid ?? '']).sort())
  const changed = operativeRowsOrganizationId !== organizationId || key(operativeRows) !== key(rows)
  operativeRowsOrganizationId = organizationId
  operativeRows = [...rows]
  return changed
}

/**
 * The pay subjects of `organizationId` for `payProfileReadPlan` / `rateHistoryQueryPlan` (rulebook 1.27.0): the roster
 * (users documents) and the catalogue operatives among the `operatives` rows (`catalogueOperativePaySubjects`).
 */
export function payPlanSubjects(
  organizationId: string,
  roster: ReadonlyArray<PaySubject & { formerUserIds?: ReadonlyArray<string> | null }>
): PaySubject[] {
  const rows = operativeRowsOrganizationId === organizationId ? operativeRows : []
  return [...roster, ...catalogueOperativePaySubjects(rows, roster as never)]
}
let profiles = new Map<string, PayProfileDocument>()
let inFlight: Promise<boolean> | null = null

// Pay strip readiness. `cacheVersion` goes up whenever what is cached changes. A list laid over with the cache (the
// roster, the operatives rows) notes the version it was parsed with; it is "settled" only when that is the current
// version. `loadedOrganizationId` is the organisation whose last read (while `privatePay` was on) answered;
// `failedOrganizationId` the one whose whole-collection read failed.
let cacheVersion = 0
let loadedOrganizationId = ''
let failedOrganizationId = ''
let rosterOverlaid = { organizationId: '', version: -1 }
let operativesOverlaid = { organizationId: '', version: -1 }
const versionListeners = new Set<(organizationId: string) => void>()
const statusListeners = new Set<() => void>()
let watchingSwitches = false

function notifyStatus(): void {
  for (const listener of statusListeners) {
    try {
      listener()
    } catch {
      // A listener's failure never stops the others.
    }
  }
}

function bumpVersion(organizationId: string): void {
  cacheVersion += 1
  for (const listener of versionListeners) {
    try {
      listener(organizationId)
    } catch {
      // A listener's failure never stops the others.
    }
  }
}

/** The version of the pay-profile cache; a list parsed through `overlayRosterPay` notes it (see `notePayRosterOverlaid`). */
export function payProfileCacheVersion(): number {
  return cacheVersion
}

/** Called when the cache changes (a list parsed with an older version should be read again). Returns the unsubscribe. */
export function onPayProfileCacheChange(listener: (organizationId: string) => void): () => void {
  versionListeners.add(listener)
  return () => versionListeners.delete(listener)
}

/** The roster of `organizationId` was parsed through `overlayRosterPay` with cache `version`. */
export function notePayRosterOverlaid(organizationId: string, version: number): void {
  rosterOverlaid = { organizationId, version }
  notifyStatus()
}

/** The `operatives` rows of `organizationId` were parsed through `overlayRosterPay` with cache `version`. */
export function notePayOperativesOverlaid(organizationId: string, version: number): void {
  if (operativesOverlaid.organizationId === organizationId && operativesOverlaid.version === version) return
  operativesOverlaid = { organizationId, version }
  notifyStatus()
}

export type PayProfilesStatus = 'loading' | 'ready' | 'failed'

/** How one pay-profile read ended: answered, refused by the rules, or not reached (offline / timed out). */
export type PayProfileReadOutcome = { kind: 'read' | 'refused' | 'offline'; planned: boolean }

/** `permission-denied` is a refusal; every other error is the network (offline, unavailable, timed out). */
export function payProfileReadErrorKind(error: unknown): 'refused' | 'offline' {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'permission-denied' || code === 'firestore/permission-denied' ? 'refused' : 'offline'
}

/**
 * Pay strip: whether a refresh counts. `failed` when a read the plan asks for (a person whose pay the viewer may see,
 * `payProfileReadPlan`) was refused, or was not reached with no earlier answer to fall back on. A refusal of a former
 * invite id (read only in case it holds the invited pay; the rules may refuse an id with no users document) does not
 * count. An offline read with an earlier answer keeps that answer (`ok`).
 */
export function payProfileReadVerdict(
  outcomes: ReadonlyArray<PayProfileReadOutcome>,
  options: { hadEarlierRead: boolean }
): 'ok' | 'failed' {
  for (const row of outcomes) {
    if (row.kind === 'refused' && row.planned) return 'failed'
    if (row.kind === 'offline' && !options.hadEarlierRead) return 'failed'
  }
  return 'ok'
}

/**
 * Whether the pay laid over the roster (and the operatives rows, once loaded) of `organizationId` is final, so a screen
 * may price, sign, invoice, export or build a report from it (pay strip). `ready` straight away while `privatePay` is
 * off (the users documents hold the pay, exactly as before). While it is on: `loading` until the switches have been
 * read, the viewer's pay profiles have been read for this organisation (no read in flight) and the roster was parsed
 * with that read; `failed` when the whole-collection read failed.
 */
export function payProfilesStatusFor(organizationId: string | null | undefined): PayProfilesStatus {
  if (!organizationId) return 'loading'
  if (!securitySwitchesLoaded()) return 'loading'
  if (!privatePayFor(organizationId)) return 'ready'
  if (failedOrganizationId === organizationId) return 'failed'
  // A refresh in flight does not re-open the wait once a read has answered (no flicker): the cache keeps the last
  // answer until the new one lands, and only a change (a new cache version) re-opens it.
  if (loadedOrganizationId !== organizationId || cacheOrganizationId !== organizationId) return 'loading'
  if (rosterOverlaid.organizationId !== organizationId || rosterOverlaid.version !== cacheVersion) return 'loading'
  if (operativesOverlaid.organizationId === organizationId && operativesOverlaid.version !== cacheVersion) return 'loading'
  return 'ready'
}

/** Called when `payProfilesStatusFor` may have changed. Returns the unsubscribe. */
export function onPayProfilesStatusChange(listener: () => void): () => void {
  if (!watchingSwitches) {
    watchingSwitches = true
    onPlatformConfigChange(notifyStatus)
  }
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

/** Resolves with the status once it is no longer `loading`, or `loading` after `timeoutMs`. */
export function whenPayProfilesSettled(organizationId: string, timeoutMs = 20000): Promise<PayProfilesStatus> {
  const now = payProfilesStatusFor(organizationId)
  if (now !== 'loading') return Promise.resolve(now)
  return new Promise((resolve) => {
    let done = false
    const finish = (status: PayProfilesStatus) => {
      if (done) return
      done = true
      clearTimeout(timer)
      stop()
      resolve(status)
    }
    const stop = onPayProfilesStatusChange(() => {
      const next = payProfilesStatusFor(organizationId)
      if (next !== 'loading') finish(next)
    })
    const timer = setTimeout(() => finish(payProfilesStatusFor(organizationId)), timeoutMs)
    void securitySwitchesReady().then(() => {
      const next = payProfilesStatusFor(organizationId)
      if (next !== 'loading') finish(next)
    })
  })
}

/** The cached pay profile of `person` in `organizationId` (own id, else a former id), or null. */
export function cachedPayProfileFor(
  organizationId: string,
  person: { id: string; formerUserIds?: ReadonlyArray<string> | null }
): PayProfileDocument | null {
  if (!organizationId || organizationId !== cacheOrganizationId) return null
  const own = profiles.get(person.id)
  if (own) return own
  for (const id of person.formerUserIds ?? []) {
    const found = id ? profiles.get(id) : undefined
    if (found) return found
  }
  return null
}

function storedIds(data: Record<string, unknown>): string[] {
  const former = Array.isArray(data.formerUserIds) ? data.formerUserIds : []
  return former.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim())
}

/**
 * Whether one person's pay profile is read for display (the people profile): only while `privatePay` is on for
 * `organizationId`. Off, nothing is read and the users document's pay is shown, as on the roster.
 */
export function readsPersonPayProfile(organizationId: string | null | undefined): boolean {
  return Boolean(organizationId) && privatePayFor(organizationId)
}

/**
 * The users document `data` with its pay taken from `profile` (`overlayPayProfile`) only while `privatePay` is on for
 * `organizationId`. Off, `data` is returned unchanged, so a stale pay profile is never shown or used as a starting value.
 */
export function personPayRecord(
  organizationId: string | null | undefined,
  data: Record<string, unknown>,
  profile: PayProfileDocument | null | undefined
): Record<string, unknown> {
  // Rulebook 1.26.1 §8: the display and every pay editor take the same value (`payEditorStartingValues`).
  return payEditorStartingValues(data, profile, { privatePay: readsPersonPayProfile(organizationId) }).record
}

/**
 * Rulebook 1.26.1 §8 (`payEditorStartingValues`): the stored person document `data` (a `users` or `operatives` row,
 * id `subjectId`) a pay editor starts from and diffs its save against. While `privatePay` is off for `organizationId`
 * no pay profile is read and `data` is returned unchanged (as before 1.26.1). While it is on, the pay profile of
 * `subjectId` (else of one of its `formerUserIds`) is read and laid over, so the editor shows — and its save, its
 * "rate changed?" test and its rate-history "previous" row start from — the same pay the people profile shows. A
 * refused or missing read keeps `data`.
 */
export async function payEditorRecord(
  organizationId: string | null | undefined,
  subjectId: string,
  data: Record<string, unknown>,
  load: (organizationId: string, subjectId: string) => Promise<PayProfileDocument | null> = defaultLoadPayProfile
): Promise<Record<string, unknown>> {
  if (!organizationId || !subjectId) return data
  await securitySwitchesReady()
  const privatePay = readsPersonPayProfile(organizationId)
  if (!privatePay) return payEditorStartingValues(data, null, { privatePay }).record
  let profile: PayProfileDocument | null = null
  for (const id of [subjectId, ...storedIds(data)]) {
    profile = await load(organizationId, id).catch(() => null)
    if (profile) break
  }
  return payEditorStartingValues(data, profile, { privatePay }).record
}

/**
 * Starts reading `subjectId`'s own pay profile now, while the caller is still reading the users document, and returns
 * a loader for `payEditorRecord` that answers that one read from the read already started (every other id is read as
 * before). Same documents, same result: only the two reads overlap instead of running one after the other. The early
 * read is made only while `privatePay` is on for `organizationId`; if it was off then and `payEditorRecord` finds it
 * on, the loader reads again.
 */
export function startPayEditorProfileRead(
  organizationId: string | null | undefined,
  subjectId: string,
  load: (organizationId: string, subjectId: string) => Promise<PayProfileDocument | null> = defaultLoadPayProfile
): (organizationId: string, subjectId: string) => Promise<PayProfileDocument | null> {
  if (!organizationId || !subjectId) return load
  const early = (async (): Promise<{ read: boolean; profile: PayProfileDocument | null }> => {
    await securitySwitchesReady()
    if (!readsPersonPayProfile(organizationId)) return { read: false, profile: null }
    return { read: true, profile: await load(organizationId, subjectId).catch(() => null) }
  })()
  return async (org, id) => {
    if (org !== organizationId || id !== subjectId) return load(org, id)
    const result = await early
    return result.read ? result.profile : load(org, id)
  }
}

function defaultLoadPayProfile(organizationId: string, subjectId: string): Promise<PayProfileDocument | null> {
  return loadPayProfile(organizationId, subjectId)
}

/** The users / operatives document `data` (id `docId`) with its pay taken from its pay profile when one was read. */
export function overlayRosterPay(
  organizationId: string,
  docId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!organizationId || organizationId !== cacheOrganizationId || profiles.size === 0) return data
  if (!privatePayFor(organizationId)) return data
  const profile = profiles.get(docId) ?? storedIds(data).map((id) => profiles.get(id)).find(Boolean) ?? null
  return profile ? overlayPayProfile(data, profile) : data
}

function sameProfiles(a: Map<string, PayProfileDocument>, b: Map<string, PayProfileDocument>): boolean {
  if (a.size !== b.size) return false
  for (const [id, profile] of a) {
    const other = b.get(id)
    if (!other || JSON.stringify(other.fields) !== JSON.stringify(profile.fields)) return false
  }
  return true
}

/**
 * Reads the pay profiles this viewer may read for `organizationId` (`payProfileReadPlan`) into the cache. Resolves true
 * when what is cached changed (the roster should be re-read through `overlayRosterPay`). A refused or failed read
 * leaves that person on their users document, as before 1.26.0.
 */
export async function refreshPayProfiles(
  organizationId: string,
  viewer: PayViewer | null | undefined,
  roster: ReadonlyArray<PaySubject & { formerUserIds?: ReadonlyArray<string> | null }>
): Promise<boolean> {
  if (!organizationId || !viewer) return false
  if (inFlight) await inFlight.catch(() => false)
  // Off: no pay-profile read and nothing laid over (a stale profile never replaces the users document's pay).
  if (!privatePayFor(organizationId)) {
    const had = cacheOrganizationId === organizationId && profiles.size > 0
    cacheOrganizationId = organizationId
    profiles = new Map()
    if (had) bumpVersion(organizationId)
    notifyStatus()
    return had
  }
  if (!db) return false
  const firestore = db
  const run = (async () => {
    // 1.27.0: the catalogue operatives too, so a manager with the Operatives toggle reads `payProfiles/{rowId}`.
    const plan = payProfileReadPlan(viewer, payPlanSubjects(organizationId, roster), roster as never)
    // Pay strip: what is cached for this organisation from an earlier read that answered (the offline fallback).
    const previous = loadedOrganizationId === organizationId && cacheOrganizationId === organizationId ? profiles : null
    const outcomes: PayProfileReadOutcome[] = []
    const next = new Map<string, PayProfileDocument>()
    if (plan.kind === 'all') {
      try {
        const snap = await getDocs(collection(firestore, 'organizations', organizationId, PAY_PROFILES_COLLECTION))
        for (const entry of snap.docs) next.set(entry.id, parsePayProfileDocument(entry.id, entry.data() as Record<string, unknown>))
        outcomes.push({ kind: 'read', planned: true })
      } catch (error) {
        outcomes.push({ kind: payProfileReadErrorKind(error), planned: true })
        if (previous) for (const [id, profile] of previous) next.set(id, profile)
      }
    } else {
      const byId = new Map(roster.map((person) => [String(person.id ?? ''), person]))
      const planned = new Set(plan.ids)
      const ids = new Set<string>()
      for (const id of plan.ids) {
        ids.add(id)
        for (const former of byId.get(id)?.formerUserIds ?? []) if (former) ids.add(former)
      }
      await Promise.all(
        [...ids].map(async (id) => {
          try {
            const snap = await getDoc(doc(firestore, 'organizations', organizationId, PAY_PROFILES_COLLECTION, id))
            if (snap.exists()) next.set(snap.id, parsePayProfileDocument(snap.id, snap.data() as Record<string, unknown>))
            outcomes.push({ kind: 'read', planned: planned.has(id) })
          } catch (error) {
            const kind = payProfileReadErrorKind(error)
            outcomes.push({ kind, planned: planned.has(id) })
            // Offline only: keep what an earlier read gave for this id. Never after a refusal.
            const kept = kind === 'offline' ? previous?.get(id) : undefined
            if (kept) next.set(id, kept)
          }
        })
      )
    }
    const verdict = payProfileReadVerdict(outcomes, { hadEarlierRead: previous != null })
    if (verdict === 'failed') {
      failedOrganizationId = organizationId
      // A refused read never keeps an earlier copy (the viewer may have lost the right to see it).
      if (outcomes.some((row) => row.kind === 'refused' && row.planned) && cacheOrganizationId === organizationId && profiles.size > 0) {
        profiles = new Map()
        bumpVersion(organizationId)
      }
      return false
    }
    const changed = cacheOrganizationId !== organizationId ? next.size > 0 : !sameProfiles(profiles, next)
    cacheOrganizationId = organizationId
    profiles = next
    loadedOrganizationId = organizationId
    if (failedOrganizationId === organizationId) failedOrganizationId = ''
    if (changed) bumpVersion(organizationId)
    return changed
  })()
  inFlight = run
  notifyStatus()
  try {
    return await run
  } finally {
    if (inFlight === run) inFlight = null
    notifyStatus()
  }
}

/**
 * Rulebook 1.40.0 (review r306 #3): resolves once the security switches have answered and any pay-profile read in
 * flight has finished, so a caller that overlays raw documents (`overlayRosterPay`) does not read them half laid over.
 */
export async function payProfilesSettled(): Promise<void> {
  await securitySwitchesReady()
  if (inFlight) await inFlight.catch(() => false)
}

/** Tests only. */
export function setPayProfilesForTests(organizationId: string, rows: PayProfileDocument[]): void {
  cacheOrganizationId = organizationId
  loadedOrganizationId = organizationId
  failedOrganizationId = ''
  profiles = new Map(rows.map((row) => [row.subjectId, row]))
  bumpVersion(organizationId)
  notifyStatus()
}

/** Tests only: a refresh in flight (null: none). */
export function setPayProfilesInFlightForTests(pending: Promise<boolean> | null): void {
  inFlight = pending
  notifyStatus()
}

/** Tests only: forget every read, version and note. */
export function resetPayProfilesForTests(): void {
  cacheOrganizationId = ''
  loadedOrganizationId = ''
  failedOrganizationId = ''
  profiles = new Map()
  rosterOverlaid = { organizationId: '', version: -1 }
  operativesOverlaid = { organizationId: '', version: -1 }
  inFlight = null
  cacheVersion += 1
}
