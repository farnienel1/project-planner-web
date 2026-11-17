import type { User } from '@/types'
import { canManageOperativesOnly, canManageUsers } from '@/lib/navigation/menuPermissions'
import { canViewOperatives } from '@/lib/permissions'
import { permissionLevelOf } from '@/lib/canonical/permissionLevels'

/** The two accounts are one person: the same id or one of the actor's former ids (any letter case). */
function isSamePerson(current: User, target: User): boolean {
  const ids = new Set(
    [current.id, ...(current.formerUserIds ?? [])].map((id) => String(id).toLowerCase())
  )
  return ids.has(String(target.id).toLowerCase())
}

/**
 * May the signed-in person open Edit user for `target` and change their details (rulebook §11 / §16)?
 *   - Admins and super admins (`canManageUsers`): anyone but the Super Admin, unless they are the Super Admin.
 *   - A manager with the Operatives permission (`canManageOperatives`, via `canManageOperativesOnly`): operatives only (operative level by
 *     `permissionLevelOf`, with or without a login) — never a manager, an admin or themselves. What they may change
 *     inside the profile stays with the field rules (`canChangePersonPay`, `canChangeLineManager`, `canDeleteUser`).
 * Before 2026-11-17 the profile page asked an admin-only check, so an Operatives manager saw "View only".
 */
export function canEditTargetUser(current: User | null, target: User): boolean {
  if (!current) return false
  if (target.isSuperAdmin && !current.isSuperAdmin) return false
  if (canManageUsers(current)) return true
  // `canManageOperativesOnly`: a manager with the Operatives permission (rulebook `canManageOperatives`).
  if (!canManageOperativesOnly(current)) return false
  if (isSamePerson(current, target)) return false
  // Operative level, and no manager flag left on the document (firestore.rules `manageableOperative` refuses one).
  return permissionLevelOf(target) === 'operative' && target.permissions?.manager !== true
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
