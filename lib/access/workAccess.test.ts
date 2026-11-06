/**
 * iOS parity source: Core/WorkAccess.swift
 * Spec: docs/ios-parity/01-data-model.md §9
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { liveUserIdsOnJob, visibleWorks } from './workAccess.ts'

const emptyPerms = {
  adminAccess: false,
  manager: false,
  operatives: false,
  skills: false,
  qualifications: false,
  materials: false,
  projects: false,
  smallWorks: false,
  operativeMode: false,
  annualLeaveSelfBook: false,
  weeklyReports: false,
  dailyOverview: true,
  subContractors: false,
  siteAudit: true,
  wholesalersOrderHistory: true,
}

function project(id: string, extra: Partial<Project> = {}): Project {
  return {
    id,
    jobNumber: id,
    siteName: `Site ${id}`,
    addressLine1: '',
    townCity: '',
    postcode: '',
    client: { id: 'c', name: 'C', createdAt: new Date(), updatedAt: new Date() },
    startDate: new Date(),
    endDate: new Date(),
    jobType: 'CAT A',
    manager: { name: 'Custom', email: '' },
    isLive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  }
}

test('admins see every job whether the Projects toggle is on or off', () => {
  const admin: User = {
    id: 'admin',
    email: 'a@x.com',
    firstName: 'A',
    surname: 'D',
    organizationId: 'o',
    role: UserRole.ADMIN,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: true,
    permissions: { ...emptyPerms, adminAccess: true, projects: true },
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const jobs = [project('1'), project('2')]
  const visible = visibleWorks({
    projects: jobs,
    user: admin,
    operatives: [],
    bookings: [],
    managerBookings: [],
  })
  assert.equal(visible.length, 2)
  const withoutProjects = visibleWorks({
    projects: jobs,
    user: { ...admin, permissions: { ...admin.permissions, projects: false } },
    operatives: [],
    bookings: [],
    managerBookings: [],
  })
  assert.equal(withoutProjects.length, 2)
  const plainAdminToggleOff = visibleWorks({
    projects: jobs,
    user: { ...admin, isSuperAdmin: false, permissions: { ...admin.permissions, projects: false, smallWorks: false } },
    operatives: [],
    bookings: [],
    managerBookings: [],
  })
  assert.equal(plainAdminToggleOff.length, 2)
})

test('rulebook 1.33.0: a manager sees every job with both toggles off, in projects and small works', () => {
  const mgr: User = {
    id: 'm1',
    email: 'm@x.com',
    firstName: 'M',
    surname: 'G',
    organizationId: 'o',
    role: UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { ...emptyPerms, manager: true, projects: false, smallWorks: false },
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const jobs = [
    project('assigned', { managerIds: ['roster-m'] }),
    project('someone-elses', { managerIds: ['roster-other'] }),
    project('small-job', { jobType: 'Small Works', managerIds: ['roster-other'] }),
    project('my-small-job', { jobType: 'Small Works', managerIds: ['user:m1'] }),
    project('hidden-from-me', { managerIds: ['roster-m'] }),
  ]
  const input = {
    projects: jobs,
    user: mgr,
    operatives: [],
    managers: [
      { id: 'roster-m', firstName: 'M', lastName: 'G', email: 'm@x.com', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'roster-other', firstName: 'O', lastName: 'T', email: 'o@x.com', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ],
    bookings: [],
    managerBookings: [],
  }
  assert.deepEqual(visibleWorks({ ...input, catalogue: 'projects' }).map((p) => p.id).sort(), ['assigned', 'hidden-from-me', 'someone-elses'])
  assert.deepEqual(visibleWorks({ ...input, catalogue: 'smallWorks' }).map((p) => p.id).sort(), ['my-small-job', 'small-job'])
  // Not their job: still listed.
  assert.deepEqual(
    visibleWorks({ ...input, projects: [project('assigned', { managerIds: ['roster-other'] })], catalogue: 'projects' }).map((p) => p.id),
    ['assigned']
  )
  // The manager role without the manager flag is still a manager.
  const roleOnly = { ...mgr, permissions: { ...emptyPerms } }
  assert.equal(visibleWorks({ ...input, user: roleOnly, catalogue: 'all' }).length, 5)
})

test('an account with no staff role still only sees jobs it is assigned to or booked onto', () => {
  const basic: User = {
    id: 'b1',
    email: 'b@x.com',
    firstName: 'B',
    surname: 'A',
    organizationId: 'o',
    role: UserRole.BASIC,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { ...emptyPerms, projects: true },
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const jobs = [project('mine', { managerIds: ['roster-b'] }), project('other')]
  const visible = visibleWorks({
    projects: jobs,
    user: basic,
    operatives: [],
    managers: [
      { id: 'roster-b', firstName: 'B', lastName: 'A', email: 'b@x.com', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ],
    bookings: [],
    managerBookings: [],
  })
  assert.deepEqual(visible.map((p) => p.id), ['mine'])
})

test('operatives only see booked jobs and never ones hidden from them (1.33.0: the operatives\' hide list stays)', () => {
  const opUser: User = {
    id: 'uid',
    email: 'op@x.com',
    firstName: 'O',
    surname: 'P',
    organizationId: 'o',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { ...emptyPerms, operativeMode: true },
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const operative: Operative = {
    id: 'OP1',
    firstName: 'O',
    lastName: 'P',
    email: 'op@x.com',
    startDate: new Date(),
    hourlyRate: 0,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const booking: Booking = {
    id: 'B1',
    operativeId: 'OP1',
    projectId: 'P1',
    date: new Date(),
    timeSlot: 'FULL DAY',
    bookedBy: 'Boss',
    status: 'Confirmed',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const jobs = [
    project('P1'),
    project('P2'),
    project('P1-hidden', { id: 'PH', hiddenOperativeUserIds: ['uid'] }),
  ]
  const visible = visibleWorks({
    projects: jobs,
    user: opUser,
    operatives: [operative],
    bookings: [booking, { ...booking, id: 'B2', projectId: 'PH' }],
    managerBookings: [],
  })
  assert.deepEqual(visible.map((p) => p.id), ['P1'])
})

test('managers with the manager flag see every job when Projects is off (1.33.0)', () => {
  const mgr: User = {
    id: 'm1',
    email: 'm@x.com',
    firstName: 'M',
    surname: 'G',
    organizationId: 'o',
    role: UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { ...emptyPerms, manager: true },
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const jobs = [project('A', { managerIds: ['roster-m'] }), project('B')]
  const visible = visibleWorks({
    projects: jobs,
    user: mgr,
    operatives: [],
    managers: [
      {
        id: 'roster-m',
        firstName: 'M',
        lastName: 'G',
        email: 'm@x.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    bookings: [],
    managerBookings: [],
  })
  assert.deepEqual(visible.map((p) => p.id).sort(), ['A', 'B'])
})

test('an operative with no catalogue row sees jobs booked under their users id or former invite id', () => {
  const rehired: User = {
    id: 'rehiredUid0001',
    email: 'rehired@x.com',
    firstName: 'Re',
    surname: 'Hired',
    organizationId: 'o',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { ...emptyPerms, operativeMode: true },
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    formerUserIds: ['PLACEHOLDER-0001'],
  }
  const booked = (id: string, projectId: string, operativeId: string, status: Booking['status']): Booking => ({
    id,
    operativeId,
    projectId,
    date: new Date('2026-10-20T08:00:00Z'),
    timeSlot: 'FULL DAY',
    bookedBy: 'Admin',
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const visible = visibleWorks({
    projects: [project('by-uid'), project('by-placeholder'), project('completed'), project('cancelled'), project('other')],
    user: rehired,
    operatives: [],
    bookings: [
      booked('1', 'by-uid', 'rehiredUid0001', 'Confirmed'),
      booked('2', 'by-placeholder', 'PLACEHOLDER-0001', 'Tentative'),
      booked('3', 'completed', 'rehiredUid0001', 'Completed'),
      booked('4', 'cancelled', 'rehiredUid0001', 'Cancelled'),
      booked('5', 'other', 'someoneElse', 'Confirmed'),
    ],
    managerBookings: [],
  })
  assert.deepEqual(visible.map((p) => p.id).sort(), ['by-placeholder', 'by-uid', 'completed'])
})

test('liveUserIdsOnJob counts a booking stored under the users id (no Operatives-list row)', () => {
  const solo = {
    id: 'uidSolo01',
    email: 'solo@site.test',
    firstName: 'Solo',
    surname: 'Op',
    organizationId: 'org',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: { ...emptyPerms, operativeMode: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User
  const booking = (operativeId: string) =>
    ({
      id: `b-${operativeId}`,
      operativeId,
      projectId: 'job-1',
      date: new Date(),
      timeSlot: 'FULL DAY',
      bookedBy: 'admin',
      status: 'Confirmed',
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as Booking
  const base = { projectId: 'job-1', managerBookings: [], tasks: [], users: [solo] }
  assert.deepEqual([...liveUserIdsOnJob({ ...base, bookings: [booking('UIDSOLO01')], operatives: [] })], ['uidSolo01'])
  // A catalogue row on the same email still maps to the account.
  const row = { id: 'OP-SOLO', email: 'solo@site.test' } as Operative
  assert.deepEqual([...liveUserIdsOnJob({ ...base, bookings: [booking('OP-SOLO')], operatives: [row] })], ['uidSolo01'])
  // A cancelled booking does not count.
  assert.deepEqual(
    [...liveUserIdsOnJob({ ...base, bookings: [{ ...booking('uidSolo01'), status: 'Cancelled' }], operatives: [] })],
    []
  )
})
