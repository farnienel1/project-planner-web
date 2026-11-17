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
