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
  securitySwitchesTimedOut,
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
// `failedOrganizationId` the one whose whole-collection read (admins) failed — then nobody's pay is known.
// `failedSubjects` holds, per person, the people whose own pay-profile read was refused or not reached (review #342
// item 1): only their sheets, rows and actions fail, never the whole organisation. `answeredIds` are the ids whose
// last read answered (an offline re-read keeps that answer). `rosterFailedOrganizationId`: the roster itself could not
// be read (error or time-out), so nothing was laid over — `failed`, with Retry (review #342 item 4).
let cacheVersion = 0
let loadedOrganizationId = ''
let failedOrganizationId = ''
let failedSubjects: { organizationId: string; ids: Set<string> } = { organizationId: '', ids: new Set() }
let answeredIds: { organizationId: string; ids: Set<string> } = { organizationId: '', ids: new Set() }
let rosterFailedOrganizationId = ''
// Re-review #342 item 2: the people the last pay read was planned for (every roster and catalogue id passed to it, lower
// case). Someone added to the roster after that read has no known pay yet: `loading`, and a read is started for them.
let coveredSubjects: { organizationId: string; ids: Set<string> } = { organizationId: '', ids: new Set() }
let stateVersion = 0
let rosterOverlaid = { organizationId: '', version: -1 }
let operativesOverlaid = { organizationId: '', version: -1 }
const versionListeners = new Set<(organizationId: string) => void>()
const statusListeners = new Set<() => void>()
let watchingSwitches = false

function notifyStatus(): void {
  stateVersion += 1
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
  if (rosterFailedOrganizationId === organizationId) rosterFailedOrganizationId = ''
  notifyStatus()
}

/** The roster of `organizationId` could not be read (an error or a time-out): the pay gate reads `failed` until it is. */
export function notePayRosterLoadFailed(organizationId: string): void {
  if (!organizationId || rosterFailedOrganizationId === organizationId) return
  rosterFailedOrganizationId = organizationId
  notifyStatus()
}

/** The `operatives` rows of `organizationId` were parsed through `overlayRosterPay` with cache `version`. */
export function notePayOperativesOverlaid(organizationId: string, version: number): void {
  if (operativesOverlaid.organizationId === organizationId && operativesOverlaid.version === version) return
  operativesOverlaid = { organizationId, version }
  notifyStatus()
}

export type PayProfilesStatus = 'loading' | 'ready' | 'failed'

/**
 * How one pay-profile read ended: answered, refused by the rules, or not reached (offline / timed out). `id` is the
 * document read (`*` for the whole collection); `subjectId` the person it was read for (the planned id; for a former
 * invite id, the person whose former id it is); `planned` whether the read plan asked for that id itself.
 */
export type PayProfileReadOutcome = {
  kind: 'read' | 'refused' | 'offline'
  planned: boolean
  id?: string
  subjectId?: string
}

/** `permission-denied` is a refusal; every other error is the network (offline, unavailable, timed out). */
export function payProfileReadErrorKind(error: unknown): 'refused' | 'offline' {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'permission-denied' || code === 'firestore/permission-denied' ? 'refused' : 'offline'
}

function personKey(id: string | null | undefined): string {
  return String(id ?? '').trim().toLowerCase()
}

/**
 * Pay strip (review #342 item 1): what a refresh could not read, per person. `wholeOrganization` only when the
 * whole-collection read (admins) was refused, or not reached with no earlier answer — then nobody's pay is known.
 * Otherwise `failedSubjectIds` are the people whose own planned read was refused, or not reached with no earlier answer
 * for that id; a person whose former invite id was not reached (with no earlier answer) too, since it may hold their
 * pay. A refused former invite id does not count (the rules may refuse an id with no users document). Never fails the
 * rest of the organisation because of one person.
 */
export function payProfileReadFailures(
  outcomes: ReadonlyArray<PayProfileReadOutcome>,
  options: { answeredBefore: ReadonlySet<string> }
): { wholeOrganization: boolean; failedSubjectIds: string[] } {
  const failed = new Set<string>()
  let wholeOrganization = false
  for (const row of outcomes) {
    if (row.kind === 'read') continue
    const id = personKey(row.id ?? '*')
    if (id === '*') {
      if (row.kind === 'refused' || !options.answeredBefore.has('*')) wholeOrganization = true
      continue
    }
    const subject = personKey(row.subjectId ?? row.id)
    if (row.kind === 'refused') {
      if (row.planned) failed.add(subject)
      continue
    }
    if (!options.answeredBefore.has(id)) failed.add(subject)
  }
  return { wholeOrganization, failedSubjectIds: [...failed].filter(Boolean).sort() }
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
  // Re-review #342 item 4: not read after the time-out → `failed` (Retry), never "off".
  if (!securitySwitchesLoaded()) return securitySwitchesTimedOut() ? 'failed' : 'loading'
  if (!privatePayFor(organizationId)) return 'ready'
  if (failedOrganizationId === organizationId) return 'failed'
  if (rosterFailedOrganizationId === organizationId) return 'failed'
  // A refresh in flight does not re-open the wait once a read has answered (no flicker): the cache keeps the last
  // answer until the new one lands, and only a change (a new cache version) re-opens it.
  if (loadedOrganizationId !== organizationId || cacheOrganizationId !== organizationId) return 'loading'
  if (rosterOverlaid.organizationId !== organizationId || rosterOverlaid.version !== cacheVersion) return 'loading'
  if (operativesOverlaid.organizationId === organizationId && operativesOverlaid.version !== cacheVersion) return 'loading'
  return 'ready'
}

/** The people of `organizationId` whose pay could not be read (lower-case ids; see `payProfileReadFailures`). */
export function payProfileFailedSubjectIds(organizationId: string | null | undefined): string[] {
  if (!organizationId || failedSubjects.organizationId !== organizationId) return []
  // Review #342: off → nobody's pay read can have failed (no pay-profile read at all).
  if (securitySwitchesLoaded() && !privatePayFor(organizationId)) return []
  return [...failedSubjects.ids].sort()
}

/**
 * Pay strip (review #342 items 1 and 7): whether one person's pay is known — the organisation's status first
 * (`payProfilesStatusFor`), then `failed` when the read of any id the person goes by (`id`, `formerUserIds`) failed.
 */
export function personPayStatus(
  organizationStatus: PayProfilesStatus,
  failedIds: ReadonlyArray<string> | ReadonlySet<string>,
  person: { id: string; formerUserIds?: ReadonlyArray<string> | null } | null | undefined
): PayProfilesStatus {
  if (organizationStatus !== 'ready') return organizationStatus
  if (!person) return 'ready'
  const failed = failedIds instanceof Set ? (failedIds as ReadonlySet<string>) : new Set(failedIds as ReadonlyArray<string>)
  if (failed.size === 0) return 'ready'
  return [person.id, ...(person.formerUserIds ?? [])].some((id) => failed.has(personKey(id))) ? 'failed' : 'ready'
}

/**
 * `personPayStatus` for `organizationId` as it is now, plus (re-review #342 item 2) `loading` for a person who was not
 * on the roster when the pay was last read — their pay is unknown until `refreshPayProfilesForNewPeople` reads it.
 */
export function payProfilesStatusForPerson(
  organizationId: string | null | undefined,
  person: { id: string; formerUserIds?: ReadonlyArray<string> | null } | null | undefined
): PayProfilesStatus {
  const status = personPayStatus(payProfilesStatusFor(organizationId), payProfileFailedSubjectIds(organizationId), person)
  if (status !== 'ready' || !person || !organizationId || !privatePayFor(organizationId)) return status
  if (coveredSubjects.organizationId !== organizationId) return status
  return [person.id, ...(person.formerUserIds ?? [])].some((id) => coveredSubjects.ids.has(personKey(id))) ? status : 'loading'
}

/**
 * 16 Nov scan (rulebook §8, `catalogueOperativePaySubjects`): a catalogue operative (an `operatives` row with no app
 * account, id `operativeId`) is priced from `payProfiles/{rowId}` laid over its row. Its pay is known only once the
 * person's status is ready (`payProfilesStatusForPerson`: the row was in the last read plan, its read did not fail) AND
 * the `operatives` rows were parsed with the current pay-profile cache — before that the row still holds its stripped
 * or stale pay. While `privatePay` is off the row holds the pay, so it is ready with the organisation.
 */
export function payProfilesStatusForCatalogueOperative(
  organizationId: string | null | undefined,
  operativeId: string
): PayProfilesStatus {
  const status = payProfilesStatusForPerson(organizationId, { id: operativeId })
  if (status !== 'ready' || !organizationId || !privatePayFor(organizationId)) return status
  if (operativesOverlaid.organizationId !== organizationId || operativesOverlaid.version !== cacheVersion) return 'loading'
  return status
}

/** Changes whenever any pay status may have changed (for hooks that ask about many people). */
export function payProfileStateVersion(): number {
  return stateVersion
}

/** Ids of `roster` that the last pay read was not planned for (re-review #342 item 2). Empty while `privatePay` is off. */
export function payProfileUncoveredIds(
  organizationId: string,
  roster: ReadonlyArray<{ id?: string | null }>
): string[] {
  if (!organizationId || !privatePayFor(organizationId)) return []
  if (coveredSubjects.organizationId !== organizationId) return []
  return roster.map((row) => String(row.id ?? '')).filter((id) => id && !coveredSubjects.ids.has(personKey(id)))
}

/**
 * Whether Retry has anything to read again for `organizationId` (final check #342 item 2): the organisation or roster
 * failed, a person's read failed, or someone on `roster` has had no pay read yet.
 */
export function payProfilesRetryNeeded(organizationId: string, roster: ReadonlyArray<{ id?: string | null }>): boolean {
  if (!organizationId) return false
  if (payProfilesStatusFor(organizationId) === 'failed') return true
  if (payProfileFailedSubjectIds(organizationId).length > 0) return true
  return payProfileUncoveredIds(organizationId, roster).length > 0
}

/**
 * Re-review #342 item 2: the live roster brought people the last pay read did not plan for — read again (the read
 * plan decides whose pay the viewer may read). Nothing while `privatePay` is off or everyone is covered.
 */
export async function refreshPayProfilesForNewPeople(
  organizationId: string,
  viewer: PayViewer | null | undefined,
  roster: ReadonlyArray<PaySubject & { formerUserIds?: ReadonlyArray<string> | null }>,
  reader: PayProfileReader | null = firestorePayProfileReader()
): Promise<boolean> {
  if (payProfileUncoveredIds(organizationId, roster).length === 0) return false
  return refreshPayProfiles(organizationId, viewer, roster, reader)
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
/** Where `refreshPayProfiles` reads from: Firestore by default; tests pass their own. Each read throws as Firestore does. */
export type PayProfileReader = {
  readCollection: (organizationId: string) => Promise<Array<{ id: string; data: Record<string, unknown> }>>
  readDocument: (organizationId: string, id: string) => Promise<{ id: string; data: Record<string, unknown> } | null>
}

function firestorePayProfileReader(): PayProfileReader | null {
  if (!db) return null
  const firestore = db
  return {
    readCollection: async (organizationId) => {
      const snap = await getDocs(collection(firestore, 'organizations', organizationId, PAY_PROFILES_COLLECTION))
      return snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
    },
    readDocument: async (organizationId, id) => {
      const snap = await getDoc(doc(firestore, 'organizations', organizationId, PAY_PROFILES_COLLECTION, id))
      return snap.exists() ? { id: snap.id, data: snap.data() as Record<string, unknown> } : null
    },
  }
}

export async function refreshPayProfiles(
  organizationId: string,
  viewer: PayViewer | null | undefined,
  roster: ReadonlyArray<PaySubject & { formerUserIds?: ReadonlyArray<string> | null }>,
  reader: PayProfileReader | null = firestorePayProfileReader()
): Promise<boolean> {
  if (!organizationId) return false
  if (!viewer) {
    // Review #342 item 4: the signed-in person is not known yet. The roster store re-runs the overlay once they are
    // (`siteAuditStore`); until then the gate stays `loading`, never `ready` on a stripped roster.
    return false
  }
  if (inFlight) await inFlight.catch(() => false)
  // Off: no pay-profile read and nothing laid over (a stale profile never replaces the users document's pay).
  if (!privatePayFor(organizationId)) {
    const had = cacheOrganizationId === organizationId && profiles.size > 0
    cacheOrganizationId = organizationId
    profiles = new Map()
    // Review #342: a per-person failure or "not read yet" left from while the switch was on never blocks anyone once
    // it is off (the users documents hold the pay).
    if (failedSubjects.organizationId === organizationId) failedSubjects = { organizationId: '', ids: new Set() }
    if (coveredSubjects.organizationId === organizationId) coveredSubjects = { organizationId: '', ids: new Set() }
    if (had) bumpVersion(organizationId)
    notifyStatus()
    return had
  }
  if (!reader) return false
  const run = (async () => {
    // 1.27.0: the catalogue operatives too, so a manager with the Operatives toggle reads `payProfiles/{rowId}`.
    const subjects = payPlanSubjects(organizationId, roster)
    const plan = payProfileReadPlan(viewer, subjects, roster as never)
    let covered = new Set<string>([...roster.map((row) => personKey(String(row.id ?? ''))), ...subjects.map((row) => personKey(String(row.id ?? '')))])
    covered.delete('')
    // Pay strip: what is cached for this organisation from an earlier read that answered (the offline fallback).
    const previous = loadedOrganizationId === organizationId && cacheOrganizationId === organizationId ? profiles : null
    const answeredBefore = answeredIds.organizationId === organizationId ? answeredIds.ids : new Set<string>()
    const outcomes: PayProfileReadOutcome[] = []
    const next = new Map<string, PayProfileDocument>()
    if (plan.kind === 'all') {
      try {
        const rows = await reader.readCollection(organizationId)
        for (const entry of rows) next.set(entry.id, parsePayProfileDocument(entry.id, entry.data))
        outcomes.push({ kind: 'read', planned: true, id: '*' })
      } catch (error) {
        const kind = payProfileReadErrorKind(error)
        outcomes.push({ kind, planned: true, id: '*' })
        // Offline only: keep the earlier answer. Never after a refusal.
        if (kind === 'offline' && previous) for (const [id, profile] of previous) next.set(id, profile)
        // Final check #342 item 1: the earlier answer covers only the people it was read for — someone added since is
        // still unknown (loading), never "ready" on their stripped document.
        covered = coveredSubjects.organizationId === organizationId ? new Set(coveredSubjects.ids) : new Set<string>()
      }
    } else {
      const byId = new Map(roster.map((person) => [String(person.id ?? ''), person]))
      // id read → the planned person it is read for (their own id, or theirs as a former invite id).
      const reads = new Map<string, { subjectId: string; planned: boolean }>()
      for (const id of plan.ids) reads.set(id, { subjectId: id, planned: true })
      for (const id of plan.ids) {
        for (const former of byId.get(id)?.formerUserIds ?? []) {
          if (former && !reads.has(former)) reads.set(former, { subjectId: id, planned: false })
        }
      }
      await Promise.all(
        [...reads].map(async ([id, read]) => {
          try {
            const found = await reader.readDocument(organizationId, id)
            if (found) next.set(found.id, parsePayProfileDocument(found.id, found.data))
            outcomes.push({ kind: 'read', planned: read.planned, id, subjectId: read.subjectId })
          } catch (error) {
            const kind = payProfileReadErrorKind(error)
            outcomes.push({ kind, planned: read.planned, id, subjectId: read.subjectId })
            // Offline only: keep what an earlier read gave for this id. Never after a refusal.
            const kept = kind === 'offline' ? previous?.get(id) : undefined
            if (kept) next.set(id, kept)
          }
        })
      )
    }
    const failures = payProfileReadFailures(outcomes, { answeredBefore })
    const answered = new Set<string>(answeredBefore)
    for (const row of outcomes) {
      const key = personKey(row.id)
      if (row.kind === 'read') answered.add(key)
      else if (row.kind === 'refused') answered.delete(key)
    }
    answeredIds = { organizationId, ids: answered }
    const previousFailed = failedSubjects.organizationId === organizationId ? [...failedSubjects.ids].sort().join('|') : ''
    failedSubjects = { organizationId, ids: new Set(failures.failedSubjectIds) }
    if (failures.wholeOrganization) {
      failedOrganizationId = organizationId
      // A refused read never keeps an earlier copy (the viewer may have lost the right to see it).
      if (outcomes.some((row) => row.kind === 'refused') && cacheOrganizationId === organizationId && profiles.size > 0) {
        profiles = new Map()
        bumpVersion(organizationId)
      }
      return false
    }
    const changed = cacheOrganizationId !== organizationId ? next.size > 0 : !sameProfiles(profiles, next)
    cacheOrganizationId = organizationId
    profiles = next
    loadedOrganizationId = organizationId
    coveredSubjects = { organizationId, ids: covered }
    if (failedOrganizationId === organizationId) failedOrganizationId = ''
    if (changed) bumpVersion(organizationId)
    else if (previousFailed !== failures.failedSubjectIds.join('|')) notifyStatus()
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
export function setPayProfilesForTests(
  organizationId: string,
  rows: PayProfileDocument[],
  options?: { failedSubjectIds?: ReadonlyArray<string>; coveredIds?: ReadonlyArray<string> }
): void {
  cacheOrganizationId = organizationId
  loadedOrganizationId = organizationId
  failedOrganizationId = ''
  failedSubjects = { organizationId, ids: new Set((options?.failedSubjectIds ?? []).map(personKey)) }
  coveredSubjects = options?.coveredIds
    ? { organizationId, ids: new Set(options.coveredIds.map(personKey)) }
    : { organizationId: '', ids: new Set() }
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
  failedSubjects = { organizationId: '', ids: new Set() }
  answeredIds = { organizationId: '', ids: new Set() }
  rosterFailedOrganizationId = ''
  coveredSubjects = { organizationId: '', ids: new Set() }
  profiles = new Map()
  rosterOverlaid = { organizationId: '', version: -1 }
  operativesOverlaid = { organizationId: '', version: -1 }
  operativeRowsOrganizationId = ''
  operativeRows = []
  inFlight = null
  cacheVersion += 1
}
