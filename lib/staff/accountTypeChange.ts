import { accountTypePermissions } from '@/lib/canonical/permissionLevels'
import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'

/** Change user type sets the role. It does not turn Projects, Small Works, Weekly Report, or Daily Overview on. */
export function applyAccountTypeChange(user: User, accountType: 'operative' | 'manager' | 'admin'): User {
  // Rulebook 1.11.0 `accountTypePermissions`: the presets are the rulebook's (iOS runs the same function).
  const permissions = { ...user.permissions, ...accountTypePermissions(accountType, user) } as UserPermissions
  const role =
    accountType === 'admin' ? UserRole.ADMIN : accountType === 'manager' ? UserRole.MANAGER : UserRole.OPERATIVE
  return {
    ...user,
    role,
    permissions,
    isSuperAdmin: accountType === 'admin' ? user.isSuperAdmin : false,
  }
}

/** The users document as `accountTypeSyncState` / `permissionLevelOf` read it. */
export function accountTypeSubject(user: User): Record<string, unknown> & { id: string } {
  return {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    adminAccess: user.permissions.adminAccess,
    manager: user.permissions.manager,
    operativeMode: user.permissions.operativeMode,
    permissions: { ...user.permissions },
  }
}
