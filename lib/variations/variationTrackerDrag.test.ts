import assert from 'node:assert/strict'
import test from 'node:test'
import { VARIATION_PINNED_MESSAGE, variationRenumberPlan } from '../canonical/variations'
import {
  trackerEdgeScrollDelta,
  trackerOrderAfterMove,
  trackerRowMovable,
  trackerTouchDragEnd,
  trackerTouchDragMove,
  trackerTouchDragStart,
  variationPinnedMoveText,
} from './variationTrackerDrag'

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

test('touch drag state: a lifted finger always ends the drag; only a real move is saved', () => {
  const open = ['a', 'c', 'd']
  assert.equal(trackerTouchDragStart(open, 'b', 1), null) // a pinned row is not in the open order
  const start = trackerTouchDragStart(open, 'a', 7)!
  assert.deepEqual(start, { id: 'a', pointerId: 7, order: ['a', 'c', 'd'], moved: false })
  assert.equal(trackerTouchDragMove(start, null), start)
  assert.equal(trackerTouchDragMove(start, 'b'), start) // over a pinned row: nothing moves
  assert.equal(trackerTouchDragMove(start, 'a'), start)
  assert.equal(trackerTouchDragEnd(start), null) // lifted without moving: nothing to save
  // Dragging down past two rows reads the order from the state, not from a stale render.
  const one = trackerTouchDragMove(start, 'c')
  const two = trackerTouchDragMove(one, 'd')
  assert.deepEqual(two.order, ['c', 'd', 'a'])
  assert.deepEqual(trackerTouchDragEnd(two), ['c', 'd', 'a'])
  assert.deepEqual(open, ['a', 'c', 'd']) // the input is never changed
  assert.equal(trackerTouchDragEnd(null), null)
})

test('edge auto-scroll speed', () => {
  assert.equal(trackerEdgeScrollDelta(400, 0, 800), 0)
  assert.equal(trackerEdgeScrollDelta(0, 0, 800), -16)
  assert.equal(trackerEdgeScrollDelta(32, 0, 800), -8)
  assert.equal(trackerEdgeScrollDelta(800, 0, 800), 16)
  assert.equal(trackerEdgeScrollDelta(760, 0, 800), 6)
  assert.equal(trackerEdgeScrollDelta(10, 0, 0), 0)
  assert.equal(trackerEdgeScrollDelta(Number.NaN, 0, 800), 0)
})
