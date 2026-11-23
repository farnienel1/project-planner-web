/**
 * Owner decision 23 Nov: Annual leave → Team "Who is off" colours, as iOS `HolidayView.teamAway(on:)` — approved leave
 * only (`leaveDayKind` approvedFull / approvedHalf), one person green, two or more the blue tint, initials of the first two.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { HolidayBooking } from '@/types'
import type { AnnualLeavePerson } from './annualLeavePerson'
import { teamAwayCaption, teamAwayInitials, teamAwayOnDay, teamAwayTone } from './teamAway'

const person = (id: string, displayName: string, leaveIds: string[] = [id]): AnnualLeavePerson => ({
  id,
  displayName,
  subtitle: '',
  tradeLabel: '',
  firstNameSort: displayName,
  surnameSort: displayName,
  userId: id,
  leaveIds,
})

const leave = (
  id: string,
  userId: string,
  status: HolidayBooking['status'],
  start: string,
  end = start,
  timeSlot: HolidayBooking['timeSlot'] = 'FULL DAY'
): HolidayBooking => {
  const now = new Date('2026-11-01T00:00:00Z')
  return {
    id,
    organizationId: 'org',
    userId,
    startDate: new Date(`${start}T00:00:00Z`),
    endDate: new Date(`${end}T00:00:00Z`),
    startDayKey: start,
    endDayKey: end,
    dayKeyTimeZone: 'Europe/London',
    status,
    timeSlot,
    createdAt: now,
    updatedAt: now,
  }
}

const day = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const amy = person('amy', 'Amy Bell')
const ben = person('ben', 'Ben Cole', ['ben', 'ben-old'])
const cal = person('cal', 'Cal Dunn')
const people = [amy, ben, cal]

test('approved full and half days count; pending and rejected never do', () => {
  const bookings = [
    leave('1', 'amy', 'approved', '2026-11-24'),
    leave('2', 'ben', 'approved', '2026-11-24', '2026-11-24', 'AM'),
    leave('3', 'cal', 'pending', '2026-11-24'),
    leave('4', 'cal', 'rejected', '2026-11-25'),
  ]
  assert.deepEqual(teamAwayOnDay(day('2026-11-24'), people, bookings).map((p) => p.id), ['amy', 'ben'])
  assert.deepEqual(teamAwayOnDay(day('2026-11-25'), people, bookings), [])
})

test('leave filed under another id the person goes by counts (bookingMatchesPerson)', () => {
  const bookings = [leave('1', 'BEN-OLD', 'approved', '2026-11-26')]
  assert.deepEqual(teamAwayOnDay(day('2026-11-26'), people, bookings).map((p) => p.id), ['ben'])
})

test('a weekend or bank holiday inside a multi-day record is not away (leaveDayKind)', () => {
  const bookings = [leave('1', 'amy', 'approved', '2026-12-24', '2026-12-29')]
  const bank = ['2026-12-25', '2026-12-28']
  assert.equal(teamAwayOnDay(day('2026-12-24'), people, bookings, bank).length, 1)
  assert.equal(teamAwayOnDay(day('2026-12-25'), people, bookings, bank).length, 0)
  assert.equal(teamAwayOnDay(day('2026-12-26'), people, bookings, bank).length, 0)
  assert.equal(teamAwayOnDay(day('2026-12-29'), people, bookings, bank).length, 1)
})

test('colour: nobody none, one person green, two or more the blue tint', () => {
  assert.equal(teamAwayTone(0), 'none')
  assert.equal(teamAwayTone(1), 'one')
  assert.equal(teamAwayTone(2), 'many')
  assert.equal(teamAwayTone(5), 'many')
})

test('caption: initials of up to the first two people away', () => {
  assert.equal(teamAwayCaption([]), null)
  assert.equal(teamAwayCaption(['Amy Bell']), 'AB')
  assert.equal(teamAwayCaption(['Amy Bell', 'Ben Cole', 'Cal Dunn']), 'AB BC')
  assert.equal(teamAwayInitials('Madonna'), 'MA')
})
