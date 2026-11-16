/**
 * "Resend sign-up email" (Manage Users list and Edit User): send the person's existing, unused invitation again, as
 * iOS does (`UserStore.resendInvitationEmail`). It never writes: no new invitation, no placeholder rebuilt from the
 * screen's copy of the user, no email claim. Before this, web called the Add User create path, which the rulebook's
 * `resolveInviteEmailClaim` refuses for a pending invite ("already exists"), and which — when it did get through —
 * overwrote the placeholder from partial fields (line managers, hourly rate, employment type, leave fields lost).
 *
 * Queries come from `invitationListConstraints` (this organisation and email; an Operatives manager's also name
 * `invitedBy`, the only list the security rules allow them). The level is the invitation's own (`invitationRole`).
 */
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { auth } from '@/lib/firebase/config'
import { canManageOperatives, invitationListConstraints, invitationReadErrorIsSkippable, invitationRole } from '@/lib/canonical'
import type { User } from '@/types'

export const RESEND_NO_OPEN_INVITATION_MESSAGE =
  'No open invitation was found for this email. Delete the pending user and add them again to send a new one.'

export type OpenInvitation = {
  id: string
  role: 'admin' | 'manager' | 'operative'
  firstName: string
  createdAtMs: number
}

function instantMs(value: unknown): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const withToDate = value as { toDate?: () => Date; seconds?: number }
  if (typeof withToDate.toDate === 'function') return withToDate.toDate().getTime()
  if (typeof withToDate.seconds === 'number') return withToDate.seconds * 1000
  if (typeof value === 'string') return Date.parse(value) || 0
  return 0
}

/** Newest first; `isUsed` true rows are left out. Pure, for tests. */
export function pickOpenInvitation(rows: ReadonlyArray<{ id: string; data: Record<string, unknown> }>): OpenInvitation | null {
  const open = rows
    .filter((row) => row.data.isUsed !== true)
    .map((row): OpenInvitation => {
      const role = invitationRole(row.data)
      return {
        id: row.id,
        role: role === 'member' ? 'manager' : role,
        firstName: typeof row.data.firstName === 'string' ? row.data.firstName : '',
        createdAtMs: instantMs(row.data.createdAt),
      }
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
  return open[0] ?? null
}

/** An Operatives manager (not an admin) lists only invitations they sent (rulebook 1.31.1 B-1). */
export function actorListsOwnInvitationsOnly(actor: User | null | undefined): boolean {
  return Boolean(
    actor && !(actor.isSuperAdmin || actor.permissions?.adminAccess || actor.role === 'admin') &&
      canManageOperatives({ ...actor.permissions, role: actor.role })
  )
}

export async function findOpenInvitation(input: {
  organizationId: string
  email: string
  actor: User | null | undefined
}): Promise<OpenInvitation | null> {
  const email = input.email.trim()
  if (!input.organizationId || !email) return null
  const uid = auth?.currentUser?.uid || input.actor?.id || ''
  const signInEmail = auth?.currentUser?.email || input.actor?.email || ''
  const lookups = invitationListConstraints({
    organizationId: input.organizationId,
    email,
    actorManagesOperatives: actorListsOwnInvitationsOnly(input.actor),
    senderIds: [uid, signInEmail],
  })
  const db = getFirebaseDb()
  const rows = new Map<string, Record<string, unknown>>()
  for (const constraints of lookups) {
    try {
      const snap = await getDocs(
        query(collection(db, 'invitations'), ...constraints.map(([field, value]) => where(field, '==', value)))
      )
      for (const row of snap.docs) rows.set(row.id, row.data())
    } catch (error) {
      if (!invitationReadErrorIsSkippable((error as { code?: unknown })?.code)) throw error
    }
  }
  return pickOpenInvitation([...rows].map(([id, data]) => ({ id, data })))
}

/** Sends the open invitation's sign-up email again. Throws `RESEND_NO_OPEN_INVITATION_MESSAGE` when there is none. */
export async function resendInvitationEmail(input: {
  organizationId: string
  organizationName: string
  person: Pick<User, 'email' | 'firstName'>
  actor: User | null | undefined
}): Promise<void> {
  const invitation = await findOpenInvitation({ organizationId: input.organizationId, email: input.person.email, actor: input.actor })
  if (!invitation) throw new Error(RESEND_NO_OPEN_INVITATION_MESSAGE)
  const { requestInviteSetupEmail } = await import('@/lib/invites/requestSetupEmail')
  await requestInviteSetupEmail({
    organizationId: input.organizationId,
    invitationId: invitation.id,
    organizationName: input.organizationName,
    firstName: invitation.firstName || input.person.firstName,
    role: invitation.role,
    to: input.person.email.trim().toLowerCase(),
  })
}
