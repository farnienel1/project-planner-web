import type { User } from '@/types'

/** Another active administrator who is not an operative. */
export function isSuperAdminSuccessor(user: User, currentUserId: string): boolean {
  if (!user.id || user.id === currentUserId) return false
  if (user.permissions.operativeMode) return false
  if (!(user.permissions.adminAccess || user.role === 'admin')) return false
  if (user.passwordSet === false) return false
  if (user.isActive === false) return false
  return true
}

export function superAdminSuccessors(users: readonly User[], currentUserId: string): User[] {
  const seen = new Set<string>()
  const rows: User[] = []
  for (const user of users) {
    const email = user.email.trim().toLowerCase()
    const key = email || `id:${user.id}`
    if (seen.has(key) || seen.has(user.id)) continue
    if (!isSuperAdminSuccessor(user, currentUserId)) continue
    seen.add(key)
    seen.add(user.id)
    rows.push(user)
  }
  return rows.sort((a, b) => a.email.localeCompare(b.email))
}

export const SUPER_ADMIN_SUCCESSOR_EMPTY = 'You need another administrator first.'
