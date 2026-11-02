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
 * Admins and super admins outside operative mode see every project and every small works job (rulebook §16, owner
 * decision 1.10.0). Managers see only the jobs they manage (`canSeeJob`); operatives see no job list beyond their
 * own bookings (My Schedule). The Projects and Small works toggles never hide a job.
 */
export function seesEveryJob(role: StaffAccountRole): boolean {
  if (role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin
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

/**
 * User Timesheets (Awaiting / Signed off / Exported). Staff open the list.
 * Operatives stay on My Timesheets. Whose rows a manager sees is still the
 * line-manager filter in each app — this is not `seesEveryJob`.
 */
export function canReviewUserTimesheets(role: StaffAccountRole): boolean {
  return isStaffAccount(role)
}

/** Admins see every person's timesheet. Managers see only their reports. */
export function seesEveryUserTimesheet(role: StaffAccountRole): boolean {
  if (role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin
}

/**
 * Quote and order history on a job's Materials: every admin and manager, never
 * operative mode. It is not the Wholesalers toggle (`wholesalersOrderHistory`),
 * which only gates the Wholesalers screen. Firestore `canReadMaterialSendHistory`
 * gives the same answer for reads of `materialSendRecords`.
 */
export function canViewMaterialOrderHistory(role: StaffAccountRole): boolean {
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

// MARK: - Job visibility and booking permissions (rulebook §2, §16; 1.10.0)

/**
 * The person asking: their resolved role and every id they go by. `ids` should be `personIdSet(user, roster)`
 * (own id, `formerUserIds`, `sameEmailUserIds`, same-email roster rows); ids compare without case.
 */
export type JobAccessViewer = {
  role: StaffAccountRole
  /** Every id of the person (`personIdSet`). At least their users id. */
  ids: ReadonlyArray<string>
  /** The signed-in email; matches a managers-list row named on the job. */
  email?: string | null
}

/** The manager fields of `projects/{id}` / `smallWorks/{id}` as stored. */
export type JobManagerFields = {
  managerIds?: ReadonlyArray<string> | null
  managerId?: string | null
  /** Older spelling some imports used on a job. */
  assignedManagerUserIds?: ReadonlyArray<string> | null
  /** Account ids of the job managers (1.10.0, `jobManagerUserIds`), written beside `managerIds` for the rules. */
  managerUserIds?: ReadonlyArray<string> | null
}

/** A row of `organizations/{orgId}/managers`, which a job's `managerIds` may name instead of an account id. */
export type JobManagerRosterRow = {
  id: string
  email?: string | null
}

/** An account the job-manager mapping may resolve to (`jobManagerUserIds`). */
export type JobManagerAccount = {
  id: string
  email?: string | null
  isActive?: boolean | null
}

function idKey(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  const bare = raw.toLowerCase().startsWith('user:') ? raw.slice(5) : raw
  return bare.trim().toLowerCase()
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

function utf8Bytes(value: string): number[] {
  const out: number[] = []
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x80) out.push(code)
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63))
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
  }
  return out
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * iOS `Manager.stableId(forFirestoreDocumentId:)`: a managers-list document id as iOS stores it in `managerIds`.
 * A UUID document id is itself (upper case); any other id is a deterministic FNV-1a-based UUID (version 5 bits).
 */
export function stableManagerId(documentId: unknown): string {
  const trimmed = typeof documentId === 'string' ? documentId.trim() : ''
  if (!trimmed) return ''
  if (UUID_PATTERN.test(trimmed)) return trimmed.toUpperCase()
  const MASK64 = (BigInt(1) << BigInt(64)) - BigInt(1)
  const FNV_OFFSET = BigInt('14695981039346656037')
  const FNV_PRIME = BigInt('1099511628211')
  let h1 = FNV_OFFSET
  let h2 = FNV_PRIME
  const bytes = utf8Bytes(trimmed)
  for (const byte of bytes) {
    h1 = (h1 ^ BigInt(byte)) & MASK64
    h1 = (h1 * FNV_PRIME) & MASK64
    h2 = (h2 ^ BigInt(byte)) & MASK64
    h2 = (h2 * FNV_OFFSET) & MASK64
  }
  const out = new Array<number>(16).fill(0)
  for (let index = 0; index < 8; index += 1) {
    out[index] = Number((h1 >> BigInt(8 * index)) & BigInt(255))
    out[index + 8] = Number((h2 >> BigInt(8 * index)) & BigInt(255))
  }
  out[6] = (out[6] & 0x0f) | 0x50
  out[8] = (out[8] & 0x3f) | 0x80
  const hex = out.map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase()
}

/**
 * Every manager id stored on a job, de-duplicated without case, stored case kept: `managerIds`, then `managerId`,
 * `assignedManagerUserIds` and `managerUserIds`. A `user:` prefix (web picker) is kept as stored.
 */
export function jobManagerIds(job: JobManagerFields | Record<string, unknown> | null | undefined): string[] {
  const row = (job && typeof job === 'object' ? job : {}) as Record<string, unknown>
  const out: string[] = []
  const seen = new Set<string>()
  const add = (id: string) => {
    const key = idKey(id)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(id)
  }
  for (const id of idList(row.managerIds)) add(id)
  if (typeof row.managerId === 'string') add(row.managerId.trim())
  for (const id of idList(row.assignedManagerUserIds)) add(id)
  for (const id of idList(row.managerUserIds)) add(id)
  return out
}

/**
 * True when the viewer is one of the job's managers: a stored manager id (without a `user:` prefix, without case) is
 * one of the viewer's ids, or names a managers-list row (by its id or iOS stable id) whose email is the viewer's.
 * Role is not checked here (`canSeeJob` does).
 */
export function isJobManager(
  viewer: Pick<JobAccessViewer, 'ids' | 'email'> | null | undefined,
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null
): boolean {
  if (!viewer) return false
  const viewerIds = new Set((viewer.ids || []).map(idKey).filter(Boolean))
  if (viewerIds.size === 0) return false
  const stored = jobManagerIds(job).map(idKey)
  if (stored.length === 0) return false
  if (stored.some((id) => viewerIds.has(id))) return true
  const email = typeof viewer.email === 'string' ? viewer.email.trim().toLowerCase() : ''
  if (!email) return false
  const storedSet = new Set(stored)
  return (managers || []).some((row) => {
    if (!row || typeof row.id !== 'string') return false
    if (String(row.email ?? '').trim().toLowerCase() !== email) return false
    return storedSet.has(idKey(row.id)) || storedSet.has(idKey(stableManagerId(row.id)))
  })
}

/**
 * Whether the viewer sees this project or small works job anywhere a job list or picker is shown (§16, 1.10.0).
 * Admins and super admins outside operative mode: every job. Managers: only the jobs they manage
 * (`isJobManager`) — removed as manager, the job leaves their lists; re-added, it comes back. Operatives: no job
 * list (they see their own bookings on My Schedule).
 */
export function canSeeJob(
  viewer: JobAccessViewer | null | undefined,
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null
): boolean {
  if (!viewer || !job) return false
  const role = viewer.role
  if (!role || role.isOperativeMode) return false
  if (role.isSuperAdmin || role.isAdmin) return true
  if (!role.isManager) return false
  return isJobManager(viewer, job, managers)
}

/** The jobs `canSeeJob` keeps, in order. */
export function visibleJobsFor<T extends JobManagerFields | Record<string, unknown>>(
  viewer: JobAccessViewer | null | undefined,
  jobs: ReadonlyArray<T> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null
): T[] {
  return (jobs || []).filter((job) => canSeeJob(viewer, job, managers))
}

export const BOOKING_PERMISSION_COLLECTIONS = ['bookings', 'managerSiteBookings', 'subcontractorBookings'] as const
export type BookingPermissionCollection = (typeof BOOKING_PERMISSION_COLLECTIONS)[number]

/** The booking fields the permission rule reads. */
export type BookingPermissionInput = {
  collection: BookingPermissionCollection | string
  /** `bookings` / `subcontractorBookings`: the job id. */
  projectId?: string | null
  /** `managerSiteBookings`: the booked manager, `locationType` and `locationId`. */
  userId?: string | null
  locationType?: string | null
  locationId?: string | null
}

/**
 * The job a booking belongs to: `projectId` for labour and subcontractor bookings; for a manager site booking,
 * `locationId` when `locationType` is `project` or `small_work`. Null for an office, working-from-home, site-survey
 * or custom manager booking (no job).
 */
export function bookingJobId(booking: BookingPermissionInput | null | undefined): string | null {
  if (!booking) return null
  if (booking.collection === 'managerSiteBookings') {
    const type = String(booking.locationType ?? '').trim()
    if (type !== 'project' && type !== 'small_work') return null
    const id = String(booking.locationId ?? '').trim()
    return id || null
  }
  const id = String(booking.projectId ?? '').trim()
  return id || null
}

/**
 * Create, edit, cancel or delete a booking (§2, §16; owner decision 1.10.0). Labour (`bookings`), manager site
 * (`managerSiteBookings`) and subcontractor (`subcontractorBookings`) bookings:
 *   - admins and super admins outside operative mode: every booking;
 *   - managers: bookings on a job they manage (`isJobManager` on `job`, the booking's project or small works); a
 *     manager site booking with no job (office, working from home, site survey, custom) only for themselves;
 *   - operatives (and operative mode): never.
 * `job` is the stored job document the booking names (null when it is missing → only admins).
 */
export function canWriteBooking(
  viewer: JobAccessViewer | null | undefined,
  booking: BookingPermissionInput | null | undefined,
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null
): boolean {
  if (!viewer || !booking) return false
  if (!(BOOKING_PERMISSION_COLLECTIONS as readonly string[]).includes(String(booking.collection))) return false
  const role = viewer.role
  if (!role || role.isOperativeMode) return false
  if (role.isSuperAdmin || role.isAdmin) return true
  if (!role.isManager) return false
  if (booking.collection === 'managerSiteBookings' && bookingJobId(booking) == null) {
    const ids = new Set((viewer.ids || []).map(idKey).filter(Boolean))
    return ids.has(idKey(booking.userId))
  }
  if (!job) return false
  return isJobManager(viewer, job, managers)
}

/** Deleting a booking: the same people as `canWriteBooking` (1.10.0: managers delete on jobs they manage). */
export function canDeleteBooking(
  viewer: JobAccessViewer | null | undefined,
  booking: BookingPermissionInput | null | undefined,
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null
): boolean {
  return canWriteBooking(viewer, booking, job, managers)
}

/**
 * `managerUserIds` to write on a job beside `managerIds` (1.10.0): the account ids of the job's managers, so the
 * security rules can match the signed-in user without reading the managers list. A stored id that is an account id
 * (with or without `user:`) is that account; a managers-list row (by id or iOS stable id) is every active account
 * with its email. De-duplicated without case, account order, stored case.
 */
export function jobManagerUserIds(
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  managers: ReadonlyArray<JobManagerRosterRow> | null | undefined,
  accounts: ReadonlyArray<JobManagerAccount> | null | undefined
): string[] {
  const stored = (() => {
    const row = (job && typeof job === 'object' ? job : {}) as Record<string, unknown>
    const ids: string[] = []
    for (const id of idList(row.managerIds)) ids.push(id)
    if (typeof row.managerId === 'string' && row.managerId.trim()) ids.push(row.managerId.trim())
    return new Set(ids.map(idKey).filter(Boolean))
  })()
  if (stored.size === 0) return []
  const emails = new Set(
    (managers || [])
      .filter((row) => row && (stored.has(idKey(row.id)) || stored.has(idKey(stableManagerId(row.id)))))
      .map((row) => String(row.email ?? '').trim().toLowerCase())
      .filter(Boolean)
  )
  const out: string[] = []
  const seen = new Set<string>()
  for (const account of accounts || []) {
    const id = typeof account?.id === 'string' ? account.id.trim() : ''
    const key = id.toLowerCase()
    if (!id || seen.has(key) || account.isActive === false) continue
    const email = String(account.email ?? '').trim().toLowerCase()
    if (stored.has(key) || (email !== '' && emails.has(email))) {
      seen.add(key)
      out.push(id)
    }
  }
  return out
}
