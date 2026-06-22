import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { companyLogoPath, uploadFile } from '@/lib/firebase/storageUtils'
import { auth, db } from '@/lib/firebase/config'
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
  organizationName: string
  planKey: SubscriptionPlanKey
  policyAccepted: boolean
  orgSetupSettings?: OrgSetupSettings
}

export type CreateOrganizationResult = {
  userId: string
  organizationId: string
}

export async function createPendingOrganization(
  input: CreateOrganizationInput
): Promise<CreateOrganizationResult> {
  const result = await createUserWithEmailAndPassword(auth, input.email, input.password)
  const userId = result.user.uid
  const organizationId = crypto.randomUUID()
  const now = new Date()

  const setupFields = input.orgSetupSettings
    ? orgSetupSettingsToFirestoreFields(input.orgSetupSettings, userId)
  : { creatorUserId: userId }

  const { settings: nestedSettings = {}, ...topLevelSetupFields } = setupFields as {
    settings?: Record<string, unknown>
    creatorUserId?: string
  }

  await setDoc(doc(db, 'organizations', organizationId), {
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

  const logoFile = input.orgSetupSettings?.identity.logoFile
  if (logoFile) {
    const storagePath = companyLogoPath(organizationId, logoFile.name)
    const companyLogoURL = await uploadFile(storagePath, logoFile, 'image/jpeg')
    await updateDoc(doc(db, 'organizations', organizationId), {
      companyLogoURL,
      updatedAt: now,
    })
  }

  await seedOrgDefaultDashboard(organizationId)

  const notificationPreferences = input.orgSetupSettings?.features.notificationPreferences

  await setDoc(doc(db, 'users', userId), {
    email: input.email,
    firstName: input.firstName,
    surname: input.surname,
    organizationId,
    role: 'admin',
    isActive: true,
    passwordSet: true,
    isSuperAdmin: true,
    permissions: {
      adminAccess: true,
      manager: true,
      operatives: true,
      skills: true,
      qualifications: true,
      materials: true,
      projects: true,
      smallWorks: true,
      operativeMode: false,
      siteAudit: true,
      subContractors: true,
      wholesalersOrderHistory: true,
    },
    policyAccepted: input.policyAccepted,
    policyAcceptedAt: input.policyAccepted ? now : null,
    ...(notificationPreferences ? { notificationPreferences } : {}),
    createdAt: now,
    updatedAt: now,
  })

  return { userId, organizationId }
}
