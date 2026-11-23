/**
 * Rulebook 1.44.0 §11: Settings → Data health "Link to a person…" — the reads and the one transaction that add a stored
 * person id to the chosen person's `users/{uid}.formerUserIds`. Shared by "Bookings not linked to a person" and "Leave
 * not linked to a person": both link an id the same way (`linkBookingPersonRefusal` re-checked on fresh reads, then
 * `linkBookingPersonWriteFields`, an admin identity-link write, §16). No rule of its own: every decision is the rulebook's.
 */

import { arrayUnion, collection, doc, documentId, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { auth } from '@/lib/firebase/config'
import {
  linkBookingPersonRefusal,
  linkBookingPersonWriteFields,
  type LinkBookingPersonFiledUnder,
  type LinkCandidateProfile,
} from '@/lib/canonical'

/** A users document as the link rules read it (every document of the organisation, never the email fold). */
export function linkProfile(id: string, data: Record<string, unknown>): LinkCandidateProfile {
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  const str = (value: unknown) => (typeof value === 'string' ? value : null)
  return {
    id,
    firstName: str(data.firstName),
    surname: str(data.surname) ?? str(data.lastName),
    name: str(data.name),
    displayName: str(data.displayName),
    email: str(data.email),
    organizationId: str(data.organizationId),
    isActive: typeof data.isActive === 'boolean' ? data.isActive : null,
    passwordSet: typeof data.passwordSet === 'boolean' ? data.passwordSet : null,
    ghost: data.ghost === true,
    formerUserIds: list(data.formerUserIds),
    sameEmailUserIds: list(data.sameEmailUserIds),
  }
}

/** Every users document of the organisation, read from the server (the picker and the re-check). */
export async function loadOrgRoster(organizationId: string): Promise<LinkCandidateProfile[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), 'users'), where('organizationId', '==', organizationId)))
  return snap.docs.map((row) => linkProfile(row.id, row.data()))
}

/**
 * Rulebook 1.44.0 §11 (`linkBookingPersonImpact`): what else is filed under the id — counted once per document,
 * whichever field names it. Admin reads; a collection the viewer may not read counts as 0 rather than blocking the link.
 */
export async function loadFiledUnder(organizationId: string, personId: string): Promise<LinkBookingPersonFiledUnder> {
  const db = getFirebaseDb()
  const org = (name: string) => collection(db, 'organizations', organizationId, name)
  const count = async (queries: Array<ReturnType<typeof query>>): Promise<number> => {
    const ids = new Set<string>()
    for (const q of queries) {
      try {
        const snap = await getDocs(q)
        for (const d of snap.docs) ids.add(d.id)
      } catch {
        // Not readable for this viewer: leave it out of the count.
      }
    }
    return ids.size
  }
  const prefix = `timesheet_${personId}_`
  const [rateHistoryRows, leaveRecords, timesheets, overtimeRequests, priceWorkItems, expenseItems] = await Promise.all([
    count([
      query(org('operativeDayRateHistory'), where('userId', '==', personId)),
      query(org('operativeDayRateHistory'), where('operativeId', '==', personId)),
    ]),
    count([
      query(org('holidayBookings'), where('userId', '==', personId)),
      query(org('holidayBookings'), where('operativeId', '==', personId)),
    ]),
    count([
      query(org('settings'), where(documentId(), '>=', prefix), where(documentId(), '<', `${prefix}\uf8ff`)),
      query(org('settings'), where('userId', '==', personId)),
    ]),
    count([query(org('overtimeRequests'), where('userId', '==', personId))]),
    count([query(org('priceWorkItems'), where('userId', '==', personId))]),
    count([query(org('expenseItems'), where('userId', '==', personId))]),
  ])
  return { rateHistoryRows, leaveRecords, timesheets, overtimeRequests, priceWorkItems, expenseItems }
}

export type LinkPersonIdOutcome = { refused: string } | { wrote: boolean }

/**
 * Reads the organisation's people and `operatives` rows fresh, then in one transaction re-reads the chosen person,
 * asks `linkBookingPersonRefusal` and writes `linkBookingPersonWriteFields` (arrayUnion onto `formerUserIds` plus write
 * metadata). `{ wrote: false }` when the id was already listed (show `LINK_BOOKING_PERSON_ALREADY_MESSAGE`).
 */
export async function linkPersonIdToPerson(input: {
  organizationId: string
  personId: string
  targetId: string
  viewerIds: readonly string[]
}): Promise<LinkPersonIdOutcome> {
  const db = getFirebaseDb()
  const [freshRoster, operativeSnap] = await Promise.all([
    loadOrgRoster(input.organizationId),
    getDocs(collection(db, 'organizations', input.organizationId, 'operatives')),
  ])
  const freshOperatives = operativeSnap.docs.map((d) => ({
    id: d.id,
    email: typeof d.data().email === 'string' ? (d.data().email as string) : null,
  }))
  const ref = doc(db, 'users', input.targetId)
  return runTransaction(db, async (tx): Promise<LinkPersonIdOutcome> => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return { refused: 'That person no longer exists. Check again to refresh the list.' }
    // The chosen person as stored right now, laid over the fresh roster.
    const target = linkProfile(snap.id, snap.data())
    const rosterNow = [...freshRoster.filter((r) => r.id !== snap.id), target]
    const refusal = linkBookingPersonRefusal({
      personId: input.personId,
      targetId: input.targetId,
      roster: rosterNow,
      operatives: freshOperatives,
      organizationId: input.organizationId,
      viewerIds: input.viewerIds,
    })
    if (refusal) return { refused: refusal.message }
    const write = linkBookingPersonWriteFields({
      person: { id: snap.id, formerUserIds: target.formerUserIds ?? [] },
      personId: input.personId,
      actorUserId: auth?.currentUser?.uid ?? '',
      platform: 'web',
    })
    if (!write) return { wrote: false }
    tx.update(ref, {
      formerUserIds: arrayUnion(...write.arrayUnion.formerUserIds),
      ...write.set,
      updatedAt: serverTimestamp(),
    })
    return { wrote: true }
  })
}

/** A refused or failed link: `permissionMessage` for a permission refusal, else the error's message, else `fallback`. */
export function linkPersonIdErrorMessage(err: unknown, fallback: string, permissionMessage: string): string {
  if (err instanceof Error && /permission/i.test(err.message)) return permissionMessage
  return err instanceof Error ? err.message : fallback
}
