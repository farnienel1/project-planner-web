/**
 * Rulebook 1.91.0 §34 (owner decisions 25 Nov, Tasks follow-ups): who sees which task, the Tasks page filters and
 * sorts, and who the task assignee pickers offer — one rule for web and iOS (pure, JSON in / JSON out, so iOS calls it
 * through `CanonicalBusinessEngine`).
 *
 * - Visibility (decision A): admins outside operative mode see every task; managers (a legacy user with no level flag
 *   is a manager, `permissionLevelOf`) see the tasks on the projects and small works they manage (`isJobManager`,
 *   under every id they go by), plus tasks assigned to them or created by them; operatives see the tasks assigned to
 *   them. Display only: the security rules still let every member read every task (not narrowed).
 * - Filters and sorts (decision B): by project, by small works, by who assigned the task (its creator), by assignee,
 *   priority and due; sorted overdue first (the 1.89.0 tab order), due date earliest first or latest first.
 * - Assignee candidates (owner report 25 Nov): only current people — never an anonymised deleted profile, an inactive
 *   or pending person, a placeholder row, a ghost, or a catalogue row whose person has no users document any more.
 */

import { dueDayKey } from './dueDates'
import { taskViewerIdKeys, tasksAssignedToViewer, type HomeOverviewTask } from './homeOverview'
import { normalizeProjectTaskPriority } from './operationsDocuments'
import { isPlaceholderOperativeRow } from './operativeQualifications'
import { permissionLevelOf } from './permissionLevels'
import { isJobManager, type JobManagerRosterRow } from './staffAccess'
import { taskPersonKeys, type TaskPersonCatalogueRow, type TaskPersonRosterRow } from './taskPeople'
import { sortTasksForTab, taskDueLabel, taskPriorityRank, type TaskSortInput, type TaskTabKey } from './taskRules'
import { isAnonymisedDeletedProfile, isGhostUser, rosterSegment } from './userRosterSegment'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function lower(value: unknown): string {
  return text(value).toLowerCase()
}

// MARK: - Visibility (decision A)

export type TaskVisibilityTask = HomeOverviewTask & {
  id?: string | null
  projectId?: string | null
  createdByUserId?: string | null
}

export type TaskVisibilityJob = {
  id: string
  managerIds?: ReadonlyArray<string> | null
  managerId?: string | null
  managerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserIds?: ReadonlyArray<string> | null
}

export type TaskVisibilityInput<T extends TaskVisibilityTask> = {
  /** The signed-in person's users document (its level decides; `permissionLevelOf`). */
  viewer: ({ id?: string | null; email?: string | null } & Record<string, unknown>) | null | undefined
  tasks: ReadonlyArray<T> | null | undefined
  /** Every project and small works job (stored manager fields). */
  jobs?: ReadonlyArray<TaskVisibilityJob> | null
  /** Users documents of the organisation (unfolded). */
  roster?: ReadonlyArray<TaskPersonRosterRow & { sameEmailUserIds?: ReadonlyArray<string> | null }> | null
  operatives?: ReadonlyArray<{ id: string; email?: string | null }> | null
  managers?: ReadonlyArray<JobManagerRosterRow & { email?: string | null }> | null
}

export type TaskVisibilityReason = 'admin' | 'managesJob' | 'assigned' | 'created'

/** Why the viewer sees each task (absent = not visible), plus whether they see every task of the organisation. */
export function taskVisibility<T extends TaskVisibilityTask>(
  input: TaskVisibilityInput<T>
): { everyTask: boolean; level: 'admin' | 'manager' | 'operative' | null; reasons: Record<string, TaskVisibilityReason> } {
  const tasks = (input?.tasks || []).filter((task) => task && text(task.id))
  const viewer = input?.viewer
  const reasons: Record<string, TaskVisibilityReason> = {}
  if (!viewer || typeof viewer !== 'object' || (!text(viewer.id) && !text(viewer.email))) {
    return { everyTask: false, level: null, reasons }
  }
  const level = permissionLevelOf(viewer)
  if (level === 'admin') {
    for (const task of tasks) reasons[text(task.id)] = 'admin'
    return { everyTask: true, level, reasons }
  }
  const viewerInput = {
    viewer: { id: text(viewer.id) || null, email: text(viewer.email) || null },
    roster: (input.roster || []) as never,
    operatives: input.operatives || [],
    managers: input.managers || [],
  }
  const assigned = new Set(tasksAssignedToViewer({ ...viewerInput, tasks }).map((task) => text(task.id)))
  const ids = taskViewerIdKeys(viewerInput)
  const idSet = new Set(ids)
  const managedJobs = new Set<string>()
  if (level === 'manager') {
    const jobViewer = { ids, email: text(viewer.email) || null }
    for (const job of input.jobs || []) {
      if (job && text(job.id) && isJobManager(jobViewer, job, input.managers || [])) managedJobs.add(lower(job.id))
    }
  }
  for (const task of tasks) {
    const id = text(task.id)
    if (assigned.has(id)) reasons[id] = 'assigned'
    else if (level === 'manager' && lower(task.projectId) && managedJobs.has(lower(task.projectId))) reasons[id] = 'managesJob'
    else if (level === 'manager' && lower(task.createdByUserId) && idSet.has(lower(task.createdByUserId))) reasons[id] = 'created'
  }
  return { everyTask: false, level, reasons }
}

/** The tasks the viewer may see, in the given order (decision A). Every task count and list uses this list. */
export function visibleTasksForViewer<T extends TaskVisibilityTask>(input: TaskVisibilityInput<T>): T[] {
  const { reasons } = taskVisibility(input)
  return (input?.tasks || []).filter((task) => task && Boolean(reasons[text(task.id)]))
}

// MARK: - Filters and sorts (decision B)

export type TaskSortKey = 'overdue_first' | 'due_earliest' | 'due_latest'

export const TASK_SORTS: ReadonlyArray<{ key: TaskSortKey; label: string }> = [
  { key: 'overdue_first', label: 'Overdue first' },
  { key: 'due_earliest', label: 'Due date, earliest first' },
  { key: 'due_latest', label: 'Due date, latest first' },
]

export const TASK_DEFAULT_SORT: TaskSortKey = 'overdue_first'

export type TaskDueFilter = '' | 'overdue' | 'today' | 'week' | 'none'

export const TASK_DUE_FILTERS: ReadonlyArray<{ key: Exclude<TaskDueFilter, ''>; label: string }> = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'none', label: 'No due date' },
]

export type TaskFilters = {
  /** A project id (stored case); '' = any. */
  projectId?: string
  /** A small works id; '' = any. */
  smallWorksId?: string
  /** The creator's person key (`taskCreatorKey`); '' = anyone. */
  creatorKey?: string
  /** An assignee's person key (`taskPersonKeys`); '' = anyone. */
  assigneeKey?: string
  /** A stored priority token (Low / Normal / High / Urgent); '' = any. */
  priority?: string
  due?: TaskDueFilter
}

export const TASK_NO_FILTERS: Required<TaskFilters> = {
  projectId: '',
  smallWorksId: '',
  creatorKey: '',
  assigneeKey: '',
  priority: '',
  due: '',
}

export type TaskFilterTask = TaskSortInput & {
  id?: string | null
  projectId?: string | null
  createdByUserId?: string | null
  createdBy?: string | null
  assignedOperativeId?: string | null
  assignedOperativeIds?: ReadonlyArray<string> | null
  assignedManagerId?: string | null
  assignedManagerIds?: ReadonlyArray<string> | null
}

export type TaskFilterLocation = { id: string; kind: 'project' | 'smallWorks'; code?: string | null; name?: string | null }

/** A person key for an id (the `keys` of `taskPersonKeys`; an id not listed is its own person). */
function personKeyOf(keys: Readonly<Record<string, string>> | null | undefined, id: unknown): string {
  const k = lower(id)
  if (!k) return ''
  return (keys && keys[k]) || `id:${k}`
}

/**
 * Who assigned the task: the person key of its `createdByUserId`; a task stored before 1.10.0 with only the creator's
 * name (`createdBy`) keys on the name (`name:<name>`); a task with neither is '' (it matches no creator filter).
 */
export function taskCreatorKey(task: TaskFilterTask | null | undefined, personKeys: Readonly<Record<string, string>> | null | undefined): string {
  if (!task) return ''
  const id = text(task.createdByUserId)
  if (id) return personKeyOf(personKeys, id)
  const name = lower(task.createdBy)
  return name ? `name:${name.replace(/\s+/g, ' ')}` : ''
}

function assigneeKeys(task: TaskFilterTask, personKeys: Readonly<Record<string, string>> | null | undefined): string[] {
  const ids = [
    ...(task.assignedManagerIds || []),
    task.assignedManagerId,
    ...(task.assignedOperativeIds || []),
    task.assignedOperativeId,
  ]
  return [...new Set(ids.map((id) => personKeyOf(personKeys, id)).filter(Boolean))]
}

function locationMap(locations: ReadonlyArray<TaskFilterLocation> | null | undefined): Map<string, TaskFilterLocation> {
  const map = new Map<string, TaskFilterLocation>()
  for (const row of locations || []) if (row && text(row.id)) map.set(lower(row.id), row)
  return map
}

function rosterName(row: Record<string, unknown> | undefined): string {
  if (!row) return ''
  const full = `${text(row.firstName)} ${text(row.surname) || text(row.lastName)}`.trim()
  return full || text(row.displayName) || text(row.name) || text(row.email)
}

export type TaskFilterOption = { value: string; label: string; count: number }

/**
 * The choices each filter offers for the tasks given (the viewer's visible, scoped list), each with how many of those
 * tasks it would keep: projects and small works that have tasks (code + name), and the people who assigned them
 * (their users document's name, else the stored `createdBy` name, else "Unknown person"). Sorted by label.
 */
export function taskFilterOptions(input: {
  tasks: ReadonlyArray<TaskFilterTask> | null | undefined
  locations: ReadonlyArray<TaskFilterLocation> | null | undefined
  personKeys: Readonly<Record<string, string>> | null | undefined
  roster?: ReadonlyArray<Record<string, unknown> & { id?: unknown }> | null
}): { projects: TaskFilterOption[]; smallWorks: TaskFilterOption[]; creators: TaskFilterOption[] } {
  const locations = locationMap(input.locations)
  const tasks = (input.tasks || []).filter(Boolean)
  const projects = new Map<string, TaskFilterOption>()
  const smallWorks = new Map<string, TaskFilterOption>()
  const creators = new Map<string, TaskFilterOption>()
  const nameByKey = new Map<string, string>()
  for (const row of input.roster || []) {
    const name = rosterName(row)
    const key = personKeyOf(input.personKeys, row.id)
    if (name && key && !nameByKey.has(key)) nameByKey.set(key, name)
  }
  for (const task of tasks) {
    const location = locations.get(lower(task.projectId))
    if (location) {
      const target = location.kind === 'smallWorks' ? smallWorks : projects
      const label = [text(location.code), text(location.name)].filter(Boolean).join(' · ') || 'Untitled'
      const option = target.get(location.id) || { value: location.id, label, count: 0 }
      option.count += 1
      target.set(location.id, option)
    }
    const creator = taskCreatorKey(task, input.personKeys)
    if (creator) {
      const label = nameByKey.get(creator) || text(task.createdBy) || 'Unknown person'
      const option = creators.get(creator) || { value: creator, label, count: 0 }
      option.count += 1
      creators.set(creator, option)
    }
  }
  const sorted = (map: Map<string, TaskFilterOption>) => [...map.values()].sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value))
  return { projects: sorted(projects), smallWorks: sorted(smallWorks), creators: sorted(creators) }
}

/** How many filters are on (for the "Filters (2)" button and Clear all). */
export function taskActiveFilterCount(filters: TaskFilters | null | undefined): number {
  const f = { ...TASK_NO_FILTERS, ...(filters || {}) }
  return [f.projectId, f.smallWorksId, f.creatorKey, f.assigneeKey, f.priority, f.due].filter((value) => text(value)).length
}

/** A remembered filter set read back safely (unknown keys and values dropped). */
export function parseTaskFilters(raw: unknown): Required<TaskFilters> {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const due = text(row.due)
  return {
    projectId: text(row.projectId),
    smallWorksId: text(row.smallWorksId),
    creatorKey: text(row.creatorKey),
    assigneeKey: text(row.assigneeKey),
    priority: text(row.priority) ? normalizeProjectTaskPriority(row.priority) : '',
    due: (['overdue', 'today', 'week', 'none'].includes(due) ? due : '') as TaskDueFilter,
  }
}

/** A remembered sort read back safely (unknown = the default, overdue first). */
export function parseTaskSort(raw: unknown): TaskSortKey {
  return TASK_SORTS.some((row) => row.key === raw) ? (raw as TaskSortKey) : TASK_DEFAULT_SORT
}

/**
 * The tasks every filter keeps (all filters together). Project and small works filters match the task's job id without
 * case; a project filter never keeps a small works task and the reverse. Due filters are on the organisation day
 * (`taskDueLabel`).
 */
export function filterTasks<T extends TaskFilterTask>(
  tasks: ReadonlyArray<T> | null | undefined,
  filters: TaskFilters | null | undefined,
  context: {
    locations: ReadonlyArray<TaskFilterLocation> | null | undefined
    personKeys: Readonly<Record<string, string>> | null | undefined
    nowMs: number
    timeZone?: string | null
  }
): T[] {
  const f = { ...TASK_NO_FILTERS, ...(filters || {}) }
  const locations = locationMap(context.locations)
  const priority = f.priority ? normalizeProjectTaskPriority(f.priority) : ''
  return (tasks || []).filter((task) => {
    if (!task) return false
    const location = locations.get(lower(task.projectId))
    if (f.projectId && !(location?.kind === 'project' && lower(location.id) === lower(f.projectId))) return false
    if (f.smallWorksId && !(location?.kind === 'smallWorks' && lower(location.id) === lower(f.smallWorksId))) return false
    if (priority && normalizeProjectTaskPriority(task.priority) !== priority) return false
    if (f.creatorKey && taskCreatorKey(task, context.personKeys) !== f.creatorKey) return false
    if (f.assigneeKey && !assigneeKeys(task, context.personKeys).includes(f.assigneeKey)) return false
    if (f.due) {
      const due = taskDueLabel(task, context.nowMs, context.timeZone)
      if (f.due === 'overdue' && !due.overdue) return false
      if (f.due === 'today' && due.days !== 0) return false
      if (f.due === 'week' && (due.days == null || due.days < 0 || due.days > 6)) return false
      if (f.due === 'none' && due.dueDayKey) return false
    }
    return true
  })
}

/**
 * Decision B sorts. `overdue_first` is the 1.89.0 tab order (`sortTasksForTab`: overdue first, oldest first, then due
 * date; on Completed newest completion first). `due_earliest` / `due_latest`: by due day on the organisation day, a task
 * with no due date last; ties by higher priority, then title, then id.
 */
export function sortTasks<T extends TaskFilterTask>(
  tasks: ReadonlyArray<T> | null | undefined,
  sort: TaskSortKey | null | undefined,
  tab: TaskTabKey,
  nowMs: number,
  timeZone?: string | null
): T[] {
  const key = parseTaskSort(sort)
  if (key === 'overdue_first') return sortTasksForTab(tasks || [], tab, nowMs, timeZone)
  const rows = (tasks || []).filter(Boolean).map((task) => ({ task, due: dueDayKey(task.dueDate, timeZone) || '' }))
  const sign = key === 'due_earliest' ? 1 : -1
  rows.sort((a, b) => {
    if (a.due !== b.due) {
      if (!a.due) return 1
      if (!b.due) return -1
      return a.due < b.due ? -sign : sign
    }
    const rank = taskPriorityRank(b.task.priority) - taskPriorityRank(a.task.priority)
    if (rank) return rank
    const title = text(a.task.title).localeCompare(text(b.task.title))
    if (title) return title
    return text(a.task.id).localeCompare(text(b.task.id))
  })
  return rows.map((row) => row.task)
}

// MARK: - Assignee candidates (owner report 25 Nov)

export type TaskCandidateRow = TaskPersonCatalogueRow & {
  isActive?: boolean | null
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}

export type TaskCandidateRosterRow = TaskPersonRosterRow & {
  isActive?: unknown
  passwordSet?: unknown
  firstName?: unknown
  surname?: unknown
  lastName?: unknown
  name?: unknown
  displayName?: unknown
}

export type TaskLeftoverRow = {
  kind: 'manager' | 'operative'
  id: string
  name: string
  email: string
  active: boolean
  /** `noAccount`: no users document names this person; `deletedAccount`: every account of theirs is anonymised. */
  reason: 'noAccount' | 'deletedAccount'
}

export type TaskAssigneeCandidates = {
  /** `managers` row ids offered for a new pick (one per person). */
  managerIds: string[]
  /** `operatives` row ids offered for a new pick (one per person). */
  operativeIds: string[]
  /**
   * Row ids (either kind, lower case) whose person no longer exists — a `managers` row with no users document, or an
   * anonymised row. An existing assignment to one reads "Removed user" (the reassign banner, bug B11).
   */
  goneIds: string[]
  /** Catalogue rows left behind with no person (Settings → Data health, read only). Placeholder rows are left out. */
  leftovers: TaskLeftoverRow[]
}

/**
 * Who the task assignee pickers offer (managers and operatives, New task and Edit). A `managers` or `operatives` row is
 * offered when it is active, not a placeholder (`isPlaceholderOperativeRow`), not an anonymised deleted profile, and
 * its person (`taskPersonKeys`: every record of them) has a current users document — Active (`rosterSegment`, so never
 * inactive, pending or anonymised), not a ghost operative, and for a `managers` row at the manager or admin level
 * (`permissionLevelOf`). One row per person per kind: the row with an email first, then the smallest id. A row left
 * behind by an older delete (no users document) is never offered. An assignee already on a task who no longer
 * qualifies stays on the task (the picker lists it ticked, to remove).
 */
export function taskAssigneeCandidates(input: {
  managers: ReadonlyArray<TaskCandidateRow> | null | undefined
  operatives: ReadonlyArray<TaskCandidateRow> | null | undefined
  roster?: ReadonlyArray<TaskCandidateRosterRow> | null
}): TaskAssigneeCandidates {
  const managers = (input?.managers || []).filter((row) => row && text(row.id))
  const operatives = (input?.operatives || []).filter((row) => row && text(row.id))
  const roster = (input?.roster || []).filter((row) => row && text(row.id))
  const { keys } = taskPersonKeys({ managers, operatives, roster })
  type Person = { accounts: TaskCandidateRosterRow[] }
  const people = new Map<string, Person>()
  for (const row of roster) {
    const key = personKeyOf(keys, row.id)
    const person = people.get(key) || { accounts: [] }
    person.accounts.push(row)
    people.set(key, person)
  }
  const current = (account: TaskCandidateRosterRow) =>
    !isGhostUser(account) && !isAnonymisedDeletedProfile(account as never) && rosterSegment(account as never) === 'active'
  const offered = (kind: 'manager' | 'operative', row: TaskCandidateRow) => {
    if (row.isActive === false) return false
    if (isPlaceholderOperativeRow(row)) return false
    if (isAnonymisedDeletedProfile(row as never)) return false
    const person = people.get(personKeyOf(keys, row.id))
    if (!person) return false
    return person.accounts.some((account) => current(account) && (kind === 'operative' || permissionLevelOf(account) !== 'operative'))
  }
  const pick = (kind: 'manager' | 'operative', rows: ReadonlyArray<TaskCandidateRow>) => {
    const best = new Map<string, TaskCandidateRow>()
    const order: string[] = []
    for (const row of rows) {
      if (!offered(kind, row)) continue
      const key = personKeyOf(keys, row.id)
      const existing = best.get(key)
      if (!existing) {
        best.set(key, row)
        order.push(key)
        continue
      }
      const score = (r: TaskCandidateRow) => (lower(r.email) ? 1 : 0)
      if (score(row) > score(existing) || (score(row) === score(existing) && text(row.id) < text(existing.id))) best.set(key, row)
    }
    return order.map((key) => text(best.get(key)!.id))
  }
  const goneIds: string[] = []
  const leftovers: TaskLeftoverRow[] = []
  const scan = (kind: 'manager' | 'operative', rows: ReadonlyArray<TaskCandidateRow>) => {
    for (const row of rows) {
      if (isPlaceholderOperativeRow(row)) continue
      const anonymised = isAnonymisedDeletedProfile(row as never)
      const person = people.get(personKeyOf(keys, row.id))
      const allDeleted = Boolean(person && person.accounts.every((account) => isAnonymisedDeletedProfile(account as never)))
      if (anonymised || (kind === 'manager' && (!person || allDeleted))) goneIds.push(lower(row.id))
      if (!person || allDeleted || anonymised) {
        const name = `${text(row.firstName)} ${text(row.lastName)}`.trim() || text(row.name)
        leftovers.push({
          kind,
          id: text(row.id),
          name: name || text(row.email) || 'No name',
          email: text(row.email),
          active: row.isActive !== false,
          reason: person ? 'deletedAccount' : anonymised ? 'deletedAccount' : 'noAccount',
        })
      }
    }
  }
  scan('manager', managers)
  scan('operative', operatives)
  leftovers.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return { managerIds: pick('manager', managers), operativeIds: pick('operative', operatives), goneIds: [...new Set(goneIds)].sort(), leftovers }
}
