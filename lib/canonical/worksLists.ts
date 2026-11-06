/**
 * Job lists (rulebook §21, 1.21.0): which jobs appear in which list, under which tab, in which count, for which
 * viewer, and which jobs a person may book onto. Every screen on every platform asks these functions; no screen,
 * store or listener decides list membership itself (an iOS store that kept live small works only, and a web store
 * flag that dropped inactive projects by load order, both made jobs vanish).
 *
 * Plain data only, so the packed script runs it unchanged on iOS: jobs are objects with string ids, booleans,
 * day keys or epoch milliseconds; the viewer is `JobAccessViewer`; every list in `context` is an array of plain rows.
 */

import { dayKeyInZone } from '../orgTime/zoneTime'
import { bookingIdsForAccount } from './bookingPerson'
import { zoneOrLondon } from './dayKeys'
import { workDocuments, workStatusOn, type WorkStatusOnDay } from './scheduleSources'
import {
  canSeeJob,
  canWriteBooking,
  isJobManager,
  jobKind,
  stableManagerId,
  type BookingPermissionCollection,
  type JobAccessViewer,
  type JobManagerFields,
  type JobManagerRosterRow,
  type WorkCatalogue,
} from './staffAccess'
import { bookingOccupiesDay } from './warningRows'

/** A job as the list rules read it. Extra fields are kept and returned untouched. */
export type WorksListJob = JobManagerFields & {
  id: string
  /** `projects` | `smallWorks`: the collection the document was read from (decides the kind, `jobKind`). */
  collection?: string | null
  /** Only used when the collection is unknown. */
  jobType?: string | null
  /** False only when stored false (`parseJobDocument`). */
  isLive?: boolean | null
  /** Start and end day in the organisation zone. When missing, `startMs`/`endMs` or `startDate`/`endDate` are read. */
  startDayKey?: string | null
  endDayKey?: string | null
  startMs?: number | null
  endMs?: number | null
  /** A web `Date`, an ISO string, a `YYYY-MM-DD` day key or epoch milliseconds. */
  startDate?: unknown
  endDate?: unknown
  /** 1.33.0: the per-job hide list for operatives (owner decision 6 Nov); there is no managers' hide list. */
  hiddenOperativeUserIds?: ReadonlyArray<string> | null
}

/** The tabs of every job list (Projects, Small works, Site Audit, booking pickers). */
export type WorksTab = 'active' | 'upcoming' | 'completed' | 'all'
export const WORKS_TABS: readonly WorksTab[] = ['active', 'upcoming', 'completed', 'all']

export type WorksTabCounts = { all: number; active: number; upcoming: number; completed: number }

/** A labour booking as the visibility rule reads it. */
export type WorksListBooking = { projectId?: string | null; operativeId?: string | null; status?: string | null }
/** A manager site booking as the visibility rule reads it. */
export type WorksListManagerBooking = { userId?: string | null; locationType?: string | null; locationId?: string | null }
/** A task as the visibility rule reads it (operatives-list ids, managers-list ids or account ids). */
export type WorksListTask = {
  projectId?: string | null
  assignedOperativeId?: string | null
  assignedOperativeIds?: ReadonlyArray<string> | null
  assignedManagerId?: string | null
  assignedManagerIds?: ReadonlyArray<string> | null
}

/**
 * Everything a job list may need besides the jobs and the viewer. Every field is optional; a missing list is empty.
 */
export type WorksListContext = {
  /** `organizations/{orgId}/managers` rows (`canSeeJob`, `isJobManager`, a task's manager id). */
  managers?: ReadonlyArray<JobManagerRosterRow> | null
  /** `organizations/{orgId}/operatives` rows: a booking or task may name the viewer's row on their email. */
  operatives?: ReadonlyArray<{ id: string; email?: string | null }> | null
  bookings?: ReadonlyArray<WorksListBooking> | null
  managerSiteBookings?: ReadonlyArray<WorksListManagerBooking> | null
  tasks?: ReadonlyArray<WorksListTask> | null
  /** Jobs the viewer has a deadline on (`deadlines` assignees), by id. */
  deadlineJobIds?: ReadonlyArray<string> | null
  /** `bookableJobs` only: the collection the new booking is written to (default `bookings`). */
  bookingCollection?: BookingPermissionCollection | null
}

function idKey(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  const bare = raw.toLowerCase().startsWith('user:') ? raw.slice(5) : raw
  return bare.trim().toLowerCase()
}

function emailKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function instantDayKey(value: unknown, timeZone: string): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string' && DAY_KEY.test(value.trim())) return value.trim()
  let ms: number | null = null
  if (typeof value === 'number') ms = value
  else if (value instanceof Date) ms = value.getTime()
  else if (typeof value === 'string') ms = Date.parse(value)
  else if (typeof value === 'object' && value && typeof (value as { getTime?: unknown }).getTime === 'function') {
    ms = Number((value as { getTime: () => number }).getTime())
  }
  if (ms == null || !Number.isFinite(ms)) return null
  return dayKeyInZone(new Date(ms), timeZone)
}

/** A job's start and end day in the organisation zone (`startDayKey`, else `startMs`, else `startDate`). */
export function jobDayKeys(
  job: WorksListJob | null | undefined,
  timeZone: string
): { startDayKey: string | null; endDayKey: string | null } {
  const zone = zoneOrLondon(timeZone)
  const row = job ?? ({} as WorksListJob)
  const start = instantDayKey(row.startDayKey, zone) ?? instantDayKey(row.startMs, zone) ?? instantDayKey(row.startDate, zone)
  const end = instantDayKey(row.endDayKey, zone) ?? instantDayKey(row.endMs, zone) ?? instantDayKey(row.endDate, zone)
  return { startDayKey: start, endDayKey: end }
}

/** Today's day key in the organisation zone. `now`: epoch ms, ISO string, `Date` or a day key. */
function todayKey(now: unknown, timeZone: string): string {
  return instantDayKey(now ?? Date.now(), zoneOrLondon(timeZone)) ?? dayKeyInZone(new Date(), zoneOrLondon(timeZone))
}

/**
 * A job's status on `now`'s day in the organisation zone (`workStatusOn`): inactive when stored `isLive: false`,
 * upcoming before its start day, completed after its end day, otherwise active. The zone is required: the day never
 * comes from the device or a London default.
 */
export function jobWorkStatus(job: WorksListJob | null | undefined, now: unknown, timeZone: string): WorkStatusOnDay {
  const days = jobDayKeys(job, timeZone)
  return workStatusOn({ isLive: job?.isLive ?? null, ...days }, todayKey(now, timeZone))
}

/** The list tab a status belongs to: an inactive job is under Completed (and All). */
export function worksTab(status: WorkStatusOnDay | string | null | undefined): Exclude<WorksTab, 'all'> {
  if (status === 'upcoming') return 'upcoming'
  if (status === 'completed' || status === 'inactive') return 'completed'
  return 'active'
}

/** The jobs under a tab, in order. `all` is every job given. */
export function worksInTab<T extends WorksListJob>(
  jobs: ReadonlyArray<T> | null | undefined,
  tab: WorksTab | string,
  now: unknown,
  timeZone: string
): T[] {
  const list = [...(jobs || [])].filter(Boolean)
  if (tab === 'all') return list
  return list.filter((job) => worksTab(jobWorkStatus(job, now, timeZone)) === tab)
}

/**
 * The tab counts. `all` is the number of jobs given (the length of the All list); every job is in exactly one of
 * active, upcoming and completed, so active + upcoming + completed = all.
 */
export function worksTabCounts(
  jobs: ReadonlyArray<WorksListJob> | null | undefined,
  now: unknown,
  timeZone: string
): WorksTabCounts {
  const counts: WorksTabCounts = { all: 0, active: 0, upcoming: 0, completed: 0 }
  for (const job of jobs || []) {
    if (!job) continue
    counts.all += 1
    counts[worksTab(jobWorkStatus(job, now, timeZone))] += 1
  }
  return counts
}

/**
 * The documents a Projects (`projects`) or Small works (`smallWorks`) list holds before per-viewer visibility: every
 * document of that kind the reader accepted, once by id (`workDocuments`: two jobs with the same job number both
 * stay), live or not. The collection decides the kind (`jobKind`), never `jobType`. Stores keep every document; no
 * store or listener drops inactive jobs.
 */
export function worksListMembership<T extends WorksListJob>(
  jobs: ReadonlyArray<T> | null | undefined,
  kind: WorkCatalogue
): T[] {
  return workDocuments((jobs || []).filter((job) => job && jobKind(job, job.collection ?? null) === kind))
}

/**
 * Every id a booking, task or job list may name the viewer by: their account ids (`viewer.ids`), the operatives rows
 * and managers rows on their email (a managers row also as its iOS stable id). Never by name.
 */
export function worksListPersonIds(
  viewer: JobAccessViewer | null | undefined,
  context?: Pick<WorksListContext, 'operatives' | 'managers'> | null
): string[] {
  if (!viewer) return []
  const ids = [...(viewer.ids || [])]
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: unknown) => {
    const id = typeof raw === 'string' ? raw.trim() : ''
    const key = idKey(id)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(id)
  }
  for (const id of ids) add(id)
  const operatives = (context?.operatives || []).map((row) => ({ id: row.id, email: row.email ?? '' }))
  for (const id of bookingIdsForAccount({ id: ids[0] ?? '', email: viewer.email ?? null, formerIds: ids.slice(1) }, operatives)) add(id)
  const email = emailKey(viewer.email)
  if (email) {
    for (const row of context?.managers || []) {
      if (!row || emailKey(row.email) !== email) continue
      add(row.id)
      add(stableManagerId(row.id))
    }
  }
  return out
}

function taskAssigneeIds(task: WorksListTask): string[] {
  return [
    task.assignedOperativeId,
    ...(task.assignedOperativeIds || []),
    task.assignedManagerId,
    ...(task.assignedManagerIds || []),
  ].filter((id): id is string => typeof id === 'string' && id.trim() !== '')
}

/**
 * The jobs an operative sees (§17): the jobs of their own labour bookings (a status that occupies the day,
 * `bookingOccupiesDay`), of tasks assigned to them, and of their deadlines. Ids as stored, de-duplicated without
 * case. Also the `documentIds` of their `jobQueryPlan`.
 */
export function operativeJobIds(viewer: JobAccessViewer | null | undefined, context?: WorksListContext | null): string[] {
  if (!viewer) return []
  const person = new Set(worksListPersonIds(viewer, context).map(idKey))
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: unknown) => {
    const id = typeof raw === 'string' ? raw.trim() : ''
    const key = idKey(id)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(id)
  }
  for (const booking of context?.bookings || []) {
    if (!booking || !person.has(idKey(booking.operativeId))) continue
    if (bookingOccupiesDay(booking.status)) add(booking.projectId)
  }
  for (const task of context?.tasks || []) {
    if (!task) continue
    if (taskAssigneeIds(task).some((id) => person.has(idKey(id)))) add(task.projectId)
  }
  for (const id of context?.deadlineJobIds || []) add(id)
  return out
}

function hiddenFrom(list: ReadonlyArray<string> | null | undefined, viewerIds: ReadonlySet<string>): boolean {
  return (list || []).some((id) => viewerIds.has(idKey(id)))
}

/**
 * The jobs a viewer sees in a job list, in order (§17, §21):
 *   - admins, super admins and (1.33.0) every manager outside operative mode: every job (`canSeeJob`);
 *   - operatives (and operative mode): the jobs of their own bookings, tasks and deadlines (`operativeJobIds`), less
 *     the jobs whose `hiddenOperativeUserIds` names them (an operative booked on a hidden job does not see it);
 *   - an account with no staff role: the jobs they manage or are booked onto (labour or manager site booking).
 * 1.33.0 (owner decisions 6 Nov): the managers' hide list (`hiddenManagerUserIds`) is no longer read — stored values
 * are left in place and ignored; the operatives' hide list stays.
 * The viewer is matched by id and email only, never by name.
 */
export function visibleJobs<T extends WorksListJob>(
  jobs: ReadonlyArray<T> | null | undefined,
  viewer: JobAccessViewer | null | undefined,
  context?: WorksListContext | null
): T[] {
  const list = (jobs || []).filter((job): job is T => Boolean(job && typeof job.id === 'string' && job.id.trim()))
  if (!viewer || !viewer.role) return []
  const role = viewer.role
  const viewerIds = new Set((viewer.ids || []).map(idKey).filter(Boolean))
  const managers = context?.managers ?? null
  if (role.isOperativeMode) {
    const own = new Set(operativeJobIds(viewer, context).map(idKey))
    return list.filter((job) => own.has(idKey(job.id)) && !hiddenFrom(job.hiddenOperativeUserIds, viewerIds))
  }
  if (role.isSuperAdmin || role.isAdmin || role.isManager) {
    return list.filter((job) => canSeeJob(viewer, job, managers, jobKind(job, job.collection ?? null)))
  }
  const person = new Set(worksListPersonIds(viewer, context).map(idKey))
  const booked = new Set<string>()
  for (const booking of context?.managerSiteBookings || []) {
    if (!booking || !viewerIds.has(idKey(booking.userId))) continue
    const type = String(booking.locationType ?? '').trim()
    if (type === 'project' || type === 'small_work') booked.add(idKey(booking.locationId))
  }
  for (const booking of context?.bookings || []) {
    if (booking && person.has(idKey(booking.operativeId)) && bookingOccupiesDay(booking.status)) booked.add(idKey(booking.projectId))
  }
  return list.filter((job) => booked.has(idKey(job.id)) || isJobManager(viewer, job, managers))
}

/**
 * The jobs a viewer may book a person onto (§21, owner decision 1.21.0): jobs they see (`visibleJobs`), not inactive
 * (`isLive` not stored false) and whose booking the viewer may write (`canWriteBooking` for `context.bookingCollection`,
 * default `bookings`). The job's start and end dates are never checked: a job past its end date, or with no end date,
 * stays bookable. `dayKeys` and `timeZone` are accepted for a stable signature and ignored. Operatives book onto no job.
 */
export function bookableJobs<T extends WorksListJob>(
  jobs: ReadonlyArray<T> | null | undefined,
  viewer: JobAccessViewer | null | undefined,
  context: WorksListContext | null | undefined,
  dayKeys?: ReadonlyArray<string> | string | null,
  timeZone?: string | null
): T[] {
  void dayKeys
  void timeZone
  const collection = context?.bookingCollection ?? 'bookings'
  const managers = context?.managers ?? null
  const uid = viewer ? viewer.uid || viewer.ids?.[0] || null : null
  return visibleJobs(jobs, viewer, context).filter((job) => {
    if (job.isLive === false) return false
    const small = jobKind(job, job.collection ?? null) === 'smallWorks'
    return canWriteBooking(
      viewer,
      {
        collection,
        projectId: job.id,
        userId: uid,
        locationType: small ? 'small_work' : 'project',
        locationId: job.id,
      },
      job,
      managers
    )
  })
}

/**
 * Home "active projects" (§21): the number of jobs, projects and small works together, that the viewer sees
 * (`visibleJobs`) and that are active today in the organisation zone — the same jobs the
 * Projects and Small works lists show under Active. Each document counts once by id (two jobs with one job number
 * both count). An operative's jobs are their bookings, tasks and deadlines; manager site bookings count only for an
 * account with no staff role (as in `visibleJobs`).
 */
export function activeJobsCount(
  jobs: ReadonlyArray<WorksListJob> | null | undefined,
  viewer: JobAccessViewer | null | undefined,
  context: WorksListContext | null | undefined,
  now: unknown,
  timeZone: string
): number {
  const documents = workDocuments((jobs || []).filter(Boolean))
  return visibleJobs(documents, viewer, context).filter((job) => jobWorkStatus(job, now, timeZone) === 'active').length
}

// MARK: - "My Projects" / "My Small works" (1.33.0, owner decision 6 Nov)

/**
 * The person's own pick list of jobs on the Projects and Small works lists (rulebook §21, 1.33.0). Stored per person
 * per organisation in `organizations/{orgId}/worksListPicks/{uid}` (`myWorksPicksPath`), so web and iPhone show the
 * same list. A missing kind (`null`) means the person has never saved that list: it is pre-filled with the jobs they
 * manage (`myWorksDefaultIds`) until their first save. An empty array is a saved, empty list.
 */
export type MyWorksPicks = { projects: string[] | null; smallWorks: string[] | null }

/** The Firestore document of a person's picks in an organisation: `organizations/{orgId}/worksListPicks/{uid}`. */
export const MY_WORKS_PICKS_COLLECTION = 'worksListPicks'

/** Most job ids one pick list stores (the rules check the same cap). */
export const MY_WORKS_PICKS_MAX = 500

export function myWorksPicksPath(organizationId: string, uid: string): string {
  return `organizations/${String(organizationId ?? '').trim()}/${MY_WORKS_PICKS_COLLECTION}/${String(uid ?? '').trim()}`
}

function pickList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    const key = idKey(id)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

/** Reads a `worksListPicks` document (missing document or field → `null`, never saved). Ids de-duplicated without case. */
export function parseMyWorksPicks(data: Record<string, unknown> | null | undefined): MyWorksPicks {
  const row = data && typeof data === 'object' ? data : {}
  return { projects: pickList(row.projects), smallWorks: pickList(row.smallWorks) }
}

/**
 * Who gets the My Projects / My Small works filter: admins, super admins and managers outside operative mode.
 * Operatives (and operative mode) never — their list is already their own jobs (`operativeJobIds`).
 */
export function hasMyWorksList(viewer: JobAccessViewer | null | undefined): boolean {
  const role = viewer?.role
  if (!role || role.isOperativeMode) return false
  return role.isSuperAdmin || role.isAdmin || role.isManager
}

/** The list's first tab and default: `mine` for people with the filter (`hasMyWorksList`), else `active`. */
export function defaultWorksListTab(viewer: JobAccessViewer | null | undefined): WorksListTab {
  return hasMyWorksList(viewer) ? 'mine' : 'active'
}

/** A list tab: `mine` (My Projects / My Small works, 1.33.0) or one of `WORKS_TABS`. */
export type WorksListTab = 'mine' | WorksTab

/** The tab label: "My Projects" / "My Small works". */
export function myWorksTabLabel(kind: WorkCatalogue): string {
  return kind === 'smallWorks' ? 'My Small works' : 'My Projects'
}

/** The empty state of the My list: "No projects in your list yet" / "No small works in your list yet". */
export function myWorksEmptyTitle(kind: WorkCatalogue): string {
  return kind === 'smallWorks' ? 'No small works in your list yet' : 'No projects in your list yet'
}

/** The button under the empty state, which opens the ⚙ picker. */
export function myWorksEmptyActionLabel(kind: WorkCatalogue): string {
  return kind === 'smallWorks' ? 'Choose small works' : 'Choose projects'
}

/**
 * The pre-fill for a list never saved: the jobs of that kind the viewer sees (`visibleJobs`) and is an assigned
 * manager of (`isJobManager`: a stored manager id that is one of theirs, or a `managers` row on their email), in list
 * order. Empty for an operative.
 */
export function myWorksDefaultIds<T extends WorksListJob>(
  jobs: ReadonlyArray<T> | null | undefined,
  viewer: JobAccessViewer | null | undefined,
  context: WorksListContext | null | undefined,
  kind: WorkCatalogue
): string[] {
  if (!hasMyWorksList(viewer)) return []
  const managers = context?.managers ?? null
  return visibleJobs(worksListMembership(jobs, kind), viewer, context)
    .filter((job) => isJobManager(viewer, job, managers))
    .map((job) => job.id)
}

/** The ids on the person's list for `kind`: what they saved, else the pre-fill (`myWorksDefaultIds`). */
export function myWorksIds<T extends WorksListJob>(
  picks: MyWorksPicks | null | undefined,
  jobs: ReadonlyArray<T> | null | undefined,
  viewer: JobAccessViewer | null | undefined,
  context: WorksListContext | null | undefined,
  kind: WorkCatalogue
): string[] {
  if (!hasMyWorksList(viewer)) return []
  const saved = picks ? picks[kind] : null
  if (saved != null) return saved
  return myWorksDefaultIds(jobs, viewer, context, kind)
}

/**
 * The My Projects / My Small works list: the jobs of `kind` the viewer sees (`visibleJobs`) whose id is on their list
 * (`myWorksIds`; ids compare without case), in list order — every status, inactive included. A saved id of a job that
 * was deleted or that they no longer see is not shown (it stays stored). Its length is the tab's count.
 */
export function myWorksList<T extends WorksListJob>(
  jobs: ReadonlyArray<T> | null | undefined,
  picks: MyWorksPicks | null | undefined,
  viewer: JobAccessViewer | null | undefined,
  context: WorksListContext | null | undefined,
  kind: WorkCatalogue
): T[] {
  const ids = new Set(myWorksIds(picks, jobs, viewer, context, kind).map(idKey))
  if (ids.size === 0) return []
  return visibleJobs(worksListMembership(jobs, kind), viewer, context).filter((job) => ids.has(idKey(job.id)))
}

/**
 * The ⚙ picker: every job of `kind` the viewer sees, in list order, each with whether it is on their list. The
 * screen shows them all with ticks; `myWorksPicksAfterToggle` gives the list to save.
 */
export function myWorksPickerRows<T extends WorksListJob>(
  jobs: ReadonlyArray<T> | null | undefined,
  picks: MyWorksPicks | null | undefined,
  viewer: JobAccessViewer | null | undefined,
  context: WorksListContext | null | undefined,
  kind: WorkCatalogue
): Array<{ job: T; picked: boolean }> {
  if (!hasMyWorksList(viewer)) return []
  const ids = new Set(myWorksIds(picks, jobs, viewer, context, kind).map(idKey))
  return visibleJobs(worksListMembership(jobs, kind), viewer, context).map((job) => ({ job, picked: ids.has(idKey(job.id)) }))
}

/**
 * The list after ticking (`picked` true) or unticking a job: `current` (the ids `myWorksIds` returned) with `jobId`
 * added at the end or removed, de-duplicated without case, stored case kept. Never more than `MY_WORKS_PICKS_MAX`.
 */
export function myWorksPicksAfterToggle(
  current: ReadonlyArray<string> | null | undefined,
  jobId: string,
  picked: boolean
): string[] {
  const id = typeof jobId === 'string' ? jobId.trim() : ''
  const list = pickList([...(current || [])]) ?? []
  const key = idKey(id)
  const without = list.filter((row) => idKey(row) !== key)
  if (!key) return list
  return (picked ? [...without, id] : without).slice(-MY_WORKS_PICKS_MAX)
}

/**
 * The fields to write on `organizations/{orgId}/worksListPicks/{uid}` (merge) when the person saves one list: that
 * kind's ids and `updatedAt` (the app's server timestamp, passed in). The other kind's list is left as stored.
 */
export function myWorksPicksWriteFields<TTime>(
  kind: WorkCatalogue,
  ids: ReadonlyArray<string>,
  updatedAt: TTime
): { projects?: string[]; smallWorks?: string[]; updatedAt: TTime } {
  const list = (pickList([...(ids || [])]) ?? []).slice(-MY_WORKS_PICKS_MAX)
  return kind === 'smallWorks' ? { smallWorks: list, updatedAt } : { projects: list, updatedAt }
}
