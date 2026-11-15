import {
  canManageVariationTracker as canManageVariationTrackerRole,
  canRenumberVariations,
  canSeeVariationCosts,
  canSeeVariations,
  isJobManager,
} from '@/lib/canonical'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
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

/**
 * Rulebook 1.52.0 `canRenumberVariations`: the VO tracker (reorder, renumber, turn it on) is for admins and the job's
 * managers (`isJobManager` over the job's stored manager ids, or a `managers` row on the viewer's email).
 */
export function canUseVariationTracker(
  user: User | null | undefined,
  parent: VariationParentAccess & { managerUserIds?: string[] | null },
  managers: VariationManagerProfile[] = []
): boolean {
  if (!user) return false
  const viewer = jobAccessViewer(user)
  const managesJob = isJobManager(viewer, parent, managers.map((row) => ({ id: row.id, email: row.email ?? null })))
  return canRenumberVariations(staffAccountRole(user), { managesJob })
}

/** Rulebook 1.52.0 `canSeeVariationCosts`: admins and managers (everyone who sees variations). */
export function canSeeVariationCostsFor(user: User | null | undefined): boolean {
  return user ? canSeeVariationCosts(staffAccountRole(user)) : false
}
