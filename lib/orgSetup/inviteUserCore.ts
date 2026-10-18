import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { buildInvitedUserPayload, normalizeLineManagerIds, permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { readStoredRates } from '@/lib/timesheets/payBasis'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { withTimeout } from '@/lib/client/withTimeout'
import {
  inviteEmailOrgLookupConstraints,
  inviteWritesOperativeProfile,
  resolveInviteEmailClaim,
  type InviteEmailClaimUser,
} from '@/lib/canonical/inviteEmailClaim'
import { userCreateRequiresAgeConfirmation } from '@/lib/canonical/userProfile'
import { orgEmailPointerUserId } from '@/lib/orgSetup/staleOrgEmailPointer'
import type { UserPermissions } from '@/types'

const INVITE_LOOKUP_TIMEOUT_MS = 8000

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

async function loadInviteClaimState(
  organizationId: string,
  emailLower: string
): Promise<{
  existingUsers: InviteEmailClaimUser[]
  emailPointer: {
    exists: boolean
    pointedUserId?: string
    pointedUser: InviteEmailClaimUser | null
  }
}> {
  const db = getFirebaseDb()
  const lookup = inviteEmailOrgLookupConstraints(organizationId, emailLower)
  if (!lookup.organizationId || !lookup.email) {
    throw new Error('Organisation and email are required to invite a user.')
  }

  try {
    const existingInOrg = await withTimeout(
      getDocs(
        query(
          collection(db, 'users'),
          where('email', '==', lookup.email),
          where('organizationId', '==', lookup.organizationId)
        )
      ),
      INVITE_LOOKUP_TIMEOUT_MS,
      'invite-org-email-lookup'
    )
    const orgEmailSnap = await withTimeout(
      getDoc(doc(db, 'organizations', lookup.organizationId, 'userEmails', lookup.email)),
      INVITE_LOOKUP_TIMEOUT_MS,
      'invite-org-email-pointer'
    )
    const pointedId = orgEmailSnap.exists()
      ? orgEmailPointerUserId(orgEmailSnap.data() as Record<string, unknown>)
      : ''
    const pointedUserSnap = pointedId
      ? await withTimeout(
          getDoc(doc(db, 'users', pointedId)),
          INVITE_LOOKUP_TIMEOUT_MS,
          'invite-pointed-user'
        )
      : null
    const existingUsers = existingInOrg.docs.map((row) =>
      inviteClaimUserFromDoc(row.id, row.data() as Record<string, unknown>)
    )
    const pointedUser = pointedUserSnap?.exists()
      ? inviteClaimUserFromDoc(pointedId, pointedUserSnap.data() as Record<string, unknown>)
      : null
    if (pointedUser && !existingUsers.some((user) => user.userId === pointedId)) {
      existingUsers.push(pointedUser)
    }
    return {
      existingUsers,
      emailPointer: {
        exists: orgEmailSnap.exists(),
        pointedUserId: pointedId || undefined,
        pointedUser,
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Checking who already has this email took too long. Try again.')
    }
    throw error
  }
}

export async function inviteUserCore(input: InviteUserCoreInput): Promise<InviteUserCoreResult> {
  const db = getFirebaseDb()
  const emailLower = input.email.toLowerCase().trim()
  const claim = await loadInviteClaimState(input.organizationId, emailLower)

  const decision = resolveInviteEmailClaim({
    inviteEmail: emailLower,
    existingUsers: claim.existingUsers,
    emailPointer: claim.emailPointer,
  })
  if (decision.action === 'block') {
    throw new Error(`A user with email ${emailLower} already exists in this organisation.`)
  }

  const userId = decision.reuseUserId || newUuid()
  if (
    userCreateRequiresAgeConfirmation({
      creatorUserId: input.invitedBy,
      targetUserId: userId,
    })
  ) {
    throw new Error('Invite placeholders must not use the self-create path.')
  }

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
  if (inviteWritesOperativeProfile()) {
    throw new Error('inviteWritesOperativeProfile must stay false; rates belong on users/{uid}')
  }

  return { invitationId, userId, inviteType: 'new_user' }
}
