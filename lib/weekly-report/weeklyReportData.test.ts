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

test('cancelled bookings are not counted, and bookings under a users id or former invite id are named', () => {
  const rehired: User = { ...person(), id: 'rehiredUid0001', email: 'rehired@x.com', firstName: 'Re', surname: 'Hired', formerUserIds: ['PLACEHOLDER-0001'] }
  const report = buildWeeklyReportData({
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [
      booking('kept', day),
      { ...booking('cancelled', next), status: 'Cancelled' },
      { ...booking('by-uid', day), operativeId: 'rehiredUid0001' },
      { ...booking('by-placeholder', next), operativeId: 'PLACEHOLDER-0001' },
    ],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [person(), rehired],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  })
  const rows = report.projectGroups[0]?.rows ?? []
  const ada = rows.find((row) => row.person === 'Ada Booked')
  const re = rows.find((row) => row.person === 'Re Hired')
  assert.equal(ada?.days, 1)
  assert.equal(re?.days, 2)
})

test('a PAYE person keeps their bookings and hours but shows PAYE instead of pay, and is not in the pay total', () => {
  const paye = { ...person(), id: 'u2', email: 'pat@x.com', firstName: 'Pat', surname: 'Paye', employmentType: 'paye' } as User
  const payeOperative: Operative = { ...operative, id: 'op2', firstName: 'Pat', lastName: 'Paye', email: 'pat@x.com' }
  const payeBooking = { ...booking('b3', day), operativeId: 'op2' }
  const input = {
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking('b1', day), booking('b2', next), payeBooking],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative, payeOperative],
    users: [person(), paye],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  }
  const report = buildWeeklyReportData(input)
  const pat = report.paySummary.find((row) => row.person === 'Pat Paye')
  assert.ok(pat, 'PAYE person stays on the report')
  assert.equal(pat?.lines[0]?.payLabel, 'PAYE')
  assert.equal(pat?.lines[0]?.isPaye, true)
  assert.ok((pat?.lines[0]?.days ?? 0) > 0, 'PAYE hours are still shown')
  assert.equal(pat?.personTotalLabel, 'PAYE')
  const ada = report.paySummary.find((row) => row.person === 'Ada Booked')
  assert.equal(ada?.personTotal, 400)
  assert.equal(ada?.personTotalLabel, null)
  assert.equal(report.grandTotal, 400)
  // The PAYE booking is still a project row with its day.
  const rows = report.projectGroups[0]?.rows ?? []
  assert.equal(rows.find((row) => row.person === 'Pat Paye')?.days, 1)
})
