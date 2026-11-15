import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project } from '../../types/index.ts'
import { computeOperativeBookingClashWarnings, isExactDuplicateBooking } from './bookingClashUtils.ts'
import { dayKeyInZone } from '../orgTime/zoneTime.ts'

const at = (iso: string) => new Date(iso)
const booking = (id: string, date: string, start: string, end: string, extra: Partial<Booking> = {}): Booking =>
  ({
    id,
    operativeId: 'op1',
    projectId: 'p1',
    date: at(`${date}T00:00:00Z`),
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: start,
    workEndTime: end,
    bookedBy: 'x',
    status: 'Confirmed',
    createdAt: at('2026-11-01T00:00:00Z'),
    updatedAt: at('2026-11-01T00:00:00Z'),
    ...extra,
  }) as Booking
const operative = { id: 'op1', firstName: 'Ada', lastName: 'Site', email: 'ada@x.com' } as Operative
const project = { id: 'p1', jobNumber: 'J1', siteName: 'Site' } as Project

test('1.53.0 B2 an overnight clash is dated on the later day, in the organisation zone', () => {
  const zone = 'Pacific/Auckland'
  // Night shift Mon 22:00–06:00, then Tue 05:00–09:00: the clash is on Tuesday.
  const rows = computeOperativeBookingClashWarnings(
    [
      { ...booking('n', '2026-11-02', '22:00', '06:00'), date: at('2026-11-01T11:00:00Z') },
      { ...booking('t', '2026-11-03', '05:00', '09:00'), date: at('2026-11-02T11:00:00Z') },
    ],
    [operative],
    [project],
    { timeZone: zone }
  )
  assert.equal(rows.length, 1)
  assert.equal(dayKeyInZone(rows[0].date, zone), '2026-11-03')
  assert.match(rows[0].message, /3 Nov 2026/)
})

test('1.53.0 A8 "already booked" is the rulebook booking identity (canonical slot, clock minutes, break toggle)', () => {
  const zone = 'Europe/London'
  const existing = [booking('a', '2026-11-04', '7:30', '16:00', { timeSlot: 'CUSTOM' as never })]
  const slot = { date: at('2026-11-04T00:00:00Z'), slot: 'CUSTOM' as const, workStartTime: '07:30', workEndTime: '16:00' }
  assert.equal(isExactDuplicateBooking(existing, 'p1', 'OP1', slot, { timeZone: zone }), true)
  assert.equal(isExactDuplicateBooking(existing, 'p1', 'op1', { ...slot, workEndTime: '17:00' }, { timeZone: zone }), false)
  assert.equal(isExactDuplicateBooking(existing, 'p1', 'op1', slot, { timeZone: zone, isBreakRemoved: true }), false)
  assert.equal(isExactDuplicateBooking([{ ...existing[0], status: 'Cancelled' }], 'p1', 'op1', slot, { timeZone: zone }), false)
})
