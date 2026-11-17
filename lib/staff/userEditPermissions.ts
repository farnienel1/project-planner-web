import type { User } from '@/types'
import { canManageOperativesOnly, canManageUsers } from '@/lib/navigation/menuPermissions'
import { canViewOperatives } from '@/lib/permissions'

/** The organisation id a stored `organizationId` names: an id, or a path ending `organizations/{id}` (rules `orgIdsMatch`). */
function organizationIdOf(value: string | undefined): string {
  const text = String(value ?? '').trim()
  const match = /(?:^|\/)organizations\/([^/]+)$/.exec(text)
  return (match ? match[1] : text).toLowerCase()
}

/**
 * The target side of firestore.rules `managerMayManageOperative` / `manageableOperative` (firestore.rules ~415–433):
 *   - the target's users document names the open organisation (`orgIdsMatch(home.organizationId,
 *     targetData.organizationId)`; the caller's home organisation is the open one, `operativesManagerWritesAllowed`);
 *   - an operative: `operativeMode` true / 1 at the top level or in `permissions`, or the stored role exactly
 *     `operative`;
 *   - no stored role exactly `admin` or `manager`, and no `isSuperAdmin`, `adminAccess` or `manager` true / 1 in either
 *     place (`User.storedPrivilegeFlags`, read from the raw document — never the parsed `permissions`, which always read
 *     `manager` off for an operative).
 * A user built without the stored fields (not read through `parseAppUserDocument`, e.g. a test fixture) falls back to
 * the parsed values.
 */
export function isManageableOperative(target: User, openOrganizationId: string | undefined): boolean {
  const targetOrganization = target.homeOrganizationId || target.organizationId
  if (!openOrganizationId || organizationIdOf(targetOrganization) !== organizationIdOf(openOrganizationId)) return false
  const flags = target.storedPrivilegeFlags ?? {
    isSuperAdmin: target.isSuperAdmin === true,
    adminAccess: target.permissions?.adminAccess === true,
    manager: target.permissions?.manager === true,
    operativeMode: target.permissions?.operativeMode === true,
  }
  const role = target.storedRole ?? String(target.role ?? '')
  if (role === 'admin' || role === 'manager') return false
  if (flags.isSuperAdmin || target.isSuperAdmin === true || flags.adminAccess || flags.manager) return false
  return flags.operativeMode || role === 'operative'
}

/**
 * May the signed-in person open Edit user for `target` and change their details (rulebook §11 / §16)?
 *   - Admins and super admins (`canManageUsers`): anyone but the Super Admin, unless they are the Super Admin.
 *   - A manager with the Operatives permission where the rules accept their writes (`canManageOperativesOnly`, which
 *     mirrors the caller side of firestore.rules `managerMayManageOperative`): an operative the rules let them manage
 *     (`isManageableOperative`), never their own document (`request.auth.uid != targetUserId`). An Operatives manager
 *     is manager level, so they are never an operative themselves.
 * What they may change inside the profile stays with the field rules (`canChangePersonPay`, `canChangeLineManager`,
 * `canDeleteUser`).
 */
export function canEditTargetUser(current: User | null, target: User): boolean {
  if (!current) return false
  if (target.isSuperAdmin && !current.isSuperAdmin) return false
  if (canManageUsers(current)) return true
  if (!canManageOperativesOnly(current)) return false
  if (target.id === current.id) return false
  return isManageableOperative(target, current.organizationId)
}

/**
 * The profile page's Edit profile button: every admin, as before 17 Nov (they reach the Super Admin's Edit user page
 * for its account tools — password reset, wrong-email support), plus an Operatives manager for an operative they may
 * edit (`canEditTargetUser`).
 */
export function canOpenEditProfile(current: User | null, target: User): boolean {
  return canManageUsers(current) || canEditTargetUser(current, target)
}

/**
 * Qualification-warning “Open operative”. Managers see every warning, but
 * without the Operatives toggle they cannot open Edit User. Admins who can
 * manage users still can, even if that toggle is off.
 */
export function canOpenOperativeFromWarning(current: User | null, target?: User | null): boolean {
  if (!current) return false
  if (target) return canEditTargetUser(current, target)
  return canManageUsers(current) || canViewOperatives(current)
}

export function canUseAdminAccountTools(current: User | null): boolean {
  return canManageUsers(current)
}

export function canEditPermissionsMatrix(current: User | null, target: User): boolean {
  return canEditTargetUser(current, target)
}

export function canEditIdentityDetails(current: User | null, target: User): boolean {
  return canEditTargetUser(current, target)
}

export function roleLabel(user: User): string {
  if (user.isSuperAdmin) return 'Super Admin'
  if (user.permissions.adminAccess || user.role === 'admin') return 'Administrator'
  if (user.permissions.operativeMode) return 'Operative'
  if (user.permissions.manager) return 'Manager'
  return 'User'
}

export function setupSectionTitle(user: User): string {
  if (user.isSuperAdmin) return 'Super Admin setup'
  if (user.permissions.adminAccess || user.role === 'admin') return 'Administrator setup'
  if (user.permissions.operativeMode) return 'Operative setup'
  if (user.permissions.manager) return 'Manager setup'
  return 'Staff setup'
}
