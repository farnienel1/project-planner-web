import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingStatusRepairs, isLegacyPlaceholderBookingRow } from './bookingHealthActions'
import { bookingUpdateWriteFields } from '../canonical/workDocumentReaders'

const booking = (status: string) => ({
  operativeId: 'A1B2C3D4-0000-4000-8000-000000000001',
  projectId: 'A1B2C3D4-0000-4000-8000-000000000002',
  date: { seconds: 1793750400, nanoseconds: 0 },
  timeSlot: 'FULL DAY',
  status,
  bookedBy: 'x',
})

test('Data health "Fix all" re-saves only the status in the rulebook spelling', () => {
  const docs = [
    { id: 'B1', data: booking('confirmed') },
    { id: 'B2', data: booking('Confirmed') },
  ]
  const repairs = bookingStatusRepairs(docs)
  assert.deepEqual(repairs.map((row) => [row.id, row.status]), [['B1', 'Confirmed']])
  // The write is a partial update of `status` alone.
  const write = bookingUpdateWriteFields(repairs[0].data, { ...repairs[0].data, status: repairs[0].status })
  assert.deepEqual(write, { set: { status: 'Confirmed' }, remove: [] })
})

test('Data health "Remove placeholder" is offered only for the INITIAL-PLACEHOLDER row', () => {
  assert.equal(isLegacyPlaceholderBookingRow({ id: 'INITIAL-PLACEHOLDER', kind: 'refused', detail: 'legacy_placeholder' }), true)
  assert.equal(isLegacyPlaceholderBookingRow({ id: 'B1', kind: 'refused', detail: 'missing_date' }), false)
  assert.equal(isLegacyPlaceholderBookingRow({ id: 'INITIAL-PLACEHOLDER', kind: 'missing_job', detail: '' }), false)
})
