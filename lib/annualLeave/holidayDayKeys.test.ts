import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHolidayDocument } from '@/lib/canonical'
import { dateFromDayKeyInZone } from '@/lib/orgTime/zoneTime'
import type { HolidayBooking } from '@/types'
import { holidayBookingDayKeys, holidayBookingLabourInput } from './holidayDayKeys'

const LONDON = 'Europe/London'

function booking(partial: Partial<HolidayBooking>): HolidayBooking {
  const now = new Date('2026-11-01T00:00:00Z')
  return {
    id: 'h',
    organizationId: 'org',
    startDate: now,
    endDate: now,
    status: 'approved',
    timeSlot: 'FULL DAY',
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

test('holidayBookingDayKeys uses the parsed day keys, not the stored instants', () => {
  // A BST-evening instant: parseHolidayDocument reads it as the next organisation day.
  const evening = { seconds: Date.UTC(2026, 6, 14, 23, 30) / 1000, nanoseconds: 0 }
  const parsed = parseHolidayDocument('h', { userId: 'ADMIN', startDate: evening }, LONDON)!
  const row = booking({
    userId: 'ADMIN',
    startDate: dateFromDayKeyInZone(parsed.startDayKey, LONDON),
    endDate: dateFromDayKeyInZone(parsed.endDayKey, LONDON),
    startDayKey: parsed.startDayKey,
    endDayKey: parsed.endDayKey,
    dayKeyTimeZone: LONDON,
  })
  assert.deepEqual(holidayBookingDayKeys(row, LONDON), { startDayKey: '2026-07-15', endDayKey: '2026-07-15' })
  assert.deepEqual(holidayBookingLabourInput(row, LONDON), {
    id: 'h',
    userId: 'ADMIN',
    operativeId: null,
    startDayKey: '2026-07-15',
    endDayKey: '2026-07-15',
    timeSlot: 'FULL DAY',
    approved: true,
  })
})

test('holidayBookingDayKeys falls back to the rulebook conversion for an in-memory row, swapping a reversed range', () => {
  const row = booking({ startDate: new Date('2026-11-13T00:00:00Z'), endDate: new Date('2026-11-09T00:00:00Z') })
  assert.deepEqual(holidayBookingDayKeys(row, LONDON), { startDayKey: '2026-11-09', endDayKey: '2026-11-13' })
  assert.equal(holidayBookingLabourInput({ ...row, status: 'pending' }, LONDON).approved, false)
})
