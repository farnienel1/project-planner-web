import type { User } from '@/types'

const UUID_RE =
  /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i

export function isInvitePlaceholderId(id: string): boolean {
  return UUID_RE.test(id)
}

function scoreUser(user: User): number {
  let score = 0
  if (user.lastSeenAt) score += 8
  if (user.passwordSet) score += 4
  if (!isInvitePlaceholderId(user.id)) score += 2
  if (user.isActive !== false) score += 1
  return score
}

/**
 * Invite placeholders live at users/{UUID} until first sign-in. If merge left the
 * old row behind, the same email appears twice (e.g. "Manager Tester" Never vs
 * "Test Manager" with a last-seen). Keep the live Auth account.
 */
export function collapseDirectoryUsers(users: User[]): {
  users: User[]
  hiddenLeftovers: User[]
} {
  const groups = new Map<string, User[]>()
  for (const user of users) {
    const email = (user.email || '').trim().toLowerCase()
    const key = email && !email.endsWith('@unknown.user') ? `${user.organizationId}::${email}` : `id::${user.id}`
    const list = groups.get(key) || []
    list.push(user)
    groups.set(key, list)
  }
  const kept: User[] = []
  const hiddenLeftovers: User[] = []
  for (const list of groups.values()) {
    if (list.length === 1) {
      kept.push(list[0])
      continue
    }
    const ranked = [...list].sort((a, b) => scoreUser(b) - scoreUser(a))
    kept.push(ranked[0])
    hiddenLeftovers.push(...ranked.slice(1))
  }
  return { users: kept, hiddenLeftovers }
}
