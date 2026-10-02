import type { User, UserPermissions, UserRole } from '@/types'
import { UserRole as Role } from '@/types'
import { permissionsFromRecord } from '@/lib/orgMembership/orgRoleFlags'

const STORAGE_PREFIX = 'pp.webActiveOrg:'

/** The company this browser last opened. iOS keeps its own choice on the user document. */
export function readWebActiveOrg(userId: string): string | null {
  if (typeof localStorage === 'undefined' || !userId) return null
  try {
    const value = localStorage.getItem(STORAGE_PREFIX + userId)?.trim()
    return value || null
  } catch {
    return null
  }
}

export function writeWebActiveOrg(userId: string, organizationId: string): void {
  if (typeof localStorage === 'undefined' || !userId || !organizationId) return
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, organizationId)
  } catch {
    /* This page still uses the organisation it already loaded. */
  }
}

function roleFrom(value: unknown, fallback: UserRole): UserRole {
  const role = String(value || '')
  if (role === Role.ADMIN) return Role.ADMIN
  if (role === Role.MANAGER) return Role.MANAGER
  if (role === Role.OPERATIVE) return Role.OPERATIVE
  if (role === Role.BASIC || role === Role.VIEWER) return Role.BASIC
  return fallback
}

function staffPermissions(role: UserRole): UserPermissions {
  const operative = role === Role.OPERATIVE
  const admin = role === Role.ADMIN
  const manager = role === Role.MANAGER
  return {
    adminAccess: admin,
    manager: manager,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: !operative,
    projects: false,
    smallWorks: false,
    operativeMode: operative,
    siteAudit: !operative,
    subContractors: false,
    wholesalersOrderHistory: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: false,
  }
}

/**
 * Rights for the company open on this device come from that company's membership.
 * The user document's organizationId stays the company last opened on another device.
 */
export function applyDeviceOrgMembership(
  user: User,
  documentOrganizationId: string,
  activeOrganizationId: string,
  membership: Record<string, unknown> | null,
  listedRole?: string | null
): User {
  const organizationId = activeOrganizationId || documentOrganizationId
  if (!organizationId) return user
  if (!membership && organizationId === documentOrganizationId) {
    return user
  }
  if (!membership) {
    const role = roleFrom(listedRole, Role.BASIC)
    return {
      ...user,
      organizationId,
      role,
      isSuperAdmin: false,
      permissions: staffPermissions(role),
    }
  }

  const permissions = permissionsFromRecord(membership)
  const isSuperAdmin =
    membership.isSuperAdmin === true ||
    (user.isSuperAdmin && organizationId === documentOrganizationId)
  const keepsAdmin = isSuperAdmin || permissions.adminAccess || String(membership.role || '') === Role.ADMIN
  const operativeMode = permissions.operativeMode && !keepsAdmin
  const role = keepsAdmin
    ? Role.ADMIN
    : operativeMode
      ? Role.OPERATIVE
      : permissions.manager
        ? Role.MANAGER
        : roleFrom(membership.role, user.role)

  return {
    ...user,
    organizationId,
    role,
    isSuperAdmin,
    isActive: membership.accountActive !== false,
    permissions: {
      ...permissions,
      operativeMode,
      adminAccess: operativeMode ? false : permissions.adminAccess || isSuperAdmin,
      manager: operativeMode ? false : permissions.manager,
      skills: false,
      materials: operativeMode ? permissions.materials : true,
      siteAudit: operativeMode ? permissions.siteAudit : true,
    },
  }
}
