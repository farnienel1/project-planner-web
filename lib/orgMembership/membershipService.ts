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
import { queryWithin } from '@/lib/orgMembership/queryBudget'
import { permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import {
  chooseWebSessionOrganization,
  organizationIdsMatch,
  probeSessionOrganizations,
  readWebActiveOrg,
  writeWebActiveOrg,
  type OrgAccessProbe,
} from '@/lib/orgMembership/webActiveOrg'
import type { UserPermissions } from '@/types'
import type { OrgMembership, UserOrgMembershipRecord } from '@/lib/orgMembership/types'
import {
  isSetupIncomplete,
  subscriptionStatusFromOrgData,
} from '@/lib/orgSetup/pendingOrganizationReuse'
import {
  FOUNDER_PERMISSIONS,
  membershipSnapshotFromUserDoc,
} from '@/lib/orgMembership/orgRoleFlags'
import {
  isAccessBlocked,
  isTrialOrganization,
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
  const orgSnaps = await Promise.all(
    snap.docs.map(async (entry) => {
      const orgSnap = await getDoc(doc(db, 'organizations', entry.id))
      return { entry, orgSnap }
    })
  )
  for (const { entry, orgSnap } of orgSnaps) {
    const data = entry.data() as Record<string, unknown>
    const orgData = orgSnap.exists() ? (orgSnap.data() as Record<string, unknown>) : {}
    const record = parseMembershipRecord(entry.id, data)
    byId.set(
      entry.id,
      membershipFromOrgDoc(entry.id, orgData, record.role, {
        status: record.status,
        invitedAt: record.invitedAt,
        acceptedAt: record.acceptedAt,
      })
    )
  }

  // One saved membership must not hide every other company. iOS waits for both queries.
  const discoveryBudgetMs = 12_000
  const [memberSnap, creatorSnap] = await Promise.all([
    queryWithin(getDocs(query(collection(db, 'organizations'), where(`members.${userId}`, '!=', ''))), discoveryBudgetMs),
    queryWithin(getDocs(query(collection(db, 'organizations'), where('creatorUserId', '==', userId))), discoveryBudgetMs),
  ])

  if (memberSnap) {
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
  }

  if (creatorSnap) {
    for (const orgDoc of creatorSnap.docs) {
      if (byId.has(orgDoc.id)) continue
      const orgData = orgDoc.data() as Record<string, unknown>
      byId.set(orgDoc.id, membershipFromOrgDoc(orgDoc.id, orgData, 'admin'))
    }
  }

  const rows = Array.from(byId.values()).map((row) => ({
    ...row,
    id: row.organizationId,
    name: row.organizationName,
  }))
  const sorted = sortMemberships(rows, activeOrgId).map(({ id: _id, name: _name, ...row }) => row)
  if (!memberSnap || !creatorSnap) {
    return Object.assign(sorted, { discoveryIncomplete: true as const })
  }
  return sorted
}

/** True when the members or creator query did not finish, so the list may be missing companies. */
export function membershipListDiscoveryFailed(rows: readonly OrgMembership[]): boolean {
  return (rows as { discoveryIncomplete?: boolean }).discoveryIncomplete === true
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

/** Trial and locked companies still need the full membership list. A normal company does not. */
export function destinationNeedsTrialScan(orgData: Record<string, unknown> | null | undefined): boolean {
  if (!orgData) return false
  return isTrialOrganization(orgData) || isAccessBlocked(orgData)
}

export async function switchActiveOrganization(userId: string, organizationId: string): Promise<void> {
  const db = getFirebaseDb()
  const membershipRef = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const [membershipResult, orgResult] = await Promise.allSettled([
    getDoc(membershipRef),
    getDoc(doc(db, 'organizations', organizationId)),
  ])
  const membershipSnap = membershipResult.status === 'fulfilled' ? membershipResult.value : null
  const orgSnap = orgResult.status === 'fulfilled' ? orgResult.value : null
  const orgRead = Boolean(orgSnap?.exists())
  const orgData = orgRead ? (orgSnap!.data() as Record<string, unknown>) : {}
  const members = (orgData.members as Record<string, string> | undefined) ?? {}
  const isCreator = orgRead && String(orgData.creatorUserId || '') === userId
  const listedRole = orgRead ? members[userId] : undefined
  const membershipActive =
    Boolean(membershipSnap?.exists()) && membershipSnap?.data()?.status !== 'pending'

  if (membershipSnap?.exists() && membershipSnap.data().status === 'pending') {
    throw new Error('Accept the invitation before switching to this organisation.')
  }
  // A failed read is not proof they are outside the company. Deny only when a
  // document loaded and it does not list them.
  if ((membershipSnap || orgSnap?.exists()) && !membershipActive && !isCreator && listedRole == null) {
    throw new Error('You are not a member of that organisation.')
  }

  // A company this login already belongs to can be remembered immediately.
  // The 12s member/creator scan is only for the trial block.
  if (destinationNeedsTrialScan(orgRead ? orgData : null)) {
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
    if (blockMessage && (!membershipListDiscoveryFailed(memberships) || isAccessBlocked(orgData))) {
      throw new Error(blockMessage)
    }
  }

  const destinationRole =
    listedRole ||
    (membershipSnap?.exists() ? String(membershipSnap.data().role || '') : '') ||
    (isCreator ? 'admin' : 'member')
  try {
    await ensurePrimaryOrgMembership(userId, organizationId, destinationRole)
  } catch {
    // The browser still remembers the company. The members map can list it next time.
  }

  // This browser remembers the company. The shared user document keeps the company last opened on iOS.
  writeWebActiveOrg(userId, organizationId)
}

/**
 * A thrown read is not "not a member". Timeout, unavailable, not-found, and
 * permission-denied stay unknown so the company the user picked is kept.
 * Denied is only a document that loaded and does not list this login.
 */
export function accessProbeFromReadError(error: unknown): OrgAccessProbe {
  void error
  return 'unknown'
}

export type OrgDocumentRead = 'loaded' | 'missing' | 'failed'
export type MembershipDocumentRead = 'active' | 'pending' | 'missing' | 'failed'

/**
 * Denied only after the organisation document loaded and this login is not a
 * member, not the creator, and has no active membership. A missing document
 * or a thrown read (permission-denied, not-found, timeout) stays unknown.
 */
export function orgAccessProbeFromReads(input: {
  orgRead: OrgDocumentRead
  membershipRead: MembershipDocumentRead
  listed: boolean
  isCreator: boolean
}): OrgAccessProbe {
  const pending = input.membershipRead === 'pending'
  const activeMembership = input.membershipRead === 'active'
  const belongs = !pending && (activeMembership || input.listed || input.isCreator)
  if (input.orgRead !== 'loaded' || input.membershipRead === 'failed') {
    return belongs ? 'allowed' : 'unknown'
  }
  if (!belongs) return 'denied'
  return 'allowed'
}

async function membershipForDeviceOrg(
  userId: string,
  organizationId: string
): Promise<{ probe: OrgAccessProbe; membership: Record<string, unknown> | null; listedRole: string | null }> {
  const db = getFirebaseDb()
  let membership: Record<string, unknown> | null = null
  let membershipExists = false
  let membershipProbe: OrgAccessProbe = 'allowed'
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'orgMemberships', organizationId))
    membershipExists = snap.exists()
    if (snap.exists()) membership = snap.data() as Record<string, unknown>
  } catch (error) {
    membership = null
    membershipProbe = accessProbeFromReadError(error)
  }

  let orgExists = false
  let listed = false
  let listedRole: string | null = null
  let isCreator = false
  let orgProbe: OrgAccessProbe = 'allowed'
  try {
    const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
    orgExists = orgSnap.exists()
    if (orgSnap.exists()) {
      const data = orgSnap.data() as Record<string, unknown>
      const members = (data.members as Record<string, unknown> | undefined) ?? {}
      if (members[userId] != null) {
        listed = true
        listedRole = String(members[userId])
      }
      isCreator = String(data.creatorUserId || '') === userId
    }
  } catch (error) {
    orgExists = false
    orgProbe = accessProbeFromReadError(error)
  }

  const pending = membership?.status === 'pending'
  const probe = orgAccessProbeFromReads({
    orgRead: orgProbe === 'unknown' ? 'failed' : orgExists ? 'loaded' : 'missing',
    membershipRead:
      membershipProbe === 'unknown' ? 'failed' : pending ? 'pending' : membershipExists ? 'active' : 'missing',
    listed,
    isCreator,
  })
  if (probe === 'denied') return { probe, membership: null, listedRole: null }
  return { probe, membership: pending ? null : membership, listedRole }
}

/** Company last chosen on this browser. Does not write users/{uid}.organizationId. */
export async function resolveWebSessionOrganization(
  userId: string,
  documentOrganizationId: string,
  explicitOrganizationId?: string | null,
  options?: { shouldPersist?: () => boolean }
): Promise<{
  organizationId: string
  membership: Record<string, unknown> | null
  listedRole: string | null
  probe: OrgAccessProbe
}> {
  const remembered = readWebActiveOrg(userId)
  const checked = await probeSessionOrganizations(
    [explicitOrganizationId, remembered, documentOrganizationId],
    (organizationId) => membershipForDeviceOrg(userId, organizationId),
    () => ({ probe: 'unknown' as const, membership: null, listedRole: null })
  )
  const probes = new Map<string, OrgAccessProbe>()
  const details = new Map<
    string,
    { probe: OrgAccessProbe; membership: Record<string, unknown> | null; listedRole: string | null }
  >()
  for (const [organizationId, value] of checked) {
    probes.set(organizationId, value.probe)
    details.set(organizationId, value)
  }

  const choice = chooseWebSessionOrganization({
    explicitOrganizationId,
    rememberedOrganizationId: remembered,
    documentOrganizationId,
    probes,
  })
  if (!choice.organizationId) return { organizationId: '', membership: null, listedRole: null, probe: 'unknown' }
  // A newer sign-in or switch owns the browser choice. This probe must not overwrite it.
  if (choice.persistOrganizationId && options?.shouldPersist?.() !== false) {
    writeWebActiveOrg(userId, choice.persistOrganizationId)
  }

  let detail = {
    probe: 'unknown' as OrgAccessProbe,
    membership: null as Record<string, unknown> | null,
    listedRole: null as string | null,
  }
  for (const [organizationId, value] of details) {
    if (organizationIdsMatch(organizationId, choice.organizationId)) {
      detail = value
      break
    }
  }
  return {
    organizationId: choice.organizationId,
    membership: detail.membership,
    listedRole: detail.listedRole,
    probe: detail.probe,
  }
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
    ...(isSuperAdmin ? { isSuperAdmin: true, permissions: permissionsToFirestoreMap(FOUNDER_PERMISSIONS) } : {}),
    invitedAt: now,
    acceptedAt: now,
  })
}
