import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activeUserDayRows,
  buildProjectActiveUsers,
  canViewProjectActiveUsers,
  countProjectActiveUsers,
  formatActiveUserHours,
} from './activeUsers.ts'
import type { User } from '@/types'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'

const policy = { ...DEFAULT_PAYROLL_POLICY, unpaidBreakMinutes: 30 }

function user(partial: Partial<User> & Pick<User, 'id' | 'email'>): User {
  return {
    firstName: '',
    surname: '',
    organizationId: 'org',
    role: 'manager',
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: {
      adminAccess: false,
      manager: true,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: true,
      smallWorks: true,
      operativeMode: false,
    },
    policyAccepted: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  }
}

const project = { managerId: 'mgr-roster', managerIds: ['other'] }

test('formatActiveUserHours rounds to the nearest half hour like iOS', () => {
  assert.equal(formatActiveUserHours(1.5), '1.5')
  assert.equal(formatActiveUserHours(4), '4')
  assert.equal(formatActiveUserHours(1.2), '1')
  assert.equal(formatActiveUserHours(1.3), '1.5')
})

test('admins and assigned managers can open Active users; operatives and other managers cannot', () => {
  const managers = [{ id: 'mgr-roster', email: 'sam@site.test' }]
  assert.equal(
    canViewProjectActiveUsers(user({ id: 'a', email: 'a@x', isSuperAdmin: true, permissions: { ...user({ id: 'a', email: 'a@x' }).permissions, manager: false } }), managers, project),
    true
  )
  assert.equal(canViewProjectActiveUsers(user({ id: 's', email: 'sam@site.test' }), managers, project), true)
  assert.equal(canViewProjectActiveUsers(user({ id: 'o', email: 'other@site.test' }), managers, project), false)
  assert.equal(
    canViewProjectActiveUsers(
      user({
        id: 'op',
        email: 'op@site.test',
        role: 'operative',
        permissions: { ...user({ id: 'op', email: 'op@site.test' }).permissions, operativeMode: true, manager: false },
      }),
      managers,
      project
    ),
    false
  )
})

test('Active users lists booked people, skips cancelled and missing roster rows, and sorts by name', () => {
  const rows = buildProjectActiveUsers({
    projectId: 'job-1',
    payrollPolicy: policy,
    operativeBookings: [
      {
        id: 'b1',
        operativeId: 'op-1',
        projectId: 'job-1',
        date: new Date('2026-03-02T00:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '08:00',
        workEndTime: '10:00',
        status: 'Confirmed',
      },
      {
        id: 'b2',
        operativeId: 'op-1',
        projectId: 'job-1',
        date: new Date('2026-03-04T00:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '08:00',
        workEndTime: '12:00',
        isBreakRemoved: true,
        status: 'Completed',
      },
      {
        id: 'gone',
        operativeId: 'op-1',
        projectId: 'job-1',
        date: new Date('2026-03-05T00:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '08:00',
        workEndTime: '16:00',
        status: 'Cancelled',
      },
      {
        id: 'other-job',
        operativeId: 'op-1',
        projectId: 'job-2',
        date: new Date('2026-03-01T00:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '08:00',
        workEndTime: '16:00',
        status: 'Confirmed',
      },
      {
        id: 'missing-op',
        operativeId: 'op-missing',
        projectId: 'job-1',
        date: new Date('2026-03-01T00:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '08:00',
        workEndTime: '09:00',
        status: 'Confirmed',
      },
    ],
    operatives: [{ id: 'op-1', firstName: 'Zara', lastName: 'Jones' }],
    managerBookings: [
      {
        id: 'm1',
        userId: 'user-1',
        date: new Date('2026-03-03T00:00:00Z'),
        timeSlot: 'custom',
        locationType: 'project',
        locationId: 'job-1',
        workStartTime: '09:00',
        workEndTime: '11:00',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'office',
        userId: 'user-1',
        date: new Date('2026-03-03T00:00:00Z'),
        timeSlot: 'FULL DAY',
        locationType: 'office',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    users: [user({ id: 'user-1', email: 'ada@site.test', firstName: 'Ada', surname: 'Manager' })],
    subcontractorBookings: [
      {
        id: 's1',
        subcontractorId: 'sub-1',
        projectId: 'job-1',
        date: new Date('2026-03-01T00:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '07:00',
        workEndTime: '08:00',
        status: 'Tentative',
      },
      {
        id: 's-cancel',
        subcontractorId: 'sub-1',
        projectId: 'job-1',
        date: new Date('2026-03-06T00:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '07:00',
        workEndTime: '15:00',
        status: 'Cancelled',
      },
      {
        id: 's-missing',
        subcontractorId: 'sub-missing',
        projectId: 'job-1',
        date: new Date('2026-03-01T00:00:00Z'),
        timeSlot: 'FULL DAY',
        status: 'Confirmed',
      },
    ],
    subcontractors: [{ id: 'sub-1', name: 'Brick Co', subcontractorType: 'Brickwork' }],
  })

  assert.deepEqual(
    rows.map((row) => row.displayName),
    ['Ada Manager', 'Brick Co', 'Zara Jones']
  )
  const zara = rows[2]
  assert.equal(zara.subtitle, 'Operative')
  assert.equal(zara.bookingCount, 2)
  assert.equal(zara.initials, 'ZJ')
  assert.equal(formatActiveUserHours(zara.totalHours), '5.5')
  assert.equal(rows[0].subtitle, 'Manager / staff')
  assert.equal(rows[1].subtitle, 'Brickwork')
  assert.equal(
    countProjectActiveUsers({
      projectId: 'job-1',
      operativeBookings: [
        { operativeId: 'op-1', projectId: 'job-1', status: 'Confirmed' },
        { operativeId: 'op-missing', projectId: 'job-1', status: 'Confirmed' },
        { operativeId: 'op-1', projectId: 'job-1', status: 'Cancelled' },
      ],
      managerBookings: [{ userId: 'user-1', locationId: 'job-1', locationType: 'project' }],
      subcontractorBookings: [
        { subcontractorId: 'sub-1', projectId: 'job-1', status: 'Tentative' },
        { subcontractorId: 'sub-missing', projectId: 'job-1', status: 'Confirmed' },
      ],
    }),
    5
  )
})

test('day history is newest first and keeps the clock label', () => {
  const input = {
    projectId: 'job-1',
    payrollPolicy: policy,
    operativeBookings: [
      {
        id: 'early',
        operativeId: 'op-1',
        projectId: 'job-1',
        date: new Date('2026-03-01T12:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '08:00',
        workEndTime: '10:00',
        status: 'Confirmed',
      },
      {
        id: 'late',
        operativeId: 'op-1',
        projectId: 'job-1',
        date: new Date('2026-03-09T12:00:00Z'),
        timeSlot: 'custom',
        workStartTime: '08:00',
        workEndTime: '12:00',
        isBreakRemoved: true,
        status: 'Confirmed',
      },
    ],
    operatives: [],
    managerBookings: [],
    users: [],
    subcontractorBookings: [],
    subcontractors: [],
  }
  const days = activeUserDayRows('op-op-1', input)
  assert.deepEqual(
    days.map((row) => row.id),
    ['late', 'early']
  )
  assert.equal(days[0].scheduleLabel, '08:00–12:00 · no break')
  assert.equal(days[0].hours, 4)
})

test('a staff booking with no user account still appears as Staff member', () => {
  const rows = buildProjectActiveUsers({
    projectId: 'job-1',
    managerBookings: [
      {
        id: 'm1',
        userId: 'ghost',
        date: new Date('2026-04-01T00:00:00Z'),
        timeSlot: 'FULL DAY',
        locationType: 'small_work',
        locationId: 'job-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    operativeBookings: [],
    operatives: [],
    users: [],
    subcontractorBookings: [],
    subcontractors: [],
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].displayName, 'Staff member')
  assert.equal(rows[0].subtitle, 'Staff')
  assert.equal(rows[0].id, 'staff-ghost')
})
