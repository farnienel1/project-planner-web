import { canManageVariationTracker as canManageVariationTrackerRole, canSeeVariations } from '@/lib/canonical'
import { staffAccountRole } from '@/lib/permissions'
import type { User } from '@/types'

export type VariationParentAccess = {
  managerId?: string | null
  managerIds?: string[] | null
}

export type VariationManagerProfile = {
  id: string
  email?: string | null
}

export function assignedManagerIds(parent: VariationParentAccess): string[] {
  return [parent.managerId || '', ...(parent.managerIds || [])].map((id) => id.trim()).filter(Boolean)
}

/**
 * Admins and managers see variations on every job. Operatives never do.
 * Assignment is only used for who gets a new-variation notification.
 */
export function canSeeJobVariations(
  user: User | null | undefined,
  _parent?: VariationParentAccess,
  _managers: VariationManagerProfile[] = []
): boolean {
  if (!user) return false
  return canSeeVariations(staffAccountRole(user))
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
  if (!user) return false
  return canManageVariationTrackerRole(staffAccountRole(user))
}

export function canSeeAnyVariations(user: User | null | undefined): boolean {
  return canSeeJobVariations(user)
}
