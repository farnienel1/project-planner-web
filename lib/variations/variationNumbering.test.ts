import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextFreeVoNumber, orderForTrackerEnable, previewRenumber, voNumberTaken } from './variationNumbering.ts'

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

test('lock submitted keeps client numbers and slides open numbers around them', () => {
  const preview = previewRenumber(
    [
      { id: 'c', status: 'open', voNumber: 'VO-003' },
      { id: 'b', status: 'submitted', voNumber: 'VO-002' },
      { id: 'a', status: 'open', voNumber: 'VO-001' },
    ],
    'lockSubmitted'
  )
  assert.deepEqual(
    preview.map((row) => [row.id, row.to, row.changed]),
    [
      ['c', 'VO-001', true],
      ['b', 'VO-002', false],
      ['a', 'VO-003', true],
    ]
  )
})

test('renumber everything warns by changing submitted numbers', () => {
  const preview = previewRenumber(
    [
      { id: 'b', status: 'submitted', voNumber: 'VO-009' },
      { id: 'a', status: 'open', voNumber: 'VO-001' },
    ],
    'resequenceAll'
  )
  assert.equal(preview[0].to, 'VO-001')
  assert.equal(preview[0].changed, true)
  assert.equal(preview[1].to, 'VO-002')
})
