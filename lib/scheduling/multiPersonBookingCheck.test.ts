import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, User } from '../../types/index.ts'
import { MULTI_PERSON_ALREADY_BOOKED_MESSAGE } from '../canonical/index.ts'
import { webMultiPersonBookingBlocks } from './multiPersonBookingCheck.ts'

const ZONE = 'Europe/London'
const users = [
  { id: 'U-ADA', email: 'ada@site.test', formerUserIds: ['OLD-ADA'] },
  { id: 'U-BEN', email: 'ben@site.test' },
] as unknown as User[]
const operatives = [{ id: 'OP-ADA', email: 'ADA@site.test' }] as unknown as Operative[]
const mon = new Date('2026-11-23T12:00:00Z')
const booking = (id: string, operativeId: string, status = 'Confirmed') =>
  ({ id, operativeId, date: mon, status, timeSlot: 'AM' }) as unknown as Booking

const people = [
  { personKey: 'U-ADA', name: 'Ada', id: 'U-ADA' },
  { personKey: 'U-BEN', name: 'Ben', id: 'U-BEN' },
]

test('1.60.0: a multi-person booking names a person already booked that day under their operatives row', () => {
  const blocks = webMultiPersonBookingBlocks({
    people,
    dayKeys: ['2026-11-23'],
    bookings: [booking('B1', 'op-ada')],
    managerSiteBookings: [],
    users,
    operatives,
    timeZone: ZONE,
  })
  assert.deepEqual(blocks.map((b) => [b.personKey, b.dayKeys]), [['U-ADA', ['2026-11-23']]])
  assert.equal(blocks[0].message, MULTI_PERSON_ALREADY_BOOKED_MESSAGE)
})

test('1.60.0: a former id and a manager site booking count; cancelled and one person do not', () => {
  const blocks = webMultiPersonBookingBlocks({
    people,
    dayKeys: ['2026-11-23'],
    bookings: [booking('B1', 'OLD-ADA'), booking('B2', 'U-BEN', 'Cancelled')],
    managerSiteBookings: [{ id: 'M1', userId: 'u-ben', date: mon } as never],
    users,
    operatives,
    timeZone: ZONE,
  })
  assert.deepEqual(blocks.map((b) => b.personKey), ['U-ADA', 'U-BEN'])
  const single = webMultiPersonBookingBlocks({
    people: [people[0]],
    dayKeys: ['2026-11-23'],
    bookings: [booking('B1', 'U-ADA')],
    managerSiteBookings: [],
    users,
    operatives,
    timeZone: ZONE,
  })
  assert.deepEqual(single, [])
  const cancelledOnly = webMultiPersonBookingBlocks({
    people,
    dayKeys: ['2026-11-23'],
    bookings: [booking('B2', 'U-BEN', 'Cancelled')],
    managerSiteBookings: [],
    users,
    operatives,
    timeZone: ZONE,
  })
  assert.deepEqual(cancelledOnly, [])
})

test('1.60.0: Book labour counts the id the booking is written under (bookingOperativeId)', () => {
  const blocks = webMultiPersonBookingBlocks({
    people: [{ ...people[0], extraIds: ['ROW-NO-EMAIL'] }, people[1]],
    dayKeys: ['2026-11-23'],
    bookings: [booking('B1', 'row-no-email')],
    managerSiteBookings: [],
    users,
    operatives: [],
    timeZone: ZONE,
  })
  assert.deepEqual(blocks.map((b) => b.personKey), ['U-ADA'])
})

test('1.60.0: Book labour Continue and the Schedule wizard Confirm wait for the multi-person block', async () => {
  const { readFileSync } = await import('node:fs')
  const flow = readFileSync(new URL('../../components/book-labour/BookLabourFlowScreen.tsx', import.meta.url), 'utf8')
  // Continue does nothing and is disabled while anyone must be removed; the save re-checks.
  assert.match(flow, /if \(selectedBlocks\.length > 0\) return/)
  assert.match(flow, /disabled=\{selectedIds\.size === 0 \|\| continueBlocked\}/)
  assert.match(flow, /const lateBlocks = multiPersonBlocksFor\(people\)/)
  const wizard = readFileSync(new URL('../../components/projects/scheduling/ScheduleOperativeForm.tsx', import.meta.url), 'utf8')
  assert.match(wizard, /jobBookable && !multiBlocked/)
  assert.match(wizard, /allDraftPeopleResolved\(draftPeople\) && !multiBlocked/)
})
