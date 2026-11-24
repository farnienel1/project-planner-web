/**
 * Rulebook 1.89.0 §32 (tasks upgrade, owner pack 24 Nov `docs/features/tasks-upgrade/`): everything about a task that
 * web and iOS must show and decide the same way — status and priority words, due-date wording, the Active / Overdue /
 * Completed tabs and their counts, sorting, the Start / Complete / Reopen actions, the statuses Edit offers, the
 * complete step, the checklist kept through an edit, who may do what, the default scope, attachment limits and
 * sources per platform, the form errors and every message.
 *
 * The pack's own `rules/tasks.rules.json` is expressed here as rulebook functions and constants (one rulebook, never a
 * second JSON file served to the apps). Its keys (`to_do`, `normal`, …) map onto the values both apps already store
 * (`To Do`, `Normal`, …; `PROJECT_TASK_STATUSES`, `PROJECT_TASK_PRIORITIES`): nothing stored is renamed or migrated.
 *
 * The other screens that count tasks (Home `homeOverviewMetrics`, the job tile `jobTileBadges`, My Profile) already
 * read Active as "not completed" (`isTaskCompleted`) and Overdue as `isTaskOverdue`; `taskTabCounts` is built from the
 * same two functions, so every count agrees (canonical.test.ts locks it).
 *
 * Pure, JSON in / JSON out (iOS calls it through `CanonicalBusinessEngine`).
 */

import { calendarDaysBetween, dueDayKey, isTaskCompleted, isTaskOverdue } from './dueDates'
import {
  normalizeProjectTaskPriority,
  normalizeProjectTaskStatus,
  taskCompletionFields,
  type ProjectTaskPriorityToken,
  type ProjectTaskStatusToken,
} from './operationsDocuments'
import { isStaffAccount, type StaffAccountRole } from './staffAccess'

/** The version of the pack's `tasks.rules.json` these rules carry (its `rulebookVersion`). */
export const TASK_RULES_PACK_VERSION = 1

// MARK: - Statuses

export type TaskStatusKey = 'to_do' | 'in_progress' | 'completed'
export type TaskTone = 'grey' | 'blue' | 'green' | 'amber' | 'red'

/** The three statuses, in order: the stored token, the pack key, the label every screen shows and its tone. */
export const TASK_STATUS_OPTIONS: ReadonlyArray<{
  token: ProjectTaskStatusToken
  key: TaskStatusKey
  label: string
  tone: TaskTone
}> = [
  { token: 'To Do', key: 'to_do', label: 'To do', tone: 'grey' },
  { token: 'In Progress', key: 'in_progress', label: 'In progress', tone: 'blue' },
  { token: 'Completed', key: 'completed', label: 'Completed', tone: 'green' },
]

function statusOption(raw: unknown) {
  const token = normalizeProjectTaskStatus(raw)
  return TASK_STATUS_OPTIONS.find((option) => option.token === token) ?? TASK_STATUS_OPTIONS[0]
}

/** "To do" / "In progress" / "Completed" — never "Done" (bug B6: iOS and the project tab said Done). */
export function taskStatusLabel(raw: unknown): string {
  return statusOption(raw).label
}

export function taskStatusKey(raw: unknown): TaskStatusKey {
  return statusOption(raw).key
}

export function taskStatusTone(raw: unknown): TaskTone {
  return statusOption(raw).tone
}

// MARK: - Priorities

export type TaskPriorityKey = 'low' | 'normal' | 'high' | 'urgent'

/** Low / Normal / High / Urgent — never "Medium" (bug B5: the web form and iOS New task said Medium). */
export const TASK_PRIORITY_OPTIONS: ReadonlyArray<{
  token: ProjectTaskPriorityToken
  key: TaskPriorityKey
  label: string
  tone: TaskTone
  rank: number
}> = [
  { token: 'Low', key: 'low', label: 'Low', tone: 'grey', rank: 1 },
  { token: 'Normal', key: 'normal', label: 'Normal', tone: 'blue', rank: 2 },
  { token: 'High', key: 'high', label: 'High', tone: 'amber', rank: 3 },
  { token: 'Urgent', key: 'urgent', label: 'Urgent', tone: 'red', rank: 4 },
]

/** The stored word for a new task's priority. */
export const TASK_DEFAULT_PRIORITY: ProjectTaskPriorityToken = 'Normal'

function priorityOption(raw: unknown) {
  const token = normalizeProjectTaskPriority(raw)
  return TASK_PRIORITY_OPTIONS.find((option) => option.token === token) ?? TASK_PRIORITY_OPTIONS[1]
}

/** A stored priority (any case; `medium` and unknown words read as Normal) as its label. */
export function taskPriorityLabel(raw: unknown): string {
  return priorityOption(raw).label
}

export function taskPriorityKey(raw: unknown): TaskPriorityKey {
  return priorityOption(raw).key
}

export function taskPriorityTone(raw: unknown): TaskTone {
  return priorityOption(raw).tone
}

export function taskPriorityRank(raw: unknown): number {
  return priorityOption(raw).rank
}

// MARK: - Due dates

/** Due within this many days (today included) is "due soon": amber, the weekday shown. */
export const TASK_DUE_SOON_DAYS = 3

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function keyParts(dayKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dayKey.split('-').map(Number)
  return { y, m, d }
}

/** `d MMM yyyy` of a day key ("15 Sep 2026"), never the device's locale. */
export function taskDateText(dayKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return ''
  const { y, m, d } = keyParts(dayKey)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** `d MMM` of a day key ("15 Sep"). */
export function taskShortDateText(dayKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return ''
  const { m, d } = keyParts(dayKey)
  return `${d} ${MONTHS[m - 1]}`
}

function weekdayText(dayKey: string): string {
  const { y, m, d } = keyParts(dayKey)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

export type TaskDueInput = { status?: unknown; dueDate?: unknown; completedAt?: unknown }

export type TaskDueLabel = {
  /** Words first: "70 days overdue", "Due today", "Due Thu", "Due 28 Nov", "Completed 20 Nov", "No due date". */
  label: string
  /** Second line: the date ("15 Sep 2026") for overdue / today / soon, "in 8 days" further out, else null. */
  secondary: string | null
  tone: TaskTone
  overdue: boolean
  /** The due day in the organisation zone, '' when none. */
  dueDayKey: string
  /** Organisation days from today to the due day (negative when overdue); null without a due day. */
  days: number | null
}

/**
 * Rulebook 1.89.0 §32 (F6, F20, fixtures `dueLabels`): a task's due date in words, on the organisation day (never the
 * phone's or browser's). A completed task shows when it was completed and is never overdue; a task with no due date
 * shows "No due date" and is never overdue.
 */
export function taskDueLabel(task: TaskDueInput | null | undefined, nowMs: number, timeZone?: string | null): TaskDueLabel {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now()
  const due = dueDayKey(task?.dueDate, timeZone)
  if (isTaskCompleted({ status: task?.status as string | null | undefined })) {
    const done = dueDayKey(task?.completedAt, timeZone)
    return {
      label: done ? `Completed ${taskShortDateText(done)}` : 'Completed',
      secondary: null,
      tone: 'grey',
      overdue: false,
      dueDayKey: due,
      days: null,
    }
  }
  if (!due) return { label: 'No due date', secondary: null, tone: 'grey', overdue: false, dueDayKey: '', days: null }
  const today = dueDayKey(now, timeZone)
  const days = calendarDaysBetween(today, due)
  if (days < 0) {
    const late = -days
    return {
      label: late === 1 ? '1 day overdue' : `${late} days overdue`,
      secondary: taskDateText(due),
      tone: 'red',
      overdue: true,
      dueDayKey: due,
      days,
    }
  }
  if (days === 0) return { label: 'Due today', secondary: taskDateText(due), tone: 'amber', overdue: false, dueDayKey: due, days }
  if (days === 1) return { label: 'Due tomorrow', secondary: taskDateText(due), tone: 'amber', overdue: false, dueDayKey: due, days }
  if (days <= TASK_DUE_SOON_DAYS) {
    return { label: `Due ${weekdayText(due)}`, secondary: taskDateText(due), tone: 'amber', overdue: false, dueDayKey: due, days }
  }
  return {
    label: `Due ${taskShortDateText(due)}`,
    secondary: `in ${days} days`,
    tone: 'grey',
    overdue: false,
    dueDayKey: due,
    days,
  }
}

// MARK: - Tabs, counts, sorting

export type TaskTabKey = 'active' | 'overdue' | 'completed'

/** The tabs every task list shows, in order (Approvals, the leave approvals of §9, is added by the main page only). */
export const TASK_TABS: ReadonlyArray<{ key: TaskTabKey; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
]

export const TASK_DEFAULT_TAB: TaskTabKey = 'active'

/** Active = not completed (the rule Home, the job tile and My Profile already count with `isTaskCompleted`). */
export function isTaskActive(task: { status?: unknown } | null | undefined): boolean {
  return Boolean(task) && !isTaskCompleted({ status: task?.status as string | null | undefined })
}

/** The tabs a task is listed under (fixtures `tabs`): an overdue task is under Active and Overdue. */
export function taskTabKeys(task: TaskDueInput | null | undefined, nowMs: number, timeZone?: string | null): TaskTabKey[] {
  if (!task) return []
  if (!isTaskActive(task)) return ['completed']
  return isTaskOverdue({ status: task.status as string | null | undefined, dueDate: task.dueDate }, nowMs, timeZone)
    ? ['active', 'overdue']
    : ['active']
}

export function taskInTab(task: TaskDueInput | null | undefined, tab: TaskTabKey, nowMs: number, timeZone?: string | null): boolean {
  return taskTabKeys(task, nowMs, timeZone).includes(tab)
}

/** Counts for the tabs (F5). Active and Overdue overlap on purpose: an overdue task is also active. */
export function taskTabCounts(
  tasks: ReadonlyArray<TaskDueInput | null | undefined> | null | undefined,
  nowMs: number,
  timeZone?: string | null
): Record<TaskTabKey, number> {
  const counts: Record<TaskTabKey, number> = { active: 0, overdue: 0, completed: 0 }
  for (const task of tasks || []) for (const key of taskTabKeys(task, nowMs, timeZone)) counts[key] += 1
  return counts
}

export type TaskSortInput = TaskDueInput & { id?: unknown; title?: unknown; priority?: unknown; updatedAt?: unknown }

function instantMs(raw: unknown): number {
  if (raw == null) return 0
  if (raw instanceof Date) return raw.getTime() || 0
  if (typeof raw === 'number') return raw > 10_000_000_000 ? raw : raw * 1000
  if (typeof raw === 'string') return Date.parse(raw) || 0
  if (typeof raw === 'object') {
    const row = raw as { seconds?: unknown; _seconds?: unknown; toDate?: unknown }
    const seconds = typeof row.seconds === 'number' ? row.seconds : typeof row._seconds === 'number' ? row._seconds : null
    if (seconds != null) return seconds * 1000
    if (typeof row.toDate === 'function') {
      const date = (row.toDate as () => unknown)()
      if (date instanceof Date) return date.getTime() || 0
    }
  }
  return 0
}

/**
 * Rulebook 1.89.0 §32 (F18, fixtures `sortActive`): the order of a tab. Active and Overdue: overdue first (oldest due
 * first), then due date, then higher priority, then title; a task with no due date last. Completed: newest completion
 * first (the last update when no completion time is stored). Returns the given rows, sorted (a new array).
 */
export function sortTasksForTab<T extends TaskSortInput>(
  tasks: ReadonlyArray<T> | null | undefined,
  tab: TaskTabKey,
  nowMs: number,
  timeZone?: string | null
): T[] {
  const rows = [...(tasks || [])].filter(Boolean)
  const title = (row: T) => String(row.title ?? '').toLowerCase()
  if (tab === 'completed') {
    return rows.sort((a, b) => {
      const diff = (instantMs(b.completedAt) || instantMs(b.updatedAt)) - (instantMs(a.completedAt) || instantMs(a.updatedAt))
      return diff !== 0 ? diff : title(a).localeCompare(title(b))
    })
  }
  const keyed = rows.map((row) => ({
    row,
    due: dueDayKey(row.dueDate, timeZone),
    overdue: isTaskOverdue({ status: row.status as string | null | undefined, dueDate: row.dueDate }, nowMs, timeZone),
    rank: taskPriorityRank(row.priority),
  }))
  keyed.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    if (!a.due !== !b.due) return a.due ? -1 : 1
    if (a.due !== b.due) return a.due < b.due ? -1 : 1
    if (a.rank !== b.rank) return b.rank - a.rank
    return title(a.row).localeCompare(title(b.row))
  })
  return keyed.map((entry) => entry.row)
}

// MARK: - Actions and statuses

export type TaskActionKey = 'start' | 'complete' | 'reopen'

export const TASK_ACTION_LABELS: Readonly<Record<TaskActionKey, string>> = {
  start: 'Start',
  complete: 'Complete',
  reopen: 'Reopen',
}

/**
 * Rulebook 1.89.0 §32 (F1, F3, fixtures `actions`): the main action and every action a task offers. To do: Start (one
 * tap, To do → In progress) and Complete (opens the complete step). In progress: Complete. Completed: Reopen (→ In
 * progress). "Carry out" is gone: on both apps it opened the complete step (iOS) or moved the task to In progress
 * (web), now Complete and Start.
 */
export function taskActions(status: unknown): { primary: TaskActionKey; available: TaskActionKey[] } {
  const token = normalizeProjectTaskStatus(status)
  if (token === 'Completed') return { primary: 'reopen', available: ['reopen'] }
  if (token === 'In Progress') return { primary: 'complete', available: ['complete'] }
  return { primary: 'start', available: ['start', 'complete'] }
}

/** The stored status an action moves to. Reopen goes back to In progress (it went to To do on web before 1.89.0). */
export function taskActionStatus(action: TaskActionKey): ProjectTaskStatusToken {
  return action === 'complete' ? 'Completed' : 'In Progress'
}

/**
 * The fields a status change writes (status with `taskCompletionFields`): completed by / at kept when already
 * completed, set on completing, cleared on any other status. `completedBy` is the person's display name.
 */
export function taskStatusChangeFields<T>(
  task: { completedAt?: T | null; completedBy?: string | null } | null | undefined,
  status: unknown,
  input: { completedBy: string; now: T }
): { status: ProjectTaskStatusToken; completedAt: T | null; completedBy: string | null } {
  return { status: normalizeProjectTaskStatus(status), ...taskCompletionFields(task, status, input) }
}

/** Bug B7 (F3, fixtures `editForm`): Edit offers To do and In progress only; Completed goes through Complete. */
export const TASK_EDIT_STATUS_OPTIONS: ReadonlyArray<ProjectTaskStatusToken> = ['To Do', 'In Progress']

/**
 * The status an Edit save writes: a completed task keeps Completed (Edit never reopens or completes); otherwise the
 * chosen status when Edit offers it, else the stored one.
 */
export function taskEditStatus(stored: unknown, chosen: unknown): ProjectTaskStatusToken {
  const current = normalizeProjectTaskStatus(stored)
  if (current === 'Completed') return current
  const next = normalizeProjectTaskStatus(chosen)
  return TASK_EDIT_STATUS_OPTIONS.includes(next) ? next : current
}

// MARK: - Checklist

/** The id iOS builds before 1.89.0 gave the checklist row they made from the task title (never a stored item). */
export const TASK_LEGACY_PRIMARY_ITEM_ID = '00000000-0000-4000-8000-000000000001'

function idKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

export type TaskChecklistInput = {
  items?: ReadonlyArray<{ id?: unknown } | null | undefined> | null
  completedItemIds?: ReadonlyArray<unknown> | null
}

/** Whether a checklist item is ticked (ids without case). */
export function taskItemTicked(task: TaskChecklistInput | null | undefined, itemId: unknown): boolean {
  const key = idKey(itemId)
  return Boolean(key) && (task?.completedItemIds || []).some((id) => idKey(id) === key)
}

/** Tick or untick one item; ids keep their stored case, a tick is never added twice. */
export function taskToggleChecklistItem(completedItemIds: ReadonlyArray<unknown> | null | undefined, itemId: unknown): string[] {
  const key = idKey(itemId)
  const list = (completedItemIds || []).map((id) => String(id ?? '').trim()).filter(Boolean)
  if (!key) return list
  if (list.some((id) => idKey(id) === key)) return list.filter((id) => idKey(id) !== key)
  return [...list, String(itemId).trim()]
}

/**
 * Bug B4: the ticks an Edit save keeps — every tick of an item still on the checklist (and the iOS legacy title row's
 * id, so an older iPhone still reads the task as ticked), in stored case. A removed item's tick goes with it. Edit
 * never resets ticks.
 */
export function taskChecklistAfterEdit(input: TaskChecklistInput | null | undefined): string[] {
  const keep = new Set((input?.items || []).map((item) => idKey(item?.id)).filter(Boolean))
  keep.add(idKey(TASK_LEGACY_PRIMARY_ITEM_ID))
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input?.completedItemIds || []) {
    const id = String(raw ?? '').trim()
    const key = idKey(id)
    if (!key || !keep.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

export type TaskCompleteStep = {
  total: number
  done: number
  remaining: number
  /** Every item ticked (or no checklist). */
  completeEnabled: boolean
  /** Save progress is always offered (F2). */
  saveProgressEnabled: boolean
  /** "Tick 2 more to complete", or null when Complete is on. */
  hint: string | null
  /** Show the Checklist section (F25: not when the task has none — never a row made from the title). */
  showChecklist: boolean
}

/** Rulebook 1.89.0 §32 (F2, F25, fixtures `completeStep`): the complete step, from the task's real items only. */
export function taskCompleteStep(task: TaskChecklistInput | null | undefined): TaskCompleteStep {
  const items = (task?.items || []).map((item) => idKey(item?.id)).filter(Boolean)
  const ticked = new Set((task?.completedItemIds || []).map(idKey))
  const done = items.filter((id) => ticked.has(id)).length
  const remaining = items.length - done
  return {
    total: items.length,
    done,
    remaining,
    completeEnabled: remaining === 0,
    saveProgressEnabled: true,
    hint: remaining === 0 ? null : remaining === 1 ? 'Tick 1 more to complete' : `Tick ${remaining} more to complete`,
    showChecklist: items.length > 0,
  }
}

// MARK: - Who may do what

export type TaskAccess = {
  /** My tasks / Everyone switch shown, and Everyone is the default (F4). */
  seesEveryone: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  /** Start, tick, complete and reopen. */
  canAct: boolean
}

/**
 * Rulebook 1.89.0 §32 (permissions as the apps and `firestore.rules` behave today; the pack's proposal is an owner
 * question): admins and managers outside operative mode see every task and edit any task; only admins (and the
 * super admin) delete — the rules refuse anyone else, web showed Delete to managers before 1.89.0; anyone in the
 * organisation creates a task; staff and the task's assignees start, tick, complete and reopen it.
 */
export function taskAccess(role: StaffAccountRole | null | undefined, input?: { isAssignee?: boolean } | null): TaskAccess {
  const staff = Boolean(role) && isStaffAccount(role as StaffAccountRole)
  const admin = Boolean(role) && !role!.isOperativeMode && (role!.isAdmin || role!.isSuperAdmin)
  return {
    seesEveryone: staff,
    canCreate: Boolean(role),
    canEdit: staff,
    canDelete: admin,
    canAct: staff || input?.isAssignee === true,
  }
}

export type TaskScopeKey = 'mine' | 'everyone'

export const TASK_SCOPES: ReadonlyArray<{ key: TaskScopeKey; label: string }> = [
  { key: 'mine', label: 'My tasks' },
  { key: 'everyone', label: 'Everyone' },
]

/** Bug B9 (F4, fixtures `defaultScope`): staff land on Everyone, operatives on My tasks (they have no switch). */
export function taskDefaultScope(role: StaffAccountRole | null | undefined): TaskScopeKey {
  return taskAccess(role).seesEveryone ? 'everyone' : 'mine'
}

/** A remembered scope is used only when the viewer may have it (an operative is always My tasks). */
export function taskScopeFor(role: StaffAccountRole | null | undefined, remembered: unknown): TaskScopeKey {
  if (!taskAccess(role).seesEveryone) return 'mine'
  return remembered === 'mine' || remembered === 'everyone' ? remembered : taskDefaultScope(role)
}

// MARK: - Assignees

export const TASK_REMOVED_USER_LABEL = 'Removed user'

/**
 * Bug B11: an assignee whose row is gone, or an anonymised deleted profile ("Deleted user"), reads "Removed user" and
 * the task needs reassigning. `row` is the person's catalogue row or null.
 */
export function taskAssigneeDisplay(
  row: { firstName?: unknown; lastName?: unknown; name?: unknown; email?: unknown } | null | undefined
): { name: string; removed: boolean } {
  if (!row) return { name: TASK_REMOVED_USER_LABEL, removed: true }
  const name = `${String(row.firstName ?? '').trim()} ${String(row.lastName ?? '').trim()}`.trim() || String(row.name ?? '').trim()
  const email = String(row.email ?? '').trim()
  if (!email && (!name || name.toLowerCase() === 'deleted user')) return { name: TASK_REMOVED_USER_LABEL, removed: true }
  return { name: name || email, removed: false }
}

// MARK: - Attachments

export type TaskAttachmentSource = 'camera' | 'library' | 'files' | 'site_audit'
export type TaskPlatform = 'ios' | 'android' | 'web'

/** Issue 2 (F16): no camera on web — the browser's file picker offers "Take photo" on a phone. */
export const TASK_ATTACHMENT_SOURCES: Readonly<Record<TaskPlatform, ReadonlyArray<TaskAttachmentSource>>> = {
  ios: ['camera', 'library', 'files', 'site_audit'],
  android: ['camera', 'library', 'files', 'site_audit'],
  web: ['files', 'site_audit'],
}

export const TASK_ATTACHMENT_SOURCE_LABELS: Readonly<Record<TaskAttachmentSource | 'files_web', string>> = {
  camera: 'Take photo',
  library: 'Photo library',
  files: 'Files',
  files_web: 'Upload files',
  site_audit: 'Site audit',
}

export function taskAttachmentSources(platform: unknown): TaskAttachmentSource[] {
  const key = String(platform ?? '').toLowerCase() as TaskPlatform
  return [...(TASK_ATTACHMENT_SOURCES[key] ?? TASK_ATTACHMENT_SOURCES.web)]
}

/**
 * Attachment limits (issue 1). The task document holds photos as a list (`attachedImageURLs`) and one document
 * (`attachedFileURL` / `attachedFileName`, the shape older iPhones read): at most `maxFiles` in all and one PDF.
 * Photos are prepared by each app's §24 photo pipeline (redrawn without location data, at most 2560 px on the long
 * edge — web `stripPhotoLocation`, iOS `uploadTaskImage`). Uploads run `upload.parallel` at a time; one that
 * sends nothing for `upload.stallTimeoutSeconds` is cancelled and shown with Retry / Remove; the SDK retries a
 * request for at most `upload.sdkMaxUploadRetrySeconds`. The file types and the 10 MB cap are the §24 `work` kind
 * (`uploadAllowed`), checked again with the bytes before every upload.
 */
export const TASK_ATTACHMENT_RULES = {
  maxFiles: 10,
  maxDocuments: 1,
  maxSizeMb: 10,
  accepted: [
    { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], label: 'JPG' },
    { mime: 'image/png', extensions: ['png'], label: 'PNG' },
    { mime: 'image/webp', extensions: ['webp'], label: 'WebP' },
    { mime: 'image/heic', extensions: ['heic', 'heif'], label: 'HEIC', storeAs: 'image/jpeg' },
    { mime: 'application/pdf', extensions: ['pdf'], label: 'PDF' },
  ],
  upload: { parallel: 3, stallTimeoutSeconds: 45, maxRetries: 2, sdkMaxUploadRetrySeconds: 60 },
} as const

export type TaskAttachmentCheck = {
  result: 'ok' | 'tooBig' | 'wrongType' | 'tooMany'
  /** The type the file is stored as (HEIC is stored as JPEG once converted). */
  storedMime: string | null
  message: string | null
}

function sizeText(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
}

/**
 * Rulebook 1.89.0 §32 (fixtures `attachmentValidation`): one picked file against the task limits, before any upload:
 * count first (`existingFiles` already on the task or picked), then type, then size (a PDF is never resized; a photo's
 * size is judged after it is scaled). Messages are the pack's.
 */
export function taskAttachmentCheck(input: {
  name?: unknown
  mime?: unknown
  sizeBytes?: unknown
  existingFiles?: unknown
  existingDocuments?: unknown
}): TaskAttachmentCheck {
  const name = String(input?.name ?? '').trim() || 'This file'
  const mime = String(input?.mime ?? '').trim().toLowerCase().replace('image/jpg', 'image/jpeg').replace('image/heif', 'image/heic')
  const existing = Number(input?.existingFiles) || 0
  if (existing >= TASK_ATTACHMENT_RULES.maxFiles) {
    return { result: 'tooMany', storedMime: null, message: `You can attach up to ${TASK_ATTACHMENT_RULES.maxFiles} files.` }
  }
  const accepted = TASK_ATTACHMENT_RULES.accepted.find((row) => row.mime === mime)
  if (!accepted) return { result: 'wrongType', storedMime: null, message: `${name} can’t be attached. Use a photo or PDF.` }
  if (mime === 'application/pdf' && (Number(input?.existingDocuments) || 0) >= TASK_ATTACHMENT_RULES.maxDocuments) {
    return { result: 'tooMany', storedMime: null, message: 'You can attach one PDF to a task. Remove the one there first.' }
  }
  const bytes = Number(input?.sizeBytes) || 0
  if (bytes > TASK_ATTACHMENT_RULES.maxSizeMb * 1024 * 1024) {
    return {
      result: 'tooBig',
      storedMime: null,
      message: `${name} is ${sizeText(bytes)}. The limit is ${TASK_ATTACHMENT_RULES.maxSizeMb} MB.`,
    }
  }
  return { result: 'ok', storedMime: 'storeAs' in accepted ? accepted.storeAs : accepted.mime, message: null }
}

/** The limits line under every attachment picker. */
export const TASK_ATTACHMENT_HELP = `Photos (JPG, PNG, WebP, HEIC) or PDF, up to ${TASK_ATTACHMENT_RULES.maxSizeMb} MB each, ${TASK_ATTACHMENT_RULES.maxFiles} files max`

/** "Uploading 1 of 3 · 57%" on the Save button. */
export function taskUploadProgressText(done: number, total: number, percent: number): string {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  return `Uploading ${Math.min(done + 1, total)} of ${total} · ${p}%`
}

// MARK: - Form

/** The form's field order on both apps (F12; Status in Edit only). */
export const TASK_FORM_ORDER = ['title', 'description', 'location', 'assignees', 'dueDate', 'priority', 'checklist', 'attachments', 'status'] as const

export const TASK_FIELD_LIMITS = { titleMax: 120, descriptionMax: 2000, checklistMaxItems: 30, itemMax: 120, completionNotesMax: 2000 } as const

export type TaskFormDraft = {
  title?: unknown
  locationId?: unknown
  assigneeCount?: unknown
  dueDate?: unknown
  checklistCount?: unknown
}

/**
 * Rulebook 1.89.0 §32 (F21, bug B10): the form's errors, each under its own field. A due date is required for a new
 * task, and an Edit save of a task that has none asks for one. Empty object = the form may save.
 */
export function taskFormErrors(draft: TaskFormDraft | null | undefined): Partial<Record<'title' | 'location' | 'assignees' | 'dueDate' | 'checklist', string>> {
  const out: Partial<Record<'title' | 'location' | 'assignees' | 'dueDate' | 'checklist', string>> = {}
  const title = String(draft?.title ?? '').trim()
  if (!title) out.title = 'Add a task name.'
  else if (title.length > TASK_FIELD_LIMITS.titleMax) out.title = `Keep the task name to ${TASK_FIELD_LIMITS.titleMax} characters.`
  if (!String(draft?.locationId ?? '').trim()) out.location = 'Choose a project or small works.'
  if (!(Number(draft?.assigneeCount) > 0)) out.assignees = 'Assign at least one person.'
  if (!dueDayKey(draft?.dueDate)) out.dueDate = 'Pick a due date.'
  if ((Number(draft?.checklistCount) || 0) > TASK_FIELD_LIMITS.checklistMaxItems) {
    out.checklist = `A checklist can have up to ${TASK_FIELD_LIMITS.checklistMaxItems} items.`
  }
  return out
}

// MARK: - Words

export const TASK_COPY = {
  page: {
    title: 'Tasks',
    subtitle: 'Work across your projects and small works',
    newTask: 'New task',
    searchPlaceholder: 'Search tasks, projects or people',
    searchPlaceholderLocation: 'Search tasks or people',
  },
  empty: {
    active_mine: { title: 'Nothing assigned to you', body: 'Tasks assigned to you will show here.' },
    active_everyone: { title: 'No active tasks', body: 'Create a task to get work moving.' },
    overdue: { title: 'Nothing overdue', body: 'Every active task is on time.' },
    completed: { title: 'No completed tasks yet', body: 'Completed tasks show here with who finished them.' },
    search: { title: 'No tasks match "{query}"', body: 'Try a different word or clear the filters.' },
  },
  form: {
    titleNew: 'New task',
    titleEdit: 'Edit task',
    create: 'Create task',
    save: 'Save changes',
    cancel: 'Cancel',
    me: 'Me',
    addPeople: 'Add people',
    addChecklistItem: 'Add item',
    titleLabel: 'Task',
    titlePlaceholder: 'What needs doing? e.g. Replace fuse board',
    descriptionLabel: 'Details',
    descriptionPlaceholder: 'Anything the team needs to know first',
    locationLabel: 'Project or small works',
    assigneesLabel: 'Assign to',
    dueDateLabel: 'Due date',
    priorityLabel: 'Priority',
    checklistLabel: 'Checklist',
    checklistHelper: 'Assignees tick every item before they can complete the task.',
    checklistEditHelper: 'Ticked items stay ticked when you save. Untick one here if the work needs redoing.',
    attachmentsLabel: 'Attachments',
    statusLabel: 'Status',
    statusCompletedHint: 'To complete a task, use Complete so the checklist and proof of work are captured.',
    unsavedTitle: 'Discard changes?',
    unsavedBody: 'Your changes to this task haven’t been saved.',
    discard: 'Discard',
    keepEditing: 'Keep editing',
  },
  attachments: {
    dropHint: 'Drag photos or PDFs here',
    failed: '{name} didn’t upload',
    retry: 'Retry',
    remove: 'Remove',
    reportProblem: 'Report a problem with this file',
  },
  detail: {
    assigned: 'Assigned to',
    details: 'Details',
    activity: 'Activity',
    edit: 'Edit',
    delete: 'Delete task',
    copyLink: 'Copy link',
    completion: 'Completion',
    reassign: 'Someone on this task was removed. Edit the task to assign someone else.',
  },
  complete: {
    title: 'Complete task',
    proofOfWork: 'Proof of work',
    notesLabel: 'Notes for the manager',
    notesPlaceholder: 'Anything the manager should know about how the job went',
    saveProgress: 'Save progress',
    confirm: 'Complete task',
    back: 'Back',
  },
  delete: {
    title: 'Delete {title}?',
    body: 'This removes the task, its checklist and attachments for everyone on iOS and web.',
    confirm: 'Delete',
  },
  toasts: {
    created: 'Task created',
    saved: 'Changes saved',
    started: 'Task started',
    completed: 'Task completed',
    reopened: 'Task reopened',
    deleted: 'Task deleted',
    progressSaved: 'Progress saved',
    linkCopied: 'Link copied',
  },
  errors: {
    uploadStalled: '{name} stopped uploading. Check your connection and retry.',
    saveFailed: 'The task wasn’t saved. Check your connection and try again.',
    noAccess: 'You don’t have access to this task.',
    deleteRefused: 'Only an admin can delete a task.',
  },
} as const

/** Fill `{name}`-style holes in a `TASK_COPY` string. */
export function taskCopyText(template: unknown, values?: Record<string, unknown> | null): string {
  return String(template ?? '').replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? ''))
}
