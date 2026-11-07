import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTaskAssignedToUser } from './taskUtils.ts'
import type { Manager, Operative, ProjectTask, User } from '../../types/index.ts'

/** The helper web used before 1.36.0, kept here only to prove the rulebook test never shows fewer tasks. */
function legacy(task: ProjectTask, user: User | null, operatives: Operative[], managers: Manager[], operativeMode: boolean): boolean {
  const norm = (v?: string | null) => v?.toLowerCase().trim() ?? ''
  const email = norm(user?.email)
  if (!email) return false
  const opIds = operatives.filter((op) => norm(op.email) === email).map((op) => op.id)
  const hasOp = (id: string) => task.assignedOperativeId === id || (task.assignedOperativeIds || []).includes(id)
  if (operativeMode) return opIds.some(hasOp)
  const manager = managers.find((m) => norm(m.email) === email)
  if (manager && (task.assignedManagerId === manager.id || (task.assignedManagerIds || []).includes(manager.id))) return true
  return opIds.some(hasOp)
}

const ada = { id: 'u-ada', email: 'Ada@x.com', formerUserIds: ['INVITE-ADA'], permissions: {} } as unknown as User
const operatives = [
  { id: 'op-ada', email: 'ada@x.com' },
  { id: 'op-bob', email: 'bob@x.com' },
] as Operative[]
const managers = [
  { id: 'mgr-ada-1', email: 'ada@x.com' },
  { id: 'mgr-ada-2', email: 'ADA@x.com' },
  { id: 'mgr-bob', email: 'bob@x.com' },
] as Manager[]

const task = (over: Partial<ProjectTask>) => ({ id: 't', title: 't', status: 'To Do', ...over }) as ProjectTask

const cases: ProjectTask[] = [
  task({ assignedOperativeId: 'op-ada' }),
  task({ assignedOperativeIds: ['op-bob', 'op-ada'] }),
  task({ assignedManagerId: 'mgr-ada-1' }),
  task({ assignedManagerIds: ['mgr-ada-1'] }),
  task({ assignedManagerIds: ['mgr-ada-2'] }),
  task({ assignedOperativeId: 'OP-ADA' }),
  task({ assignedOperativeIds: ['u-ada'] }),
  task({ assignedOperativeIds: ['invite-ada'] }),
  task({ assignedOperativeId: 'op-bob' }),
  task({ assignedManagerId: 'mgr-bob' }),
  task({}),
]

test('1.36.0: tasksAssignedToViewer never shows fewer tasks than the old web helper (guardrail 3)', () => {
  for (const operativeMode of [false, true]) {
    for (const item of cases) {
      if (legacy(item, ada, operatives, managers, operativeMode)) {
        assert.equal(isTaskAssignedToUser(item, ada, operatives, managers), true, JSON.stringify(item))
      }
    }
  }
})

test('1.36.0: tasks under a second managers row, the users id, a former id or another letter case are the viewer\'s', () => {
  const mine = cases.filter((item) => isTaskAssignedToUser(item, ada, operatives, managers))
  assert.equal(mine.length, 8)
  assert.equal(isTaskAssignedToUser(task({ assignedOperativeId: 'op-bob' }), ada, operatives, managers), false)
  assert.equal(isTaskAssignedToUser(task({ assignedManagerId: 'mgr-bob' }), ada, operatives, managers), false)
  assert.equal(isTaskAssignedToUser(task({ assignedOperativeId: 'op-ada' }), null, operatives, managers), false)
})
