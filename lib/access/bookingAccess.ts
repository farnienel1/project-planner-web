/**
 * Web inputs for the rulebook job and booking permissions (rulebook §2, §16; 1.10.0). The rule itself is
 * `canSeeJob` / `canWriteBooking` / `canDeleteBooking` in `lib/canonical/staffAccess.ts`; this file only turns the
 * signed-in user, the job and the managers list into its inputs.
 */
import {
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
  return { role: staffAccountRole(user), ids, email: user.email ?? null }
}

function rosterRows(managers: ReadonlyArray<{ id: string; email?: string | null }> | null | undefined): JobManagerRosterRow[] {
  return (managers || []).map((row) => ({ id: row.id, email: row.email ?? null }))
}

/** `canSeeJob` for the signed-in user. */
export function userCanSeeJob(
  user: Parameters<typeof jobAccessViewer>[0],
  job: JobLike,
  managers?: ReadonlyArray<{ id: string; email?: string | null }> | null
): boolean {
  return canSeeJob(jobAccessViewer(user), job ?? null, rosterRows(managers))
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
