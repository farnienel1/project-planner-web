import { hasAdminAccess, isOperativeMode } from '@/lib/permissions'
import type { User } from '@/types'

export type VariationParentAccess = {
  managerId?: string | null
  managerIds?: string[] | null
}

export type VariationManagerProfile = {
  id: string
  email?: string | null
}

function isManagerAccount(user: User): boolean {
  return user.permissions.manager === true || user.role === 'manager'
}

export function assignedManagerIds(parent: VariationParentAccess): string[] {
  return [parent.managerId || '', ...(parent.managerIds || [])].map((id) => id.trim()).filter(Boolean)
}

/**
 * Admins see every job. A manager sees a job when their user id or their
 * manager-roster id is on the job. Jobs store the roster id, which is not the
 * sign-in id. Operatives never see variations.
 */
export function canSeeJobVariations(
  user: User | null | undefined,
  parent: VariationParentAccess,
  managers: VariationManagerProfile[] = []
): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  if (!isManagerAccount(user)) return false
  const assigned = new Set(assignedManagerIds(parent))
  if (assigned.has(user.id)) return true
  const email = user.email.trim().toLowerCase()
  if (!email) return false
  return managers.some(
    (manager) => manager.id && assigned.has(manager.id) && (manager.email || '').trim().toLowerCase() === email
  )
}

export function canEditVariationContent(
  user: User | null | undefined,
  parent: VariationParentAccess,
  managers: VariationManagerProfile[] = []
): boolean {
  return canSeeJobVariations(user, parent, managers)
}

export function canChangeVariationStatus(
  user: User | null | undefined,
  parent: VariationParentAccess,
  managers: VariationManagerProfile[] = []
): boolean {
  return canSeeJobVariations(user, parent, managers)
}

/** Tracker reorder is an admin tool. There is no QS role on this app yet. */
export function canManageVariationTracker(user: User | null | undefined): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user)
}

export function canSeeAnyVariations(user: User | null | undefined): boolean {
  if (!user || isOperativeMode(user)) return false
  return hasAdminAccess(user) || isManagerAccount(user)
}
