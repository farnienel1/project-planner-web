import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import { lineManagerLabelResolver, lineManagerRosterRows, memberLineManagerLabel } from './memberLineManagerLabel.ts'

function person(id: string, partial: Partial<User> = {}): User {
  return {
    id,
    email: `${id}@test.com`,
    firstName: id,
    surname: 'Test',
    organizationId: 'org',
    role: 'manager',
    passwordSet: true,
    policyAccepted: true,
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: { adminAccess: false, manager: true, operativeMode: false },
    ...partial,
  } as User
}

test('a line manager stored under a folded-away same-email document is named (was "Unknown")', () => {
  const live = person('mgr-live', { email: 'jo@test.com', firstName: 'Jo' })
  const old = person('mgr-old', { email: 'JO@test.com', firstName: 'Stale', passwordSet: false })
  const luke = person('luke', { firstName: 'Luke', assignedManagerUserIds: ['mgr-old'], permissions: { operativeMode: true } as User['permissions'] })
  // The folded roster (`users`) keeps only the live document; the unfolded documents hold both.
  const folded = [live, luke]
  const roster = lineManagerRosterRows([live, old, luke], folded)
  assert.equal(memberLineManagerLabel(luke, roster), 'Jo Test')
})

test('a line manager stored under a former invite id or another letter case is named', () => {
  const mgr = person('MGR-1', { firstName: 'Sam', formerUserIds: ['invite-9'] })
  const a = person('a', { assignedManagerUserIds: ['invite-9'] })
  const b = person('b', { assignedManagerUserId: 'mgr-1' })
  assert.equal(memberLineManagerLabel(a, [mgr, a]), 'Sam Test')
  assert.equal(memberLineManagerLabel(b, [mgr, b]), 'Sam Test')
})

test('not set, no line manager and an id nobody goes by use the rulebook words', () => {
  assert.equal(memberLineManagerLabel(person('x'), []), 'Not set')
  assert.equal(memberLineManagerLabel(person('y', { hasNoLineManager: true }), []), 'No line manager')
  assert.equal(memberLineManagerLabel(person('z', { assignedManagerUserIds: ['gone'] }), []), 'Unknown person')
})

test('two line managers read "First +1 more"', () => {
  const m1 = person('m1', { firstName: 'Ann' })
  const m2 = person('m2', { firstName: 'Bob' })
  const op = person('op', { assignedManagerUserIds: ['m1', 'm2'] })
  assert.equal(memberLineManagerLabel(op, [m1, m2, op]), 'Ann Test +1 more')
})

test('roster rows: unfolded documents first, each id once', () => {
  const a = person('a', { firstName: 'Doc' })
  const aFolded = person('a', { firstName: 'Folded' })
  const rows = lineManagerRosterRows([a], [aFolded, person('b')])
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b'])
  assert.equal(rows[0].firstName, 'Doc')
})

test('resolver: one roster build, labels cached per stored line manager, same answers', () => {
  const managers = Array.from({ length: 20 }, (_, i) => person(`m${i}`, { firstName: `M${i}` }))
  const ops = Array.from({ length: 300 }, (_, i) =>
    person(`op${i}`, { assignedManagerUserIds: [`m${i % 20}`], permissions: { operativeMode: true } as User['permissions'] })
  )
  const roster = [...managers, ...ops]
  const started = Date.now()
  const label = lineManagerLabelResolver(roster)
  const labels = ops.slice(0, 100).map(label)
  const elapsed = Date.now() - started
  assert.equal(labels[0], 'M0 Test')
  assert.equal(labels[21], 'M1 Test')
  assert.equal(label(ops[5]), memberLineManagerLabel(ops[5], roster))
  assert.ok(elapsed < 1500, `100 rows over 320 users took ${elapsed} ms`)
})

test('whose-turn name: the live document by name, never the email; null for none or several', async () => {
  const { soleLineManagerName } = await import('./memberLineManagerLabel.ts')
  const live = person('mgr-live', { email: 'jo@test.com', firstName: 'Jo' })
  const old = person('mgr-old', { email: 'JO@test.com', firstName: 'Stale', passwordSet: false })
  const luke = person('luke', { assignedManagerUserIds: ['mgr-old'] })
  assert.equal(soleLineManagerName(luke, lineManagerRosterRows([live, old, luke], [live, luke])), 'Jo Test')
  assert.equal(soleLineManagerName(person('x'), [live]), null)
  assert.equal(soleLineManagerName(person('y', { assignedManagerUserIds: ['gone'] }), [live]), null)
  const two = person('z', { assignedManagerUserIds: ['mgr-live', 'm2'] })
  assert.equal(soleLineManagerName(two, [live, person('m2'), two]), null)
})
