import { inviteAcceptWrites, inviteMembershipWrites, invitationProfileFields } from '@/lib/canonical/inviteAccept'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { isValidUuid } from '@/lib/security/validation'
import { ensurePrimaryOrgMembership } from '@/lib/orgMembership/membershipService'
import { ageConfirmationWriteFields } from '@/lib/legal/ageConfirmation'
import { isAnonymisedDeletedProfile } from '@/lib/canonical/userRosterSegment'
import { inviteMigrationFormerIdWriteFields } from '@/lib/canonical/userProfile'
import { moveTaxIds } from '@/lib/sensitiveProfile/taxIdsService'
import { invitationUsedWriteFields } from '@/lib/canonical/createDocuments'
import { sharedDocumentPayWrite } from '@/lib/canonical/payProfile'
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'

export type InvitationSummary = {
  invitationId: string
  email: string
  firstName: string
  surname: string
  organizationId: string
}

type InvitationRecord = InvitationSummary & {
  claimedUserId?: string
  permissions?: Record<string, boolean>
  role?: string
  employmentType?: string
  payBasis?: string
  dayRate?: number
  hourlyRate?: number
  /** The stored invitation (rulebook 1.11.0: accepting applies exactly what it stores). */
  raw: Record<string, unknown>
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

function stringField(data: Record<string, unknown>, key: string): string {
  return typeof data[key] === 'string' ? data[key].trim() : ''
}

/**
 * The userEmails claim is this invite's placeholder, not the Auth uid.
 * A Deleted-user tombstone is never the invite and must not be migrated.
 */
export function invitePlaceholderIdToMigrate(params: {
  claimedUserId?: string | null
  authUid: string
  claimedUser?: Parameters<typeof isAnonymisedDeletedProfile>[0]
}): string {
  const claimed = typeof params.claimedUserId === 'string' ? params.claimedUserId.trim() : ''
  const authUid = params.authUid.trim()
  if (!claimed || !authUid || claimed === authUid) return ''
  if (isAnonymisedDeletedProfile(params.claimedUser ?? null)) return ''
  return claimed
}

export async function fetchInvitationSummary(invitationId: string): Promise<InvitationSummary> {
  const record = await loadInvitationRecord(invitationId)
  return {
    invitationId: record.invitationId,
    email: record.email,
    firstName: record.firstName,
    surname: record.surname,
    organizationId: record.organizationId,
  }
}

async function loadInvitationRecord(invitationId: string): Promise<InvitationRecord> {
  if (!isValidUuid(invitationId)) {
    throw new Error('Invitation not found')
  }

  const db = getFirebaseDb()
  const snap = await getDoc(doc(db, 'invitations', invitationId))
  if (!snap.exists()) {
    throw new Error('Invitation not found')
  }

  const invitation = asRecord(snap.data())
  if (invitation.isUsed === true) {
    throw new Error('This invitation has already been used')
  }

  const permissions =
    invitation.permissions && typeof invitation.permissions === 'object'
      ? (invitation.permissions as Record<string, boolean>)
      : undefined
  const claimedUserId =
    stringField(invitation, 'userId') ||
    stringField(invitation, 'invitedUserId') ||
    stringField(invitation, 'placeholderUserId')

  return {
    invitationId,
    email: stringField(invitation, 'email'),
    firstName: stringField(invitation, 'firstName'),
    surname: stringField(invitation, 'surname'),
    organizationId: stringField(invitation, 'organizationId'),
    claimedUserId: claimedUserId || undefined,
    permissions,
    role: stringField(invitation, 'role') || undefined,
    employmentType: stringField(invitation, 'employmentType') || undefined,
    payBasis: stringField(invitation, 'payBasis') || undefined,
    dayRate: typeof invitation.dayRate === 'number' ? invitation.dayRate : undefined,
    hourlyRate: typeof invitation.hourlyRate === 'number' ? invitation.hourlyRate : undefined,
    raw: invitation,
  }
}

async function authWithPassword(email: string, password: string): Promise<UserCredential> {
  const auth = getFirebaseAuth()
  try {
    return await createUserWithEmailAndPassword(auth, email, password)
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : ''
    if (code === 'auth/email-already-in-use') {
      return signInWithEmailAndPassword(auth, email, password)
    }
    throw error
  }
}

/**
 * Own-email claim only, read after Auth exists. A denied read is not "no claim":
 * falling through would write a profile without the placeholder, so let it surface.
 */
async function claimedUserIdAfterSignIn(organizationId: string, email: string): Promise<string> {
  const db = getFirebaseDb()
  const snap = await getDoc(doc(db, 'organizations', organizationId, 'userEmails', email))
  if (!snap.exists()) return ''
  return String((snap.data() as { userId?: string }).userId || '').trim()
}

/** users/{authUid} from an earlier Continue that failed after the profile write. */
async function loadOwnUserIfSetUp(authUid: string): Promise<Record<string, unknown> | null> {
  const db = getFirebaseDb()
  const snap = await getDoc(doc(db, 'users', authUid))
  if (!snap.exists()) return null
  const data = asRecord(snap.data())
  return data.passwordSet === true ? data : null
}

async function loadPlaceholderIfOwnInvite(userId: string): Promise<Record<string, unknown> | null> {
  if (!userId) return null
  const db = getFirebaseDb()
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return null
    return asRecord(snap.data())
  } catch (error) {
    console.warn('Invite placeholder could not be read; profile built from the invitation', userId, error)
    return null
  }
}

function userDocFromInvitation(record: InvitationRecord, now: Timestamp): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    email: record.email.toLowerCase().trim(),
    firstName: record.firstName,
    surname: record.surname,
    organizationId: record.organizationId,
    passwordSet: true,
    isActive: true,
    accountConfirmed: true,
    updatedAt: now,
    ...ageConfirmationWriteFields(now),
  }
  // Rulebook 1.11.0 `invitationProfileFields`: exactly what Add User stored — role, permissions, pay, line manager.
  Object.assign(payload, invitationProfileFields(record.raw))
  return payload
}

/**
 * Rulebook 1.10.0 (H3, `inviteAcceptWrites` mode `existingAccount`) and 1.11.0 (`inviteMembershipWrites`): an account
 * that already exists in another company. Its profile is never rewritten and the placeholder (the in-organisation row
 * with the invited pay and line manager) stays. One batch creates the membership with exactly the invitation's role
 * and permissions, adds `members.{uid}` with that role and marks the invitation used; the security rules accept it
 * only for this genuine, unused invitation to the signed-in email.
 */
async function acceptIntoAnotherCompany(authUid: string, record: InvitationRecord, invitationId: string) {
  const db = getFirebaseDb()
  const now = Timestamp.now()
  const writes = inviteMembershipWrites({ invitation: record.raw, invitationId, authUid, now })
  if (!writes) throw new Error('Invitation not found')
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', authUid, 'orgMemberships', writes.organizationId), writes.membership)
  batch.update(doc(db, 'organizations', writes.organizationId), { [writes.membersField]: writes.role })
  batch.update(doc(db, 'invitations', invitationId), invitationUsedWriteFields(now).set)
  try {
    await batch.commit()
  } catch {
    throw new Error(
      'This email already has a Project Planner account, but the invitation could not be accepted. Ask an admin of the inviting company to send a new invitation.'
    )
  }
  const { grantMfaSkip } = await import('@/lib/auth/mfa/mfaClient')
  await grantMfaSkip({ invitationId })
}

export async function completeInvitationPasswordSetup(params: {
  invitationId: string
  password: string
}): Promise<void> {
  const record = await loadInvitationRecord(params.invitationId)
  const email = record.email.toLowerCase().trim()
  if (!email || !record.organizationId) {
    throw new Error('Invitation not found')
  }

  const authResult = await authWithPassword(email, params.password)
  const authUid = authResult.user.uid
  const db = getFirebaseDb()
  const now = Timestamp.now()

  // 1. Auth exists. 2. Read only this email's claim (rules: emailKey == token email).
  const claimedUserId = await claimedUserIdAfterSignIn(record.organizationId, email)
  // The claim is authoritative; the invitation only hints when the claim already moved to authUid.
  const hintedId = claimedUserId && claimedUserId !== authUid ? claimedUserId : record.claimedUserId || claimedUserId
  // 3. Read the placeholder the claim names (rules: its email must be this token email).
  const claimedUser = hintedId && hintedId !== authUid ? await loadPlaceholderIfOwnInvite(hintedId) : null
  const placeholderId = invitePlaceholderIdToMigrate({
    claimedUserId: hintedId,
    authUid,
    claimedUser,
  })
  const ownPlaceholder = Boolean(placeholderId && claimedUser && !isAnonymisedDeletedProfile(claimedUser))
  const ownUser = await loadOwnUserIfSetUp(authUid)
  // Rulebook 1.10.0 (H3) `inviteAcceptWrites`: whether users/{authUid} is written, whether the placeholder moves and
  // goes, and the role — from the invitation, never another company's profile.
  const plan = inviteAcceptWrites({
    existingProfile: ownUser,
    placeholder: ownPlaceholder ? claimedUser : null,
    invitation: { ...record, organizationId: record.organizationId },
  })
  const migrating = plan.movePlaceholder && ownPlaceholder

  if (plan.mode === 'existingAccount' && plan.joinsAnotherCompany) {
    await acceptIntoAnotherCompany(authUid, record, params.invitationId)
    return
  }

  // 4. Copy the placeholder onto users/{authUid} (self-create; rules accept a claim that
  //    still names this invite's pending placeholder).
  const nextUser = migrating && claimedUser
    ? {
        ...claimedUser,
        email,
        organizationId: record.organizationId,
        passwordSet: true,
        accountConfirmed: true,
        updatedAt: now,
        ...ageConfirmationWriteFields(now),
        // Bookings, leave, and warning exclusions saved under the placeholder id stay with this person.
        ...inviteMigrationFormerIdWriteFields({
          placeholderId,
          authUid,
          existing: claimedUser,
        }),
      }
    : userDocFromInvitation(record, now)
  if (plan.writeProfile) {
    // Rulebook 1.26.0 (`sharedDocumentPayWrite`): with `privatePay` on, the new account's users document carries no
    // pay (the rules refuse it, and a person never writes their own pay profile). The invited pay stays on the
    // placeholder's pay profile, which readers find through the account's `formerUserIds`.
    await securitySwitchesReady()
    const accountUser = sharedDocumentPayWrite(nextUser, { privatePay: privatePayFor(record.organizationId) })
    await setDoc(doc(db, 'users', authUid), accountUser)
  }

  // 4b. Move the placeholder's tax ids (users/{id}/private/taxIds) before the placeholder goes — only now that
  //     users/{authUid} is written.
  if (migrating) {
    try {
      await moveTaxIds(placeholderId, authUid)
    } catch (error) {
      console.warn('Invite tax ids were not moved; an admin can re-enter them', error instanceof Error ? error.message : 'unknown')
    }
  }

  // 5. Point the claim at authUid.
  if (plan.claimToAccount) {
    await setDoc(doc(db, 'organizations', record.organizationId, 'userEmails', email), {
      userId: authUid,
    })
  }

  // 6. Remove the placeholder (best effort; it is not an Auth uid).
  if (migrating) {
    try {
      await deleteDoc(doc(db, 'users', placeholderId))
    } catch (error) {
      console.warn('Invite placeholder left in place after password setup', placeholderId, error)
    }
  }

  await ensurePrimaryOrgMembership(authUid, record.organizationId, plan.role)

  // 7. Mark the invitation used last.
  // Rulebook 1.9.0 `invitationUsedWriteFields`: a partial update, never a rewrite of the invitation.
  await updateDoc(doc(db, 'invitations', params.invitationId), invitationUsedWriteFields(Timestamp.now()).set)
  const { grantMfaSkip } = await import('@/lib/auth/mfa/mfaClient')
  await grantMfaSkip({ invitationId: params.invitationId })
}
