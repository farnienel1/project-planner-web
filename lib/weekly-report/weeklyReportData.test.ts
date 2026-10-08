import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { buildWeeklyReportData } from './weeklyReportData.ts'

const day = new Date('2026-10-08T08:00:00Z')
const next = new Date('2026-10-09T08:00:00Z')

function person(): User {
  return {
    id: 'u1',
    email: 'ada@x.com',
    firstName: 'Ada',
    surname: 'Booked',
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
    createdAt: day,
    updatedAt: day,
    dayRate: 200,
    employmentType: 'self_employed',
  } as User
}

const operative: Operative = {
  id: 'op1',
  firstName: 'Ada',
  lastName: 'Booked',
  email: 'ada@x.com',
  startDate: day,
  hourlyRate: 0,
  dayRate: 200,
  skills: [],
  qualifications: [],
  isActive: true,
  createdAt: day,
  updatedAt: day,
}

const project: Project = {
  id: 'proj1',
  jobNumber: 'J-1',
  siteName: 'Site One',
  addressLine1: '1 Road',
  townCity: 'London',
  postcode: 'E1 1AA',
  client: { id: 'c1', name: 'Client', createdAt: day, updatedAt: day },
  startDate: day,
  endDate: next,
  jobType: 'CAT A',
  manager: { name: 'Custom', email: '' },
  isLive: true,
  createdAt: day,
  updatedAt: day,
}

function booking(id: string, date: Date): Booking {
  return {
    id,
    operativeId: 'op1',
    projectId: 'proj1',
    date,
    timeSlot: 'FULL DAY',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: day,
    updatedAt: day,
  }
}

test('a person with two bookings on one job is one project row', () => {
  const report = buildWeeklyReportData({
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking('b1', day), booking('b2', next)],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [person()],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  })
  const group = report.projectGroups[0]
  assert.equal(group?.rows.length, 1)
  assert.equal(group?.rows[0]?.person, 'Ada Booked')
  assert.equal(group?.rows[0]?.days, 2)
  assert.equal(group?.projectTotal, 2)
})
