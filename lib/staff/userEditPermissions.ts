import type { User } from '@/types'
import { canManageOperativesOnly, canManageUsers } from '@/lib/navigation/menuPermissions'
import { canViewOperatives } from '@/lib/permissions'

export function canEditTargetUser(current: User | null, target: User): boolean {
  if (!current) return false
  if (target.isSuperAdmin && !current.isSuperAdmin) return false
  if (canManageUsers(current)) return true
  if (canManageOperativesOnly(current)) return target.permissions.operativeMode
  return false
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

/** Admin user-edit screen (permissions, payroll, account type). Not personal settings. */
export function canShowAdminEditProfile(current: User | null): boolean {
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
