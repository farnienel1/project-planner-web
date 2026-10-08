import type { User } from '@/types'
import { dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'
import { matchesRosterSegment, type RosterSegment } from '@/lib/staff/userRosterUtils'

export type ManageUsersTab = 'admins' | 'managers' | 'operatives'

/** Mirrors iOS ManageUsersView tab lists — users must match a tab to appear. */
export function classifyManageUsersTab(user: User): ManageUsersTab | null {
  if (user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin') return 'admins'
  if (user.permissions.operativeMode) return 'operatives'
  if (user.permissions.manager) return 'managers'
  // Pending invites and existing accounts with no role flags still have to appear.
  // Admins are already returned above, so this cannot move a super admin onto Operatives.
  return 'operatives'
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

export type ManageUsersListPhase = 'loading' | 'error' | 'empty' | 'ready'

/**
 * The roster store starts empty with loading false. That is not an empty company.
 * Show the empty copy only after a load for this organisation has finished.
 */
export function manageUsersListPhase(input: {
  organizationId: string | null | undefined
  rosterLoadedOrgId: string | null
  userCount: number
  filteredCount: number
  error: string | null
}): ManageUsersListPhase {
  const orgId = input.organizationId ?? null
  const rosterSettled = Boolean(orgId) && input.rosterLoadedOrgId === orgId
  if (input.userCount === 0 && input.error) return 'error'
  if (input.userCount === 0 && !rosterSettled) return 'loading'
  if (input.filteredCount === 0) return 'empty'
  return 'ready'
}
