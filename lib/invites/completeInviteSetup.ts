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

export type InvitationSummary = {
  invitationId: string
  email: string
  firstName: string
  surname: string
  organizationId: string
}

export async function fetchInvitationSummary(invitationId: string): Promise<InvitationSummary> {
  if (!isValidUuid(invitationId)) {
    throw new Error('Invitation not found')
  }

  const db = getFirebaseDb()
  const snap = await getDoc(doc(db, 'invitations', invitationId))
  if (!snap.exists()) {
    throw new Error('Invitation not found')
  }

  const invitation = snap.data()
  if (invitation.isUsed === true) {
    throw new Error('This invitation has already been used')
  }

  return {
    invitationId,
    email: String(invitation.email || ''),
    firstName: String(invitation.firstName || ''),
    surname: String(invitation.surname || ''),
    organizationId: String(invitation.organizationId || ''),
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

async function migrateInvitedUserRecord(params: {
  organizationId: string
  existingUserId: string
  authUid: string
  email: string
  firstName: string
  surname: string
}) {
  const db = getFirebaseDb()
  const oldRef = doc(db, 'users', params.existingUserId)
  const oldSnap = await getDoc(oldRef)
  const now = Timestamp.now()
  const email = params.email.toLowerCase().trim()

  // Self-create is allowed only when this pointer is missing or already this uid.
  await setDoc(doc(db, 'organizations', params.organizationId, 'userEmails', email), {
    userId: params.authUid,
  })

  const nextUser = oldSnap.exists()
    ? {
        ...oldSnap.data(),
        email,
        passwordSet: true,
        accountConfirmed: true,
        updatedAt: now,
        ...ageConfirmationWriteFields(now),
      }
    : {
        email,
        firstName: params.firstName,
        surname: params.surname,
        organizationId: params.organizationId,
        passwordSet: true,
        isActive: true,
        accountConfirmed: true,
        updatedAt: now,
        ...ageConfirmationWriteFields(now),
      }

  await setDoc(doc(db, 'users', params.authUid), nextUser)

  const orgRef = doc(db, 'organizations', params.organizationId)
  const orgSnap = await getDoc(orgRef)
  if (orgSnap.exists()) {
    const members = (orgSnap.data().members as Record<string, string> | undefined) ?? {}
    if (members[params.existingUserId]) {
      const role = members[params.existingUserId]
      const nextMembers = { ...members, [params.authUid]: role }
      delete nextMembers[params.existingUserId]
      await updateDoc(orgRef, { members: nextMembers, updatedAt: Timestamp.now() })
    }
  }

  if (params.existingUserId !== params.authUid && oldSnap.exists()) {
    await deleteDoc(oldRef)
  }

  const role = oldSnap.exists() && typeof oldSnap.data().role === 'string' ? oldSnap.data().role : 'member'
  await ensurePrimaryOrgMembership(params.authUid, params.organizationId, role)
}

export async function completeInvitationPasswordSetup(params: {
  invitationId: string
  password: string
}): Promise<void> {
  const summary = await fetchInvitationSummary(params.invitationId)
  const email = summary.email.toLowerCase().trim()
  const db = getFirebaseDb()

  const emailMapSnap = await getDoc(
    doc(db, 'organizations', summary.organizationId, 'userEmails', email)
  )
  const existingUserId = emailMapSnap.exists()
    ? String((emailMapSnap.data() as { userId?: string }).userId || '')
    : ''

  const authResult = await authWithPassword(email, params.password)
  const authUid = authResult.user.uid

  if (existingUserId) {
    await migrateInvitedUserRecord({
      organizationId: summary.organizationId,
      existingUserId,
      authUid,
      email,
      firstName: summary.firstName,
      surname: summary.surname,
    })
  } else {
    const now = Timestamp.now()
    await setDoc(doc(db, 'organizations', summary.organizationId, 'userEmails', email), {
      userId: authUid,
    })
    await setDoc(
      doc(db, 'users', authUid),
      {
        email,
        firstName: summary.firstName,
        surname: summary.surname,
        organizationId: summary.organizationId,
        passwordSet: true,
        isActive: true,
        accountConfirmed: true,
        updatedAt: now,
        ...ageConfirmationWriteFields(now),
      },
      { merge: true }
    )
  }

  await updateDoc(doc(db, 'invitations', params.invitationId), {
    isUsed: true,
    usedAt: Timestamp.now(),
  })
  const { grantMfaSkip } = await import('@/lib/auth/mfa/mfaClient')
  await grantMfaSkip({ invitationId: params.invitationId })
}
