import assert from 'node:assert/strict'
import test from 'node:test'
import { VARIATION_PINNED_MESSAGE, variationRenumberPlan } from '../canonical/variations'
import { trackerOrderAfterMove, trackerRowMovable, variationPinnedMoveText } from './variationTrackerDrag'

test('the locked message names the variation and uses the rulebook text', () => {
  assert.equal(
    variationPinnedMoveText({ voNumber: 'VO-003', status: 'submitted' }),
    `VO-003 is submitted and locked. ${VARIATION_PINNED_MESSAGE}`
  )
  assert.equal(variationPinnedMoveText({ voNumber: 'VO-004', status: 'Closed' }), `VO-004 is closed and locked. ${VARIATION_PINNED_MESSAGE}`)
  assert.equal(variationPinnedMoveText({ voNumber: 'VO-005', status: 'sent' }), VARIATION_PINNED_MESSAGE)
})

test('only open rows can be picked up, and only while dragging is allowed', () => {
  assert.equal(trackerRowMovable({ status: 'open' }, true), true)
  assert.equal(trackerRowMovable({ status: 'open' }, false), false)
  assert.equal(trackerRowMovable({ status: 'submitted' }, true), false)
  assert.equal(trackerRowMovable({ status: 'closed' }, true), false)
  assert.equal(trackerRowMovable({ status: 'complete' }, true), false) // legacy word, pinned by the rulebook
})

test('moving an open row: pinned rows are never a target, the saved plan is the rulebook plan', () => {
  const rows = [
    { id: 'a', voNumber: 'VO-001', status: 'open', sequence: 1 },
    { id: 'b', voNumber: 'VO-002', status: 'submitted', sequence: 2 },
    { id: 'c', voNumber: 'VO-003', status: 'open', sequence: 3 },
  ]
  const open = ['a', 'c']
  assert.equal(trackerOrderAfterMove(open, 'a', 'b'), null) // b is pinned: not in the open order
  assert.equal(trackerOrderAfterMove(open, 'a', 'a'), null)
  const next = trackerOrderAfterMove(open, 'c', 'a')
  assert.deepEqual(next, ['c', 'a'])
  const plan = variationRenumberPlan({ rows, order: next! })
  assert.equal(plan.refused, null)
  assert.deepEqual(plan.rows.map((row) => [row.id, row.to]), [['c', 'VO-001'], ['b', 'VO-002'], ['a', 'VO-003']])
  // An order that would move a pinned row is refused by the rulebook with the same message.
  assert.equal(variationRenumberPlan({ rows, order: ['b', 'a', 'c'] }).refused, VARIATION_PINNED_MESSAGE)
})
