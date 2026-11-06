import { lineManagerIds } from './leaveRequests'
import { personIdSet, rosterMemberActive, type PersonRosterRow } from './personIds'

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
 * Who sees every job (rulebook §16, §17). **1.33.0 (owner decision 6 Nov, "every manager sees every project and small
 * works"):** admins, super admins and every manager outside operative mode see every project and every small works
 * job, whatever their Projects / Small works toggles. The toggles now only govern adding jobs and changing a job's
 * manager list (`hasWorkCatalogueToggle`, `canCreateJob`, `canChangeJobManagers`). Operatives see no job list beyond
 * their own bookings, tasks and deadlines (`operativeJobIds`). `kind` and `toggles` are accepted for older callers and
 * no longer change the answer.
 */
export function seesEveryJob(
  role: StaffAccountRole,
  kind?: WorkCatalogue | null,
  toggles?: WorkCatalogueToggles | null
): boolean {
  void kind
  void toggles
  if (!role || role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin || role.isManager
}

/**
 * Whether the account holds the Projects (`projects`) or Small works (`smallWorks`) add/edit/manage permission for the
 * open organisation, in the sense the rulebook gives it from 1.33.0: admins and super admins outside operative mode
 * always; a manager only with that kind's toggle (with no `kind`, only with both); operatives never. Before 1.33.0 this
 * was also "sees every job of that kind" (`seesEveryJob`); it now only decides adding jobs and changing manager lists.
 */
export function hasWorkCatalogueToggle(
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
 * Who opens the staff warning list: every admin and manager; operatives never. 1.31.0 (owner decision): opening the
 * list is not seeing every row — admins see every warning, a manager only the warnings about themselves, their reports
 * and the jobs they manage (`warningScopeFor`, §5, §17).
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
  return hasWorkCatalogueToggle(role, catalogue, toggles)
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
 * Whether the viewer sees this project or small works job anywhere a job list or picker is shown (§17). **1.33.0:**
 * admins, super admins and every manager outside operative mode see every job, whatever their Projects / Small works
 * toggles (`seesEveryJob`). Operatives (and operative mode): no job list (they see the jobs of their own bookings,
 * tasks and deadlines, `visibleJobs` / `operativeJobIds`). `managers` and `kind` are accepted for older callers and no
 * longer change the answer. Seeing a job is not writing its bookings (`canWriteBooking`: the jobs they manage).
 */
export function canSeeJob(
  viewer: JobAccessViewer | null | undefined,
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  managers?: ReadonlyArray<JobManagerRosterRow> | null,
  kind?: WorkCatalogue | null
): boolean {
  void managers
  if (!viewer || !job) return false
  const role = viewer.role
  if (!role) return false
  return seesEveryJob(role, kind ?? null, viewer.toggles ?? null)
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

/**
 * 1.32.0 (owner decision 4 Nov, "booking screens follow `canWriteBooking`"), the candidate side of `canWriteBooking`
 * for the places that are not jobs (Office, Working from home, Site survey, custom items): whether the viewer may book
 * every one of `personUserIds` there. Admins and super admins: anyone. A manager: only themself (any of their ids) —
 * never a report or anyone else. Operatives: never. Empty list: false. Every booking screen (Book labour, the Daily
 * Overview booking sheet, My Schedule, scheduling) offers the non-job places only when this is true, so a save is
 * never refused after the fact. Jobs stay `bookableJobs` / `canWriteBooking` (managers: the jobs they manage).
 * `canScheduleOperatives` is a viewer rule (may this person schedule at all); this one is about the people booked.
 */
export function canBookOtherLocationsFor(
  viewer: JobAccessViewer | null | undefined,
  personUserIds: ReadonlyArray<string> | null | undefined
): boolean {
  const ids = (personUserIds || []).map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
  if (!viewer || ids.length === 0) return false
  return ids.every((userId) =>
    canWriteBooking(viewer, { collection: 'managerSiteBookings', userId, locationType: 'office', locationId: null }, null, null)
  )
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
 * `permissions.smallWorks`, `USER_PERMISSION_FIELDS`; `hasWorkCatalogueToggle`); operatives never. From 1.33.0 the
 * toggle no longer decides which jobs a manager sees (`seesEveryJob`: every job).
 */
export function canCreateJob(viewer: JobAccessViewer | null | undefined, kind: WorkCatalogue): boolean {
  if (!viewer || !viewer.role) return false
  return hasWorkCatalogueToggle(viewer.role, kind, viewer.toggles ?? null)
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
/** Own-booking ids per query (each may cost the rules one roster lookup; same 10-lookup budget). */
export const OWN_BOOKING_IDS_PER_QUERY = 4

export type JobCollection = WorkCatalogue
export const JOB_QUERY_COLLECTIONS: ReadonlyArray<JobCollection> = ['projects', 'smallWorks']

/**
 * One job query: the whole collection, or single documents (an operative's own jobs). 1.33.0: the `managed` query
 * (`managerUserIds array-contains <uid>`, a manager without a toggle) is gone — every manager reads every job.
 */
export type JobQuery =
  | { collection: JobCollection; kind: 'all' }
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
 *   - admins, super admins and (1.33.0) every manager outside operative mode: every project and every small works job
 *     (`seesEveryJob`), with the enforced-reads switch on or off;
 *   - operatives (and an account with no staff role): the single job documents named in `documentIds` (the jobs
 *     of their own bookings, tasks and deadlines), in both collections, each id in every spelling. They never list a
 *     job collection.
 * `uid` is the signed-in account id (`viewer.uid`, else `viewer.ids[0]`). `enforced` is accepted for older callers and
 * no longer changes the plan (1.33.0).
 */
export function jobQueryPlan(
  viewer: JobAccessViewer | null | undefined,
  options?: { documentIds?: ReadonlyArray<string> | null; enforced?: boolean } | null
): JobQueryPlan {
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
  // 1.33.0: staff see every job (`seesEveryJob`), so they list both collections whole, switch on or off.
  const queries: JobQuery[] = JOB_QUERY_COLLECTIONS.map((collection) => ({ collection, kind: 'all' }))
  return { seesEvery: { projects: true, smallWorks: true }, queries }
}

/**
 * One booking query: the whole collection, or the viewer's own bookings. Each app adds the collection's download
 * bound (`date >= bookingLoadStart`). 1.33.0: the per-kind (`jobCollection ==`) and per-job (`projectId in` /
 * `locationId in`) manager queries are gone — every manager reads every booking (`readsEveryBooking`).
 */
export type BookingQuery =
  | { collection: BookingPermissionCollection; kind: 'all' }
  | { collection: BookingPermissionCollection; kind: 'own'; field: 'operativeId'; op: 'in'; values: string[] }

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
 *
 * 1.26.0: the apps no longer wait for a release that flips this constant. Each app reads `platformConfig/app` and
 * passes `enforced: securitySwitchOn(config, organizationId, 'enforcedReads')` to `jobQueryPlan`, `bookingQueryPlan`,
 * `readsEveryBooking` and `warningScopeFor`, so it plans exactly the reads the rules allow with the switch on or off.
 * This constant is only the default when no value is passed (the document could not be read): off.
 */
export const ENFORCED_READS_ACTIVE = false

/**
 * Who reads every booking (whole collections of labour, subcontractor and manager site bookings). **1.33.0 (owner
 * decision 6 Nov):** admins, super admins and every manager outside operative mode, whatever their Projects / Small
 * works toggles and with the enforced-reads switch on or off — a manager sees every job (`seesEveryJob`), so they
 * read every booking. Operatives (and operative mode) never: they read only their own bookings. Before 1.33.0, with
 * the switch on, a manager read only the bookings of their toggled kinds and their jobs. `enforced` is accepted for
 * older callers and no longer changes the answer.
 */
export function readsEveryBooking(
  viewer: JobAccessViewer | null | undefined,
  options?: { enforced?: boolean } | null
): boolean {
  void options
  if (!viewer || !viewer.role) return false
  const role = viewer.role
  if (role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin || role.isManager
}

/**
 * The booking queries an app runs for the viewer (rulebook §17; 1.33.0):
 *   - `readsEveryBooking` (admins, super admins and every manager outside operative mode): `bookings`,
 *     `managerSiteBookings` and `subcontractorBookings`, whole collections;
 *   - everyone else with a role (operatives, operative mode): their own labour bookings — `bookings` `operativeId in`
 *     `ownBookingIds` (the account's `bookingIdsForAccount`, else its ids), `OWN_BOOKING_IDS_PER_QUERY` per query.
 * `visibleJobIds` and `enforced` are accepted for older callers and no longer change the plan.
 */
export function bookingQueryPlan(
  viewer: JobAccessViewer | null | undefined,
  visibleJobIds: ReadonlyArray<string> | null | undefined,
  options?: { ownBookingIds?: ReadonlyArray<string> | null; enforced?: boolean } | null
): BookingQueryPlan {
  void visibleJobIds
  if (!viewer || !viewer.role) return { readsEveryBooking: false, queries: [] }
  const uid = viewerUid(viewer)
  if (!uid) return { readsEveryBooking: false, queries: [] }
  if (readsEveryBooking(viewer)) {
    return {
      readsEveryBooking: true,
      queries: BOOKING_PERMISSION_COLLECTIONS.map((collection) => ({ collection, kind: 'all' as const })),
    }
  }
  const queries: BookingQuery[] = []
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
  return { readsEveryBooking: false, queries }
}

// MARK: - Daily Overview and warning scope (rulebook §17)

/**
 * What the warning list (`warningScopeFor`) and Daily Overview (`dailyOverviewScopeFor`, 1.33.0) cover for a viewer
 * (rulebook §5, §6, §17). `all`: everything (admins and super admins outside operative mode). `jobs`: only rows about
 * the jobs in `jobIds` and the people in `personIds` / `personEmails` (Daily Overview's scope never has `jobIds`);
 * `unbookedLabour` is false when the viewer cannot read every booking, because a person missing from the viewer's
 * bookings may be booked on a job they cannot see — those rows are not produced. From 1.33.0 every manager reads every
 * booking (`readsEveryBooking`), so it is false only for operatives and an unknown viewer.
 */
export type WarningScope =
  | { kind: 'all' }
  | { kind: 'jobs'; jobIds: string[]; personIds: string[]; personEmails: string[]; unbookedLabour: boolean }

export const WARNING_SCOPE_ALL: WarningScope = { kind: 'all' }

/** A users document as the warning scope reads it: ids, email, active flag, level and the line-manager fields. */
export type WarningScopeRosterRow = {
  id: string
  email?: string | null
  isActive?: boolean | null
  role?: StaffAccountRole | string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  assignedManagerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserId?: string | null
  hasNoLineManager?: boolean | null
  [key: string]: unknown
}

/**
 * The scope for a viewer (`WarningScope`). **1.31.0 (owner decision):** admins and super admins outside operative
 * mode see every warning. A manager — whatever their Projects / Small works toggles — sees only:
 *   (a) warnings about themselves, under any of their ids (`personIdSet` over `roster`, `people` and `operatives`:
 *       their own id, former and same-email ids, rows on their email);
 *   (b) warnings about their reports — the active people whose `lineManagerIds` include the manager — under any of
 *       their ids and their email;
 *   (c) warnings on the jobs they are an assigned manager of (`jobs`, kept by `isJobManager`: a stored manager id that
 *       is one of theirs, or a `managers` row on their email).
 * Per type: unbooked labour, qualification expiry and unverified accounts → (a) + (b); clashes and leave cover → any
 * person involved in (a) + (b), or any booking on a job of (c) (`isWarningRowInScope`); materials cut-off → (c).
 * Before 1.31.0 the scope was the jobs the viewer could see and everyone booked on them, so a manager who sees every
 * job got `all`. `visibleJobIds`, `bookings` and `managerBookings` are no longer read (older callers may still pass
 * them); a caller that passes no `jobs` gives a manager no job rows. Operatives and an unknown viewer: nothing.
 * `unbookedLabour` is `readsEveryBooking` (1.33.0: true for every manager, with the enforced-reads switch on or off).
 */
export function warningScopeFor(input: {
  viewer: JobAccessViewer | null | undefined
  /** Every job loaded, with its stored manager fields (`managerIds`, `managerId`, `managerUserIds`, ...). */
  jobs?: ReadonlyArray<{ id: string } & JobManagerFields> | null
  /** `organizations/{orgId}/managers` rows (a job may name one; matched on the viewer's email). */
  managers?: ReadonlyArray<JobManagerRosterRow> | null
  /** Every users document of the organisation, with the line-manager fields (for the viewer's reports). */
  roster?: ReadonlyArray<WarningScopeRosterRow> | null
  /** Ignored from 1.31.0 (kept so older callers still type-check). */
  visibleJobIds?: ReadonlyArray<string> | null
  /** Ignored from 1.31.0. */
  bookings?: ReadonlyArray<{ projectId?: string | null; operativeId?: string | null }> | null
  /** Ignored from 1.31.0. */
  managerBookings?: ReadonlyArray<{ userId?: string | null; locationType?: string | null; locationId?: string | null }> | null
  /** Accounts (`formerIds`) and `operatives` rows: a person in scope is in scope under every row on their email. */
  people?: ReadonlyArray<{ id: string; email?: string | null; formerIds?: ReadonlyArray<string> | null }> | null
  operatives?: ReadonlyArray<{ id: string; email?: string | null }> | null
  /** Overrides `ENFORCED_READS_ACTIVE` (tests and the release that switches reads on). */
  enforced?: boolean
}): WarningScope {
  const viewer = input?.viewer
  const none: WarningScope = { kind: 'jobs', jobIds: [], personIds: [], personEmails: [], unbookedLabour: false }
  if (!viewer || !viewer.role) return none
  const role = viewer.role
  if ((role.isAdmin || role.isSuperAdmin) && !role.isOperativeMode) return WARNING_SCOPE_ALL
  if (!role.isManager || role.isOperativeMode) return none
  const jobIds = new Set<string>()
  for (const job of input.jobs || []) {
    if (job && idKey(job.id) && isJobManager(viewer, job, input.managers ?? null)) jobIds.add(idKey(job.id))
  }
  const roster = (input.roster || []).filter((row) => row && idKey(row.id)) as PersonRosterRow[]
  const rows: Array<{ ids: string[]; email: string }> = [
    ...roster.map((row) => ({
      ids: [row.id, ...(row.formerUserIds || []), ...(row.sameEmailUserIds || [])],
      email: idKey(row.email),
    })),
    ...(input.people || []).map((row) => ({ ids: [row.id, ...(row.formerIds || [])], email: idKey(row.email) })),
    ...(input.operatives || []).map((row) => ({ ids: [row.id], email: idKey(row.email) })),
  ]
  const ids = new Set<string>()
  const emails = new Set<string>()
  const addPerson = (personIds: ReadonlyArray<string | null | undefined>, email: unknown) => {
    for (const id of personIds) if (idKey(id)) ids.add(idKey(id))
    if (idKey(email)) emails.add(idKey(email))
  }
  // (a) the viewer, every id they go by.
  const viewerIds = [viewer.uid, ...(viewer.ids || [])].filter((id): id is string => typeof id === 'string' && id.trim() !== '')
  const self = { id: viewerIds[0] ?? '', email: viewer.email ?? null, formerUserIds: viewerIds }
  addPerson(personIdSet(self, roster), viewer.email)
  // (b) their reports: active roster people whose line managers (`lineManagerIds`) include one of the viewer's ids.
  const viewerKeys = new Set(ids)
  for (const member of roster) {
    if (!rosterMemberActive(member)) continue
    if (!lineManagerIds(member, roster).some((id) => viewerKeys.has(idKey(id)))) continue
    addPerson(personIdSet(member, roster), member.email)
  }
  // Every row on an email in scope is the same person (an `operatives` row, a second users document).
  for (const row of rows) if (row.email && emails.has(row.email)) addPerson(row.ids, row.email)
  ids.delete('')
  return {
    kind: 'jobs',
    jobIds: [...jobIds],
    personIds: [...ids],
    personEmails: [...emails],
    unbookedLabour: readsEveryBooking(viewer, { enforced: input.enforced }),
  }
}

/** Daily Overview's scope (rulebook §6, 1.33.0): the `WarningScope` shape with no job part. */
export type DailyOverviewScope = WarningScope

/**
 * What Daily Overview — and every screen that shows a day of it (Home team panels and the Home on-site / on-leave
 * figures) — covers for a viewer (rulebook §6; **1.33.0, owner decision 5 Nov / Q-D1 6 Nov: "a manager's Daily
 * Overview shows only their own team"**). Admins and super admins outside operative mode: everything (`all`), every
 * person and every subcontractor booking. A manager, whatever their Projects / Small works toggles: only (a)
 * themselves and (b) their reports — the parts (a) and (b) of `warningScopeFor`, with **no job part**: a non-report
 * booked on a job they manage, and subcontractors on it, are not shown (they still are in project scheduling).
 * Booked people, people on leave, unbooked people and the day's hours all follow it (`isDailyOverviewRowInScope`), so
 * a manager's unbooked list is their Book labour list. Operatives and an unknown viewer: nothing.
 */
export function dailyOverviewScopeFor(input: {
  viewer: JobAccessViewer | null | undefined
  roster?: ReadonlyArray<WarningScopeRosterRow> | null
  people?: ReadonlyArray<{ id: string; email?: string | null; formerIds?: ReadonlyArray<string> | null }> | null
  operatives?: ReadonlyArray<{ id: string; email?: string | null }> | null
  enforced?: boolean
}): DailyOverviewScope {
  return warningScopeFor({
    viewer: input?.viewer,
    jobs: null,
    managers: null,
    roster: input?.roster ?? null,
    people: input?.people ?? null,
    operatives: input?.operatives ?? null,
    enforced: input?.enforced,
  })
}

/**
 * Whether one Daily Overview row is in `scope` (`dailyOverviewScopeFor`): a booked person (labour or manager site
 * booking), a person on leave, an unbooked person or their hours — in scope when any of `personIds` or `email` is in
 * scope. A subcontractor booking (`subcontractor: true`) only for `all` (admins). No scope keeps every row.
 */
export function isDailyOverviewRowInScope(
  scope: DailyOverviewScope | null | undefined,
  row: {
    personIds?: ReadonlyArray<string | null | undefined> | null
    email?: string | null
    subcontractor?: boolean | null
  }
): boolean {
  if (!scope || scope.kind === 'all') return true
  if (row?.subcontractor === true) return false
  return isPersonInWarningScope(scope, row?.personIds || [], row?.email ?? null)
}

/**
 * A warning row that can be about a job and people — a clash, a leave-cover row (rulebook 1.31.0 §5): in scope when
 * one of its jobs is in `scope.jobIds` or one of its people is in scope (any id, or `email`). `WARNING_SCOPE_ALL` (or
 * no scope) keeps every row.
 */
export function isWarningRowInScope(
  scope: WarningScope | null | undefined,
  row: {
    jobIds?: ReadonlyArray<string | null | undefined> | null
    personIds?: ReadonlyArray<string | null | undefined> | null
    email?: string | null
  }
): boolean {
  if (!scope || scope.kind === 'all') return true
  if ((row?.jobIds || []).some((id) => idKey(id) !== '' && scope.jobIds.includes(idKey(id)))) return true
  if ((row?.personIds || []).some((id) => idKey(id) !== '' && scope.personIds.includes(idKey(id)))) return true
  const email = idKey(row?.email)
  return email !== '' && scope.personEmails.includes(email)
}

/** The job id of a manager site booking at a project or small works, or '' (for `isWarningRowInScope`). */
export function managerBookingJobId(booking: { locationType?: string | null; locationId?: string | null } | null | undefined): string {
  return bookingJobId({ collection: 'managerSiteBookings', ...(booking || {}) }) || ''
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
