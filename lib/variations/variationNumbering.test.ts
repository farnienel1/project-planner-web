import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newVariationNumberChoice, nextFreeVoNumber, orderForTrackerEnable, voNumberTaken } from './variationNumbering.ts'
import { variationRenumberPlan } from '../canonical/variations.ts'

test('next free number skips gaps and retired numbers', () => {
  assert.equal(nextFreeVoNumber([{ voNumber: 'VO-001' }, { voNumber: 'VO-004' }, { voNumber: 'VO-002' }]), 'VO-005')
  assert.equal(nextFreeVoNumber([]), 'VO-001')
})

test('duplicate check is the display label, not the document id', () => {
  assert.equal(voNumberTaken([{ id: 'a', voNumber: 'VO-004' }], 'vo-004'), true)
  assert.equal(voNumberTaken([{ id: 'a', voNumber: 'VO-004' }], 'VO-004', 'a'), false)
})

test('turning the tracker on orders by number and does not invent a new sequence of labels', () => {
  const rows = orderForTrackerEnable([
    { voNumber: 'VO-010', createdAt: new Date('2026-01-02') },
    { voNumber: 'VO-002', createdAt: new Date('2026-02-01') },
    { voNumber: 'VO-002', createdAt: new Date('2026-01-01') },
  ])
  assert.deepEqual(
    rows.map((row) => row.createdAt.toISOString().slice(0, 10)),
    ['2026-01-01', '2026-02-01', '2026-01-02']
  )
})

test('the tracker preview is the rulebook plan: pinned numbers stay, open numbers slide around them', () => {
  const plan = variationRenumberPlan({
    rows: [
      { id: 'c', status: 'open', voNumber: 'VO-003' },
      { id: 'b', status: 'submitted', voNumber: 'VO-002' },
      { id: 'a', status: 'open', voNumber: 'VO-001' },
    ],
    order: ['c', 'b', 'a'],
  })
  assert.deepEqual(
    plan.rows.map((row) => [row.id, row.to, row.changed]),
    [
      ['c', 'VO-001', true],
      ['b', 'VO-002', false],
      ['a', 'VO-003', true],
    ]
  )
})

test('a new variation saves the number the field shows, typed or suggested, never recomputed (owner 26 Nov)', () => {
  const rows = [
    { id: 'a', voNumber: 'VO-001' },
    { id: 'b', voNumber: 'VO-002' },
    { id: 'c', voNumber: 'VO-004' }, // deleted: its number stays retired
  ]
  assert.equal(nextFreeVoNumber(rows), 'VO-005')
  assert.deepEqual(newVariationNumberChoice('VO-005', rows), { voNumber: 'VO-005', error: null })
  assert.deepEqual(newVariationNumberChoice('  VO-003 ', rows), { voNumber: 'VO-003', error: null })
  assert.match(newVariationNumberChoice('vo-004', rows).error ?? '', /already used/)
  assert.match(newVariationNumberChoice('  ', rows).error ?? '', /Enter a VO number/)
})
