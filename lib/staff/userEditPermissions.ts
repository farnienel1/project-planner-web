import type { User } from '@/types'
import { canManageOperativesOnly, canManageUsers } from '@/lib/navigation/menuPermissions'

export function canEditTargetUser(current: User | null, target: User): boolean {
  if (!current) return false
  if (target.isSuperAdmin && !current.isSuperAdmin) return false
  if (canManageUsers(current)) return true
  if (canManageOperativesOnly(current)) return target.permissions.operativeMode
  return false
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
  if (user.permissions.operativeMode) return 'Operative'
  if (user.permissions.adminAccess || user.isSuperAdmin) return 'Administrator'
  if (user.permissions.manager) return 'Manager'
  return 'User'
}

export function setupSectionTitle(user: User): string {
  if (user.permissions.operativeMode) return 'Operative setup'
  if (user.permissions.adminAccess || user.isSuperAdmin) return 'Administrator setup'
  if (user.permissions.manager) return 'Manager setup'
  return 'Staff setup'
}
