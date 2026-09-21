import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serializeClient } from './converters.ts'
import { searchWorks } from '../projects/workStatus.ts'
import { buildDailyOverview, estimatedPaidHours, isLondonWeekday } from '../daily-overview/buildDailyOverview.ts'
import type { Booking, Client, HolidayBooking, Project, User } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'

test('serializeClient writes empty strings and uppercase id like iOS saveClient', () => {
  const payload = serializeClient({
    id: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    name: 'Acme',
    organizationId: 'org1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as Client)
  assert.equal(payload.id, 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA')
  assert.equal(payload.name, 'Acme')
  assert.equal(payload.email, '')
  assert.equal(payload.phone, '')
  assert.equal(payload.address, '')
  assert.equal(payload.contactPerson, '')
})

test('searchWorks matches job number, site, address and client', () => {
  const p = {
    id: '1',
    jobNumber: 'J-100',
    siteName: 'Riverside',
    addressLine1: '1 High St',
    addressLine2: '',
    townCity: 'London',
    postcode: 'E1 1AA',
    client: { id: 'c', name: 'Acme Ltd' },
  } as Project
  assert.equal(searchWorks([p], 'high').length, 1)
  assert.equal(searchWorks([p], 'acme').length, 1)
  assert.equal(searchWorks([p], 'zzz').length, 0)
})

function user(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Ada',
    surname: 'Lovelace',
    organizationId: 'org',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: true,
      projects: true,
      smallWorks: true,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User
}

test('estimatedPaidHours uses clock times then slot', () => {
  assert.equal(estimatedPaidHours({ workStartTime: '08:00', workEndTime: '12:00' }), 4)
  assert.equal(estimatedPaidHours({ timeSlot: 'FULL DAY' }), 8)
  assert.equal(estimatedPaidHours({ timeSlot: 'AM' }), 4)
})

test('buildDailyOverview groups jobs and weekday unbooked labour', () => {
  const day = new Date('2026-09-16T12:00:00Z')
  assert.equal(isLondonWeekday(day), true)
  const project = {
    id: 'P1',
    jobNumber: 'J1',
    siteName: 'Alpha',
    jobType: 'CAT A',
    client: { id: 'c', name: 'Acme' },
    addressLine1: '',
    townCity: '',
    postcode: '',
    startDate: day,
    endDate: day,
    isLive: true,
    manager: { name: 'Custom', email: '' },
    createdAt: day,
    updatedAt: day,
  } as Project
  const booking: Booking = {
    id: 'B1',
    operativeId: 'OP1',
    projectId: 'P1',
    date: day,
    timeSlot: 'FULL DAY',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: day,
    updatedAt: day,
  }
  const model = buildDailyOverview({
    day,
    today: day,
    projects: [project],
    bookings: [booking],
    managerBookings: [],
    holidays: [] as HolidayBooking[],
    users: [
      user({ id: 'U1', email: 'ada@x.com', firstName: 'Ada', surname: 'Booked' }),
      user({ id: 'U2', email: 'bob@x.com', firstName: 'Bob', surname: 'Free' }),
    ],
    operatives: [
      {
        id: 'OP1',
        firstName: 'Ada',
        lastName: 'Booked',
        email: 'ada@x.com',
        startDate: day,
        hourlyRate: 0,
        skills: [],
        qualifications: [],
        isActive: true,
        createdAt: day,
        updatedAt: day,
      },
    ],
  })
  assert.equal(model.jobsCount, 1)
  assert.equal(model.projectCards[0].project.siteName, 'Alpha')
  assert.equal(model.projectCards[0].people.length, 1)
  assert.equal(model.projectCards[0].people[0].name, 'Ada Booked')
  assert.ok(model.unbookedNames.some((n) => n.startsWith('Bob Free')))
  assert.equal(model.empty, false)
})

test('buildDailyOverview does not double-count the same booking id', () => {
  const day = new Date('2026-09-16T12:00:00Z')
  const project = {
    id: 'P1',
    jobNumber: 'J1',
    siteName: 'Alpha',
    jobType: 'CAT A',
    client: { id: 'c', name: 'Acme' },
    addressLine1: '',
    townCity: '',
    postcode: '',
    startDate: day,
    endDate: day,
    isLive: true,
    manager: { name: 'Custom', email: '' },
    createdAt: day,
    updatedAt: day,
  } as Project
  const booking: Booking = {
    id: 'B1',
    operativeId: 'OP1',
    projectId: 'P1',
    date: day,
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '07:30',
    workEndTime: '16:00',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: day,
    updatedAt: day,
  }
  const model = buildDailyOverview({
    day,
    today: day,
    projects: [project],
    bookings: [booking, { ...booking }],
    managerBookings: [],
    holidays: [] as HolidayBooking[],
    users: [user({ id: 'U1', email: 'ada@x.com', firstName: 'Ada', surname: 'Booked' })],
    operatives: [
      {
        id: 'OP1',
        firstName: 'Ada',
        lastName: 'Booked',
        email: 'ada@x.com',
        startDate: day,
        hourlyRate: 0,
        skills: [],
        qualifications: [],
        isActive: true,
        createdAt: day,
        updatedAt: day,
      },
    ],
  })
  assert.equal(model.projectCards[0].people[0].hours, 8)
  assert.equal(model.labourHours, 8)
})

test('buildDailyOverview lists people even when the job document is missing', () => {
  const day = new Date('2026-09-16T12:00:00Z')
  const booking: Booking = {
    id: 'B2',
    operativeId: 'OP1',
    projectId: 'MISSING',
    date: new Date('2026-09-16T00:00:00Z'),
    timeSlot: 'AM',
    bookedBy: '',
    status: 'Tentative',
    createdAt: day,
    updatedAt: day,
  }
  const model = buildDailyOverview({
    day,
    today: day,
    projects: [],
    bookings: [booking],
    managerBookings: [],
    holidays: [] as HolidayBooking[],
    users: [],
    operatives: [
      {
        id: 'OP1',
        firstName: 'Sam',
        lastName: 'Site',
        email: 'sam@x.com',
        startDate: day,
        hourlyRate: 0,
        skills: [],
        qualifications: [],
        isActive: true,
        createdAt: day,
        updatedAt: day,
      },
    ],
  })
  assert.equal(model.projectCards.length, 1)
  assert.equal(model.projectCards[0].people[0].name, 'Sam Site')
})

test('buildDailyOverview groups mixed-case project ids and merges a person\'s hours', () => {
  const day = new Date('2026-09-16T12:00:00Z')
  const project = {
    id: 'P1',
    jobNumber: 'J-100',
    siteName: 'Alpha',
    jobType: 'CAT A',
    client: { id: 'c', name: 'Acme' },
    addressLine1: '',
    townCity: '',
    postcode: '',
    startDate: day,
    endDate: day,
    isLive: true,
    manager: { name: 'Custom', email: '' },
    createdAt: day,
    updatedAt: day,
  } as Project
  const ada = {
    id: 'OP1',
    firstName: 'Ada',
    lastName: 'Booked',
    email: 'ada@x.com',
    startDate: day,
    hourlyRate: 0,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: day,
    updatedAt: day,
  }
  const bob = {
    ...ada,
    id: 'OP2',
    firstName: 'Bob',
    lastName: 'Site',
    email: 'bob@x.com',
  }
  const model = buildDailyOverview({
    day,
    today: day,
    projects: [project],
    bookings: [
      {
        id: 'B-am',
        operativeId: 'OP1',
        projectId: 'p1',
        date: day,
        timeSlot: 'AM',
        bookedBy: 'Ada',
        status: 'Confirmed',
        createdAt: day,
        updatedAt: day,
      },
      {
        id: 'B-pm',
        operativeId: 'OP1',
        projectId: 'J-100',
        date: day,
        timeSlot: 'PM',
        bookedBy: 'Ada',
        status: 'Confirmed',
        createdAt: day,
        updatedAt: day,
      },
      {
        id: 'B-bob',
        operativeId: 'OP2',
        projectId: 'P1',
        date: day,
        timeSlot: 'FULL DAY',
        bookedBy: 'Mo',
        status: 'Confirmed',
        createdAt: day,
        updatedAt: day,
      },
    ],
    managerBookings: [],
    holidays: [] as HolidayBooking[],
    users: [],
    operatives: [ada, bob],
  })
  assert.equal(model.jobsCount, 1)
  assert.equal(model.projectCards[0].project.siteName, 'Alpha')
  assert.equal(model.projectCards[0].people.length, 2)
  const adaRow = model.projectCards[0].people.find((row) => row.name === 'Ada Booked')
  const bobRow = model.projectCards[0].people.find((row) => row.name === 'Bob Site')
  assert.ok(adaRow)
  assert.ok(bobRow)
  assert.equal(adaRow?.pillText, '8h')
  assert.equal(bobRow?.pillText, '8h')
})

test('buildDailyOverview groups dashed and undashed UUID project ids', () => {
  const day = new Date('2026-09-16T12:00:00Z')
  const id = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'
  const project = {
    id,
    jobNumber: 'J9',
    siteName: 'Bridge',
    jobType: 'CAT A',
    client: { id: 'c', name: 'Acme' },
    addressLine1: '',
    townCity: '',
    postcode: '',
    startDate: day,
    endDate: day,
    isLive: true,
    manager: { name: 'Custom', email: '' },
    createdAt: day,
    updatedAt: day,
  } as Project
  const model = buildDailyOverview({
    day,
    today: day,
    projects: [project],
    bookings: [
      {
        id: 'B1',
        operativeId: 'OP1',
        projectId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        date: day,
        timeSlot: 'FULL DAY',
        bookedBy: 'Ada',
        status: 'Confirmed',
        createdAt: day,
        updatedAt: day,
      },
    ],
    managerBookings: [],
    holidays: [] as HolidayBooking[],
    users: [],
    operatives: [
      {
        id: 'OP1',
        firstName: 'Ada',
        lastName: 'Booked',
        email: 'ada@x.com',
        startDate: day,
        hourlyRate: 0,
        skills: [],
        qualifications: [],
        isActive: true,
        createdAt: day,
        updatedAt: day,
      },
    ],
  })
  assert.equal(model.jobsCount, 1)
  assert.equal(model.projectCards[0].project.siteName, 'Bridge')
  assert.equal(model.projectCards[0].people[0].name, 'Ada Booked')
})
