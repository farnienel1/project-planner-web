import { permissionsToFirestoreMap } from '@/lib/firebase/userPayload'
import { parseOrgMembershipDocument } from '@/lib/canonical/orgMembership'
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

/**
 * A membership's (or users document's) role flags, read by the rulebook (1.10.0 `parseOrgMembershipDocument`: nested
 * `permissions.{key}` first, else the legacy flat key, else its default). `skills` stays off on web (no Skills
 * screen yet), as before.
 */
export function membershipPermissions(raw?: Record<string, unknown> | null): UserPermissions {
  const parsed = parseOrgMembershipDocument('membership', raw && typeof raw === 'object' ? raw : {})!
  const flags = parsed.permissions
  return {
    adminAccess: flags.adminAccess,
    manager: flags.manager,
    operatives: flags.operatives,
    skills: false,
    qualifications: flags.qualifications,
    materials: flags.materials,
    projects: flags.projects,
    smallWorks: flags.smallWorks,
    operativeMode: flags.operativeMode,
    siteAudit: flags.siteAudit,
    subContractors: flags.subContractors,
    wholesalersOrderHistory: flags.wholesalersOrderHistory,
    annualLeaveSelfBook: flags.annualLeaveSelfBook,
    // Rulebook 1.28.0: admins only; `effectivePermissions` reads it off at other levels.
    timesheetSelfSign: flags.timesheetSelfSign,
    weeklyReports: flags.weeklyReports,
    dailyOverview: flags.dailyOverview,
  }
}

export function userPatchForActiveOrg(input: {
  organizationId: string
  role?: string
  isCreator?: boolean
  membershipIsSuperAdmin?: boolean
  permissions?: Record<string, unknown> | null
  accountActive?: boolean
}): Record<string, unknown> {
  const isSuperAdmin = input.membershipIsSuperAdmin === true
  const permissions = isSuperAdmin
    ? FOUNDER_PERMISSIONS
    : membershipPermissions(input.permissions || undefined)
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
    isActive: input.accountActive !== false,
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
  accountActive: boolean
  permissions: Record<string, boolean>
} {
  const permissions = membershipPermissions(data)
  return {
    role: String(data.role || 'member'),
    status: 'active',
    isSuperAdmin: data.isSuperAdmin === true,
    accountActive: data.isActive !== false,
    permissions: permissionsToFirestoreMap(permissions),
  }
}
