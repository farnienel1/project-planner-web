/**
 * Rulebook 1.33.0 §11 (`canChangeLineManager`): the invitation the signed-in person sent to `email` in this
 * organisation, for an Operatives-toggle manager who may still set the line manager of their own unaccepted invite.
 * Lists only invitations the caller sent (`invitedBy == uid`, what the security rules allow a list of).
 */
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'

export type SentInvitation = { accepted: boolean; invitedBy: string }

export async function loadSentInvitation(input: {
  organizationId: string
  uid: string
  email: string
}): Promise<SentInvitation | null> {
  const email = input.email.trim().toLowerCase()
  if (!input.organizationId || !input.uid || !email) return null
  const snap = await getDocs(
    query(collection(getFirebaseDb(), 'invitations'), where('invitedBy', '==', input.uid), where('email', '==', email))
  )
  const rows = snap.docs
    .map((row) => row.data())
    .filter((data) => String(data.organizationId ?? '') === input.organizationId)
  if (rows.length === 0) return null
  // Any open (not used) invitation from this person counts; otherwise it has been accepted.
  const open = rows.some((data) => data.isUsed !== true)
  return { accepted: !open, invitedBy: input.uid }
}
