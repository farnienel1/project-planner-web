import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { buildInvitedUserPayload, normalizeLineManagerIds, permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import {
  addExistingUserToOrganization,
  findExistingAuthUserByEmail,
} from '@/lib/orgMembership/membershipService'
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
  tradeTypePreset?: string
  tradeTypeCustom?: string
  employmentType?: 'paye' | 'selfEmployed'
  timesheetsEnabled?: boolean
  vatNumber?: string
  utrNumber?: string
  annualLeaveEnabled?: boolean
  annualLeaveDaysPerYear?: number
  annualLeaveYearStartMonth?: number
  annualLeaveYearEndMonth?: number
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
  if (!existingInOrg.empty) {
    throw new Error(`A user with email ${emailLower} already exists in this organisation.`)
  }

  const orgEmailSnap = await getDoc(
    doc(db, 'organizations', input.organizationId, 'userEmails', emailLower)
  )
  if (orgEmailSnap.exists()) {
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

  const invitationId = newUuid()
  const userId = newUuid()

  const invitationData: Record<string, unknown> = {
    email: emailLower,
    organizationId: input.organizationId,
    invitedBy: input.invitedBy,
    firstName: input.firstName.trim(),
    surname: input.surname.trim(),
    employmentType: input.employmentType || 'selfEmployed',
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
  if ((input.permissions.operativeMode || input.permissions.manager) && lineManagerIds.length > 0) {
    invitationData.assignedManagerUserIds = lineManagerIds
    invitationData.assignedManagerUserId = lineManagerIds[0]
  }
  if ((input.permissions.operativeMode || input.permissions.manager) && input.dayRate != null) {
    invitationData.dayRate = input.dayRate
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
    })
  )
  await setDoc(doc(db, 'organizations', input.organizationId, 'userEmails', emailLower), { userId })

  return { invitationId, userId, inviteType: 'new_user' }
}
