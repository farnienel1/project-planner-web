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

/** iOS organizationIdsMatch — trim and ignore case. */
export function organizationIdsMatch(lhs?: string | null, rhs?: string | null): boolean {
  const left = String(lhs || '').trim().toLowerCase()
  const right = String(rhs || '').trim().toLowerCase()
  return left.length > 0 && left === right
}

/** Result of asking Firestore whether this login belongs to a company. */
export type OrgAccessProbe = 'allowed' | 'denied' | 'unknown'

/**
 * Pick the company this browser should open.
 * An explicit switch or a remembered company wins over the company stored on
 * users/{uid}. A slow or failed read must not throw that choice away.
 * Only a definite "not a member" falls back to the user document.
 */
export function chooseWebSessionOrganization(input: {
  explicitOrganizationId?: string | null
  rememberedOrganizationId?: string | null
  documentOrganizationId?: string | null
  probes: ReadonlyMap<string, OrgAccessProbe> | Readonly<Record<string, OrgAccessProbe>>
}): { organizationId: string; persistOrganizationId: string | null } {
  const documentOrganizationId = String(input.documentOrganizationId || '').trim()
  const ordered = [
    input.explicitOrganizationId,
    input.rememberedOrganizationId,
    documentOrganizationId,
  ]
  const candidates: string[] = []
  for (const value of ordered) {
    const id = String(value || '').trim()
    if (!id) continue
    if (candidates.some((existing) => organizationIdsMatch(existing, id))) continue
    candidates.push(id)
  }

  const probeFor = (organizationId: string): OrgAccessProbe => {
    if (input.probes instanceof Map) {
      for (const [key, probe] of input.probes) {
        if (organizationIdsMatch(key, organizationId)) return probe
      }
      return 'unknown'
    }
    for (const [key, probe] of Object.entries(input.probes)) {
      if (organizationIdsMatch(key, organizationId)) return probe
    }
    return 'unknown'
  }

  for (const organizationId of candidates) {
    const isDocument = organizationIdsMatch(organizationId, documentOrganizationId)
    const probe = probeFor(organizationId)
    if (!isDocument && probe === 'denied') continue
    return { organizationId, persistOrganizationId: organizationId }
  }

  return {
    organizationId: documentOrganizationId,
    persistOrganizationId: documentOrganizationId || null,
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
 * Rights for a different company come from that company's membership.
 * When this browser is in the company on the user document, that document is the profile.
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
  // iOS loadDeviceSessionProfile: the shared user document is this company's profile.
  // A membership stub (often just members-map role "admin") must not replace it.
  if (organizationIdsMatch(organizationId, documentOrganizationId)) {
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
