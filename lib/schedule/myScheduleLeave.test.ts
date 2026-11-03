import assert from 'node:assert/strict'
import test from 'node:test'
import type { HolidayBooking } from '@/types'
import { myScheduleAnnualLeaveLabel, myScheduleLeaveRecords } from './myScheduleLeave'

const LONDON = 'Europe/London'

function leave(partial: Partial<HolidayBooking>): HolidayBooking {
  const at = new Date('2026-11-04T12:00:00Z')
  return {
    id: 'h1',
    organizationId: 'org',
    startDate: at,
    endDate: at,
    startDayKey: '2026-11-04',
    endDayKey: '2026-11-04',
    dayKeyTimeZone: LONDON,
    status: 'approved',
    timeSlot: 'FULL DAY',
    createdAt: at,
    updatedAt: at,
    ...partial,
  }
}

test('1.12.2 My Schedule leave: an admin sees their own approved leave, matched by account in any letter case', () => {
  const admin = { id: 'admin-uid', email: 'boss@test.com', formerUserIds: [] as string[] }
  const rows = [
    leave({ id: 'mine', userId: 'ADMIN-UID' }),
    leave({ id: 'other', userId: 'someone-else' }),
    leave({ id: 'alias', userId: 'old-invite-id', startDayKey: '2026-11-05', endDayKey: '2026-11-05', status: 'pending', timeSlot: 'AM' }),
    // Older iOS builds stored the account's email as userId (1.10.0 leaveRecordsForAccount).
    leave({ id: 'by-email', userId: 'Boss@Test.com', startDayKey: '2026-11-09', endDayKey: '2026-11-09' }),
  ]
  const mine = myScheduleLeaveRecords(admin, rows, [], ['old-invite-id'])
  assert.deepEqual(mine.map((row) => row.id).sort(), ['alias', 'by-email', 'mine'])
  assert.equal(myScheduleAnnualLeaveLabel(mine, new Date('2026-11-04T10:00:00Z'), LONDON), 'Annual Leave - Full Day')
  assert.equal(myScheduleAnnualLeaveLabel(mine, new Date('2026-11-05T10:00:00Z'), LONDON), 'Pending annual leave - AM')
  assert.equal(myScheduleAnnualLeaveLabel(mine, new Date('2026-11-06T10:00:00Z'), LONDON), null)
  // Rejected leave never shows; another person's leave is never matched (never by name).
  assert.equal(myScheduleAnnualLeaveLabel([leave({ userId: 'admin-uid', status: 'rejected' })], new Date('2026-11-04T10:00:00Z'), LONDON), null)
  assert.deepEqual(myScheduleLeaveRecords(null, rows, []), [])
})
