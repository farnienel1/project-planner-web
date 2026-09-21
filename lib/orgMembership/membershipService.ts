/**
 * iOS parity source: Core/FirebaseBackend+OrganizationMembership.swift
 * Spec: docs/ios-parity/sections/26-switch-organisation.md
 */
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
import {
  isSetupIncomplete,
  subscriptionStatusFromOrgData,
} from '@/lib/orgSetup/pendingOrganizationReuse'
import {
  FOUNDER_PERMISSIONS,
  membershipSnapshotFromUserDoc,
  userPatchForActiveOrg,
} from '@/lib/orgMembership/orgRoleFlags'
import {
  loginBlockMessage,
  membershipSummary,
  sortMemberships,
} from '@/lib/orgMembership/organizationTrialPolicy'

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
  if (!snap.empty) {
    const docSnap = snap.docs[0]
    const data = docSnap.data()
    return {
      userId: docSnap.id,
      organizationId: String(data.organizationId || ''),
      firstName: String(data.firstName || ''),
      surname: String(data.surname || ''),
    }
  }

  const mixed = await getDocs(
    query(collection(db, 'users'), where('email', '==', email.trim()), where('passwordSet', '==', true))
  )
  if (mixed.empty) return null
  const docSnap = mixed.docs[0]
  const data = docSnap.data()
  return {
    userId: docSnap.id,
    organizationId: String(data.organizationId || ''),
    firstName: String(data.firstName || ''),
    surname: String(data.surname || ''),
  }
}

function firestoreDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate()
  }
  return undefined
}

function membershipFromOrgDoc(
  organizationId: string,
  orgData: Record<string, unknown>,
  role: string,
  extras?: Partial<OrgMembership>
): OrgMembership {
  const createdAt = firestoreDate(orgData.createdAt)
  const summary = membershipSummary(organizationId, { ...orgData, createdAt: createdAt ?? null }, role)
  const subscriptionStatus = subscriptionStatusFromOrgData(orgData)
  return {
    organizationId,
    organizationName: summary.name,
    role: summary.roleInOrg,
    status: extras?.status || 'active',
    invitedAt: extras?.invitedAt || createdAt || new Date(),
    acceptedAt: extras?.acceptedAt,
    isTrial: summary.isTrial,
    trialAccessBlocked: summary.trialAccessBlocked,
    createdAt,
    setupIncomplete: isSetupIncomplete(orgData),
    subscriptionStatus,
  }
}

export async function loadUserOrgMemberships(
  userId: string,
  activeOrgId?: string
): Promise<OrgMembership[]> {
  const db = getFirebaseDb()
  const byId = new Map<string, OrgMembership>()

  const snap = await getDocs(collection(db, 'users', userId, 'orgMemberships'))
  for (const entry of snap.docs) {
    const data = entry.data() as Record<string, unknown>
    const organizationId = entry.id
    const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
    const orgData = orgSnap.exists() ? (orgSnap.data() as Record<string, unknown>) : {}
    const record = parseMembershipRecord(organizationId, data)
    byId.set(
      organizationId,
      membershipFromOrgDoc(organizationId, orgData, record.role, {
        status: record.status,
        invitedAt: record.invitedAt,
        acceptedAt: record.acceptedAt,
      })
    )
  }

  try {
    const memberSnap = await getDocs(
      query(collection(db, 'organizations'), where(`members.${userId}`, '!=', ''))
    )
    for (const orgDoc of memberSnap.docs) {
      const orgData = orgDoc.data() as Record<string, unknown>
      const members = (orgData.members as Record<string, string> | undefined) ?? {}
      const existing = byId.get(orgDoc.id)
      const role = members[userId] || existing?.role || 'member'
      byId.set(
        orgDoc.id,
        membershipFromOrgDoc(orgDoc.id, orgData, role, {
          status: existing?.status || 'active',
          invitedAt: existing?.invitedAt,
          acceptedAt: existing?.acceptedAt,
        })
      )
    }
  } catch {
    // Permission or missing index: keep orgMemberships fallback.
  }

  try {
    const creatorSnap = await getDocs(
      query(collection(db, 'organizations'), where('creatorUserId', '==', userId))
    )
    for (const orgDoc of creatorSnap.docs) {
      if (byId.has(orgDoc.id)) continue
      const orgData = orgDoc.data() as Record<string, unknown>
      byId.set(orgDoc.id, membershipFromOrgDoc(orgDoc.id, orgData, 'admin'))
    }
  } catch {
    // Permission or missing index: keep orgMemberships fallback.
  }

  const rows = Array.from(byId.values()).map((row) => ({
    ...row,
    id: row.organizationId,
    name: row.organizationName,
  }))
  return sortMemberships(rows, activeOrgId).map(({ id: _id, name: _name, ...row }) => row)
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

/** Persist the active org's role flags onto its membership doc before switching away. */
export async function snapshotCurrentMembership(userId: string): Promise<string | null> {
  const db = getFirebaseDb()
  const userSnap = await getDoc(doc(db, 'users', userId))
  if (!userSnap.exists()) return null
  const data = userSnap.data() as Record<string, unknown>
  const organizationId = String(data.organizationId || '')
  if (!organizationId) return null

  const membershipRef = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const existing = await getDoc(membershipRef)
  const now = Timestamp.now()
  const snapshot = membershipSnapshotFromUserDoc(data)

  await setDoc(
    membershipRef,
    {
      ...snapshot,
      invitedAt: existing.exists() ? existing.data().invitedAt ?? now : now,
      acceptedAt: existing.exists() ? existing.data().acceptedAt ?? now : now,
      updatedAt: now,
    },
    { merge: true }
  )
  return organizationId
}

export async function switchActiveOrganization(userId: string, organizationId: string): Promise<void> {
  const db = getFirebaseDb()
  const membershipRef = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const membershipSnap = await getDoc(membershipRef)
  const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
  const orgData = orgSnap.exists() ? (orgSnap.data() as Record<string, unknown>) : {}
  const members = (orgData.members as Record<string, string> | undefined) ?? {}
  const isCreator = String(orgData.creatorUserId || '') === userId
  const listedRole = members[userId]

  if (membershipSnap.exists()) {
    const status = membershipSnap.data().status
    if (status === 'pending') {
      throw new Error('Accept the invitation before switching to this organisation.')
    }
  } else if (!isCreator && listedRole == null) {
    throw new Error('You are not a member of that organisation.')
  }

  const memberships = await loadUserOrgMemberships(userId, organizationId)
  const blockMessage = loginBlockMessage({
    organizationId,
    orgData,
    memberships: memberships.map((row) => ({
      id: row.organizationId,
      name: row.organizationName,
      roleInOrg: row.role,
      isTrial: row.isTrial === true,
      trialAccessBlocked: row.trialAccessBlocked === true,
      createdAt: row.createdAt,
    })),
  })
  if (blockMessage) {
    throw new Error(blockMessage)
  }

  await snapshotCurrentMembership(userId)

  const membershipData = membershipSnap.exists()
    ? (membershipSnap.data() as Record<string, unknown>)
    : {}
  const patch = userPatchForActiveOrg({
    organizationId,
    role: String(membershipData.role || listedRole || (isCreator ? 'admin' : 'member')),
    isCreator,
    membershipIsSuperAdmin: membershipData.isSuperAdmin === true,
    permissions: (membershipData.permissions as Record<string, unknown>) || membershipData,
  })

  await updateDoc(doc(db, 'users', userId), {
    ...patch,
    updatedAt: Timestamp.now(),
  })
}

/** Ensure the primary org membership exists for org creators (backward compat). */
export async function ensurePrimaryOrgMembership(
  userId: string,
  organizationId: string,
  role: string,
  options?: { isSuperAdmin?: boolean }
): Promise<void> {
  const db = getFirebaseDb()
  const ref = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  const now = Timestamp.now()
  const isSuperAdmin = options?.isSuperAdmin === true
  await setDoc(ref, {
    role,
    status: 'active',
    isSuperAdmin,
    ...(isSuperAdmin ? { permissions: permissionsToFirestoreMap(FOUNDER_PERMISSIONS) } : {}),
    invitedAt: now,
    acceptedAt: now,
  })
}
