/**
 * One-off repair for bookings orphaned before `users/{uid}.formerUserIds` existed.
 *
 * A person booked while their invite was pending was stored under the invite
 * placeholder id. Accepting the invite deleted that placeholder, and no document
 * kept the placeholder id next to an email (not `invitations`, not `userEmails`).
 * So this cannot prove who an orphaned id was. It proposes a match from timing:
 * the orphan's first reference was written while exactly one invitation in that
 * organisation was still open. A person reviews the proposals before any write.
 *
 * Identity rules come from the rulebook: `labourPersonIds` decides which ids a
 * person already owns, and the write is `USER_FORMER_IDS_FIELD` (append only).
 */

import { labourPersonIds } from '@/lib/canonical'

export type BackfillReferenceSource = 'booking' | 'managerSiteBooking' | 'holiday' | 'warningExclusion'

export type BackfillReference = {
  personId: string
  source: BackfillReferenceSource
  /** When the referencing document was written. Missing for a warning exclusion. */
  createdAt?: Date | null
}

export type BackfillUser = {
  id: string
  email: string
  name: string
  formerIds?: readonly string[] | null
}

export type BackfillInvitation = {
  email: string
  createdAt?: Date | null
  usedAt?: Date | null
  isUsed: boolean
}

export type BackfillCandidate = {
  userId: string
  email: string
  name: string
  /** Plain-English evidence for the reviewer. */
  reason: string
}

export type OrphanProposal = {
  organizationId: string
  orphanId: string
  references: number
  sources: BackfillReferenceSource[]
  firstReferenceAt: string | null
  candidates: BackfillCandidate[]
  /** `matched`: exactly one candidate. `ambiguous`: more than one. `unmatched`: none. */
  status: 'matched' | 'ambiguous' | 'unmatched'
  /** Only entries with `apply: true` are written. Matched entries start true; review them. */
  apply: boolean
  /** The account that would receive `formerUserIds`, when `apply` is true. */
  userId: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Invite placeholders are always UUIDs (`newUuid`). A Firebase Auth uid is not. */
export function looksLikeInvitePlaceholderId(id: string): boolean {
  return UUID_PATTERN.test(id.trim())
}

function emailKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function validDate(value: Date | null | undefined): Date | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Orphaned ids in one organisation and the people they most likely belonged to.
 * An id is orphaned when no user owns it (`labourPersonIds`), no operative record
 * has it, and it has the shape of an invite placeholder.
 */
export function proposeFormerUserIdBackfill(input: {
  organizationId: string
  users: readonly BackfillUser[]
  operativeIds: readonly string[]
  references: readonly BackfillReference[]
  invitations: readonly BackfillInvitation[]
}): OrphanProposal[] {
  const owned = new Set<string>()
  for (const user of input.users) for (const id of labourPersonIds(user)) owned.add(id)
  for (const id of input.operativeIds) owned.add(id)

  const byOrphan = new Map<string, BackfillReference[]>()
  for (const reference of input.references) {
    const id = String(reference.personId || '').trim()
    if (!id || owned.has(id) || !looksLikeInvitePlaceholderId(id)) continue
    const list = byOrphan.get(id) || []
    list.push(reference)
    byOrphan.set(id, list)
  }

  const usersByEmail = new Map<string, BackfillUser>()
  for (const user of input.users) {
    const email = emailKey(user.email)
    if (email && !usersByEmail.has(email)) usersByEmail.set(email, user)
  }
  const usedInvitations = input.invitations.filter((invitation) => invitation.isUsed && emailKey(invitation.email))

  const proposals: OrphanProposal[] = []
  for (const [orphanId, references] of byOrphan) {
    const dated = references
      .map((reference) => validDate(reference.createdAt))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime())
    const first = dated[0] ?? null

    const candidates = new Map<string, BackfillCandidate>()
    if (first) {
      for (const invitation of usedInvitations) {
        const sent = validDate(invitation.createdAt)
        const used = validDate(invitation.usedAt)
        // The placeholder existed from the invite until sign-up. A booking under it
        // was written in that window.
        if (!sent || first < sent) continue
        if (used && first > used) continue
        const user = usersByEmail.get(emailKey(invitation.email))
        if (!user) continue
        const window = used ? `${isoDay(sent)} to ${isoDay(used)}` : `from ${isoDay(sent)} (no accepted date stored)`
        candidates.set(user.id, {
          userId: user.id,
          email: user.email,
          name: user.name,
          reason: `Invite open ${window}; first booking under this id written ${isoDay(first)}.`,
        })
      }
    }

    const list = [...candidates.values()].sort((a, b) => a.email.localeCompare(b.email))
    const status = list.length === 1 ? 'matched' : list.length > 1 ? 'ambiguous' : 'unmatched'
    proposals.push({
      organizationId: input.organizationId,
      orphanId,
      references: references.length,
      sources: [...new Set(references.map((reference) => reference.source))].sort(),
      firstReferenceAt: first ? first.toISOString() : null,
      candidates: list,
      status,
      apply: status === 'matched',
      userId: status === 'matched' ? list[0].userId : null,
    })
  }
  return proposals.sort((a, b) => b.references - a.references || a.orphanId.localeCompare(b.orphanId))
}

/**
 * Reviewed proposals → one append per account. Skips anything not marked
 * `apply`, without a `userId`, or not shaped like a placeholder id.
 */
export function formerUserIdWritesFromProposals(
  proposals: readonly Pick<OrphanProposal, 'orphanId' | 'apply' | 'userId'>[]
): Map<string, string[]> {
  const writes = new Map<string, string[]>()
  for (const proposal of proposals) {
    const userId = String(proposal.userId || '').trim()
    const orphanId = String(proposal.orphanId || '').trim()
    if (proposal.apply !== true || !userId || !looksLikeInvitePlaceholderId(orphanId) || orphanId === userId) continue
    const ids = writes.get(userId) || []
    if (!ids.includes(orphanId)) ids.push(orphanId)
    writes.set(userId, ids)
  }
  return writes
}
