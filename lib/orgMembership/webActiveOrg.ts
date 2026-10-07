import type { User, UserPermissions, UserRole } from '@/types'
import { UserRole as Role } from '@/types'
import { withTimeout } from '@/lib/client/withTimeout'
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

/** One membership probe. Short enough that a slow read cannot hold the splash. */
export const SESSION_ORG_PROBE_MS = 2_000

/**
 * The company to open before membership reads finish.
 * Explicit switch, then the company this browser remembers, then the user document.
 */
export function provisionalWebOrganizationId(input: {
  explicitOrganizationId?: string | null
  rememberedOrganizationId?: string | null
  documentOrganizationId?: string | null
}): string {
  for (const value of [input.explicitOrganizationId, input.rememberedOrganizationId, input.documentOrganizationId]) {
    const organizationId = String(value || '').trim()
    if (organizationId) return organizationId
  }
  return ''
}

/**
 * Ask each company at the same time. A read that does not finish is `unknown`
 * from `unknown()`, which keeps the company the browser already chose.
 */
export async function probeSessionOrganizations<T>(
  organizationIds: readonly (string | null | undefined)[],
  read: (organizationId: string) => Promise<T>,
  unknown: () => T,
  timeoutMs = SESSION_ORG_PROBE_MS
): Promise<Map<string, T>> {
  const unique: string[] = []
  for (const value of organizationIds) {
    const organizationId = String(value || '').trim()
    if (!organizationId) continue
    if (unique.some((existing) => organizationIdsMatch(existing, organizationId))) continue
    unique.push(organizationId)
  }

  const rows = await Promise.all(
    unique.map(async (organizationId) => {
      const pending = read(organizationId).catch(() => unknown())
      try {
        const value = await withTimeout(pending, timeoutMs, 'Organisation membership check timed out')
        return [organizationId, value] as const
      } catch {
        return [organizationId, unknown()] as const
      }
    })
  )
  return new Map(rows)
}

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
    manager: admin || manager,
    operatives: admin,
    skills: false,
    qualifications: admin,
    materials: admin || manager || !operative,
    projects: admin,
    smallWorks: admin,
    operativeMode: operative,
    siteAudit: !operative,
    subContractors: admin,
    wholesalersOrderHistory: admin || manager,
    annualLeaveSelfBook: false,
    weeklyReports: admin,
    dailyOverview: admin || manager || !operative,
  }
}

function roleToken(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function isAdminRole(value: unknown): boolean {
  return roleToken(value).includes('admin')
}

/** Keys actually stored on a membership. A role-only stub has none. */
function explicitPermissionKeys(record: Record<string, unknown>): Set<string> {
  const keys = new Set<string>()
  const nested =
    record.permissions && typeof record.permissions === 'object'
      ? (record.permissions as Record<string, unknown>)
      : {}
  for (const key of Object.keys(record)) {
    if (typeof record[key] === 'boolean') keys.add(key)
  }
  for (const key of Object.keys(nested)) {
    if (typeof nested[key] === 'boolean') keys.add(key)
  }
  return keys
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
    const listed = roleFrom(listedRole, Role.BASIC)
    const adminHere = listed === Role.ADMIN || (user.isSuperAdmin === true && !listedRole)
    if (adminHere) {
      return {
        ...user,
        organizationId,
        role: Role.ADMIN,
        isSuperAdmin: user.isSuperAdmin === true,
        permissions: staffPermissions(Role.ADMIN),
      }
    }
    return {
      ...user,
      organizationId,
      role: listed,
      isSuperAdmin: false,
      permissions: staffPermissions(listed),
    }
  }

  const membershipRole = membership.role || listedRole
  const stub = explicitPermissionKeys(membership).size === 0
  if (stub && (isAdminRole(membershipRole) || user.isSuperAdmin === true)) {
    return {
      ...user,
      organizationId,
      role: Role.ADMIN,
      isSuperAdmin: user.isSuperAdmin === true || membership.isSuperAdmin === true,
      isActive: membership.accountActive !== false,
      permissions: staffPermissions(Role.ADMIN),
    }
  }

  const permissions = permissionsFromRecord(membership)
  const isSuperAdmin =
    membership.isSuperAdmin === true ||
    (user.isSuperAdmin === true && (isAdminRole(membershipRole) || permissions.adminAccess))
  const keepsAdmin = isSuperAdmin || permissions.adminAccess || isAdminRole(membershipRole)
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

/**
 * Apply a finished membership read. A slow or failed read keeps the admin menu
 * and the company already chosen; only a real membership may narrow it.
 */
export function sessionUserForOrganizationProbe(
  user: User,
  documentOrganizationId: string,
  session: {
    organizationId: string
    membership: Record<string, unknown> | null
    listedRole?: string | null
    probe: OrgAccessProbe
  }
): User {
  const organizationId = String(session.organizationId || '').trim()
  if (!organizationId) return user
  const unconfirmedElsewhere =
    session.probe === 'unknown' &&
    !session.membership &&
    !session.listedRole &&
    !organizationIdsMatch(organizationId, documentOrganizationId)
  if (unconfirmedElsewhere) return { ...user, organizationId }
  return applyDeviceOrgMembership(
    user,
    documentOrganizationId,
    organizationId,
    session.membership,
    session.listedRole
  )
}
