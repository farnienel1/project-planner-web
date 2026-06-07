import type { User } from '@/types'
import { dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'
import { matchesRosterSegment, type RosterSegment } from '@/lib/staff/userRosterUtils'

export type ManageUsersTab = 'admins' | 'managers' | 'operatives'

/** Mirrors iOS ManageUsersView tab lists — users must match a tab to appear. */
export function classifyManageUsersTab(user: User): ManageUsersTab | null {
  if (user.permissions.operativeMode) return 'operatives'
  if (user.permissions.adminAccess || user.isSuperAdmin) return 'admins'
  if (user.permissions.manager) return 'managers'
  // Pending invites without role flags yet — same bucket as iOS operative invites
  if (!user.passwordSet) return 'operatives'
  return null
}

export function filterUsersForManageTab(users: User[], tab: ManageUsersTab): User[] {
  const deduped = dedupeUsersByEmail(users)
  return deduped.filter((user) => classifyManageUsersTab(user) === tab)
}

export function filterUsersForManageTabAndSegment(
  users: User[],
  tab: ManageUsersTab,
  segment: RosterSegment
): User[] {
  return filterUsersForManageTab(users, tab).filter((user) => matchesRosterSegment(user, segment))
}

export function countUsersForTab(users: User[], tab: ManageUsersTab, segment: RosterSegment): number {
  return filterUsersForManageTabAndSegment(users, tab, segment).length
}
