import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Booking, type Operative, type Project, type User } from '../../types/index.ts'
import type { ManagerSiteBooking } from './managerSiteBookingUtils.ts'
import { buildDraftPersonDayStates } from './draftProjectBooking.ts'
import type { ScheduleDateSlot } from './scheduleUtils.ts'
import type { SchedulablePerson } from './scheduleRosterUtils.ts'

const DAY = new Date('2026-09-22T12:00:00+01:00')

function perms(partial: Partial<User['permissions']> = {}): User['permissions'] {
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

function user(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Ada',
    surname: 'Admin',
    organizationId: 'org',
    role: UserRole.ADMIN,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: perms({ adminAccess: true, manager: true }),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as User
}

function operative(partial: Partial<Operative> & { id: string; email: string }): Operative {
  return {
    firstName: 'Ada',
    lastName: 'Admin',
    phone: '',
    startDate: new Date('2026-01-01T00:00:00Z'),
    hourlyRate: 20,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    organizationId: 'org',
    ...partial,
  } as Operative
}

function project(id: string, jobNumber: string): Project {
  return {
    id,
    jobNumber,
    siteName: `${jobNumber} site`,
    addressLine1: '1 High St',
    townCity: 'London',
    postcode: 'W1',
    client: { id: 'c1', name: 'Client', createdAt: DAY, updatedAt: DAY },
    startDate: DAY,
    endDate: DAY,
    jobType: 'project',
    manager: { name: 'Ada', email: 'ada@site.test' },
    isLive: true,
    createdAt: DAY,
    updatedAt: DAY,
    organizationId: 'org',
  } as Project
}

function slot(): ScheduleDateSlot {
  return { date: DAY, slot: 'FULL DAY' }
}

test('selecting an operative already booked as a manager on another job is clash_pending', () => {
  const admin = user({ id: 'U-ADMIN', email: 'ada@site.test' })
  const op = operative({ id: 'OP-ADMIN', email: 'ada@site.test' })
  const person: SchedulablePerson = {
    id: op.id,
    kind: 'operative',
    name: 'Ada Admin',
    email: admin.email,
    badge: 'Admin',
  }
  const managerBooking: ManagerSiteBooking = {
    id: 'MSB-1',
    userId: admin.id,
    date: DAY,
    timeSlot: 'FULL DAY',
    locationType: 'project',
    locationId: 'P-OTHER',
    createdAt: DAY,
    updatedAt: DAY,
  }

  const draft = buildDraftPersonDayStates({
    person,
    slots: [slot()],
    bookings: [],
    managerSiteBookings: [managerBooking],
    operatives: [op],
    users: [admin],
    projects: [project('P-THIS', 'C100'), project('P-OTHER', 'C200')],
    currentProjectId: 'P-THIS',
  })

  assert.equal(Object.values(draft.dayStates)[0], 'clash_pending')
})

test('selecting a manager already booked as an operative on another job is clash_pending', () => {
  const admin = user({ id: 'U-ADMIN', email: 'ada@site.test' })
  const op = operative({ id: 'OP-ADMIN', email: 'ada@site.test' })
  const person: SchedulablePerson = {
    id: admin.id,
    kind: 'manager',
    name: 'Ada Admin',
    email: admin.email,
    badge: 'Admin',
  }
  const existing: Booking = {
    id: 'B-1',
    operativeId: op.id,
    projectId: 'P-OTHER',
    date: DAY,
    timeSlot: 'FULL DAY',
    bookedBy: 'admin',
    status: 'Confirmed',
    createdAt: DAY,
    updatedAt: DAY,
  }

  const draft = buildDraftPersonDayStates({
    person,
    slots: [slot()],
    bookings: [existing],
    managerSiteBookings: [],
    operatives: [op],
    users: [admin],
    projects: [project('P-THIS', 'C100'), project('P-OTHER', 'C200')],
    currentProjectId: 'P-THIS',
  })

  assert.equal(Object.values(draft.dayStates)[0], 'clash_pending')
})

test('same-project existing manager booking still warns instead of silently doubling', () => {
  const admin = user({ id: 'U-ADMIN', email: 'ada@site.test' })
  const person: SchedulablePerson = {
    id: admin.id,
    kind: 'manager',
    name: 'Ada Admin',
    email: admin.email,
    badge: 'Admin',
  }
  const managerBooking: ManagerSiteBooking = {
    id: 'MSB-1',
    userId: admin.id,
    date: DAY,
    timeSlot: 'FULL DAY',
    locationType: 'project',
    locationId: 'P-THIS',
    createdAt: DAY,
    updatedAt: DAY,
  }

  const draft = buildDraftPersonDayStates({
    person,
    slots: [slot()],
    bookings: [],
    managerSiteBookings: [managerBooking],
    operatives: [],
    users: [admin],
    projects: [project('P-THIS', 'C100')],
    currentProjectId: 'P-THIS',
  })

  assert.equal(Object.values(draft.dayStates)[0], 'clash_pending')
})

test('a free person stays free when they have no overlapping bookings', () => {
  const op = operative({ id: 'OP-1', email: 'op@site.test' })
  const person: SchedulablePerson = {
    id: op.id,
    kind: 'operative',
    name: 'Pat Op',
    email: op.email,
    badge: 'Operative',
  }

  const draft = buildDraftPersonDayStates({
    person,
    slots: [slot()],
    bookings: [],
    managerSiteBookings: [],
    operatives: [op],
    users: [],
    projects: [project('P-THIS', 'C100')],
    currentProjectId: 'P-THIS',
  })

  assert.equal(Object.values(draft.dayStates)[0], 'free')
})
