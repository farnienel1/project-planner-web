import { hasAdminAccess, isOperativeMode } from '@/lib/permissions'
import type { User } from '@/types'

export type VariationParentAccess = {
  managerId?: string | null
  managerIds?: string[] | null
}

function isManagerAccount(user: User): boolean {
  return user.permissions.manager === true || user.role === 'manager'
}

export function assignedManagerIds(parent: VariationParentAccess): string[] {
  return [parent.managerId || '', ...(parent.managerIds || [])].map((id) => id.trim()).filter(Boolean)
}

/** Admins see every job. A manager sees a job only when they are on its manager list. Operatives never do. */
export function canSeeJobVariations(user: User | null | undefined, parent: VariationParentAccess): boolean {
  if (!user || isOperativeMode(user)) return false
  if (hasAdminAccess(user)) return true
  if (!isManagerAccount(user)) return false
  return assignedManagerIds(parent).includes(user.id)
}

export function canEditVariationContent(user: User | null | undefined, parent: VariationParentAccess): boolean {
  return canSeeJobVariations(user, parent)
}

export function canChangeVariationStatus(user: User | null | undefined, parent: VariationParentAccess): boolean {
  return canSeeJobVariations(user, parent)
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
