import type { User } from '@/types'
import { canManageOperativesOnly, canManageUsers } from '@/lib/navigation/menuPermissions'
import { canViewOperatives } from '@/lib/permissions'

const PRIVILEGE_ROLES = new Set(['admin', 'manager', 'super_admin', 'superadmin'])

/**
 * The target side of firestore.rules `manageableOperative` (lines ~426–433): an operative (`operativeMode` stored on,
 * top level or `permissions` map, or the `operative` role) with no admin or manager role and no stored `isSuperAdmin`,
 * `adminAccess` or `manager` flag. Reads the STORED flags (`storedPermissions`), never the parsed ones — the parsed
 * view (`effectivePermissions`) always reads `manager` off for an operative.
 * Known gap: `storedPermissions` keeps the top-level value when one is stored, so a top-level `false` with a `true` in
 * the `permissions` map reads false here while the rules refuse (the save then shows the refusal).
 */
export function isManageableOperative(target: User): boolean {
  const stored = target.storedPermissions ?? {}
  // The stored role (the reader turns `role: 'manager'` on an operative-mode document into `operative`).
  const role = String(target.storedRole ?? target.role ?? '').trim().toLowerCase()
  if (target.isSuperAdmin === true || stored.isSuperAdmin === true) return false
  if (stored.adminAccess === true || stored.manager === true) return false
  if (PRIVILEGE_ROLES.has(role)) return false
  return stored.operativeMode === true || target.permissions?.operativeMode === true || role === 'operative'
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
  return isManageableOperative(target)
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
