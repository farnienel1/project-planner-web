import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import type { UserPermissions } from '@/types'
import type { OrgMembership, UserOrgMembershipRecord } from '@/lib/orgMembership/types'

function parseMembershipRecord(
  organizationId: string,
  data: Record<string, unknown>
): UserOrgMembershipRecord {
  return {
    organizationId,
    role: String(data.role || 'member'),
    status: data.status === 'pending' ? 'pending' : 'active',
    permissions: (data.permissions as Record<string, boolean> | undefined) ?? undefined,
    invitedAt: (data.invitedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    acceptedAt: (data.acceptedAt as { toDate?: () => Date } | undefined)?.toDate?.(),
  }
}

/** Find an existing authenticated user (any org) by email. */
export async function findExistingAuthUserByEmail(email: string): Promise<{
  userId: string
  organizationId: string
  firstName: string
  surname: string
} | null> {
  const db = getFirebaseDb()
  const emailLower = email.toLowerCase().trim()
  const snap = await getDocs(
    query(collection(db, 'users'), where('email', '==', emailLower), where('passwordSet', '==', true))
  )
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  const data = docSnap.data()
  return {
    userId: docSnap.id,
    organizationId: String(data.organizationId || ''),
    firstName: String(data.firstName || ''),
    surname: String(data.surname || ''),
  }
}

export async function loadUserOrgMemberships(userId: string): Promise<OrgMembership[]> {
  const db = getFirebaseDb()
  const snap = await getDocs(collection(db, 'users', userId, 'orgMemberships'))
  const memberships: OrgMembership[] = []

  for (const entry of snap.docs) {
    const data = entry.data() as Record<string, unknown>
    const organizationId = entry.id
    const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
    const orgName = orgSnap.exists() ? String(orgSnap.data().name || 'Organisation') : 'Organisation'
    const record = parseMembershipRecord(organizationId, data)
    memberships.push({
      organizationId,
      organizationName: orgName,
      role: record.role,
      status: record.status,
      invitedAt: record.invitedAt,
      acceptedAt: record.acceptedAt,
    })
  }

  return memberships.sort((a, b) => a.organizationName.localeCompare(b.organizationName))
}

export async function addExistingUserToOrganization(params: {
  authUserId: string
  organizationId: string
  organizationName: string
  role: string
  permissions: UserPermissions
  invitedBy: string
}): Promise<{ invitationId: string }> {
  const db = getFirebaseDb()
  const membershipRef = doc(db, 'users', params.authUserId, 'orgMemberships', params.organizationId)
  const existingMembership = await getDoc(membershipRef)
  if (existingMembership.exists()) {
    throw new Error('This user is already linked to this organisation.')
  }

  const invitationId = crypto.randomUUID()
  const now = Timestamp.now()

  await setDoc(doc(db, 'users', params.authUserId, 'orgMemberships', params.organizationId), {
    role: params.role,
    status: 'pending',
    permissions: permissionsToFirestoreMap(params.permissions),
    invitedAt: now,
    invitedBy: params.invitedBy,
  })

  const orgRef = doc(db, 'organizations', params.organizationId)
  const orgSnap = await getDoc(orgRef)
  if (orgSnap.exists()) {
    const members = (orgSnap.data().members as Record<string, string> | undefined) ?? {}
    await updateDoc(orgRef, {
      members: { ...members, [params.authUserId]: params.role },
      updatedAt: now,
    })
  }

  const userSnap = await getDoc(doc(db, 'users', params.authUserId))
  const email = userSnap.exists() ? String(userSnap.data().email || '') : ''
  if (email) {
    await setDoc(doc(db, 'organizations', params.organizationId, 'userEmails', email.toLowerCase()), {
      userId: params.authUserId,
    })
  }

  await setDoc(doc(db, 'invitations', invitationId), {
    email: email.toLowerCase(),
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    invitedBy: params.invitedBy,
    inviteType: 'existing_user_org_add',
    isUsed: false,
    createdAt: now,
  })

  return { invitationId }
}

export async function acceptOrgMembership(userId: string, organizationId: string): Promise<void> {
  const db = getFirebaseDb()
  const membershipRef = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const snap = await getDoc(membershipRef)
  if (!snap.exists()) {
    throw new Error('Membership not found for this organisation.')
  }
  await updateDoc(membershipRef, {
    status: 'active',
    acceptedAt: Timestamp.now(),
  })
}

export async function switchActiveOrganization(userId: string, organizationId: string): Promise<void> {
  const db = getFirebaseDb()
  const membershipRef = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const membershipSnap = await getDoc(membershipRef)

  if (membershipSnap.exists()) {
    const status = membershipSnap.data().status
    if (status === 'pending') {
      throw new Error('Accept the invitation before switching to this organisation.')
    }
  }

  await updateDoc(doc(db, 'users', userId), {
    organizationId,
    updatedAt: Timestamp.now(),
  })
}

/** Ensure the primary org membership exists for org creators (backward compat). */
export async function ensurePrimaryOrgMembership(
  userId: string,
  organizationId: string,
  role: string
): Promise<void> {
  const db = getFirebaseDb()
  const ref = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    role,
    status: 'active',
    invitedAt: Timestamp.now(),
    acceptedAt: Timestamp.now(),
  })
}
