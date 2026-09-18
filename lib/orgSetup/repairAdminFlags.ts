/**
 * Org setup used to write admin flags only under permissions.*.
 * Invite Path 2 in Firestore checks top-level adminAccess / isSuperAdmin / role.
 * Repair existing founder docs on login so Add user is not permission-denied.
 */
export function topLevelAdminFlagPatch(
  raw: Record<string, unknown>,
  user: {
    isSuperAdmin: boolean
    role: string
    permissions: { adminAccess: boolean; operativeMode?: boolean }
  }
): Record<string, unknown> {
  if (user.permissions.operativeMode) return {}
  const isAdmin = user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin'
  if (!isAdmin) return {}

  const patch: Record<string, unknown> = {}
  if (raw.adminAccess !== true && raw.adminAccess !== 1) patch.adminAccess = true
  if (user.isSuperAdmin && raw.isSuperAdmin !== true && raw.isSuperAdmin !== 1) {
    patch.isSuperAdmin = true
  }
  if (raw.role !== 'admin') patch.role = 'admin'
  if (raw.manager !== true && raw.manager !== 1) patch.manager = true
  return patch
}
