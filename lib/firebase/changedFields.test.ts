import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedFirestoreFields, sameFirestoreValue } from './changedFields.ts'

class FakeTimestamp {
  constructor(private readonly ms: number) {}
  toMillis() {
    return this.ms
  }
  isEqual(other: unknown) {
    return other instanceof FakeTimestamp && other.toMillis() === this.ms
  }
}

test('changedFirestoreFields writes only changed and new keys, never deletes', () => {
  const stored = {
    managerNote: 'a',
    managerSignedAt: new FakeTimestamp(5),
    weekStart: new FakeTimestamp(1),
    expenseEntries: [{ id: 'e1', amount: 10 }],
  }
  const next = {
    managerNote: 'b',
    weekStart: new FakeTimestamp(1),
    expenseEntries: [{ id: 'e1', amount: 10 }],
    operativeSignedByName: 'Sam',
  }
  assert.deepEqual(changedFirestoreFields(next, stored), { managerNote: 'b', operativeSignedByName: 'Sam' })
})

test('changedFirestoreFields writes changed map keys as dotted paths', () => {
  const stored = { payrollLineReviews: { l1: { decision: 'approved' }, l2: { decision: 'declined' } } }
  const next = { payrollLineReviews: { l1: { decision: 'approved' }, l2: { decision: 'approved' } } }
  assert.deepEqual(changedFirestoreFields(next, stored), { 'payrollLineReviews.l2.decision': 'approved' })
})

test('changedFirestoreFields replaces arrays and nulls whole', () => {
  assert.deepEqual(changedFirestoreFields({ a: [1, 2] }, { a: [1] }), { a: [1, 2] })
  assert.deepEqual(changedFirestoreFields({ o: null }, { o: { x: 1 } }), { o: null })
  assert.deepEqual(changedFirestoreFields({ o: { x: 1 } }, { o: null }), { o: { x: 1 } })
})

test('sameFirestoreValue compares dates, timestamps and maps', () => {
  assert.equal(sameFirestoreValue(new Date(3), new Date(3)), true)
  assert.equal(sameFirestoreValue(new FakeTimestamp(3), new FakeTimestamp(4)), false)
  assert.equal(sameFirestoreValue({ a: 1, b: undefined }, { a: 1 }), true)
})
