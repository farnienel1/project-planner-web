import { collection, doc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { buildInvitedUserPayload, permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import type { UserPermissions } from '@/types'

export type InviteUserCoreInput = {
  email: string
  organizationId: string
  firstName: string
  surname: string
  mobileNumber?: string
  permissions: UserPermissions
  assignedManagerUserId?: string
  dayRate?: number
  employmentType?: 'paye' | 'selfEmployed'
  invitedBy: string
}

export async function inviteUserCore(
  input: InviteUserCoreInput
): Promise<{ invitationId: string; userId: string }> {
  const db = getFirebaseDb()
  const emailLower = input.email.toLowerCase().trim()

  const existing = await getDocs(
    query(
      collection(db, 'users'),
      where('email', '==', emailLower),
      where('organizationId', '==', input.organizationId)
    )
  )
  if (!existing.empty) {
    throw new Error(`A user with email ${emailLower} already exists in this organization.`)
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
    createdAt: Timestamp.now(),
    isUsed: false,
  }

  if (input.mobileNumber?.trim()) invitationData.mobileNumber = input.mobileNumber.trim()
  if ((input.permissions.operativeMode || input.permissions.manager) && input.assignedManagerUserId) {
    invitationData.assignedManagerUserId = input.assignedManagerUserId
  }
  if (input.permissions.operativeMode && input.dayRate != null) {
    invitationData.dayRate = input.dayRate
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
      dayRate: input.dayRate,
      employmentType: input.employmentType,
    })
  )
  await setDoc(doc(db, 'organizations', input.organizationId, 'userEmails', emailLower), { userId })

  return { invitationId, userId }
}
