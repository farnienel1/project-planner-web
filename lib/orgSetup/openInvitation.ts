/**
 * Rulebook 1.33.0 §11 (`canChangeLineManager`): the invitation the signed-in person sent to `email` in this
 * organisation, for an Operatives-toggle manager who may still set the line manager of their own unaccepted invite.
 * Queries come from `invitationListConstraints` (this organisation, the email as typed and in lower case, and each
 * value the sender may be stored under: users id or sign-in email), the only list the security rules allow an
 * Operatives manager. Before this, the query named no `organizationId`, so the rules refused it.
 */
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { invitationListConstraints, invitationReadErrorIsSkippable } from '@/lib/canonical'

export type SentInvitation = { accepted: boolean; invitedBy: string }

export async function loadSentInvitation(input: {
  organizationId: string
  uid: string
  email: string
  senderEmail?: string | null
}): Promise<SentInvitation | null> {
  const email = input.email.trim()
  if (!input.organizationId || !input.uid || !email) return null
  const lookups = invitationListConstraints({
    organizationId: input.organizationId,
    email,
    actorManagesOperatives: true,
    senderIds: [input.uid, input.senderEmail],
  })
  const db = getFirebaseDb()
  const seen = new Set<string>()
  const rows: Array<Record<string, unknown>> = []
  for (const constraints of lookups) {
    try {
      const snap = await getDocs(
        query(collection(db, 'invitations'), ...constraints.map(([field, value]) => where(field, '==', value)))
      )
      for (const row of snap.docs) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        rows.push(row.data())
      }
    } catch (error) {
      if (!invitationReadErrorIsSkippable(error)) throw error
    }
  }
  if (rows.length === 0) return null
  // Any open (not used) invitation from this person counts; otherwise it has been accepted.
  const open = rows.some((data) => data.isUsed !== true)
  return { accepted: !open, invitedBy: input.uid }
}
