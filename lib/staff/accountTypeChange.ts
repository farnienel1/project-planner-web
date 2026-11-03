import { accountTypePermissions, effectivePermissions } from '@/lib/canonical/permissionLevels'
import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'

/**
 * Change user type sets the role and the level flags. Rulebook 1.15.0 `accountTypePermissions`: every saved toggle is
 * kept — read from the stored values (`storedPermissions`), never from an admin's all-on view — so manager → admin →
 * manager shows the same toggles again.
 */
export function applyAccountTypeChange(user: User, accountType: 'operative' | 'manager' | 'admin'): User {
  const stored = accountTypePermissions(accountType, storedPermissionSubject(user))
  // What every check reads: an admin's toggles are all on (except Annual Leave Management) over the stored values.
  const permissions = { ...user.permissions, ...effectivePermissions(stored, accountType) } as UserPermissions
  const role =
    accountType === 'admin' ? UserRole.ADMIN : accountType === 'manager' ? UserRole.MANAGER : UserRole.OPERATIVE
  return {
    ...user,
    role,
    permissions,
    storedPermissions: { ...stored },
    isSuperAdmin: accountType === 'admin' ? user.isSuperAdmin : false,
  }
}

/**
 * The users document's stored toggles for `accountTypePermissions`: `storedPermissions` when the reader kept them; an
 * admin without them (a hand-built user) has nothing stored, any other level reads its toggles from `permissions`.
 */
export function storedPermissionSubject(user: User): Record<string, unknown> {
  if (user.storedPermissions) return { role: user.role, isSuperAdmin: user.isSuperAdmin, ...user.storedPermissions }
  const isAdmin = user.isSuperAdmin || user.permissions.adminAccess || user.role === UserRole.ADMIN
  return isAdmin ? { role: user.role, isSuperAdmin: user.isSuperAdmin } : { role: user.role, ...user.permissions }
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
