/**
 * Who sees the company job lists and the staff warning list, who may add or
 * edit a work catalogue, and which managers receive a job notification.
 *
 * Plain data only. Each app resolves the account flags with its own user store
 * (web `lib/permissions.ts`, iOS `UserStore`) and passes them in, so the rule
 * is written once and both apps return the same answer.
 */

export type StaffAccountRole = {
  isSuperAdmin: boolean
  /** Admin access flag or the admin role, and not in operative mode. */
  isAdmin: boolean
  /** Manager flag or the manager role. */
  isManager: boolean
  /** Operative role or operative-mode flag without admin access. */
  isOperativeMode: boolean
}

export type WorkCatalogue = 'projects' | 'smallWorks'

/** The organisation-level Projects and Small works sliders on the account. */
export type WorkCatalogueToggles = {
  projects: boolean
  smallWorks: boolean
}

/** Super admin, admin, or manager. Operative mode is never staff. */
export function isStaffAccount(role: StaffAccountRole): boolean {
  if (role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin || role.isManager
}

/**
 * Staff see every project and every small works job, including jobs they are
 * not the project manager or line manager for. The Projects and Small works
 * toggles never hide a job. Operatives see only the jobs they are booked onto,
 * which each app resolves from its bookings.
 */
export function seesEveryJob(role: StaffAccountRole): boolean {
  return isStaffAccount(role)
}

/**
 * The staff warning list shows every warning in the company to every admin and
 * manager. It is not narrowed to the jobs or people a manager is assigned to.
 * Operatives do not get the list.
 */
export function canViewStaffWarnings(role: StaffAccountRole): boolean {
  return isStaffAccount(role)
}

/**
 * Variations, evidence, and the company rollup. Every admin and manager sees
 * every job. Operatives never do. Assignment only affects who is notified.
 */
export function canSeeVariations(role: StaffAccountRole): boolean {
  return isStaffAccount(role)
}

/** Tracker reorder is an admin tool. There is no QS role on this app yet. */
export function canManageVariationTracker(role: StaffAccountRole): boolean {
  if (role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin
}

/**
 * Add or edit a catalogue. Super admin ignores the toggles. Admins and managers
 * follow the toggle for that catalogue. Operatives never edit.
 */
export function canEditWorkCatalogue(
  role: StaffAccountRole,
  catalogue: WorkCatalogue,
  toggles: WorkCatalogueToggles
): boolean {
  if (role.isOperativeMode) return false
  if (role.isSuperAdmin) return true
  if (!role.isAdmin && !role.isManager) return false
  return catalogue === 'projects' ? toggles.projects === true : toggles.smallWorks === true
}

export type JobNotificationRecipientInput = {
  userId: string
  role: StaffAccountRole
  /** User ids of the managers assigned to the job the notification is about. */
  assignedManagerUserIds: ReadonlyArray<string>
  /** User ids of the line managers of the person the notification is about. */
  lineManagerUserIds?: ReadonlyArray<string>
}

function normalizedId(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

/**
 * Notifications stay narrower than the lists. An admin receives a job
 * notification. A manager receives it only as the line manager of the person
 * or as an assigned project manager of the job. Seeing the job in the list does
 * not make a manager a recipient.
 */
export function receivesJobNotification(input: JobNotificationRecipientInput): boolean {
  const userId = normalizedId(input.userId)
  if (!userId) return false
  const role = input.role
  if (role.isOperativeMode) return false
  if (role.isSuperAdmin || role.isAdmin) return true
  const assigned = input.assignedManagerUserIds.map(normalizedId)
  if (assigned.includes(userId)) return true
  const line = (input.lineManagerUserIds ?? []).map(normalizedId)
  return line.includes(userId)
}
