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

test('admins see every job', () => {
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
    permissions: { ...emptyPerms, adminAccess: true },
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

test('managers without catalogue flags only see assigned jobs', () => {
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
  assert.deepEqual(visible.map((p) => p.id), ['A'])
})
