import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activePeopleForAssignment, peopleForTaskPicker } from './taskAssigneePeople.ts'
import type { Manager, Operative } from '../../types/index.ts'
import {
  foldTaskFilterPeople,
  isTaskPersonSelected,
  taskAssigneeNames,
  taskPersonIndex,
  taskPickerExtras,
  toggleTaskPerson,
  type TaskPersonRosterRow,
} from './taskAssigneePeople.ts'
import { applyJobTaskFilter, EMPTY_JOB_TASK_FILTER } from './projectTaskFilters.ts'
import { tasksAssignedToUser } from './taskUtils.ts'
import type { ProjectTask, User } from '../../types/index.ts'

// Owner decision 17 Nov: a person with more than one record appears once in the task pickers.

function manager(partial: Partial<Manager> & { id: string; email: string }): Manager {
  return {
    organizationId: 'ORG',
    firstName: 'Pat',
    lastName: 'Lee',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

function operative(partial: Partial<Operative> & { id: string; email: string }): Operative {
  return {
    organizationId: 'ORG',
    firstName: 'Pat',
    lastName: 'Lee',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

test('combined picker shows a manager once, not again as an operative', () => {
  const result = peopleForTaskPicker(
    [manager({ id: 'm1', email: 'pat@site.com', firstName: 'Pat', lastName: 'Lee' })],
    [operative({ id: 'o1', email: 'pat@site.com', firstName: 'Pat', lastName: 'Lee' })],
    'combined'
  )
  assert.equal(result.managers.length, 1)
  assert.equal(result.operatives.length, 0)
})

test('combined picker drops duplicate operative emails and keeps a true operative', () => {
  const result = peopleForTaskPicker(
    [manager({ id: 'm1', email: 'admin@site.com', firstName: 'Ada', lastName: 'Admin' })],
    [
      operative({ id: 'o1', email: 'op@site.com', firstName: 'Ollie', lastName: 'Op' }),
      operative({ id: 'o2', email: 'op@site.com', firstName: 'Ollie', lastName: 'Op' }),
      operative({ id: 'o3', email: 'admin@site.com', firstName: 'Ada', lastName: 'Admin' }),
    ],
    'combined'
  )
  assert.equal(result.managers.map((row) => row.email).join(','), 'admin@site.com')
  assert.equal(result.operatives.length, 1)
  assert.equal(result.operatives[0].email, 'op@site.com')
})

test('an anonymised Deleted user is not a task assignee', () => {
  const deletedOp = operative({ id: 'OP-DEL', email: '', firstName: 'Deleted', lastName: 'user' })
  const liveOp = operative({ id: 'OP-LIVE', email: 'op@site.com', firstName: 'Ollie', lastName: 'Op' })
  const deletedMgr = manager({ id: 'M-DEL', email: '', firstName: 'Deleted', lastName: 'user' })
  const picker = peopleForTaskPicker([deletedMgr], [deletedOp, liveOp], 'combined')
  assert.equal(picker.managers.length, 0)
  assert.equal(picker.operatives.map((row) => row.id).join(','), 'OP-LIVE')
  assert.deepEqual(
    activePeopleForAssignment([deletedOp, liveOp]).map((row) => row.id),
    ['OP-LIVE']
  )
})

// A converted ghost (rulebook §11): users/ROW-A is the ghost; its old operatives row keeps the id with the email
// cleared; a duplicate row on the old email is linked to it and made inactive (its id on formerUserIds).
const ghostRoster: TaskPersonRosterRow[] = [
  { id: 'ROW-A', email: '', ghost: true, formerUserIds: ['row-b'] },
  { id: 'u-pat', email: 'pat@site.com' },
]
const ghostRow = operative({ id: 'row-a', email: '', firstName: 'Gus', lastName: 'Ghost', linkedUserId: 'ROW-A' })
const ghostDuplicate = operative({
  id: 'row-b',
  email: 'gus@old.com',
  firstName: 'Gus',
  lastName: 'Ghost',
  linkedUserId: 'row-a',
  isActive: false,
})
const patRow = operative({ id: 'op-pat', email: 'pat@site.com', firstName: 'Pat', lastName: 'Lee' })

function task(partial: Partial<ProjectTask>): ProjectTask {
  return { id: 't1', projectId: 'P1', title: 'Task', status: 'To Do', priority: 'Normal', ...partial } as ProjectTask
}

test('a converted ghost and its duplicate row are one person', () => {
  const index = taskPersonIndex({ managers: [], operatives: [ghostRow, ghostDuplicate, patRow], roster: ghostRoster })
  assert.equal(index.keyOf('operative', 'row-a'), index.keyOf('operative', 'row-b'))
  assert.equal(index.keyOf('operative', 'ROW-A'), index.keyOf('operative', 'row-a'))
  assert.notEqual(index.keyOf('operative', 'row-a'), index.keyOf('operative', 'op-pat'))
  assert.equal(index.isGhost(index.keyOf('operative', 'row-a')), true)
  const folded = foldTaskFilterPeople([ghostRow, ghostDuplicate, patRow], 'operative', index)
  assert.deepEqual(folded.map((row) => row.id), ['row-a', 'op-pat'])
})

test('the new-task picker never offers a ghost and lists each person once', () => {
  const active = activePeopleForAssignment([ghostRow, ghostDuplicate, patRow])
  const index = taskPersonIndex({ managers: [], operatives: [ghostRow, ghostDuplicate, patRow], roster: ghostRoster })
  const picker = peopleForTaskPicker([], active, 'operatives', ghostRoster, index)
  assert.deepEqual(picker.operatives.map((row) => row.id), ['op-pat'])
})

test('an operatives row linked to an account is the same person as that account’s managers row', () => {
  const roster: TaskPersonRosterRow[] = [{ id: 'u-ada', email: 'ada@site.com' }]
  const mgr = manager({ id: 'm-ada', email: 'ada@site.com', firstName: 'Ada', lastName: 'Admin' })
  const linked = operative({ id: 'op-ada', email: 'ada.other@site.com', firstName: 'Ada', lastName: 'Admin', linkedUserId: 'U-ADA' })
  const before = peopleForTaskPicker([mgr], [linked], 'combined')
  assert.equal(before.managers.length + before.operatives.length, 2, 'without the roster the link is unknown')
  const after = peopleForTaskPicker([mgr], [linked], 'combined', roster)
  assert.deepEqual(after.managers.map((row) => row.id), ['m-ada'])
  assert.equal(after.operatives.length, 0)
})

test('guardrail 3: a task assigned to an old row id keeps its assignee in the picker, names and filters', () => {
  const all = [ghostRow, ghostDuplicate, patRow]
  const index = taskPersonIndex({ managers: [], operatives: all, roster: ghostRoster })
  const selectedOperatives = new Set(['row-b'])
  // The ghost is not offered, so the old assignment is listed as already assigned (never hidden).
  const extras = taskPickerExtras({
    index,
    shown: [{ kind: 'operative', id: 'op-pat' }],
    selectedManagers: new Set(),
    selectedOperatives,
    allManagers: [],
    allOperatives: all,
  })
  assert.deepEqual(extras, [{ kind: 'operative', id: 'row-b', label: 'Gus Ghost' }])
  assert.equal(isTaskPersonSelected(index, 'operative', 'row-a', new Set(), selectedOperatives), true)
  // Unticking removes every id of the person; nothing else is touched.
  const cleared = toggleTaskPerson(index, 'operative', 'row-a', new Set(), new Set(['row-b', 'row-a', 'op-pat']))
  assert.deepEqual([...cleared.operatives], ['op-pat'])

  const assignedBoth = task({ assignedOperativeIds: ['row-a', 'ROW-B', 'op-pat'] })
  const names = taskAssigneeNames(
    { managerIds: [], operativeIds: ['row-a', 'ROW-B', 'op-pat'] },
    { managers: [], operatives: all, index }
  )
  assert.deepEqual(names.map((entry) => entry.name), ['Gus Ghost', 'Pat Lee'])

  const oldOnly = task({ id: 't2', assignedOperativeIds: ['row-b'] })
  const filtered = applyJobTaskFilter([assignedBoth, oldOnly], { ...EMPTY_JOB_TASK_FILTER, type: 'operative', operativeId: 'row-a' }, index.keyOf)
  assert.deepEqual(filtered.map((row) => row.id), ['t1', 't2'])
  // Without the index the filter is exact, as before.
  assert.deepEqual(
    applyJobTaskFilter([assignedBoth, oldOnly], { ...EMPTY_JOB_TASK_FILTER, type: 'operative', operativeId: 'row-a' }).map((row) => row.id),
    ['t1']
  )
})

test('guardrail 3: My tasks still matches a task assigned to an old operatives row id', () => {
  const viewer = { id: 'u-sam', email: 'sam@site.com', formerUserIds: ['old-row'] } as unknown as User
  const oldRow = operative({ id: 'old-row', email: '', firstName: 'Sam', lastName: 'Smith' })
  const mine = tasksAssignedToUser([task({ assignedOperativeIds: ['old-row'] })], viewer, [oldRow], [], [viewer])
  assert.equal(mine.length, 1)
})

test('ticking a person adds the row shown; a second tick of the same person removes all their ids', () => {
  const all = [patRow, operative({ id: 'op-pat-2', email: 'PAT@site.com', firstName: 'Pat', lastName: 'Lee', isActive: false })]
  const index = taskPersonIndex({ managers: [], operatives: all, roster: ghostRoster })
  const added = toggleTaskPerson(index, 'operative', 'op-pat', new Set(), new Set())
  assert.deepEqual([...added.operatives], ['op-pat'])
  const removed = toggleTaskPerson(index, 'operative', 'op-pat', new Set(), new Set(['op-pat-2']))
  assert.equal(removed.operatives.size, 0)
})

test('review of #364: every record of one person gets the same key (closure first)', () => {
  const roster: TaskPersonRosterRow[] = [
    { id: 'u-a', email: 'a@x' },
    { id: 'u-b', email: 'b@x' },
  ]
  const opA = operative({ id: 'op-a', email: 'b@x', linkedUserId: 'u-a' })
  const opB = operative({ id: 'op-b', email: 'b@x' })
  const index = taskPersonIndex({ managers: [], operatives: [opA, opB], roster })
  assert.equal(index.keyOf('operative', 'op-a'), index.keyOf('operative', 'op-b'))
  assert.equal(index.keyOf('operative', 'op-a'), 'account:u-a')
  const picked = peopleForTaskPicker([], [opA, opB], 'operatives', roster, index)
  assert.equal(picked.operatives.length, 1)
})

test('review of #364: a person is a ghost only when every account is a ghost', () => {
  const roster: TaskPersonRosterRow[] = [
    { id: 'g1', email: 'c@x', ghost: true },
    { id: 'u-c', email: 'c@x' },
  ]
  const opC = operative({ id: 'op-c', email: 'c@x', firstName: 'Cal', lastName: 'Cee' })
  const index = taskPersonIndex({ managers: [], operatives: [opC], roster })
  assert.equal(index.isGhost(index.keyOf('operative', 'op-c')), false)
  const picked = peopleForTaskPicker([], [opC], 'operatives', roster, index)
  assert.deepEqual(picked.operatives.map((row) => row.id), ['op-c'])

  const ghostOnly = taskPersonIndex({ managers: [], operatives: [opC], roster: [{ id: 'g1', email: 'c@x', ghost: true }] })
  assert.equal(ghostOnly.isGhost(ghostOnly.keyOf('operative', 'op-c')), true)
})
