/**
 * Rulebook 1.56.0 §9 / §17: the web leave listener's parts come from `leaveQueryPlan` — the whole collection for
 * admins and managers, one `userId in … OR operativeId in …` query for an operative, nothing for no viewer.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leavePlanInputs, leavePlanParts, setLeavePlanInputs } from './readPlan.ts'

const role = (overrides: Record<string, boolean>) => ({
  isAdmin: false,
  isSuperAdmin: false,
  isManager: false,
  isOperativeMode: false,
  ...overrides,
})

test('1.56.0 leavePlanParts: admins and managers keep the whole-collection listener (null)', () => {
  assert.equal(leavePlanParts({ role: role({ isAdmin: true }), ids: ['a'], uid: 'a' } as never, [], 'a@x.com'), null)
  assert.equal(leavePlanParts({ role: role({ isManager: true }), ids: ['m'], uid: 'm' } as never, [], null), null)
})

test('1.56.0 leavePlanParts: an operative gets one composite (or) part over their own ids', () => {
  const parts = leavePlanParts({ role: role({ isOperativeMode: true }), ids: ['UID'], uid: 'UID' } as never, ['UID', 'OP-1'], 'Op@X.com')
  assert.ok(parts)
  assert.equal(parts?.length, 1)
  assert.equal(parts?.[0].id, 'own:UID,OP-1,Op@X.com,op@x.com')
  assert.ok(parts?.[0].filter, 'a composite filter, never a whole-collection part')
  assert.equal(parts?.[0].constraints, undefined)
})

test('1.56.0 leavePlanParts: no viewer → no part at all', () => {
  assert.deepEqual(leavePlanParts(null, ['x'], 'x@y.com'), [])
})

test('1.56.0 setLeavePlanInputs: reports a change only when the ids change', () => {
  assert.equal(setLeavePlanInputs(['b', 'a']), true)
  assert.equal(setLeavePlanInputs(['a', 'b', 'a']), false)
  assert.deepEqual(leavePlanInputs().ownIds, ['a', 'b'])
})
