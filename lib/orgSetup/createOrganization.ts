import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { auth, db } from '@/lib/firebase/config'
import type { SubscriptionPlanKey } from '@/lib/stripe/plans'

export type CreateOrganizationInput = {
  email: string
  password: string
  firstName: string
  surname: string
  organizationName: string
  planKey: SubscriptionPlanKey
  policyAccepted: boolean
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

  await setDoc(doc(db, 'organizations', organizationId), {
    name: input.organizationName,
    members: { [userId]: 'admin' },
    settings: {},
    subscription: {
      status: 'pending',
      planKey: input.planKey,
      createdAt: now,
    },
    createdAt: now,
    updatedAt: now,
  })

  await seedOrgDefaultDashboard(organizationId)

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
    createdAt: now,
    updatedAt: now,
  })

  return { userId, organizationId }
}
