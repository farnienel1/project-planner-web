import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareVariationTrackerOrder,
  normalizeVariationStatus,
  variationIsPinned,
  variationRenumberPlan,
  variationStaleNumberLocks,
  variationStatusWriteFields,
  variationTrackerOrder,
} from './variations'
import { parseVariationTrackerDocument, variationTrackerWriteFields } from './recordsDocuments'

// Review of #388, BLOCKER 1: a job whose tracker was never switched on (before 1.63.0 it read as off) has variations
// with no `sequence`, or all 0. Created in this order: B first (VO-002), then A (VO-001), then C (VO-003).
const neverEnabled = [
  { id: 'b-made-first', voNumber: 'VO-002', status: 'open' },
  { id: 'a-made-second', voNumber: 'VO-001', status: 'open', sequence: 0 },
  { id: 'c-made-third', voNumber: 'VO-003', status: 'open' },
]

test('1.63.0 one tracker order: sequence, then VO number, then id — the screen and the plan agree', () => {
  assert.deepEqual(variationTrackerOrder(neverEnabled), ['a-made-second', 'b-made-first', 'c-made-third'])
  const plan = variationRenumberPlan({ rows: neverEnabled })
  assert.deepEqual(plan.rows.map((row) => row.id), variationTrackerOrder(neverEnabled))
  // Stored sequence wins over the number; same sequence and number fall back to the id.
  assert.ok(compareVariationTrackerOrder({ id: 'x', voNumber: 'VO-009', sequence: 1 }, { id: 'y', voNumber: 'VO-001', sequence: 2 }) < 0)
  assert.ok(compareVariationTrackerOrder({ id: 'a', voNumber: 'VO-001' }, { id: 'B', voNumber: 'VO-001' }) < 0)
  // Deleted rows are not in the order.
  assert.deepEqual(variationTrackerOrder([...neverEnabled, { id: 'gone', voNumber: 'VO-004', isDeleted: true }]).includes('gone'), false)
})

test('1.63.0 opening the tracker on a never-enabled job plans no number change', () => {
  const order = variationTrackerOrder(neverEnabled)
  const plan = variationRenumberPlan({ rows: neverEnabled, order })
  assert.deepEqual(plan.rows.filter((row) => row.changed), [])
  assert.equal(plan.refused, null)
  // No order passed (no drag yet): the same.
  assert.deepEqual(variationRenumberPlan({ rows: neverEnabled }).rows.filter((row) => row.changed), [])
})

test('1.63.0 dropping a row back in place changes no number; the only writes are first positions', () => {
  const plan = variationRenumberPlan({ rows: neverEnabled, order: variationTrackerOrder(neverEnabled) })
  assert.deepEqual(plan.changes.filter((row) => row.changed), [])
  // Every write is a position for a row that had none (what switching the tracker on used to assign), never a number.
  for (const row of plan.changes) {
    assert.equal(row.from, row.to)
    assert.equal(row.sequenceChanged, true)
  }
})

test('1.63.0 dragging one row renumbers only the rows it passed', () => {
  const rows = [...neverEnabled, { id: 'd', voNumber: 'VO-004', status: 'open' }]
  // A, B, C, D → drag D above C: A and B are untouched.
  const plan = variationRenumberPlan({ rows, order: ['a-made-second', 'b-made-first', 'd', 'c-made-third'] })
  assert.deepEqual(
    plan.rows.filter((row) => row.changed).map((row) => `${row.id} ${row.from}→${row.to}`),
    ['d VO-004→VO-003', 'c-made-third VO-003→VO-004']
  )
  // A tracker that already has positions: dragging one row the same way changes the same two rows only.
  const positioned = rows.map((row, index) => ({ ...row, sequence: [2, 1, 3, 4][index] }))
  const again = variationRenumberPlan({ rows: positioned, order: ['a-made-second', 'b-made-first', 'd', 'c-made-third'] })
  assert.deepEqual(again.changes.map((row) => row.id).sort(), ['c-made-third', 'd'])
})

test('1.63.0 variationStaleNumberLocks: Open rows that still store the lock, never pinned or deleted rows', () => {
  assert.deepEqual(
    variationStaleNumberLocks([
      { id: 'reopened', status: 'open', voNumberLocked: true },
      { id: 'submitted', status: 'submitted', voNumberLocked: true },
      { id: 'legacy-sent', status: 'sent', voNumberLocked: true },
      { id: 'open-unlocked', status: 'open', voNumberLocked: false },
      { id: 'deleted', status: 'open', voNumberLocked: true, isDeleted: true },
      { id: '', status: 'open', voNumberLocked: true },
    ]),
    ['reopened']
  )
  assert.deepEqual(variationStaleNumberLocks(null), [])
})

test('1.63.0 the status write and the pin read the status the same way (legacy words included)', () => {
  for (const word of ['open', 'Open', 'submitted', 'SENT', 'closed', 'complete', 'completed', 'done', 'weird', '', null]) {
    const write = variationStatusWriteFields(word)
    assert.equal(write.status, normalizeVariationStatus(word))
    assert.equal(write.voNumberLocked, variationIsPinned({ status: word }), String(word))
  }
  assert.deepEqual(variationStatusWriteFields('sent'), { status: 'submitted', voNumberLocked: true })
  assert.deepEqual(variationStatusWriteFields('done'), { status: 'closed', voNumberLocked: true })
})

test('1.63.0 tracker on by default: a missing document reads enabled; a stored false stays off', () => {
  assert.equal(parseVariationTrackerDocument('job-1', null).enabled, true)
  assert.equal(parseVariationTrackerDocument('job-1', { orderLocked: true }).enabled, true)
  assert.equal(parseVariationTrackerDocument('job-1', { enabled: false }).enabled, false)
})

test('1.63.0 turning off a tracker that has no document creates it with enabled: false and its parent', () => {
  const write = variationTrackerWriteFields(null, { kind: 'disable', parentId: 'job-1', parentType: 'project' } as never)
  assert.ok(write)
  const set = (write as { set: Record<string, unknown> }).set
  assert.equal(set.enabled, false)
  assert.equal(set.parentId, 'job-1')
  assert.equal(set.parentType, 'project')
})
