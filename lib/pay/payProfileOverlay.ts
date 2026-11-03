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
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  PAY_PROFILES_COLLECTION,
  overlayPayProfile,
  parsePayProfileDocument,
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

/** The users / operatives document `data` (id `docId`) with its pay taken from its pay profile when one was read. */
export function overlayRosterPay(
  organizationId: string,
  docId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!organizationId || organizationId !== cacheOrganizationId || profiles.size === 0) return data
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
  if (!db || !organizationId || !viewer) return false
  if (inFlight) await inFlight.catch(() => false)
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
