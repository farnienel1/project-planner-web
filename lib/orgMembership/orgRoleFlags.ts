import { permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import type { UserPermissions } from '@/types'

export const FOUNDER_PERMISSIONS: UserPermissions = {
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
}

export function permissionsFromRecord(raw?: Record<string, unknown> | null): UserPermissions {
  const source = raw && typeof raw === 'object' ? raw : {}
  const nested =
    source.permissions && typeof source.permissions === 'object'
      ? (source.permissions as Record<string, unknown>)
      : {}
  const read = (key: keyof UserPermissions, fallback = false): boolean => {
    if (source[key] === true || nested[key] === true) return true
    if (source[key] === false || nested[key] === false) return false
    return fallback
  }
  return {
    adminAccess: read('adminAccess'),
    manager: read('manager'),
    operatives: read('operatives'),
    skills: false,
    qualifications: read('qualifications'),
    materials: read('materials', true),
    projects: read('projects'),
    smallWorks: read('smallWorks'),
    operativeMode: read('operativeMode'),
    siteAudit: read('siteAudit', true),
    subContractors: read('subContractors'),
    wholesalersOrderHistory: read('wholesalersOrderHistory', true),
    annualLeaveSelfBook: read('annualLeaveSelfBook'),
    weeklyReports: read('weeklyReports'),
    dailyOverview: read('dailyOverview', true),
  }
}

export function userPatchForActiveOrg(input: {
  organizationId: string
  role?: string
  isCreator?: boolean
  membershipIsSuperAdmin?: boolean
  permissions?: Record<string, unknown> | null
}): Record<string, unknown> {
  const isSuperAdmin = input.membershipIsSuperAdmin === true || input.isCreator === true
  const permissions = isSuperAdmin
    ? FOUNDER_PERMISSIONS
    : permissionsFromRecord(input.permissions || undefined)
  const flags = permissionsToFirestoreMap(permissions)
  const role = isSuperAdmin
    ? 'admin'
    : flags.adminAccess
      ? 'admin'
      : flags.operativeMode
        ? 'operative'
        : flags.manager
          ? 'manager'
          : input.role || 'member'

  return {
    organizationId: input.organizationId,
    role,
    isSuperAdmin,
    permissions: flags,
    ...flags,
    adminAccess: isSuperAdmin ? true : flags.adminAccess,
    manager: flags.operativeMode ? false : flags.manager,
    operatives: flags.operativeMode ? false : flags.operatives,
  }
}

/** Snapshot of the active org's role flags, stored on users/{uid}/orgMemberships/{orgId}. */
export function membershipSnapshotFromUserDoc(data: Record<string, unknown>): {
  role: string
  status: 'active'
  isSuperAdmin: boolean
  permissions: Record<string, boolean>
} {
  const permissions = permissionsFromRecord(data)
  return {
    role: String(data.role || 'member'),
    status: 'active',
    isSuperAdmin: data.isSuperAdmin === true,
    permissions: permissionsToFirestoreMap(permissions),
  }
}
