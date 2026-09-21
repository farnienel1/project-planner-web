import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectSubjectDayEntries,
  reportsToManager,
  subjectForUser,
  teamTimesheetUsers,
} from './timesheetWeekUtils.ts'
import type { Booking, Operative, User } from '../../types/index.ts'

function user(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Ada',
    surname: 'Lovelace',
    organizationId: 'org',
    role: 'operative',
    passwordSet: true,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User
}

test('subjectForUser is the signed-in person only, including their operative link', () => {
  const me = user({ id: 'u1', email: 'me@test.com', firstName: 'Me', surname: 'Self' })
  const operatives = [
    { id: 'op1', firstName: 'Me', lastName: 'Self', email: 'me@test.com', qualifications: [] },
    { id: 'op2', firstName: 'Other', lastName: 'Person', email: 'other@test.com', qualifications: [] },
  ] as Operative[]
  const subject = subjectForUser(me, operatives)
  assert.equal(subject.userId, 'u1')
  assert.equal(subject.operativeId, 'op1')
})

test('collectSubjectDayEntries includes a single booked day inside a half-month pay run', () => {
  const subject = {
    key: 'operative:op1',
    kind: 'operative' as const,
    name: 'Me Self',
    userId: 'u1',
    operativeId: 'op1',
  }
  const bookings = [
    { id: 'b1', operativeId: 'op1', date: new Date(Date.UTC(2026, 8, 21, 12, 0, 0)), timeSlot: 'FULL' },
  ] as Booking[]
  const entries = collectSubjectDayEntries({
    subject,
    bookings,
    managerSiteBookings: [],
    weekRange: {
      start: new Date(Date.UTC(2026, 8, 16, 12, 0, 0)),
      end: new Date(Date.UTC(2026, 8, 30, 12, 0, 0)),
    },
    payrollPolicy: { standardPaidHours: 8, unpaidBreakMinutes: 0 } as never,
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].hours, 8)
})

test('teamTimesheetUsers keeps other orgs out: managers only see their reports', () => {
  const manager = user({
    id: 'mgr',
    email: 'mgr@test.com',
    permissions: { ...user({ id: 'x', email: 'x' }).permissions, manager: true, operativeMode: false },
  })
  const report = user({ id: 'r1', email: 'r1@test.com', assignedManagerUserId: 'mgr' })
  const other = user({ id: 'r2', email: 'r2@test.com', assignedManagerUserId: 'someone-else' })
  const roster = teamTimesheetUsers(manager, [report, other, manager])
  assert.deepEqual(
    roster.map((row) => row.id),
    ['r1']
  )
  assert.equal(reportsToManager(other, 'mgr'), false)
})
