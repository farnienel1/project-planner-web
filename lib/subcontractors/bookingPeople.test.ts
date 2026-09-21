import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findSubcontractorFirm,
  formatSubcontractorBookingLabel,
  idsMatch,
  parseBookedPeopleFields,
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

test('resolveSubcontractorBookingPeople matches dashed and undashed contact ids', () => {
  const dashedFirm = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Acme Electrical',
    contacts: [{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Jane Smith' }],
  }
  assert.deepEqual(
    resolveSubcontractorBookingPeople(
      { bookedContactIds: ['BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'] },
      dashedFirm
    ),
    ['Jane Smith']
  )
  assert.ok(idsMatch('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'))
  assert.equal(
    findSubcontractorFirm([dashedFirm], 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')?.name,
    'Acme Electrical'
  )
})

test('parseBookedPeopleFields reads iOS aliases and object entries', () => {
  assert.deepEqual(
    parseBookedPeopleFields({
      contactIds: ['C1'],
      bookedNames: ['Jane Smith'],
    }),
    { bookedContactIds: ['C1'], bookedOperativeNames: ['Jane Smith'] }
  )
  assert.deepEqual(
    parseBookedPeopleFields({
      bookedContactIds: [{ id: 'C2' }],
      bookedOperativeNames: [{ name: 'Tom Watts' }],
    }),
    { bookedContactIds: ['C2'], bookedOperativeNames: ['Tom Watts'] }
  )
})

test('formatSubcontractorBookingLabel puts people next to the firm', () => {
  assert.equal(formatSubcontractorBookingLabel('Acme Electrical', []), 'Acme Electrical')
  assert.equal(
    formatSubcontractorBookingLabel('Acme Electrical', ['Jane Smith']),
    'Acme Electrical · Jane Smith'
  )
})
