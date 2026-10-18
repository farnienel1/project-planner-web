import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { isValidUuid } from '@/lib/security/validation'
import { ensurePrimaryOrgMembership } from '@/lib/orgMembership/membershipService'
import { ageConfirmationWriteFields } from '@/lib/legal/ageConfirmation'
import { isAnonymisedDeletedProfile } from '@/lib/canonical/userRosterSegment'

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

async function claimedUserIdAfterSignIn(organizationId: string, email: string): Promise<string> {
  const db = getFirebaseDb()
  try {
    const snap = await getDoc(doc(db, 'organizations', organizationId, 'userEmails', email))
    if (!snap.exists()) return ''
    return String((snap.data() as { userId?: string }).userId || '').trim()
  } catch {
    return ''
  }
}

async function loadPlaceholderIfOwnInvite(userId: string): Promise<Record<string, unknown> | null> {
  if (!userId) return null
  const db = getFirebaseDb()
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return null
    return asRecord(snap.data())
  } catch {
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
  if (record.permissions) {
    payload.permissions = record.permissions
    Object.assign(payload, record.permissions)
  }
  if (record.role) payload.role = record.role
  if (record.employmentType) payload.employmentType = record.employmentType
  if (record.payBasis === 'hourly' && record.hourlyRate != null) {
    payload.payBasis = 'hourly'
    payload.hourlyRate = record.hourlyRate
  } else if (record.payBasis === 'day' && record.dayRate != null) {
    payload.payBasis = 'day'
    payload.dayRate = record.dayRate
  }
  return payload
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

  const claimedUserId = await claimedUserIdAfterSignIn(record.organizationId, email)
  const hintedId = record.claimedUserId || claimedUserId
  const claimedUser = hintedId && hintedId !== authUid ? await loadPlaceholderIfOwnInvite(hintedId) : null
  const placeholderId = invitePlaceholderIdToMigrate({
    claimedUserId: hintedId,
    authUid,
    claimedUser,
  })

  await setDoc(doc(db, 'organizations', record.organizationId, 'userEmails', email), {
    userId: authUid,
  })

  const nextUser =
    placeholderId && claimedUser && !isAnonymisedDeletedProfile(claimedUser)
      ? {
          ...claimedUser,
          email,
          organizationId: record.organizationId,
          passwordSet: true,
          accountConfirmed: true,
          updatedAt: now,
          ...ageConfirmationWriteFields(now),
        }
      : userDocFromInvitation(record, now)

  await setDoc(doc(db, 'users', authUid), nextUser)

  if (placeholderId && claimedUser && !isAnonymisedDeletedProfile(claimedUser)) {
    try {
      await deleteDoc(doc(db, 'users', placeholderId))
    } catch (error) {
      console.warn('Invite placeholder left in place after password setup', placeholderId, error)
    }
  }

  const role =
    (typeof nextUser.role === 'string' && nextUser.role) ||
    record.role ||
    'member'
  await ensurePrimaryOrgMembership(authUid, record.organizationId, role)

  await updateDoc(doc(db, 'invitations', params.invitationId), {
    isUsed: true,
    usedAt: Timestamp.now(),
  })
  const { grantMfaSkip } = await import('@/lib/auth/mfa/mfaClient')
  await grantMfaSkip({ invitationId: params.invitationId })
}
