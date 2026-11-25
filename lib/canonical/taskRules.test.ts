/**
 * Rulebook 1.89.0 §34: the owner's tasks pack fixtures (`docs/features/tasks-upgrade/rules/tasks.fixtures.json`, copied
 * into the repo unchanged) run against the rulebook functions. The same cases are in `parity-fixture.json`, which iOS
 * runs through the packed script (`CanonicalParityFixtureTests`), so both apps answer them identically.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  TASK_EDIT_STATUS_OPTIONS,
  homeOverviewMetrics,
  isTaskActive,
  jobTileBadges,
  sortTasksForTab,
  taskAccess,
  taskViewerRole,
  taskActions,
  taskAssigneeDisplay,
  taskAttachmentCheck,
  taskAttachmentSources,
  taskChecklistAfterEdit,
  taskCompleteStep,
  taskDefaultScope,
  taskDueLabel,
  taskEditStatus,
  taskFormErrors,
  taskPriorityKey,
  taskPriorityLabel,
  taskScopeFor,
  taskStatusKey,
  taskStatusLabel,
  taskTabCounts,
  taskTabKeys,
  taskToggleChecklistItem,
  TASK_LEGACY_PRIMARY_ITEM_ID,
} from './index'

type Fixtures = Record<string, any>
const fixtures: Fixtures = JSON.parse(
  readFileSync(new URL('../../docs/features/tasks-upgrade/rules/tasks.fixtures.json', import.meta.url), 'utf8')
)
const ZONE = fixtures.timezone as string
/** The fixtures' "today" at midday in London. */
const TODAY_MS = Date.parse(`${fixtures.today}T12:00:00Z`)

const roles = {
  operative: { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true },
  manager: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false },
  admin: { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false },
} as const

test('pack fixtures: due labels (organisation day, words first)', () => {
  for (const row of fixtures.dueLabels) {
    const now = row.now ? Date.parse(row.now) : TODAY_MS
    const got = taskDueLabel({ status: row.status, dueDate: row.due, completedAt: row.completedAt }, now, ZONE)
    assert.equal(got.label, row.expect.label, row.name)
    assert.equal(got.tone, row.expect.tone, row.name)
    assert.equal(got.overdue, row.expect.overdue, row.name)
  }
})

test('pack fixtures: tabs', () => {
  for (const row of fixtures.tabs) {
    assert.deepEqual(taskTabKeys({ status: row.status, dueDate: row.due }, TODAY_MS, ZONE), row.expect, row.name)
  }
})

test('pack fixtures: legacy values read as the rulebook keys', () => {
  for (const row of fixtures.legacyValues) {
    const got = row.field === 'priority' ? taskPriorityKey(row.stored) : taskStatusKey(row.stored)
    assert.equal(got, row.expect, `${row.field} ${row.stored}`)
  }
  assert.equal(taskPriorityLabel('medium'), 'Normal')
  assert.equal(taskStatusLabel('Done'), 'Completed')
})

test('pack fixtures: actions', () => {
  for (const row of fixtures.actions) {
    const got = taskActions(row.status)
    assert.equal(got.primary, row.expectPrimary, row.status)
    assert.deepEqual(got.available, row.expectAvailable, row.status)
  }
})

test('pack fixtures: Edit offers To do and In progress only', () => {
  assert.deepEqual(TASK_EDIT_STATUS_OPTIONS.map(taskStatusKey), fixtures.editForm.expectStatusOptions)
  assert.equal(taskEditStatus('To Do', 'Completed'), 'To Do')
  assert.equal(taskEditStatus('In Progress', 'To Do'), 'To Do')
  assert.equal(taskEditStatus('Completed', 'To Do'), 'Completed', 'Edit never reopens')
})

test('pack fixtures: complete step', () => {
  for (const row of fixtures.completeStep) {
    const items = (row.checklist as boolean[]).map((_, index) => ({ id: `i${index}` }))
    const completedItemIds = (row.checklist as boolean[]).flatMap((ticked, index) => (ticked ? [`I${index}`] : []))
    const got = taskCompleteStep({ items, completedItemIds })
    assert.equal(got.completeEnabled, row.expect.completeEnabled)
    assert.equal(got.saveProgressEnabled, row.expect.saveProgressEnabled)
    assert.equal(got.hint, row.expect.hint)
  }
  // F25: no checklist section, never a row made from the title.
  assert.equal(taskCompleteStep({ items: [], completedItemIds: [] }).showChecklist, false)
})

test('pack fixtures: attachment sources and checks', () => {
  assert.deepEqual(taskAttachmentSources('ios'), fixtures.attachmentSources.ios)
  assert.deepEqual(taskAttachmentSources('web'), fixtures.attachmentSources.web)
  assert.ok(!taskAttachmentSources('web').includes('camera'), 'issue 2: no camera on web')
  for (const row of fixtures.attachmentValidation) {
    const got = taskAttachmentCheck({
      name: 'file',
      mime: row.mime,
      sizeBytes: row.sizeMb * 1024 * 1024,
      existingFiles: row.existingFiles ?? 0,
    })
    assert.equal(got.result, row.expect, row.name)
    if (row.expectStoredMime) assert.equal(got.storedMime, row.expectStoredMime, row.name)
  }
})

test('pack fixtures: active sort order', () => {
  const sorted = sortTasksForTab(
    fixtures.sortActive.input.map((row: any) => ({ ...row, dueDate: row.due })),
    'active',
    TODAY_MS,
    ZONE
  )
  assert.deepEqual(sorted.map((row) => row.id), fixtures.sortActive.expectOrder)
})

test('pack fixtures: default scope by role', () => {
  for (const row of fixtures.defaultScope) {
    assert.equal(taskDefaultScope(roles[row.role as keyof typeof roles]), row.expect, row.role)
  }
  assert.equal(taskScopeFor(roles.operative, 'everyone'), 'mine', 'an operative is always My tasks')
  assert.equal(taskScopeFor(roles.manager, 'mine'), 'mine', 'a remembered choice is kept')
})

test('task access matches firestore.rules today: only admins delete', () => {
  assert.equal(taskAccess(roles.manager).canDelete, false)
  assert.equal(taskAccess(roles.admin).canDelete, true)
  assert.equal(taskAccess(roles.operative).canEdit, false)
  assert.equal(taskAccess(roles.operative, { isAssignee: true }).canAct, true)
  assert.equal(taskAccess(roles.operative, { isAssignee: false }).canAct, false)
  assert.equal(taskAccess(roles.operative).canCreate, true)
})

test('bug B4: an Edit save keeps every tick of an item still on the checklist', () => {
  const kept = taskChecklistAfterEdit({
    items: [{ id: 'A' }, { id: 'b' }],
    completedItemIds: ['a', 'B', 'gone', TASK_LEGACY_PRIMARY_ITEM_ID, 'a'],
  })
  assert.deepEqual(kept, ['a', 'B', TASK_LEGACY_PRIMARY_ITEM_ID])
  assert.deepEqual(taskToggleChecklistItem(['A'], 'a'), [])
  assert.deepEqual(taskToggleChecklistItem(['A'], 'b'), ['A', 'b'])
})

test('bug B10 / F21: due date required, each error under its own field', () => {
  assert.deepEqual(taskFormErrors({ title: 'x', locationId: 'p', assigneeCount: 1, dueDate: '2026-12-01' }), {})
  const errors = taskFormErrors({ title: ' ', locationId: '', assigneeCount: 0, dueDate: null })
  assert.equal(errors.title, 'Add a task name.')
  assert.equal(errors.location, 'Choose a project or small works.')
  assert.equal(errors.assignees, 'Assign at least one person.')
  assert.equal(errors.dueDate, 'Pick a due date.')
})

test('bug B11: a removed assignee reads Removed user', () => {
  assert.deepEqual(taskAssigneeDisplay(null), { name: 'Removed user', removed: true })
  assert.deepEqual(taskAssigneeDisplay({ firstName: 'Deleted', lastName: 'user', email: '' }), { name: 'Removed user', removed: true })
  assert.deepEqual(taskAssigneeDisplay({ firstName: 'Fin', lastName: 'Donovan', email: 'f@x' }), { name: 'Fin Donovan', removed: false })
})

test('one definition: tab counts equal Home and the job tile counts', () => {
  const tasks = fixtures.sortActive.input.map((row: any) => ({
    id: row.id,
    projectId: 'job-1',
    status: row.status === 'in_progress' ? 'In Progress' : 'To Do',
    dueDate: row.due,
    assignedOperativeIds: ['me'],
  }))
  tasks.push({ id: 'z', projectId: 'job-1', status: 'Completed', dueDate: '2026-09-01', assignedOperativeIds: ['me'] })
  const counts = taskTabCounts(tasks, TODAY_MS, ZONE)
  assert.deepEqual(counts, { active: 6, overdue: 2, completed: 1 })
  const home = homeOverviewMetrics({
    nowMs: TODAY_MS,
    timeZone: ZONE,
    viewer: { id: 'me', email: null },
    roster: [],
    operatives: [],
    managers: [],
    tasks,
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
  } as never)
  assert.equal(home.outstandingTasksAllUsers, counts.active)
  assert.equal(home.tasksOverdue, counts.overdue)
  const tile = jobTileBadges({ jobId: 'job-1', tasks } as never)
  assert.equal(tile.openTasks, counts.active)
  assert.equal(tasks.filter(isTaskActive).length, counts.active)
})

test('1.89.0 §34 review of #452: the task role comes from the person\'s level (a legacy user with no flag is a manager)', () => {
  const legacy = taskViewerRole({ id: 'u1', email: 'old@x.co' })
  assert.deepEqual(legacy, { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false })
  assert.equal(taskAccess(legacy).seesEveryone, true)
  assert.equal(taskAccess(legacy).canDelete, false)
  const strayAdmin = taskViewerRole({ adminAccess: true, operativeMode: true })
  assert.equal(strayAdmin?.isAdmin, true)
  assert.equal(strayAdmin?.isOperativeMode, false)
  assert.equal(taskAccess(strayAdmin).canDelete, true)
  const operative = taskViewerRole({ role: 'operative' })
  assert.equal(taskAccess(operative).seesEveryone, false)
  assert.equal(taskViewerRole({ isSuperAdmin: true })?.isSuperAdmin, true)
  assert.equal(taskViewerRole({ isSuperAdmin: true, organizationSuperAdmin: false })?.isSuperAdmin, false)
  assert.equal(taskViewerRole(null), null)
})
