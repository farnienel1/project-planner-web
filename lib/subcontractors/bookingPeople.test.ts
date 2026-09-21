import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatSubcontractorBookingLabel,
  resolveSubcontractorBookingPeople,
} from './bookingPeople.ts'

const firm = {
  id: 'S1',
  name: 'Acme Electrical',
  contacts: [
    { id: 'C1', name: 'Jane Smith' },
    { id: 'C2', name: 'Tom Watts' },
  ],
}

test('resolveSubcontractorBookingPeople prefers stored names', () => {
  assert.deepEqual(
    resolveSubcontractorBookingPeople(
      { bookedContactIds: ['C1'], bookedOperativeNames: ['Jane Smith'] },
      firm
    ),
    ['Jane Smith']
  )
})

test('resolveSubcontractorBookingPeople maps contact ids when names were not stored', () => {
  assert.deepEqual(resolveSubcontractorBookingPeople({ bookedContactIds: ['C2', 'C1'] }, firm), [
    'Tom Watts',
    'Jane Smith',
  ])
})

test('formatSubcontractorBookingLabel puts people next to the firm', () => {
  assert.equal(formatSubcontractorBookingLabel('Acme Electrical', []), 'Acme Electrical')
  assert.equal(
    formatSubcontractorBookingLabel('Acme Electrical', ['Jane Smith']),
    'Acme Electrical · Jane Smith'
  )
})
