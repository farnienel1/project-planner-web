import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { newUuid, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { companyLogoPath, uploadFile } from '@/lib/firebase/storageUtils'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  orgSetupSettingsToFirestoreFields,
  type OrgSetupSettings,
} from '@/lib/orgSetup/orgSetupSettings'
import type { SubscriptionPlanKey } from '@/lib/stripe/plans'

export type CreateOrganizationInput = {
  email: string
  password: string
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
}

export async function createPendingOrganization(
  input: CreateOrganizationInput
): Promise<CreateOrganizationResult> {
  const auth = getFirebaseAuth()
  const db = getFirebaseDb()
  const result = await createUserWithEmailAndPassword(auth, input.email, input.password)
  const userId = result.user.uid
  const organizationId = crypto.randomUUID()
  const confirmationToken = newUuid()
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

  const notificationPreferences = input.orgSetupSettings?.features.notificationPreferences

  const annualLeaveDefaults = input.orgSetupSettings?.features.annualLeaveDefaults

  await setDoc(
    doc(db, 'users', userId),
    sanitizeForFirestore({
      email: input.email,
      firstName: input.firstName,
      surname: input.surname,
      ...(input.mobileNumber?.trim() ? { mobileNumber: input.mobileNumber.trim() } : {}),
      organizationId,
      role: 'admin',
      isActive: true,
      passwordSet: true,
      accountConfirmed: false,
      accountConfirmToken: confirmationToken,
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
      permissions: {
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
      },
      policyAccepted: false,
      policyAcceptedAt: null,
      ...(annualLeaveDefaults
        ? {
            annualLeaveEnabled: true,
            annualLeaveDaysPerYear: annualLeaveDefaults.daysPerYear,
            annualLeaveYearStartMonth: annualLeaveDefaults.startMonth,
            annualLeaveYearEndMonth: annualLeaveDefaults.endMonth,
            annualLeaveCarriesOver: annualLeaveDefaults.carriesOver,
          }
        : {}),
      ...(notificationPreferences ? { notificationPreferences } : {}),
      createdAt: now,
      updatedAt: now,
    })
  )

  await setDoc(doc(db, 'accountConfirmations', confirmationToken), {
    userId,
    email: input.email.toLowerCase().trim(),
    organizationId,
    isUsed: false,
    createdAt: Timestamp.fromDate(now),
  })

  const { ensurePrimaryOrgMembership } = await import('@/lib/orgMembership/membershipService')
  await ensurePrimaryOrgMembership(userId, organizationId, 'admin')

  return { userId, organizationId, confirmationToken }
}
