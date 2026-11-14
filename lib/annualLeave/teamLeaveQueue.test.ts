/**
 * Owner decision 12 (5 Nov 2026): Home's "Waiting for you" leave count is the Annual leave → Team queue. The queue
 * moved into `teamLeaveQueue.ts` unchanged; this checks it is `leaveDecisionQueue` over the Team tab's people.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { UserRole, type HolidayBooking, type User } from '../../types/index.ts'
import { getPendingHolidayApprovalsForUser } from './holidayApprovalUtils.ts'
import { isPendingHolidayRequest } from '../stores/holidayStore.ts'
import { teamLeaveBookings, teamLeaveDecisionQueue, teamLeavePeople, teamLeaveTab } from './teamLeaveQueue.ts'

function person(id: string, partial: Partial<User> = {}): User {
  return {
    id,
    email: `${id}@site.test`,
    firstName: id,
    surname: 'Test',
    organizationId: 'org',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: { operativeMode: true, manager: false, adminAccess: false, annualLeaveSelfBook: false },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as User
}

const admin = person('admin', { role: UserRole.ADMIN, permissions: { operativeMode: false, manager: false, adminAccess: true } as User['permissions'] })
const mgr = person('mgr', { role: UserRole.MANAGER, permissions: { operativeMode: false, manager: true, adminAccess: false } as User['permissions'], assignedManagerUserIds: ['admin'] } as Partial<User>)
const op1 = person('op1', { assignedManagerUserIds: ['mgr'] } as Partial<User>)
const op2 = person('op2', { assignedManagerUserIds: ['admin'] } as Partial<User>)
const users = [admin, mgr, op1, op2]
const leave = (id: string, userId: string, status: HolidayBooking['status'], start: string): HolidayBooking =>
  ({ id, userId, startDate: new Date(start), endDate: new Date(start), timeSlot: 'FULL DAY', status }) as HolidayBooking
const bookings = [
  leave('L1', 'op1', 'pending', '2026-11-10T00:00:00Z'),
  leave('L2', 'op2', 'pending', '2026-11-12T00:00:00Z'),
  leave('L3', 'op1', 'approved', '2026-11-20T00:00:00Z'),
  leave('L4', 'mgr', 'pending', '2026-11-14T00:00:00Z'),
]

test('1.40.0: the Team list is annualLeaveTeamPeople — admins everyone but themself, managers their reports, operatives nobody', () => {
  const ids = (viewer: User) => teamLeavePeople(viewer, users, []).map((p) => p.userId)
  assert.deepEqual(ids(admin), ['mgr', 'op1', 'op2'])
  assert.deepEqual(ids(mgr), ['op1'])
  assert.deepEqual(ids(op1), [])
  assert.equal(teamLeaveTab(admin, users, []), true)
  assert.equal(teamLeaveTab(mgr, users, []), true)
  assert.equal(teamLeaveTab(op1, users, []), false)
  // A self-booker is still on their line manager's list (owner decision 11 Nov).
  const selfBooker = { ...op1, permissions: { ...op1.permissions, annualLeaveSelfBook: true } } as User
  assert.deepEqual(teamLeavePeople(mgr, [admin, mgr, selfBooker, op2], []).map((p) => p.userId), ['op1'])
})

test('1.40.0: the queue is leaveDecisionQueue over the Team list', () => {
  for (const viewer of [admin, mgr, op1]) {
    const team = teamLeaveBookings(bookings, teamLeavePeople(viewer, users, []))
    const expected = getPendingHolidayApprovalsForUser(team, viewer, users, [])
      .filter((b) => isPendingHolidayRequest(b))
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    assert.deepEqual(teamLeaveDecisionQueue(team, viewer, users, []).map((b) => b.id), expected.map((b) => b.id))
  }
})

test('a line manager decides only their reports; nobody decides their own', () => {
  const queue = (viewer: User) =>
    teamLeaveDecisionQueue(teamLeaveBookings(bookings, teamLeavePeople(viewer, users, [])), viewer, users, []).map((b) => b.id)
  assert.deepEqual(queue(mgr), ['L1'])
  assert.ok(!queue(admin).includes('L3'))
  assert.ok(queue(admin).includes('L4'))
})
