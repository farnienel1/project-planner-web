/**
 * iOS parity source: Core/WorkAccess.swift
 * Spec: docs/ios-parity/01-data-model.md §9
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { visibleWorks } from './workAccess.ts'

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
    hiddenManagerUserIds: [],
    hiddenOperativeUserIds: [],
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
  const jobs = [project('1'), project('2', { hiddenManagerUserIds: ['admin'] })]
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

test('a manager sees jobs they are not assigned to, with both toggles off, in projects and small works', () => {
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
    project('hidden-from-me', { hiddenManagerUserIds: ['m1'] }),
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
  assert.deepEqual(
    visibleWorks({ ...input, catalogue: 'projects' }).map((p) => p.id).sort(),
    ['assigned', 'someone-elses']
  )
  assert.deepEqual(visibleWorks({ ...input, catalogue: 'smallWorks' }).map((p) => p.id), ['small-job'])
  // The manager role without the manager flag is still a manager.
  const roleOnly = { ...mgr, permissions: { ...emptyPerms } }
  assert.deepEqual(
    visibleWorks({ ...input, user: roleOnly, catalogue: 'all' }).map((p) => p.id).sort(),
    ['assigned', 'small-job', 'someone-elses']
  )
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

test('operatives only see booked jobs and never hidden ones', () => {
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

test('managers with the manager flag see non-hidden jobs when Projects is off', () => {
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
