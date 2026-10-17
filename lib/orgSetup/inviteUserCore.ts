import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { buildInvitedUserPayload, normalizeLineManagerIds, permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { readStoredRates } from '@/lib/timesheets/payBasis'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import {
  addExistingUserToOrganization,
  findExistingAuthUserByEmail,
} from '@/lib/orgMembership/membershipService'
import { resolveInviteEmailClaim, type InviteEmailClaimUser } from '@/lib/canonical/inviteEmailClaim'
import { orgEmailPointerUserId } from '@/lib/orgSetup/staleOrgEmailPointer'
import type { UserPermissions } from '@/types'

export type InviteUserCoreInput = {
  email: string
  organizationId: string
  organizationName?: string
  firstName: string
  surname: string
  mobileNumber?: string
  permissions: UserPermissions
  assignedManagerUserId?: string
  assignedManagerUserIds?: string[]
  dayRate?: number
  hourlyRate?: number
  payBasis?: 'day' | 'hourly'
  tradeTypePreset?: string
  tradeTypeCustom?: string
  employmentType?: 'paye' | 'self_employed' | 'selfEmployed'
  timesheetsEnabled?: boolean
  vatNumber?: string
  utrNumber?: string
  annualLeaveEnabled?: boolean
  annualLeaveDaysPerYear?: number
  annualLeaveYearStartMonth?: number
  annualLeaveYearEndMonth?: number
  annualLeaveCarriesOver?: boolean
  annualLeaveYearAllowance?: number
  annualLeaveYearAllowanceKey?: string
  hasNoLineManager?: boolean
  invitedBy: string
}

export type InviteUserCoreResult = {
  invitationId: string
  userId: string
  inviteType: 'new_user' | 'existing_user_org_add'
}

function roleFromPermissions(permissions: UserPermissions): string {
  if (permissions.adminAccess) return 'admin'
  if (permissions.manager && !permissions.operativeMode) return 'manager'
  return 'operative'
}

function inviteClaimUserFromDoc(
  userId: string,
  data: Record<string, unknown> | undefined
): InviteEmailClaimUser {
  return {
    userId,
    email: typeof data?.email === 'string' ? data.email : '',
    firstName: typeof data?.firstName === 'string' ? data.firstName : '',
    surname: typeof data?.surname === 'string' ? data.surname : '',
    lastName: typeof data?.lastName === 'string' ? data.lastName : '',
    name: typeof data?.name === 'string' ? data.name : '',
    displayName: typeof data?.displayName === 'string' ? data.displayName : '',
    passwordSet: data?.passwordSet === true ? true : data?.passwordSet === false ? false : undefined,
    isActive: data?.isActive === true ? true : data?.isActive === false ? false : undefined,
    mobileNumber: typeof data?.mobileNumber === 'string' ? data.mobileNumber : '',
    mobile: typeof data?.mobile === 'string' ? data.mobile : '',
    phone: typeof data?.phone === 'string' ? data.phone : '',
  }
}

export async function inviteUserCore(input: InviteUserCoreInput): Promise<InviteUserCoreResult> {
  const db = getFirebaseDb()
  const emailLower = input.email.toLowerCase().trim()

  const existingInOrg = await getDocs(
    query(
      collection(db, 'users'),
      where('email', '==', emailLower),
      where('organizationId', '==', input.organizationId)
    )
  )
  const orgEmailSnap = await getDoc(
    doc(db, 'organizations', input.organizationId, 'userEmails', emailLower)
  )
  const pointedId = orgEmailSnap.exists()
    ? orgEmailPointerUserId(orgEmailSnap.data() as Record<string, unknown>)
    : ''
  const pointedUserSnap = pointedId ? await getDoc(doc(db, 'users', pointedId)) : null
  const existingUsers = existingInOrg.docs.map((row) =>
    inviteClaimUserFromDoc(row.id, row.data() as Record<string, unknown>)
  )
  if (pointedUserSnap?.exists() && !existingUsers.some((user) => user.userId === pointedId)) {
    existingUsers.push(
      inviteClaimUserFromDoc(pointedId, pointedUserSnap.data() as Record<string, unknown>)
    )
  }

  const decision = resolveInviteEmailClaim({
    inviteEmail: emailLower,
    existingUsers,
    emailPointer: {
      exists: orgEmailSnap.exists(),
      pointedUserId: pointedId || undefined,
      pointedUser: pointedUserSnap?.exists()
        ? inviteClaimUserFromDoc(pointedId, pointedUserSnap.data() as Record<string, unknown>)
        : null,
    },
  })
  if (decision.action === 'block') {
    throw new Error(`A user with email ${emailLower} already exists in this organisation.`)
  }

  const existingAuthUser = await findExistingAuthUserByEmail(emailLower)
  if (existingAuthUser && existingAuthUser.organizationId !== input.organizationId) {
    const role = roleFromPermissions(input.permissions)
    const { invitationId } = await addExistingUserToOrganization({
      authUserId: existingAuthUser.userId,
      organizationId: input.organizationId,
      organizationName: input.organizationName || 'Organisation',
      role,
      permissions: input.permissions,
      invitedBy: input.invitedBy,
    })
    return {
      invitationId,
      userId: existingAuthUser.userId,
      inviteType: 'existing_user_org_add',
    }
  }

  const userId = decision.reuseUserId || newUuid()

  const invitationId = newUuid()

  const invitationData: Record<string, unknown> = {
    email: emailLower,
    organizationId: input.organizationId,
    invitedBy: input.invitedBy,
    firstName: input.firstName.trim(),
    surname: input.surname.trim(),
    employmentType: input.employmentType === 'paye' ? 'paye' : 'self_employed',
    permissions: permissionsToFirestoreMap(input.permissions),
    inviteType: 'new_user',
    createdAt: Timestamp.now(),
    isUsed: false,
  }

  if (input.mobileNumber?.trim()) invitationData.mobileNumber = input.mobileNumber.trim()
  const lineManagerIds = normalizeLineManagerIds(
    input.assignedManagerUserIds,
    input.assignedManagerUserId
  )
  if (input.hasNoLineManager) {
    invitationData.hasNoLineManager = true
  } else if (lineManagerIds.length > 0) {
    invitationData.assignedManagerUserIds = lineManagerIds
    invitationData.assignedManagerUserId = lineManagerIds[0]
    invitationData.hasNoLineManager = false
  }
  const invitedRates = readStoredRates(input)
  if (invitedRates.payBasis === 'hourly' && invitedRates.hourlyRate != null) {
    invitationData.payBasis = 'hourly'
    invitationData.hourlyRate = invitedRates.hourlyRate
  } else if (invitedRates.payBasis === 'day' && invitedRates.dayRate != null) {
    invitationData.payBasis = 'day'
    invitationData.dayRate = invitedRates.dayRate
  }
  if (input.tradeTypePreset?.trim()) invitationData.tradeTypePreset = input.tradeTypePreset.trim()
  if (input.tradeTypeCustom?.trim()) invitationData.tradeTypeCustom = input.tradeTypeCustom.trim()
  if (input.permissions.manager || input.permissions.operativeMode) {
    invitationData.timesheetsEnabled = input.timesheetsEnabled === true
  }
  if (input.vatNumber?.trim()) invitationData.vatNumber = input.vatNumber.trim()
  if (input.utrNumber?.trim()) invitationData.utrNumber = input.utrNumber.trim()
  if (input.annualLeaveEnabled != null) invitationData.annualLeaveEnabled = input.annualLeaveEnabled
  if (input.annualLeaveDaysPerYear != null) invitationData.annualLeaveDaysPerYear = input.annualLeaveDaysPerYear
  if (input.annualLeaveYearStartMonth != null) {
    invitationData.annualLeaveYearStartMonth = input.annualLeaveYearStartMonth
  }
  if (input.annualLeaveYearEndMonth != null) {
    invitationData.annualLeaveYearEndMonth = input.annualLeaveYearEndMonth
  }
  if (input.annualLeaveCarriesOver != null) invitationData.annualLeaveCarriesOver = input.annualLeaveCarriesOver
  if (input.annualLeaveYearAllowance != null) {
    invitationData.annualLeaveYearAllowance = input.annualLeaveYearAllowance
  }
  if (input.annualLeaveYearAllowanceKey) {
    invitationData.annualLeaveYearAllowanceKey = input.annualLeaveYearAllowanceKey
  }

  await setDoc(doc(db, 'invitations', invitationId), invitationData)
  await setDoc(
    doc(db, 'users', userId),
    buildInvitedUserPayload({
      userId,
      email: emailLower,
      organizationId: input.organizationId,
      firstName: input.firstName,
      surname: input.surname,
      permissions: input.permissions,
      mobileNumber: input.mobileNumber,
      assignedManagerUserId: input.assignedManagerUserId,
      assignedManagerUserIds: input.assignedManagerUserIds,
      dayRate: input.dayRate,
      hourlyRate: input.hourlyRate,
      payBasis: input.payBasis,
      tradeTypePreset: input.tradeTypePreset,
      tradeTypeCustom: input.tradeTypeCustom,
      employmentType: input.employmentType,
      timesheetsEnabled: input.timesheetsEnabled,
      vatNumber: input.vatNumber,
      utrNumber: input.utrNumber,
      annualLeaveEnabled: input.annualLeaveEnabled,
      annualLeaveDaysPerYear: input.annualLeaveDaysPerYear,
      annualLeaveYearStartMonth: input.annualLeaveYearStartMonth,
      annualLeaveYearEndMonth: input.annualLeaveYearEndMonth,
      annualLeaveCarriesOver: input.annualLeaveCarriesOver,
      annualLeaveYearAllowance: input.annualLeaveYearAllowance,
      annualLeaveYearAllowanceKey: input.annualLeaveYearAllowanceKey,
      hasNoLineManager: input.hasNoLineManager,
    })
  )
  await setDoc(doc(db, 'organizations', input.organizationId, 'userEmails', emailLower), { userId })
  if (invitedRates.payBasis === 'hourly' && invitedRates.hourlyRate != null) {
    await setDoc(
      doc(db, 'organizations', input.organizationId, 'operativeProfiles', userId),
      { userId, payBasis: 'hourly', hourlyRate: invitedRates.hourlyRate, updatedAt: Timestamp.now() },
      { merge: true }
    )
  } else if (invitedRates.payBasis === 'day' && invitedRates.dayRate != null) {
    await setDoc(
      doc(db, 'organizations', input.organizationId, 'operativeProfiles', userId),
      { userId, payBasis: 'day', dayRate: invitedRates.dayRate, updatedAt: Timestamp.now() },
      { merge: true }
    )
  }

  return { invitationId, userId, inviteType: 'new_user' }
}
