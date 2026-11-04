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
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'
import { loadPayProfile } from '@/lib/pay/payProfileService'
import {
  PAY_PROFILES_COLLECTION,
  overlayPayProfile,
  parsePayProfileDocument,
  payEditorStartingValues,
  payProfileReadPlan,
  type PayProfileDocument,
  type PaySubject,
  type PayViewer,
} from '@/lib/canonical'

let cacheOrganizationId = ''
let profiles = new Map<string, PayProfileDocument>()
let inFlight: Promise<boolean> | null = null

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
    return had
  }
  if (!db) return false
  const firestore = db
  const run = (async () => {
    const plan = payProfileReadPlan(viewer, roster, roster as never)
    const next = new Map<string, PayProfileDocument>()
    if (plan.kind === 'all') {
      try {
        const snap = await getDocs(collection(firestore, 'organizations', organizationId, PAY_PROFILES_COLLECTION))
        for (const entry of snap.docs) next.set(entry.id, parsePayProfileDocument(entry.id, entry.data() as Record<string, unknown>))
      } catch {
        return false
      }
    } else {
      const byId = new Map(roster.map((person) => [String(person.id ?? ''), person]))
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
          } catch {
            // Not readable by this viewer (the rules decide): that person keeps the users document's pay.
          }
        })
      )
    }
    const changed = cacheOrganizationId !== organizationId ? next.size > 0 : !sameProfiles(profiles, next)
    cacheOrganizationId = organizationId
    profiles = next
    return changed
  })()
  inFlight = run
  try {
    return await run
  } finally {
    if (inFlight === run) inFlight = null
  }
}

/** Tests only. */
export function setPayProfilesForTests(organizationId: string, rows: PayProfileDocument[]): void {
  cacheOrganizationId = organizationId
  profiles = new Map(rows.map((row) => [row.subjectId, row]))
}
