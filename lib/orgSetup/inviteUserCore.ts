import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { buildInvitedUserPayload, normalizeLineManagerIds, permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { payProfileWriteFieldsFromProfileWrite, PAY_PROFILES_COLLECTION, sharedDocumentPayWrite, userMissingLevel, writeMetadataFields } from '@/lib/canonical'
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'
import { invitationCreateFields } from '@/lib/canonical/createDocuments'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { createWritePayload } from '@/lib/firebase/partialWrite'
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
import { saveTaxIds } from '@/lib/sensitiveProfile/taxIdsService'

const INVITE_LOOKUP_TIMEOUT_MS = 8000

export type InviteUserCoreInput = {
  email: string
  organizationId: string
  organizationName?: string
  firstName: string
  surname: string
  mobileNumber?: string
  permissions: UserPermissions
  /** Rulebook 1.11.0: the Add User level, stored on the invitation (`invitationCreateFields` `role`). */
  role?: 'admin' | 'manager' | 'operative'
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

/** Rulebook 1.23.1 §11: the refusal when an invite has no user level, else null. Pure. */
export function inviteLevelError(input: Pick<InviteUserCoreInput, 'permissions'>): string | null {
  const flags = permissionsToFirestoreMap(input.permissions)
  return userMissingLevel({ id: 'invite', email: 'invite', ...flags }) ? 'Choose a user level (admin, manager or operative) before inviting this person.' : null
}

export async function inviteUserCore(input: InviteUserCoreInput): Promise<InviteUserCoreResult> {
  // Rulebook 1.23.1 §11: every user is created with a level (admin, manager or operative). Never write a profile or
  // an invitation without one (`userMissingLevel`).
  const levelError = inviteLevelError(input)
  if (levelError) throw new Error(levelError)
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

  // Rulebook 1.9.0 `invitationCreateFields`: the shared invitation create shape (never UTR or VAT — the invitation is
  // readable by link; see saveTaxIds below).
  const invitationData = invitationCreateFields({
    email: emailLower,
    organizationId: input.organizationId,
    invitedBy: input.invitedBy,
    firstName: input.firstName,
    surname: input.surname,
    employmentType: input.employmentType,
    permissions: permissionsToFirestoreMap(input.permissions),
    role: input.role,
    createdAt: Timestamp.now(),
    mobileNumber: input.mobileNumber,
    assignedManagerUserIds: normalizeLineManagerIds(input.assignedManagerUserIds, input.assignedManagerUserId),
    hasNoLineManager: input.hasNoLineManager === true,
    payBasis: input.payBasis,
    dayRate: input.dayRate,
    hourlyRate: input.hourlyRate,
    tradeTypePreset: input.tradeTypePreset,
    tradeTypeCustom: input.tradeTypeCustom,
    timesheetsEnabled: input.timesheetsEnabled,
    annualLeaveEnabled: input.annualLeaveEnabled,
    annualLeaveDaysPerYear: input.annualLeaveDaysPerYear,
    annualLeaveYearStartMonth: input.annualLeaveYearStartMonth,
    annualLeaveYearEndMonth: input.annualLeaveYearEndMonth,
    annualLeaveCarriesOver: input.annualLeaveCarriesOver,
    annualLeaveYearAllowance: input.annualLeaveYearAllowance,
    annualLeaveYearAllowanceKey: input.annualLeaveYearAllowanceKey,
  })
  if (!invitationData) throw new Error('An invitation needs an email and an organisation.')

  const placeholder = buildInvitedUserPayload({
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
      annualLeaveEnabled: input.annualLeaveEnabled,
      annualLeaveDaysPerYear: input.annualLeaveDaysPerYear,
      annualLeaveYearStartMonth: input.annualLeaveYearStartMonth,
      annualLeaveYearEndMonth: input.annualLeaveYearEndMonth,
      annualLeaveCarriesOver: input.annualLeaveCarriesOver,
      annualLeaveYearAllowance: input.annualLeaveYearAllowance,
      annualLeaveYearAllowanceKey: input.annualLeaveYearAllowanceKey,
      hasNoLineManager: input.hasNoLineManager,
    })
  // Rulebook 1.26.0 (`sharedDocumentPayWrite`): with `privatePay` on, the placeholder users document carries no pay;
  // the invited pay goes to the placeholder's pay profile (written after the placeholder exists, so the rules can
  // check who may change its pay). The invitation itself still stores the pay it will apply.
  await securitySwitchesReady()
  const privatePay = privatePayFor(input.organizationId)
  // Rulebook 1.31.0 §11 (audit finding 8): the invitation, the placeholder users document and the email claim are ONE
  // batch, so a refusal never leaves an invitation without its placeholder or a placeholder without its claim. The pay
  // profile and the tax ids follow: their rules check the placeholder that this batch creates.
  const batch = writeBatch(db)
  batch.set(doc(db, 'invitations', invitationId), invitationData)
  // A create: `deleteField()` markers from the payload builder (e.g. an admin with "No line manager") are left out.
  batch.set(doc(db, 'users', userId), createWritePayload(sharedDocumentPayWrite(placeholder, { privatePay })))
  batch.set(doc(db, 'organizations', input.organizationId, 'userEmails', emailLower), { userId })
  await batch.commit()
  const payFields = privatePay ? payProfileWriteFieldsFromProfileWrite(userId, placeholder) : null
  if (payFields) {
    await setDoc(
      doc(db, 'organizations', input.organizationId, PAY_PROFILES_COLLECTION, userId),
      { ...payFields, ...(writeMetadataFields(input.invitedBy, 'web') || {}), updatedAt: Timestamp.now() },
      { merge: true }
    )
  }
  if (input.utrNumber?.trim() || input.vatNumber?.trim()) {
    await saveTaxIds(userId, { utrNumber: input.utrNumber, vatNumber: input.vatNumber }, input.invitedBy, {
      stripLegacy: false,
    })
  }
  if (inviteWritesOperativeProfile()) {
    throw new Error('inviteWritesOperativeProfile must stay false; rates belong on users/{uid}')
  }

  return { invitationId, userId, inviteType: 'new_user' }
}
