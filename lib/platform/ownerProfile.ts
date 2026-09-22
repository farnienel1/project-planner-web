import { UserRole, type User } from '@/types'
import { defaultUserPermissions } from '@/lib/ios-parity/converters'
import { PLATFORM_OWNER_EMAIL, PLATFORM_OWNER_SENTINEL_ORG } from '@/lib/platform/owner'

export function platformOwnerUser(uid: string, email = PLATFORM_OWNER_EMAIL): User {
  const now = new Date()
  return {
    id: uid,
    email,
    firstName: 'Platform',
    surname: 'Owner',
    organizationId: PLATFORM_OWNER_SENTINEL_ORG,
    role: UserRole.ADMIN,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: defaultUserPermissions(false),
    policyAccepted: true,
    accountConfirmed: true,
    createdAt: now,
    updatedAt: now,
  }
}

export function platformOwnerProfilePayload(email = PLATFORM_OWNER_EMAIL): Record<string, unknown> {
  return {
    email,
    firstName: 'Platform',
    surname: 'Owner',
    organizationId: PLATFORM_OWNER_SENTINEL_ORG,
    role: 'admin',
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    platformOwner: true,
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: false,
    projects: false,
    smallWorks: false,
    operativeMode: false,
    siteAudit: false,
    subContractors: false,
    wholesalersOrderHistory: false,
    dailyOverview: false,
    policyAccepted: true,
    accountConfirmed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
