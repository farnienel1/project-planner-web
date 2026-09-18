import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { newUuid, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { companyLogoPath, uploadFile } from '@/lib/firebase/storageUtils'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { FOUNDER_PERMISSIONS } from '@/lib/orgMembership/orgRoleFlags'
import {
  orgSetupSettingsToFirestoreFields,
  type OrgSetupSettings,
} from '@/lib/orgSetup/orgSetupSettings'
import type { SubscriptionPlanKey } from '@/lib/stripe/plans'

export type CreateOrganizationInput = {
  email: string
  password?: string
  firstName: string
  surname: string
  mobileNumber?: string
  organizationName: string
  planKey: SubscriptionPlanKey
  orgSetupSettings?: OrgSetupSettings
}

export type CreateOrganizationResult = {
  userId: string
  organizationId: string
  confirmationToken: string
  isAdditionalOrganization: boolean
  needsEmailConfirmation: boolean
}

function authErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: string }).code ?? '')
  }
  return ''
}

async function resolveAuthUserId(email: string, password: string | undefined): Promise<string> {
  const auth = getFirebaseAuth()
  if (auth.currentUser) {
    return auth.currentUser.uid
  }
  if (!password) {
    throw new Error('Please enter a password to create your account.')
  }
  try {
    const created = await createUserWithEmailAndPassword(auth, email, password)
    return created.user.uid
  } catch (error) {
    if (authErrorCode(error) !== 'auth/email-already-in-use') throw error
    const signedIn = await signInWithEmailAndPassword(auth, email, password)
    return signedIn.user.uid
  }
}

function founderPermissionFields() {
  const flags = permissionsToFirestoreMap(FOUNDER_PERMISSIONS)
  return {
    isSuperAdmin: true,
    adminAccess: true,
    manager: true,
    operatives: true,
    skills: false,
    qualifications: true,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    siteAudit: true,
    subContractors: true,
    wholesalersOrderHistory: true,
    weeklyReports: true,
    dailyOverview: true,
    permissions: flags,
    ...flags,
  }
}

export async function createPendingOrganization(
  input: CreateOrganizationInput
): Promise<CreateOrganizationResult> {
  const db = getFirebaseDb()
  const email = input.email.toLowerCase().trim()
  const userId = await resolveAuthUserId(email, input.password)
  const existingUserSnap = await getDoc(doc(db, 'users', userId))
  const isAdditionalOrganization = existingUserSnap.exists()
  const alreadyConfirmed = existingUserSnap.data()?.accountConfirmed !== false
  const needsEmailConfirmation = !isAdditionalOrganization || !alreadyConfirmed

  if (isAdditionalOrganization) {
    const { snapshotCurrentMembership } = await import('@/lib/orgMembership/membershipService')
    await snapshotCurrentMembership(userId)
  }

  const organizationId = crypto.randomUUID()
  const confirmationToken = needsEmailConfirmation ? newUuid() : ''
  const now = new Date()

  const setupFields = input.orgSetupSettings
    ? orgSetupSettingsToFirestoreFields(input.orgSetupSettings, userId)
    : { creatorUserId: userId }

  const { settings: nestedSettings = {}, ...topLevelSetupFields } = setupFields as {
    settings?: Record<string, unknown>
    creatorUserId?: string
  }

  await setDoc(
    doc(db, 'organizations', organizationId),
    sanitizeForFirestore({
      name: input.organizationName,
      members: { [userId]: 'admin' },
      settings: nestedSettings,
      subscription: {
        status: 'pending',
        planKey: input.planKey,
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
      ...topLevelSetupFields,
    })
  )

  const logoFile = input.orgSetupSettings?.identity.logoFile
  if (logoFile) {
    const storagePath = companyLogoPath(organizationId, logoFile.name)
    const companyLogoURL = await uploadFile(storagePath, logoFile, logoFile.type || 'image/png')
    await updateDoc(doc(db, 'organizations', organizationId), {
      companyLogoURL,
      updatedAt: now,
    })
  }

  await seedOrgDefaultDashboard(organizationId)

  await setDoc(doc(db, 'organizations', organizationId, 'userEmails', email), {
    userId,
  })

  const notificationPreferences = input.orgSetupSettings?.features.notificationPreferences
  const annualLeaveDefaults = input.orgSetupSettings?.features.annualLeaveDefaults
  const founderFields = founderPermissionFields()
  const leaveFields = annualLeaveDefaults
    ? {
        annualLeaveEnabled: true,
        annualLeaveDaysPerYear: annualLeaveDefaults.daysPerYear,
        annualLeaveYearStartMonth: annualLeaveDefaults.startMonth,
        annualLeaveYearEndMonth: annualLeaveDefaults.endMonth,
        annualLeaveCarriesOver: annualLeaveDefaults.carriesOver,
      }
    : {}

  if (isAdditionalOrganization) {
    const existing = existingUserSnap.data() as Record<string, unknown>
    await updateDoc(
      doc(db, 'users', userId),
      sanitizeForFirestore({
        email,
        firstName: input.firstName.trim() || String(existing.firstName || ''),
        surname: input.surname.trim() || String(existing.surname || ''),
        ...(input.mobileNumber?.trim() ? { mobileNumber: input.mobileNumber.trim() } : {}),
        organizationId,
        role: 'admin',
        isActive: true,
        passwordSet: true,
        ...founderFields,
        ...leaveFields,
        ...(notificationPreferences ? { notificationPreferences } : {}),
        updatedAt: now,
      }) as Record<string, unknown>
    )
  } else {
    await setDoc(
      doc(db, 'users', userId),
      sanitizeForFirestore({
        email,
        firstName: input.firstName,
        surname: input.surname,
        ...(input.mobileNumber?.trim() ? { mobileNumber: input.mobileNumber.trim() } : {}),
        organizationId,
        role: 'admin',
        isActive: true,
        passwordSet: true,
        accountConfirmed: false,
        accountConfirmToken: confirmationToken,
        ...founderFields,
        policyAccepted: false,
        policyAcceptedAt: null,
        ...leaveFields,
        ...(notificationPreferences ? { notificationPreferences } : {}),
        createdAt: now,
        updatedAt: now,
      })
    )
  }

  if (needsEmailConfirmation && confirmationToken) {
    await setDoc(doc(db, 'accountConfirmations', confirmationToken), {
      userId,
      email,
      organizationId,
      isUsed: false,
      createdAt: Timestamp.fromDate(now),
    })
  }

  const { ensurePrimaryOrgMembership } = await import('@/lib/orgMembership/membershipService')
  await ensurePrimaryOrgMembership(userId, organizationId, 'admin', { isSuperAdmin: true })

  return {
    userId,
    organizationId,
    confirmationToken,
    isAdditionalOrganization,
    needsEmailConfirmation,
  }
}
