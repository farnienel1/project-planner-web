/**
 * Pay strip, review #342: the weekly report and the Payrun Snapshot wait only for the pay of the people they actually
 * price or list. Someone with no rows (offline, added since the last pay read) never blocks them; someone with rows does.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { buildWeeklyReportData } from './weeklyReportData.ts'
import { payrunSnapshotRows } from '../canonical/index.ts'
import { reportGatePeople, reportPayGate } from '../pay/reportPayGate.ts'

const day = new Date('2026-10-08T08:00:00Z')

function user(id: string, email: string, extra: Partial<User> = {}): User {
  return {
    id,
    email,
    firstName: id.toUpperCase(),
    surname: 'Person',
    organizationId: 'org',
    role: 'operative',
    operativeMode: true,
    passwordSet: true,
    policyAccepted: true,
    isSuperAdmin: false,
    isActive: true,
    createdAt: day,
    updatedAt: day,
    dayRate: 200,
    employmentType: 'self_employed',
    ...extra,
  } as unknown as User
}

const booked = user('booked', 'booked@x.com')
const idle = user('idle', 'idle@x.com')

const project: Project = {
  id: 'proj1',
  jobNumber: 'J-1',
  siteName: 'Site One',
  addressLine1: '1 Road',
  townCity: 'London',
  postcode: 'E1 1AA',
  client: { id: 'c1', name: 'Client', createdAt: day, updatedAt: day },
  startDate: day,
  endDate: day,
  jobType: 'CAT A',
  manager: { name: 'Custom', email: '' },
  isLive: true,
  createdAt: day,
  updatedAt: day,
}

const booking: Booking = {
  id: 'b1',
  operativeId: 'booked',
  projectId: 'proj1',
  date: day,
  timeSlot: 'FULL DAY',
  bookedBy: 'Admin',
  status: 'Confirmed',
  createdAt: day,
  updatedAt: day,
}

const nameOf = (person: User) => person.id

test('review #342: the weekly report prices only the people of its bookings, and waits only for them', () => {
  const report = buildWeeklyReportData({
    showAllPay: true,
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [] as Operative[],
    users: [booked, idle],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  })
  assert.deepEqual(report.pricedUserIds, ['booked'])
  const people = reportGatePeople([booked, idle], report.pricedUserIds)
  // Idle (no bookings) still loading or failed: does not block.
  for (const idleStatus of ['loading', 'failed'] as const) {
    const statuses = { booked: 'ready', idle: idleStatus } as const
    const gate = reportPayGate({ organizationStatus: 'ready', people, statusOf: (p) => statuses[p.id as 'booked' | 'idle'], nameOf })
    assert.equal(gate.status, 'ready')
  }
  // The booked person's pay still loading or failed: blocks, naming them.
  for (const bookedStatus of ['loading', 'failed'] as const) {
    const statuses = { booked: bookedStatus, idle: 'ready' } as const
    const gate = reportPayGate({ organizationStatus: 'ready', people, statusOf: (p) => statuses[p.id as 'booked' | 'idle'], nameOf })
    assert.equal(gate.status, bookedStatus)
    assert.match(String(gate.message), /booked/)
  }
  // The organisation itself still loading: "Loading…" (no names).
  assert.deepEqual(reportPayGate({ organizationStatus: 'loading', people, statusOf: () => 'ready', nameOf }), {
    status: 'loading',
    loadingNames: [],
    failedNames: [],
    message: null,
  })
})

test('review #342: the Payrun Snapshot waits only for the people who have a row', () => {
  // An inactive person with no records in the period has no row (`payrunSnapshotRows`).
  const gone = user('gone', 'gone@x.com', { isActive: false })
  const users = [booked, gone]
  // The same selection the screen gets from `payrunSnapshotRowsFor` (the rulebook's `payrunSnapshotRows`).
  const rows = payrunSnapshotRows({
    roster: users as never,
    organization: {},
    period: { start: '2026-11-01', end: '2026-11-15' },
    timeZone: 'Europe/London',
    sheets: [],
    overtimeRequests: [],
    overtimeReports: [],
    payeClaimReports: [],
    priceWork: [],
    expenses: [],
  } as never)
  assert.deepEqual(rows.map((row) => row.personId), ['booked'])
  const people = reportGatePeople(users, rows.map((row) => row.personId))
  const statuses: Record<string, 'ready' | 'loading' | 'failed'> = { booked: 'ready', gone: 'failed' }
  assert.equal(reportPayGate({ organizationStatus: 'ready', people, statusOf: (p) => statuses[p.id], nameOf }).status, 'ready')
  statuses.booked = 'loading'
  assert.equal(reportPayGate({ organizationStatus: 'ready', people, statusOf: (p) => statuses[p.id], nameOf }).status, 'loading')
  statuses.booked = 'failed'
  assert.equal(reportPayGate({ organizationStatus: 'ready', people, statusOf: (p) => statuses[p.id], nameOf }).status, 'failed')
})

const reportInput = (extra: Record<string, unknown>) => ({
  showAllPay: true,
  organizationName: 'Acme',
  period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
  bookings: [] as Booking[],
  managerSiteBookings: [],
  subcontractorBookings: [],
  subcontractors: [],
  operatives: [] as Operative[],
  users: [booked, idle],
  projects: [project],
  smallWorks: [],
  holidays: [],
  orgDetails: null,
  ...extra,
})

test('review #342: a booking whose person id differs only in letter case is priced and waited for', () => {
  const manager = user('abc', 'abc@x.com', { role: 'manager', operativeMode: false } as Partial<User>)
  const site = { id: 'm1', userId: 'ABC', date: day, timeSlot: 'FULL DAY', locationType: 'project' as const, locationId: 'proj1', createdAt: day, updatedAt: day }
  const report = buildWeeklyReportData(reportInput({ users: [manager, idle], managerSiteBookings: [site] }) as never)
  assert.ok(report.paySummary.some((row) => row.personTotal > 0), 'priced')
  assert.deepEqual(report.pricedUserIds, ['abc'])
  // Labour booking in upper case too.
  const labour = buildWeeklyReportData(reportInput({ bookings: [{ ...booking, operativeId: 'BOOKED' }] }) as never)
  assert.deepEqual(labour.pricedUserIds, ['booked'])
})

test('review #342: a booking under a former id in another letter case is priced and waited for', () => {
  const moved = user('new1', 'moved@x.com', { formerUserIds: ['old1'] } as Partial<User>)
  const report = buildWeeklyReportData(reportInput({ users: [moved, idle], bookings: [{ ...booking, operativeId: 'OLD1' }] }) as never)
  assert.ok(report.paySummary.some((row) => row.personTotal > 0), 'priced')
  assert.deepEqual(report.pricedUserIds, ['new1'])
})

test('review #342: a timesheet week or sheet in another letter case brings its person in', () => {
  const report = buildWeeklyReportData(
    reportInput({
      timesheetSheets: [{ personId: 'IDLE', startDayKey: '2026-10-05', endDayKey: '2026-10-11' }],
    }) as never
  )
  assert.deepEqual(report.pricedUserIds, ['idle'])
})

test('review #342: a PAYE person with overtime in range is waited for (their employment type is read)', () => {
  const paye = user('pat', 'pat@x.com', { employmentType: 'paye' } as Partial<User>)
  const late = { ...booking, id: 'ot', operativeId: 'PAT', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' } as Booking
  const report = buildWeeklyReportData(reportInput({ users: [paye, idle], bookings: [late] }) as never)
  assert.equal(report.payeOvertimeRows.length, 1)
  assert.ok(report.pricedUserIds.includes('pat'))
  assert.ok(!report.pricedUserIds.includes('idle'))
})
