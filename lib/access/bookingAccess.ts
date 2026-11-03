/**
 * Web inputs for the rulebook job and booking permissions (rulebook §2, §16; 1.10.0). The rule itself is
 * `canSeeJob` / `canWriteBooking` / `canDeleteBooking` in `lib/canonical/staffAccess.ts`; this file only turns the
 * signed-in user, the job and the managers list into its inputs.
 */
import {
  canChangeJobManagers,
  canCreateJob,
  canEditJob,
  canDeleteBooking,
  canSeeJob,
  canWriteBooking,
  type BookingPermissionCollection,
  type JobAccessViewer,
  type JobManagerRosterRow,
} from '@/lib/canonical'
import { staffAccountRole, type PermissionUser } from '@/lib/permissions'

type JobLike = { managerIds?: string[] | null; managerId?: string | null; managerUserIds?: string[] | null } | null | undefined

/** The signed-in user as the rulebook reads them: role, every id (own + former invite ids), email. */
export function jobAccessViewer(user: PermissionUser): JobAccessViewer | null {
  if (!user) return null
  const ids = [user.id, ...(user.formerUserIds ?? [])].filter(Boolean)
  // 1.10.0 round 2: the Projects / Small works add-edit-manage permissions (`USER_PERMISSION_FIELDS`
  // `projects`, `smallWorks`) for the open organisation.
  const toggles = { projects: user.permissions?.projects === true, smallWorks: user.permissions?.smallWorks === true }
  return { role: staffAccountRole(user), ids, email: user.email ?? null, toggles, uid: user.id }
}

function rosterRows(managers: ReadonlyArray<{ id: string; email?: string | null }> | null | undefined): JobManagerRosterRow[] {
  return (managers || []).map((row) => ({ id: row.id, email: row.email ?? null }))
}

/** `canSeeJob` for the signed-in user. */
export function userCanSeeJob(
  user: Parameters<typeof jobAccessViewer>[0],
  job: JobLike,
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null,
  kind?: 'projects' | 'smallWorks' | null
): boolean {
  return canSeeJob(jobAccessViewer(user), job ?? null, rosterRows(managers), kind ?? null)
}

export type WebBookingRef = {
  collection: BookingPermissionCollection
  projectId?: string | null
  userId?: string | null
  locationType?: string | null
  locationId?: string | null
}

/** `canWriteBooking` (create, edit, cancel) for the signed-in user. */
export function userCanWriteBooking(
  user: Parameters<typeof jobAccessViewer>[0],
  booking: WebBookingRef,
  job: JobLike,
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
): boolean {
  return canWriteBooking(jobAccessViewer(user), booking, job ?? null, rosterRows(managers))
}

/** `canDeleteBooking` for the signed-in user (1.10.0: managers delete on jobs they manage). */
export function userCanDeleteBooking(
  user: Parameters<typeof jobAccessViewer>[0],
  booking: WebBookingRef,
  job: JobLike,
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
): boolean {
  return canDeleteBooking(jobAccessViewer(user), booking, job ?? null, rosterRows(managers))
}

/** `canCreateJob` for the signed-in user (1.10.0 round 2: admins; managers with that kind's toggle). */
export function userCanCreateJob(user: Parameters<typeof jobAccessViewer>[0], kind: 'projects' | 'smallWorks'): boolean {
  return canCreateJob(jobAccessViewer(user), kind)
}

/** `canChangeJobManagers` for the signed-in user (the same people as `canCreateJob`). */
export function userCanChangeJobManagers(user: Parameters<typeof jobAccessViewer>[0], kind: 'projects' | 'smallWorks'): boolean {
  return canChangeJobManagers(jobAccessViewer(user), kind)
}

/** `canEditJob` for the signed-in user: also a manager without the toggle on a job they manage (details only). */
export function userCanEditJob(
  user: Parameters<typeof jobAccessViewer>[0],
  job: JobLike,
  kind: 'projects' | 'smallWorks',
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
): boolean {
  return canEditJob(jobAccessViewer(user), job ?? null, kind, rosterRows(managers))
}
