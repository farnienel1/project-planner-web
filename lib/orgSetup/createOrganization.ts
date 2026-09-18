import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { withTimeout } from '@/lib/client/withTimeout'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { newUuid, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { companyLogoPath, uploadFile } from '@/lib/firebase/storageUtils'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { FOUNDER_PERMISSIONS } from '@/lib/orgMembership/orgRoleFlags'
import { resolveAuthUserIdForOrgSetup } from '@/lib/orgSetup/resolveAuthForOrgSetup'
import {
  ensurePrimaryOrgMembership,
  snapshotCurrentMembership,
} from '@/lib/orgMembership/membershipService'
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
  const userId = await resolveAuthUserIdForOrgSetup(email, input.password)
  const existingUserSnap = await withTimeout(
    getDoc(doc(db, 'users', userId)),
    10000,
    'Could not reach Firestore to create the organisation. Refresh this page, then click Activate again.'
  )
  const isAdditionalOrganization = existingUserSnap.exists()
  const alreadyConfirmed = existingUserSnap.data()?.accountConfirmed !== false
  const needsEmailConfirmation = !isAdditionalOrganization || !alreadyConfirmed

  if (isAdditionalOrganization) {
    try {
      await withTimeout(snapshotCurrentMembership(userId), 8000, 'membership-snapshot')
    } catch {
      // Best-effort snapshot of the current org — do not block creating another organisation.
    }
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

  await withTimeout(
    setDoc(
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
    ),
    12000,
    'Could not save the organisation. Refresh this page, then click Activate again.'
  )

  const logoFile = input.orgSetupSettings?.identity.logoFile
  if (logoFile) {
    try {
      const storagePath = companyLogoPath(organizationId, logoFile.name)
      const companyLogoURL = await withTimeout(
        uploadFile(storagePath, logoFile, logoFile.type || 'image/png'),
        8000,
        'Logo upload is taking too long.'
      )
      await updateDoc(doc(db, 'organizations', organizationId), {
        companyLogoURL,
        updatedAt: now,
      })
    } catch {
      // Continue without a logo — activation should not hang on Storage.
    }
  }

  try {
    await withTimeout(seedOrgDefaultDashboard(organizationId), 10000, 'dashboard-seed')
  } catch {
    // Dashboard layout can be seeded later; do not block org creation.
  }

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

  try {
    await withTimeout(
      ensurePrimaryOrgMembership(userId, organizationId, 'admin', { isSuperAdmin: true }),
      8000,
      'membership'
    )
  } catch {
    // The organisation members map already includes this founder.
  }

  return {
    userId,
    organizationId,
    confirmationToken,
    isAdditionalOrganization,
    needsEmailConfirmation,
  }
}
