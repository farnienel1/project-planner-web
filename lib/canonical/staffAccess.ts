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
 * Who sees every job (rulebook §16, owner decisions 1.10.0). Admins and super admins outside operative mode see every
 * project and every small works job. A manager whose account has the Projects (`projects`) or Small works
 * (`smallWorks`) add/edit permission sees every job of that kind (`kind`); with no `kind`, only a manager with both
 * toggles sees every job. Other managers see only the jobs they manage (`canSeeJob`); operatives see no job list
 * beyond their own bookings (My Schedule). `toggles` are the account's `permissions.projects` /
 * `permissions.smallWorks` for the open organisation.
 */
export function seesEveryJob(
  role: StaffAccountRole,
  kind?: WorkCatalogue | null,
  toggles?: WorkCatalogueToggles | null
): boolean {
  if (!role || role.isOperativeMode) return false
  if (role.isSuperAdmin || role.isAdmin) return true
  if (!role.isManager || !toggles) return false
  if (kind === 'projects') return toggles.projects === true
  if (kind === 'smallWorks') return toggles.smallWorks === true
  return toggles.projects === true && toggles.smallWorks === true
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
  // Rulebook 1.15.0: the same people who send quotes and orders (`canSendMaterialOrders`).
  return isStaffAccount(role)
}

/** Tracker reorder is an admin tool. There is no QS role on this app yet. */
export function canManageVariationTracker(role: StaffAccountRole): boolean {
  if (role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin
}

/**
 * Add or edit a catalogue (owner decision 1.10.0 round 2): admins and super admins outside operative mode always;
 * managers only with that catalogue's toggle (`permissions.projects` / `permissions.smallWorks`); operatives never.
 * The same answer as `canCreateJob`.
 */
export function canEditWorkCatalogue(
  role: StaffAccountRole,
  catalogue: WorkCatalogue,
  toggles: WorkCatalogueToggles
): boolean {
  return seesEveryJob(role, catalogue, toggles)
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
  /**
   * The account's Projects / Small works add-edit-manage permission for the open organisation
   * (`USER_PERMISSION_FIELDS` `projects`, `smallWorks`). Missing means both off.
   */
  toggles?: WorkCatalogueToggles | null
  /** The signed-in account id (Firebase Auth uid) the app queries with; defaults to `ids[0]`. */
  uid?: string | null
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
 * Admins and super admins outside operative mode: every job. A manager with the toggle for the job's kind (`kind`,
 * the collection the job is stored in): every job of that kind. Other managers: only the jobs they manage
 * (`isJobManager`) — removed as manager, the job leaves their lists; re-added, it comes back. Operatives: no job
 * list (they see their own bookings on My Schedule).
 */
export function canSeeJob(
  viewer: JobAccessViewer | null | undefined,
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null,
  kind?: WorkCatalogue | null
): boolean {
  if (!viewer || !job) return false
  const role = viewer.role
  if (!role || role.isOperativeMode) return false
  if (role.isSuperAdmin || role.isAdmin) return true
  if (!role.isManager) return false
  if (seesEveryJob(role, kind ?? null, viewer.toggles ?? null)) return true
  return isJobManager(viewer, job, managers)
}

/** The jobs `canSeeJob` keeps, in order. */
export function visibleJobsFor<T extends JobManagerFields | Record<string, unknown>>(
  viewer: JobAccessViewer | null | undefined,
  jobs: ReadonlyArray<T> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null,
  kind?: WorkCatalogue | null
): T[] {
  return (jobs || []).filter((job) => canSeeJob(viewer, job, managers, kind))
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

// MARK: - Who adds and edits jobs, and who changes a job's managers (owner decisions 1.10.0 round 2)

/** The job fields that make up a job's manager list. Only `canChangeJobManagers` changes them. */
export const JOB_MANAGER_LIST_FIELDS = ['managerIds', 'managerId', 'assignedManagerUserIds', 'managerUserIds'] as const

/**
 * Add a project (`kind` `projects`) or a small works job (`smallWorks`): admins and super admins outside operative
 * mode always; a manager only with that kind's add/edit/manage permission (`permissions.projects` /
 * `permissions.smallWorks`, `USER_PERMISSION_FIELDS`); operatives never.
 */
export function canCreateJob(viewer: JobAccessViewer | null | undefined, kind: WorkCatalogue): boolean {
  if (!viewer || !viewer.role) return false
  return seesEveryJob(viewer.role, kind, viewer.toggles ?? null)
}

/**
 * Change a job's manager list (`JOB_MANAGER_LIST_FIELDS`): the same people as `canCreateJob` for the job's kind. A
 * manager without the toggle never changes it, not even on a job they manage.
 */
export function canChangeJobManagers(viewer: JobAccessViewer | null | undefined, kind: WorkCatalogue): boolean {
  return canCreateJob(viewer, kind)
}

/**
 * Edit a job's details (name, address, dates, client, notes and the other job fields): everyone who may change its
 * managers (`canChangeJobManagers`), and a manager without the toggle on a job they manage (`isJobManager`). Such a
 * manager's save leaves `JOB_MANAGER_LIST_FIELDS` as stored (`jobWriteWithoutManagerList`). Operatives never.
 */
export function canEditJob(
  viewer: JobAccessViewer | null | undefined,
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  kind: WorkCatalogue,
  managers?: ReadonlyArray<JobManagerRosterRow> | null
): boolean {
  if (!viewer || !viewer.role || viewer.role.isOperativeMode) return false
  if (canChangeJobManagers(viewer, kind)) return true
  if (!viewer.role.isManager || !job) return false
  return isJobManager(viewer, job, managers)
}

/** A job write with the manager-list fields taken out, for a save by someone who may not change them. */
export function jobWriteWithoutManagerList<T extends Record<string, unknown>>(fields: T): Omit<T, (typeof JOB_MANAGER_LIST_FIELDS)[number]> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields || {})) {
    if ((JOB_MANAGER_LIST_FIELDS as readonly string[]).includes(key)) continue
    out[key] = value
  }
  return out as Omit<T, (typeof JOB_MANAGER_LIST_FIELDS)[number]>
}

// MARK: - Rules-compatible reads (rulebook §17, 1.10.0 round 2)

/** Firestore's limit on the values of one `in` / `array-contains-any` filter. */
export const FIRESTORE_IN_QUERY_LIMIT = 30
/**
 * Jobs per booking query for a viewer who reads only their jobs' bookings. The security rules look each value's job
 * up with `get()`, and Firestore allows 10 document lookups per query across all `in` values, so one query carries
 * one job (all its id spellings, `jobIdQueryValues`).
 */
export const JOBS_PER_BOOKING_QUERY = 1
/** Own-booking ids per query (each may cost the rules one roster lookup; same 10-lookup budget). */
export const OWN_BOOKING_IDS_PER_QUERY = 4

export type JobCollection = WorkCatalogue
export const JOB_QUERY_COLLECTIONS: ReadonlyArray<JobCollection> = ['projects', 'smallWorks']

/** One job query: the whole collection, the jobs whose `managerUserIds` holds the account, or single documents. */
export type JobQuery =
  | { collection: JobCollection; kind: 'all' }
  | { collection: JobCollection; kind: 'managed'; field: 'managerUserIds'; op: 'array-contains'; value: string }
  | { collection: JobCollection; kind: 'documents'; ids: string[] }

export type JobQueryPlan = {
  /** Kinds the viewer sees every job of (`seesEveryJob`). */
  seesEvery: WorkCatalogueToggles
  queries: JobQuery[]
}

function viewerUid(viewer: JobAccessViewer): string {
  const uid = typeof viewer.uid === 'string' ? viewer.uid.trim() : ''
  if (uid) return uid
  const first = (viewer.ids || []).find((id) => typeof id === 'string' && id.trim())
  return first ? first.trim() : ''
}

/**
 * The spellings of a job id that a booking may store and the security rules can trace back to the job document: the
 * id as stored, plus its upper-case form when the id is all lower case (an iOS booking on a web job) and its
 * lower-case form when it is all upper case. A mixed-case id is only itself — the rules look a value up as given,
 * upper-cased and lower-cased, so they could not find its job. Exact de-dupe, order kept.
 */
export function jobIdQueryValues(ids: ReadonlyArray<string> | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids || []) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id) continue
    const spellings = [id]
    if (id === id.toLowerCase()) spellings.push(id.toUpperCase())
    if (id === id.toUpperCase()) spellings.push(id.toLowerCase())
    for (const value of spellings) {
      if (seen.has(value)) continue
      seen.add(value)
      out.push(value)
    }
  }
  return out
}

function chunk<T>(values: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < values.length; index += size) out.push(values.slice(index, index + size))
  return out
}

/**
 * The job queries an app runs for the viewer (both apps build the same ones; Firestore rules are not filters):
 *   - admins and super admins outside operative mode: every project and every small works job;
 *   - managers: every job of a kind they have the toggle for, else `managerUserIds array-contains <uid>`;
 *   - operatives (and an account with no staff role): the single job documents named in `documentIds` (the jobs
 *     of their own bookings, tasks and deadlines), in both collections, each id in every spelling. They never list a
 *     job collection.
 * `uid` is the signed-in account id (`viewer.uid`, else `viewer.ids[0]`).
 */
export function jobQueryPlan(
  viewer: JobAccessViewer | null | undefined,
  options?: { documentIds?: ReadonlyArray<string> | null; enforced?: boolean } | null
): JobQueryPlan {
  const enforced = options?.enforced ?? ENFORCED_READS_ACTIVE
  const none: JobQueryPlan = { seesEvery: { projects: false, smallWorks: false }, queries: [] }
  if (!viewer || !viewer.role) return none
  const uid = viewerUid(viewer)
  if (!uid) return none
  const role = viewer.role
  const staff = !role.isOperativeMode && (role.isSuperAdmin || role.isAdmin || role.isManager)
  if (!staff) {
    const ids = jobIdQueryValues(options?.documentIds ?? [])
    if (ids.length === 0) return none
    return { seesEvery: none.seesEvery, queries: JOB_QUERY_COLLECTIONS.map((collection) => ({ collection, kind: 'documents', ids })) }
  }
  const seesEvery = {
    projects: seesEveryJob(role, 'projects', viewer.toggles ?? null),
    smallWorks: seesEveryJob(role, 'smallWorks', viewer.toggles ?? null),
  }
  const queries: JobQuery[] = JOB_QUERY_COLLECTIONS.map((collection) =>
    seesEvery[collection] || !enforced
      ? { collection, kind: 'all' }
      : { collection, kind: 'managed', field: 'managerUserIds', op: 'array-contains', value: uid }
  )
  return { seesEvery, queries }
}

/**
 * One booking query: the whole collection, the bookings of one job (`field in values`, every spelling of the job
 * id), or the viewer's own bookings. Each app adds the collection's download bound (`date >= bookingLoadStart`).
 */
export type BookingQuery =
  | { collection: BookingPermissionCollection; kind: 'all' }
  /** 1.11.0: every booking of one job kind (`jobCollection == value`), for a manager with that kind's toggle. */
  | { collection: BookingPermissionCollection; kind: 'jobCollection'; field: 'jobCollection'; op: '=='; value: WorkCatalogue }
  | { collection: BookingPermissionCollection; kind: 'job'; jobId: string; field: 'projectId' | 'locationId'; op: 'in'; values: string[] }
  | { collection: BookingPermissionCollection; kind: 'own'; field: 'operativeId' | 'userId'; op: 'in' | '=='; values: string[] }

export type BookingQueryPlan = {
  /** True when the viewer reads every booking (whole-collection queries). */
  readsEveryBooking: boolean
  queries: BookingQuery[]
}

/**
 * Rulebook 1.10.1: whether the 1.10.0 enforced job/booking reads (§17) are live. While false, staff read whole job and
 * booking collections (as before 1.10.0) and every app still shows only the jobs `canSeeJob` allows; the restricted
 * query plan is used only once this is true. It becomes true in the release that ships after the owner has run the
 * `managerUserIds` / `jobCollection` backfills, and that release goes out before the Firestore rules deploy
 * (docs/DEPLOY_1.10.0.md). Jobs saved before 1.10.0 have no `managerUserIds`, so a restricted plan before the
 * backfill would show those managers no jobs.
 */
export const ENFORCED_READS_ACTIVE = false

/**
 * Who reads every booking (whole collections). Enforced (1.11.0): admins and super admins outside operative mode
 * only — a manager with a Projects / Small works toggle reads that kind's bookings by `jobCollection`, never a whole
 * collection (a booking stored without `jobCollection` is read only by admins, its job's managers and the people it
 * books). While `ENFORCED_READS_ACTIVE` is false (1.10.1): every admin and manager, as before 1.10.0.
 */
export function readsEveryBooking(
  viewer: JobAccessViewer | null | undefined,
  options?: { enforced?: boolean } | null
): boolean {
  const enforced = options?.enforced ?? ENFORCED_READS_ACTIVE
  if (!viewer || !viewer.role) return false
  const role = viewer.role
  if (role.isOperativeMode) return false
  if (role.isSuperAdmin || role.isAdmin) return true
  if (!role.isManager) return false
  return !enforced
}

/**
 * The booking queries an app runs for the viewer (rulebook §17; 1.11.0 by job kind):
 *   - `readsEveryBooking` (admins; every manager while `ENFORCED_READS_ACTIVE` is false): `bookings`,
 *     `managerSiteBookings` and `subcontractorBookings`, whole collections;
 *   - a manager with the Projects or Small works toggle: per collection one `jobCollection == <kind>` query for each kind
 *     they have the toggle for;
 *   - managers: per job in `visibleJobIds` one query per collection — `bookings` / `subcontractorBookings`
 *     `projectId in`, `managerSiteBookings` `locationId in` — with every spelling of that job id (`jobIdQueryValues`,
 *     `JOBS_PER_BOOKING_QUERY`). Pass the jobs of the kinds they have no toggle for (the results of `jobQueryPlan`'s
 *     `managed` queries); a job of a toggled kind passed here is queried too (its bookings saved before the
 *     `jobCollection` backfill are found that way);
 *   - everyone with a role: their own bookings — `bookings` `operativeId in` `ownBookingIds` (the account's
 *     `bookingIdsForAccount`, else its ids), `OWN_BOOKING_IDS_PER_QUERY` per query, and for managers
 *     `managerSiteBookings` `userId == <uid>`.
 */
export function bookingQueryPlan(
  viewer: JobAccessViewer | null | undefined,
  visibleJobIds: ReadonlyArray<string> | null | undefined,
  options?: { ownBookingIds?: ReadonlyArray<string> | null; enforced?: boolean } | null
): BookingQueryPlan {
  if (!viewer || !viewer.role) return { readsEveryBooking: false, queries: [] }
  const uid = viewerUid(viewer)
  if (!uid) return { readsEveryBooking: false, queries: [] }
  if (readsEveryBooking(viewer, { enforced: options?.enforced })) {
    return {
      readsEveryBooking: true,
      queries: BOOKING_PERMISSION_COLLECTIONS.map((collection) => ({ collection, kind: 'all' as const })),
    }
  }
  const role = viewer.role
  const isManager = !role.isOperativeMode && role.isManager
  const queries: BookingQuery[] = []
  if (isManager) {
    for (const kind of JOB_QUERY_COLLECTIONS) {
      if (!seesEveryJob(role, kind, viewer.toggles ?? null)) continue
      for (const collection of BOOKING_PERMISSION_COLLECTIONS) {
        queries.push({ collection, kind: 'jobCollection', field: 'jobCollection', op: '==', value: kind })
      }
    }
    const seen = new Set<string>()
    for (const raw of visibleJobIds || []) {
      const jobId = typeof raw === 'string' ? raw.trim() : ''
      const key = jobId.toLowerCase()
      if (!jobId || seen.has(key)) continue
      seen.add(key)
      const values = jobIdQueryValues([jobId])
      queries.push({ collection: 'bookings', kind: 'job', jobId, field: 'projectId', op: 'in', values })
      queries.push({ collection: 'subcontractorBookings', kind: 'job', jobId, field: 'projectId', op: 'in', values })
      queries.push({ collection: 'managerSiteBookings', kind: 'job', jobId, field: 'locationId', op: 'in', values })
    }
  }
  const own: string[] = []
  const ownSeen = new Set<string>()
  for (const raw of [uid, ...(options?.ownBookingIds ?? viewer.ids ?? [])]) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id || ownSeen.has(id)) continue
    ownSeen.add(id)
    own.push(id)
  }
  for (const values of chunk(own, OWN_BOOKING_IDS_PER_QUERY)) {
    queries.push({ collection: 'bookings', kind: 'own', field: 'operativeId', op: 'in', values })
  }
  if (isManager) queries.push({ collection: 'managerSiteBookings', kind: 'own', field: 'userId', op: '==', values: [uid] })
  return { readsEveryBooking: false, queries }
}

// MARK: - Daily Overview and warning scope (rulebook §17)

/**
 * What Daily Overview and the warning list cover for a viewer. `all`: everything (admins, and managers who see every
 * job of both kinds). `jobs`: only rows about the jobs the viewer sees (`jobIds`) and the people booked on them
 * (`personIds` / `personEmails`); `unbookedLabour` is false when the viewer cannot read every booking, because a
 * person missing from the viewer's bookings may be booked on a job they cannot see — those rows are not produced.
 */
export type WarningScope =
  | { kind: 'all' }
  | { kind: 'jobs'; jobIds: string[]; personIds: string[]; personEmails: string[]; unbookedLabour: boolean }

export const WARNING_SCOPE_ALL: WarningScope = { kind: 'all' }

/**
 * The scope for a viewer (`WarningScope`). `bookings` are the labour bookings the viewer loaded (`projectId`,
 * `operativeId`), `managerBookings` their manager site bookings (`userId`, `locationType`, `locationId`); a person
 * booked on a visible job is in scope under that id, every roster row with the same email (`people` accounts with
 * `formerIds`, `operatives` rows) and that email.
 */
export function warningScopeFor(input: {
  viewer: JobAccessViewer | null | undefined
  visibleJobIds: ReadonlyArray<string> | null | undefined
  bookings?: ReadonlyArray<{ projectId?: string | null; operativeId?: string | null }> | null
  managerBookings?: ReadonlyArray<{ userId?: string | null; locationType?: string | null; locationId?: string | null }> | null
  people?: ReadonlyArray<{ id: string; email?: string | null; formerIds?: ReadonlyArray<string> | null }> | null
  operatives?: ReadonlyArray<{ id: string; email?: string | null }> | null
  /** Overrides `ENFORCED_READS_ACTIVE` (tests and the release that switches reads on). */
  enforced?: boolean
}): WarningScope {
  const viewer = input?.viewer
  if (!viewer || !viewer.role) return { kind: 'jobs', jobIds: [], personIds: [], personEmails: [], unbookedLabour: false }
  if (seesEveryJob(viewer.role, null, viewer.toggles ?? null)) return WARNING_SCOPE_ALL
  const jobKeys = new Set((input.visibleJobIds || []).map(idKey).filter(Boolean))
  const booked = new Set<string>()
  for (const booking of input.bookings || []) {
    if (jobKeys.has(idKey(booking?.projectId))) booked.add(idKey(booking?.operativeId))
  }
  for (const booking of input.managerBookings || []) {
    const job = bookingJobId({ collection: 'managerSiteBookings', ...booking })
    if (job && jobKeys.has(idKey(job))) booked.add(idKey(booking?.userId))
  }
  booked.delete('')
  const rows = [
    ...(input.people || []).map((row) => ({ ids: [row.id, ...(row.formerIds || [])], email: row.email })),
    ...(input.operatives || []).map((row) => ({ ids: [row.id], email: row.email })),
  ]
  const emails = new Set<string>()
  for (const row of rows) {
    const email = String(row.email ?? '').trim().toLowerCase()
    if (email && row.ids.some((id) => booked.has(idKey(id)))) emails.add(email)
  }
  const ids = new Set(booked)
  for (const row of rows) {
    const email = String(row.email ?? '').trim().toLowerCase()
    if (email && emails.has(email)) for (const id of row.ids) if (idKey(id)) ids.add(idKey(id))
  }
  return {
    kind: 'jobs',
    jobIds: [...jobKeys],
    personIds: [...ids],
    personEmails: [...emails],
    unbookedLabour: readsEveryBooking(viewer, { enforced: input.enforced }),
  }
}

/** True when a row about this job is in scope (ids without case). */
export function isJobInWarningScope(scope: WarningScope | null | undefined, jobId: string | null | undefined): boolean {
  if (!scope || scope.kind === 'all') return true
  const key = idKey(jobId)
  return key !== '' && scope.jobIds.includes(key)
}

/** True when a row about this person (any of `ids`, or `email`) is in scope. */
export function isPersonInWarningScope(
  scope: WarningScope | null | undefined,
  ids: ReadonlyArray<string | null | undefined>,
  email?: string | null
): boolean {
  if (!scope || scope.kind === 'all') return true
  if (ids.some((id) => idKey(id) !== '' && scope.personIds.includes(idKey(id)))) return true
  const key = String(email ?? '').trim().toLowerCase()
  return key !== '' && scope.personEmails.includes(key)
}

// MARK: - Job kind (1.11.0)

/** `jobType` values that mean small works on a job read without its collection (older imports). */
function jobTypeIsSmallWorks(jobType: unknown): boolean {
  return String(jobType ?? '').trim().toLowerCase().replace(/[\s_-]/g, '') === 'smallworks'
}

/**
 * Whether a job is a project or a small works job (rulebook §16, §17; 1.11.0). The collection decides: a document in
 * `projects` is a project and a document in `smallWorks` is a small works job, whatever its `jobType` says (a project
 * whose job type is "Small Works" stays a project). Only when the collection is not known (a job passed around
 * without it) does `jobType` decide. Every list, picker, permission (`seesEveryJob`, `canSeeJob`, `canCreateJob`),
 * booking `jobCollection` and save path uses this — never `jobType` alone.
 */
export function jobKind(
  doc: { jobType?: unknown } | Record<string, unknown> | null | undefined,
  collection?: string | null
): WorkCatalogue {
  if (collection === 'projects' || collection === 'smallWorks') return collection
  return jobTypeIsSmallWorks((doc as { jobType?: unknown } | null | undefined)?.jobType) ? 'smallWorks' : 'projects'
}

/**
 * Job ids stored in both `projects` and `smallWorks` (older iOS builds could create such a pair). Both documents are
 * kept and each shows in its own list (`jobKind`); this lists them (stored case of the project id, without case
 * de-duplicated) so the owner can decide which to keep. A booking on such an id gets `jobCollection` from neither
 * (`jobCollectionForJobId` returns null) and is reported by the backfill.
 */
export function jobIdsInBothCollections(
  projectIds: ReadonlyArray<string> | null | undefined,
  smallWorkIds: ReadonlyArray<string> | null | undefined
): string[] {
  const small = new Set((smallWorkIds || []).map((id) => String(id ?? '').trim().toLowerCase()).filter(Boolean))
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of projectIds || []) {
    const id = String(raw ?? '').trim()
    const key = id.toLowerCase()
    if (!id || seen.has(key) || !small.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}
