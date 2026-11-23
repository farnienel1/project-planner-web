import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { DEFAULT_INVOICING, DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { emptyTimesheetDraft } from './timesheetDraft.ts'
import { applyWeeklyReportOverride } from './weeklyReportOverride.ts'
import { weeklyReportOverrideFromFirestore, weeklyReportOverrideToFirestore } from './timesheetStorage.ts'
import { payPeriodsOverlapping } from './timesheetPayrollPolicy.ts'
import { invoiceLinesForTimesheet } from './timesheetExport.ts'
import { buildWeeklyReportData } from '../weekly-report/weeklyReportData.ts'
import type { ApprovedTimesheetWeek } from '../weekly-report/timesheetFeed.ts'
import { collectTimesheetPayroll, type TimesheetPayrollSummary } from './timesheetPayrollCollector.ts'
import { payrollLineEdit } from './payrollLineBookingLookup.ts'

function user(partial: Partial<User> & { id: string }): User {
  return {
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
    createdAt: new Date(),
    updatedAt: new Date(),
    dayRate: 200,
    employmentType: 'self_employed',
    assignedManagerUserId: 'mgr',
    ...partial,
  } as User
}

const operative: Operative = {
  id: 'op1',
  firstName: 'Ada',
  lastName: 'Booked',
  email: 'ada@x.com',
  startDate: new Date(),
  hourlyRate: 0,
  dayRate: 200,
  skills: [],
  qualifications: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const project: Project = {
  id: 'proj1',
  jobNumber: 'J-1',
  siteName: 'Site One',
  addressLine1: '1 Road',
  townCity: 'London',
  postcode: 'E1 1AA',
  client: { id: 'c1', name: 'Client', createdAt: new Date(), updatedAt: new Date() },
  startDate: new Date(),
  endDate: new Date(),
  jobType: 'CAT A',
  manager: { name: 'Custom', email: '' },
  isLive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const day = new Date('2026-09-16T08:00:00Z')

function booking(partial: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    operativeId: 'op1',
    projectId: 'proj1',
    date: day,
    timeSlot: 'FULL DAY',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

const base = {
  user: user({ id: 'u1' }),
  weekStart: new Date('2026-09-14T00:00:00Z'),
  weekEnd: new Date('2026-09-20T00:00:00Z'),
  bookings: [booking()],
  managerSiteBookings: [],
  operatives: [operative],
  projects: [project],
  smallWorks: [],
  payrollPolicy: DEFAULT_PAYROLL_POLICY,
  timeZone: 'Europe/London',
}

test('full approval snapshots a half-day booking and does not require a full paid day', () => {
  const draft = applyWeeklyReportOverride({
    ...base,
    bookings: [booking({ timeSlot: 'AM' })],
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
      managerSignedAt: day,
      managerSignedByUserId: 'mgr',
      managerSignedByName: 'Morgan Manager',
    },
  })
  const line = draft.weeklyReportOverride?.lines.find((row) => row.id === 'op-b1-normal')
  assert.ok(line)
  assert.equal(line.decision, 'approved')
  assert.ok(line.days > 0 && line.days < 1)
  assert.equal(line.locationKind, 'project')
  assert.equal(line.bookingId, 'b1')
  assert.equal(draft.weeklyReportOverride?.selfSigned, false)
  assert.equal(draft.weeklyReportOverride?.approvedByUserId, 'mgr')
})

test('a declined labour line stays on the snapshot with zero days and amount', () => {
  const draft = applyWeeklyReportOverride({
    ...base,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
      managerSignedAt: day,
      managerSignedByUserId: 'mgr',
      payrollLineReviews: { 'op-b1-normal': { decision: 'declined' } },
    },
  })
  const line = draft.weeklyReportOverride?.lines.find((row) => row.id === 'op-b1-normal')
  assert.equal(line?.decision, 'declined')
  assert.equal(line?.days, 0)
  assert.equal(line?.amount, 0)
})

test('later schedule changes do not rebuild stored labour lines', () => {
  const first = applyWeeklyReportOverride({
    ...base,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
      managerSignedAt: day,
      managerSignedByName: 'Morgan Manager',
      priceWorkEntries: [
        {
          id: 'pw1',
          title: 'Extra',
          details: 'First fix',
          jobNumber: 'J-1',
          agreedManagerName: 'Morgan',
          startDate: day,
          amount: 80,
          managerDecision: 'pending',
        },
      ],
      expenseEntries: [
        {
          id: 'ex1',
          title: 'Parking',
          details: '',
          jobNumber: 'J-1',
          date: day,
          amount: 12,
          managerDecision: 'declined',
        },
      ],
    },
  })
  assert.equal(first.weeklyReportOverride?.priceWork[0].decision, 'approved')
  assert.equal(first.weeklyReportOverride?.priceWork[0].amount, 80)
  assert.equal(first.weeklyReportOverride?.expenses[0].decision, 'declined')
  assert.equal(first.weeklyReportOverride?.expenses[0].amount, 0)

  const second = applyWeeklyReportOverride({
    ...base,
    bookings: [booking({ projectId: 'other' })],
    projects: [{ ...project, id: 'other', siteName: 'Moved Site', jobNumber: 'J-9' }],
    draft: {
      ...first,
      payrollLineReviews: { 'op-b1-normal': { decision: 'edited', revisedAmount: 50 } },
      priceWorkEntries: first.priceWorkEntries.map((entry) => ({
        ...entry,
        managerDecision: 'edited' as const,
        managerRevisedAmount: 40,
      })),
    },
  })
  const line = second.weeklyReportOverride?.lines.find((row) => row.id === 'op-b1-normal')
  assert.equal(line?.projectName, 'Site One')
  assert.equal(line?.decision, 'edited')
  assert.equal(line?.amount, 50)
  // Rulebook 1.76.0 (owner answer 23 Nov, b): a save after sign-off keeps the signed price work and expense rows, so
  // the change waits for the line manager (`timesheetSignedEntriesChangedSinceSignOff`) ...
  assert.equal(second.weeklyReportOverride?.priceWork[0].amount, 80)
  assert.equal(second.weeklyReportOverride?.priceWork[0].decision, 'approved')
  // ... and signing it off again takes them afresh from the decided entries.
  const resigned = applyWeeklyReportOverride({
    ...base,
    refreshSignedMoney: true,
    draft: { ...second, managerSignedAt: new Date(day.getTime() + 3_600_000) },
  })
  assert.equal(resigned.weeklyReportOverride?.priceWork[0].amount, 40)
  assert.equal(resigned.weeklyReportOverride?.priceWork[0].decision, 'edited')
  assert.equal(resigned.weeklyReportOverride?.expenses[0].amount, 0)
})

test('admin with Timesheet self-sign (1.28.0): own signature is full approval and selfSigned (timesheetSelfSigned)', () => {
  const solo = user({ id: 'solo', hasNoLineManager: true, assignedManagerUserId: undefined })
  const admin = {
    ...solo,
    role: 'admin',
    permissions: { ...solo.permissions, adminAccess: true, operativeMode: false, timesheetSelfSign: true },
  } as User
  const draft = applyWeeklyReportOverride({
    ...base,
    user: admin,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
    },
  })
  assert.equal(draft.weeklyReportOverride?.selfSigned, true)
  assert.equal(draft.weeklyReportOverride?.approvedByName, 'Ada Booked')
})

test('operative with no line manager is not self-signed: their signature waits for the admins (1.3.0)', () => {
  const solo = user({ id: 'solo', hasNoLineManager: true, assignedManagerUserId: undefined })
  const draft = applyWeeklyReportOverride({
    ...base,
    user: solo,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
    },
  })
  assert.equal(draft.weeklyReportOverride ?? null, null)
})

test('clearing approval removes the override', () => {
  const approved = applyWeeklyReportOverride({
    ...base,
    draft: { ...emptyTimesheetDraft(), operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked', managerSignedAt: day },
  })
  const cleared = applyWeeklyReportOverride({
    ...base,
    draft: { ...approved, operativeSignedAt: null, managerSignedAt: null },
  })
  assert.equal(cleared.weeklyReportOverride, null)
})

test('firestore map uses the shared weeklyReportOverride field names', () => {
  const approved = applyWeeklyReportOverride({
    ...base,
    draft: { ...emptyTimesheetDraft(), operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked', managerSignedAt: day, managerSignedByUserId: 'mgr' },
  })
  const encoded = weeklyReportOverrideToFirestore(approved.weeklyReportOverride!)
  assert.equal(encoded.selfSigned, false)
  assert.ok(Array.isArray(encoded.lines))
  const line = (encoded.lines as Array<Record<string, unknown>>)[0]
  assert.equal(typeof line.locationKind, 'string')
  assert.equal(line.bookingId, 'b1')
  assert.equal('isOvertime' in line, true)
  const decoded = weeklyReportOverrideFromFirestore({
    ...encoded,
    approvedAt: { toDate: () => day },
    lines: (encoded.lines as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      date: { toDate: () => day },
    })),
    priceWork: [],
    expenses: [],
  })
  assert.equal(decoded?.lines[0].bookingId, 'b1')
  assert.equal(decoded?.approvedByUserId, 'mgr')
})

test('weekly report replaces live days with the agreed snapshot and includes price work', () => {
  const approved = applyWeeklyReportOverride({
    ...base,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
      managerSignedAt: day,
      priceWorkEntries: [
        {
          id: 'pw1',
          title: 'Extra',
          details: 'First fix',
          jobNumber: 'J-1',
          agreedManagerName: 'Morgan',
          startDate: day,
          amount: 40,
          managerDecision: 'approved',
        },
      ],
    },
  })
  const normal = approved.weeklyReportOverride!.lines.find((row) => row.id === 'op-b1-normal')!
  normal.amount = 150
  const week: ApprovedTimesheetWeek = {
    userId: 'u1',
    personName: 'Ada Booked',
    role: 'Operative',
    trade: 'General',
    weekStart: base.weekStart,
    weekEnd: base.weekEnd,
    override: approved.weeklyReportOverride!,
  }
  const report = buildWeeklyReportData({ showAllPay: true,
    organizationName: 'Acme',
    period: { start: base.weekStart, end: base.weekEnd, label: 'week' },
    bookings: [booking()],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [base.user],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
    timesheetWeeks: [week],
  })
  const days = report.projectGroups.reduce((sum, group) => sum + group.projectTotal, 0)
  assert.ok(Math.abs(days - normal.days) < 0.02)
  assert.equal(report.priceWorkRows.length, 1)
  assert.equal(report.priceWorkTotal, 40)
  const pay = report.paySummary.find((row) => row.person === 'Ada Booked')
  assert.ok(pay)
  // Rulebook 1.51.0: the signed line, never re-priced, in the Q1 layout.
  assert.ok(
    pay.lines.some(
      (line) =>
        line.line === 'Weekday standard · signed timesheet' &&
        line.days === 1 &&
        line.rateText === '£150.00/day' &&
        line.pay === 150
    )
  )
  assert.ok(pay.lines.some((line) => line.line === 'Price work' && line.pay === 40))
})

test('export PDF lines skip declined override rows', () => {
  const payroll: TimesheetPayrollSummary = {
    totalHours: 8,
    overtimeHours: 0,
    shiftCount: 1,
    baseAmount: 200,
    overtimeAmount: 0,
    workAmount: 200,
    lineItems: [],
  }
  const lines = invoiceLinesForTimesheet({
    payroll,
    timeZone: 'Europe/London',
    extrasMode: 'export',
    draft: {
      ...emptyTimesheetDraft(),
      weeklyReportOverride: {
        approvedAt: day,
        approvedByUserId: 'mgr',
        approvedByName: 'Morgan',
        selfSigned: false,
        lines: [
          {
            id: 'op-b1-normal',
            date: day,
            jobNumber: 'J-1',
            projectName: 'Site One',
            locationKind: 'project',
            details: 'Full day',
            paidHours: 8,
            days: 1,
            amount: 200,
            isOvertime: false,
            decision: 'approved',
            bookingId: 'b1',
          },
          {
            id: 'op-b2-normal',
            date: day,
            jobNumber: 'J-1',
            projectName: 'Site One',
            locationKind: 'project',
            details: 'Cancelled',
            paidHours: 8,
            days: 0,
            amount: 0,
            isOvertime: false,
            decision: 'declined',
            bookingId: 'b2',
          },
        ],
        priceWork: [],
        expenses: [
          {
            id: 'ex1',
            title: 'Parking',
            details: '',
            jobNumber: 'J-1',
            date: day,
            amount: 0,
            decision: 'declined',
          },
        ],
      },
    },
  })
  assert.equal(lines.length, 1)
  assert.equal(lines[0].projectName, 'Site One')
  assert.equal(lines[0].amount, 200)
})

test('a signed hourly line stays in hours at the stored amount', () => {
  const lines = invoiceLinesForTimesheet({
    payroll: {
      totalHours: 24,
      overtimeHours: 0,
      shiftCount: 1,
      baseAmount: 480,
      overtimeAmount: 0,
      workAmount: 480,
      lineItems: [],
    },
    timeZone: 'Europe/London',
    extrasMode: 'raw',
    standardDayHours: 8,
    // Review of #414: the day's working hours are passed, but a signed line keeps its stored wording exactly.
    dayPolicyOn: () => DEFAULT_PAYROLL_POLICY,
    draft: {
      ...emptyTimesheetDraft(),
      weeklyReportOverride: {
        approvedAt: day,
        approvedByUserId: 'mgr',
        approvedByName: 'Morgan',
        selfSigned: false,
        lines: [
          {
            id: 'op-b1-normal',
            date: day,
            jobNumber: 'J-1',
            projectName: 'Site One',
            locationKind: 'project',
            details: 'FULL DAY',
            paidHours: 24,
            days: 3,
            amount: 480,
            payBasis: 'hourly',
            isOvertime: false,
            decision: 'approved',
            bookingId: 'b1',
          },
        ],
        priceWork: [],
        expenses: [],
      },
    },
  })
  assert.equal(lines.length, 1)
  assert.equal(lines[0].details, '24.00 hours × £20.00/hr = £480.00')
  assert.equal(lines[0].details.includes('day'), false)
})

test('pay periods overlapping a midweek report stay on that pay run', () => {
  const periods = payPeriodsOverlapping(
    new Date('2026-09-16T12:00:00Z'),
    new Date('2026-09-16T12:00:00Z'),
    DEFAULT_INVOICING,
    'Europe/London'
  )
  assert.equal(periods.length, 1)
  assert.equal(periods[0].start.toISOString().slice(0, 10) <= '2026-09-16', true)
  assert.equal(periods[0].end.toISOString().slice(0, 10) >= '2026-09-16', true)
})

// Rulebook 1.43.0 (`timesheetSnapshotNeedsRebuild`): a counter-signature made before the period's bookings had loaded
// froze a snapshot with no labour lines (the invoice then showed only price work). The next save once the bookings
// have loaded rebuilds it from them, with the signatures and approver as stored; a snapshot with labour lines is never
// rebuilt, and an exported sheet is left alone.
test('1.43.0: an empty frozen snapshot is rebuilt from the live bookings; signatures and approver kept', () => {
  const signedAt = new Date('2026-09-18T09:00:00Z')
  const signed = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: day,
    operativeSignedByName: 'Ada Booked',
    managerSignedAt: signedAt,
    managerSignedByUserId: 'mgr',
    managerSignedByName: 'Morgan Manager',
  }
  // Signed while no bookings had loaded: the snapshot has no labour lines.
  const frozen = applyWeeklyReportOverride({ ...base, bookings: [], draft: signed })
  assert.equal(frozen.weeklyReportOverride?.lines.length, 0)
  // Review r318: a booking created after the sheet was approved never rebuilds it (a signed sheet is never re-priced).
  const addedLater = booking({ createdAt: new Date('2026-09-25T09:00:00Z'), updatedAt: new Date('2026-09-25T09:00:00Z') })
  assert.equal(applyWeeklyReportOverride({ ...base, bookings: [addedLater], draft: frozen }).weeklyReportOverride?.lines.length, 0)
  // A booking created before approval but moved into the period (written) after it never rebuilds it either.
  const movedLater = booking({ createdAt: new Date('2026-09-10T09:00:00Z'), updatedAt: new Date('2026-09-25T09:00:00Z') })
  assert.equal(applyWeeklyReportOverride({ ...base, bookings: [movedLater], draft: frozen }).weeklyReportOverride?.lines.length, 0)
  // The booking that already existed, unchanged since, arrives: the next save rebuilds it.
  const existed = booking({ createdAt: new Date('2026-09-10T09:00:00Z'), updatedAt: new Date('2026-09-11T09:00:00Z') })
  const rebuilt = applyWeeklyReportOverride({ ...base, bookings: [existed], draft: frozen })
  assert.equal(rebuilt.weeklyReportOverride?.lines.length, 1)
  assert.equal(rebuilt.weeklyReportOverride?.lines[0].bookingId, 'b1')
  assert.equal(rebuilt.weeklyReportOverride?.approvedAt.getTime(), frozen.weeklyReportOverride?.approvedAt.getTime())
  assert.equal(rebuilt.weeklyReportOverride?.approvedByName, 'Morgan Manager')
  assert.equal(rebuilt.managerSignedAt, signedAt)
  assert.equal(rebuilt.operativeSignedAt, day)
  // Exported: left as it is.
  const exported = applyWeeklyReportOverride({ ...base, bookings: [existed], draft: { ...frozen, exportedAt: new Date('2026-09-20T09:00:00Z') } })
  assert.equal(exported.weeklyReportOverride?.lines.length, 0)
  // A snapshot with labour lines is never re-priced, even when the bookings later change.
  const later = applyWeeklyReportOverride({
    ...base,
    bookings: [existed, booking({ id: 'b2', timeSlot: 'AM', createdAt: new Date('2026-09-10T09:00:00Z'), updatedAt: new Date('2026-09-10T09:00:00Z') })],
    draft: rebuilt,
  })
  assert.deepEqual(later.weeklyReportOverride?.lines.map((line) => line.bookingId), ['b1'])
})

// Rulebook 1.76.0 (review of #427): the empty-snapshot repair rebuilds the labour only — a signed expense removed after
// sign-off (Make changes) stays on the signed copy until the line manager signs it off again.
test('1.76.0: the empty-snapshot repair keeps the signed price work and expense rows', () => {
  const signed = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: day,
    operativeSignedByName: 'Ada Booked',
    managerSignedAt: new Date('2026-09-18T09:00:00Z'),
    managerSignedByUserId: 'mgr',
    managerSignedByName: 'Morgan Manager',
    expenseEntries: [{ id: 'ex1', title: 'Parking', details: '', jobNumber: 'J-1', date: day, amount: 12, managerDecision: 'approved' as const }],
  }
  const frozen = applyWeeklyReportOverride({ ...base, bookings: [], draft: signed })
  assert.equal(frozen.weeklyReportOverride?.expenses[0].amount, 12)
  const existed = booking({ createdAt: new Date('2026-09-10T09:00:00Z'), updatedAt: new Date('2026-09-11T09:00:00Z') })
  const declined = { ...frozen, expenseEntries: frozen.expenseEntries.map((entry) => ({ ...entry, managerDecision: 'declined' as const })) }
  const repaired = applyWeeklyReportOverride({ ...base, bookings: [existed], draft: declined })
  assert.equal(repaired.weeklyReportOverride?.lines.length, 1)
  assert.equal(repaired.weeklyReportOverride?.expenses[0].amount, 12)
  const resigned = applyWeeklyReportOverride({ ...base, bookings: [existed], draft: declined, refreshSignedMoney: true })
  assert.equal(resigned.weeklyReportOverride?.expenses[0].amount, 0)
})

// Review r318 (2nd): Export builds the snapshot BEFORE it stamps `exportedAt` (TimesheetsScreen `persistExportedFlag`),
// because an exported snapshot is never rebuilt: built with `exportedAt` already set, a frozen-empty sheet stayed empty.
test('1.43.0: export rebuilds a frozen-empty snapshot before stamping exportedAt', () => {
  const signedAt = new Date('2026-09-18T09:00:00Z')
  const signed = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: day,
    operativeSignedByName: 'Ada Booked',
    managerSignedAt: signedAt,
    managerSignedByUserId: 'mgr',
    managerSignedByName: 'Morgan Manager',
  }
  const frozen = applyWeeklyReportOverride({ ...base, bookings: [], draft: signed })
  const existed = booking({ createdAt: new Date('2026-09-10T09:00:00Z'), updatedAt: new Date('2026-09-11T09:00:00Z') })
  const exportedAt = new Date('2026-09-20T09:00:00Z')
  // The old order (stamp, then build) keeps it empty for ever.
  const stampedFirst = applyWeeklyReportOverride({ ...base, bookings: [existed], draft: { ...frozen, exportedAt } })
  assert.equal(stampedFirst.weeklyReportOverride?.lines.length, 0)
  // The export's order: build with no export stamp, then stamp.
  const built = applyWeeklyReportOverride({ ...base, bookings: [existed], draft: { ...frozen, exportedAt: null } })
  const exported = { ...built, exportedAt }
  assert.equal(exported.weeklyReportOverride?.lines.length, 1)
  assert.equal(exported.exportedAt, exportedAt)
})

// Rulebook 1.46.0 (second independent review): Edit hours reviews never re-price a signed sheet or pay twice.
const OWNER_POLICY_146 = {
  ...DEFAULT_PAYROLL_POLICY,
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  breakPaid: false,
  paidHoursDerived: true,
  standardPaidHours: 8.5,
}
const day146 = new Date('2026-11-18T09:00:00Z')
const base146 = {
  ...base,
  user: user({ id: 'u1', dayRate: 250 }),
  operatives: [{ ...operative, dayRate: 250 }],
  weekStart: new Date('2026-11-16T00:00:00Z'),
  weekEnd: new Date('2026-11-22T00:00:00Z'),
  payrollPolicy: OWNER_POLICY_146,
}
function booking146(start: string, end: string): Booking {
  return booking({ date: day146, timeSlot: 'CUSTOM_HOURS', workStartTime: start, workEndTime: end, otMultiplierOverride: 2 } as Partial<Booking>)
}
function editReviews146(lineBookings: Booking[], start: string, end: string) {
  const summary = collectTimesheetPayroll({
    user: base146.user,
    bookings: lineBookings,
    managerSiteBookings: [],
    operatives: base146.operatives,
    projects: base146.projects,
    smallWorks: [],
    periodStart: base146.weekStart,
    periodEnd: base146.weekEnd,
    payrollPolicy: OWNER_POLICY_146,
    timeZone: 'Europe/London',
  })
  const row = summary.lineItems.find((line) => line.id === 'op-b1-normal')!
  const edit = payrollLineEdit({ row, lines: summary.lineItems, startTime: start, endTime: end, breakRemoved: false, policy: OWNER_POLICY_146, timeZone: 'Europe/London' })
  return Object.fromEntries(Object.entries(edit.reviewFieldsByLineId).map(([id, fields]) => [id, { decision: 'edited' as const, ...fields }]))
}
const signed146 = { operativeSignedAt: day146, operativeSignedByName: 'Ada Booked', managerSignedAt: day146, managerSignedByUserId: 'mgr', managerSignedByName: 'Morgan Manager' }
const labourTotal146 = (draft: { weeklyReportOverride?: { lines: { amount: number }[] } | null }) =>
  Math.round((draft.weeklyReportOverride?.lines ?? []).reduce((sum, line) => sum + line.amount, 0) * 100) / 100

test('1.46.0 review: a signed sheet is never re-priced by a stale Edit hours review on the next save', () => {
  // Edited 07:00–16:00 → 07:00–19:00, then the booking itself changed to 07:00–14:00, then signed.
  const reviews = editReviews146([booking146('07:00', '16:00')], '07:00', '19:00')
  assert.equal(reviews['op-b1-normal'].revisedAmount, 426.47)
  const later = [booking146('07:00', '14:00')]
  const signed = applyWeeklyReportOverride({ ...base146, bookings: later, draft: { ...emptyTimesheetDraft(), ...signed146, payrollLineReviews: reviews } })
  const atSigning = labourTotal146(signed)
  assert.ok(atSigning > 190 && atSigning < 192, `signed ${atSigning}`)
  assert.ok(signed.weeklyReportOverride?.lines.every((line) => line.bookingFingerprint))
  // The next save keeps what was signed — never 426.47, never an added overtime line.
  const next = applyWeeklyReportOverride({ ...base146, bookings: later, draft: signed })
  assert.equal(labourTotal146(next), atSigning)
  assert.equal(next.weeklyReportOverride?.lines.length, signed.weeklyReportOverride?.lines.length)
  // Stored and read back through Firestore, the fingerprint survives.
  const roundTrip = weeklyReportOverrideFromFirestore(weeklyReportOverrideToFirestore(signed.weeklyReportOverride!))
  assert.equal(roundTrip?.lines[0].bookingFingerprint, signed.weeklyReportOverride?.lines[0].bookingFingerprint)
})

test('1.46.0 review: an unchanged booking signs the edit as two parts and keeps them on the next save', () => {
  const now = [booking146('07:00', '16:00')]
  const reviews = editReviews146(now, '07:00', '19:00')
  const signed = applyWeeklyReportOverride({ ...base146, bookings: now, draft: { ...emptyTimesheetDraft(), ...signed146, payrollLineReviews: reviews } })
  const ids = signed.weeklyReportOverride?.lines.map((line) => [line.id, line.paidHours, line.amount])
  assert.deepEqual(ids, [['op-b1-normal', 8.5, 250], ['op-b1-ot', 3, 176.47]])
  const next = applyWeeklyReportOverride({ ...base146, bookings: now, draft: signed })
  assert.deepEqual(next.weeklyReportOverride?.lines.map((line) => [line.id, line.paidHours, line.amount]), ids)
})

test('1.46.0 review: a working-hours change that gives the booking its own overtime line makes the review stale (no 476.47, no duplicate -ot)', () => {
  const now = [booking146('07:00', '19:00')]
  // Reviewed under a day that ran to 19:00 (no overtime line), then the working day goes back to 07:00–16:00.
  const longDay = { ...OWNER_POLICY_146, standardDayEnd: '19:00' }
  const summary = collectTimesheetPayroll({
    user: base146.user, bookings: now, managerSiteBookings: [], operatives: base146.operatives, projects: base146.projects, smallWorks: [],
    periodStart: base146.weekStart, periodEnd: base146.weekEnd, payrollPolicy: longDay, timeZone: 'Europe/London',
  })
  const row = summary.lineItems.find((line) => line.id === 'op-b1-normal')!
  const edit = payrollLineEdit({ row, lines: summary.lineItems, startTime: '07:00', endTime: '20:00', breakRemoved: false, policy: longDay, timeZone: 'Europe/London' })
  const reviews = Object.fromEntries(Object.entries(edit.reviewFieldsByLineId).map(([id, fields]) => [id, { decision: 'edited' as const, ...fields }]))
  assert.ok((reviews['op-b1-normal'].revisedOvertimeAmount ?? 0) > 0)
  const signed = applyWeeklyReportOverride({ ...base146, bookings: now, draft: { ...emptyTimesheetDraft(), ...signed146, payrollLineReviews: reviews } })
  const lines = signed.weeklyReportOverride?.lines ?? []
  assert.equal(new Set(lines.map((line) => line.id)).size, lines.length)
  // The live booking under 07:00–16:00: 250 + 3h × 2 = 426.47 — the stale review is not paid on top.
  assert.equal(labourTotal146(signed), 426.47)
  assert.equal(reviews['op-b1-normal'].revisedAmount, 293.48)
  // Saved again after signing (third review of #324): the review is tested against the sheet as signed, so the
  // signed 426.47 holds — never re-priced down to the stale 293.48.
  const next = applyWeeklyReportOverride({ ...base146, bookings: now, draft: signed })
  assert.equal(labourTotal146(next), 426.47)
  assert.deepEqual(
    next.weeklyReportOverride?.lines.map((line) => [line.id, line.amount]),
    signed.weeklyReportOverride?.lines.map((line) => [line.id, line.amount])
  )
  // And after a round trip through Firestore.
  const stored = weeklyReportOverrideFromFirestore(weeklyReportOverrideToFirestore(signed.weeklyReportOverride!))
  const again = applyWeeklyReportOverride({ ...base146, bookings: now, draft: { ...signed, weeklyReportOverride: stored } })
  assert.equal(labourTotal146(again), 426.47)
})

test('1.46.0 review 3: a review changed after signing is applied once; the same review again changes nothing', () => {
  const now = [booking146('07:00', '16:00')]
  const signed = applyWeeklyReportOverride({ ...base146, bookings: now, draft: { ...emptyTimesheetDraft(), ...signed146 } })
  assert.equal(labourTotal146(signed), 250)
  // A review written after counter-signing still re-prices the signed sheet (as before 1.46.0; an owner question).
  const reviews = editReviews146(now, '07:00', '19:00')
  const edited = applyWeeklyReportOverride({ ...base146, bookings: now, draft: { ...signed, payrollLineReviews: reviews } })
  assert.equal(labourTotal146(edited), 426.47)
  const again = applyWeeklyReportOverride({ ...base146, bookings: now, draft: edited })
  assert.deepEqual(again.weeklyReportOverride?.lines, edited.weeklyReportOverride?.lines)
})

test('1.46.0 review 4: an overtime line added by a review follows that review after signing (declined, edited, approved)', () => {
  const now = [booking146('07:00', '16:00')]
  const signed = applyWeeklyReportOverride({
    ...base146,
    bookings: now,
    draft: { ...emptyTimesheetDraft(), ...signed146, payrollLineReviews: editReviews146(now, '07:00', '19:00') },
  })
  assert.equal(labourTotal146(signed), 426.47)
  assert.equal(signed.weeklyReportOverride?.lines.find((line) => line.id === 'op-b1-ot')?.reviewPartOf, 'op-b1-normal')
  const resave = (payrollLineReviews: Record<string, unknown>) =>
    applyWeeklyReportOverride({ ...base146, bookings: now, draft: { ...signed, payrollLineReviews: payrollLineReviews as never } })
  // Declined afterwards: the added overtime goes with it (was 0 + 176.47).
  assert.equal(labourTotal146(resave({ 'op-b1-normal': { decision: 'declined' } })), 0)
  // Edited again to 07:00–15:00 (no overtime): 220.59 only (was 220.59 + 176.47 = 397.06).
  assert.equal(labourTotal146(resave(editReviews146(now, '07:00', '15:00'))), 220.59)
  // Approved afterwards: the signed figures stay, as before 1.46.0.
  assert.equal(labourTotal146(resave({ 'op-b1-normal': { decision: 'approved' } })), 426.47)
  // Edited again to 07:00–18:00: both parts recomputed together (250 + 2h × 2 = 367.65).
  assert.equal(labourTotal146(resave(editReviews146(now, '07:00', '18:00'))), 367.65)
  // The recomputed overtime part keeps its own label and overtime flag (fifth review).
  const ot = resave(editReviews146(now, '07:00', '18:00')).weeklyReportOverride?.lines.find((line) => line.id === 'op-b1-ot')
  assert.equal(ot?.projectName, signed.weeklyReportOverride?.lines.find((line) => line.id === 'op-b1-ot')?.projectName)
  assert.match(ot?.projectName ?? '', /\(Overtime\)$/)
  assert.equal(ot?.isOvertime, true)
  // The standard line's review deleted after signing: both parts keep their signed amounts.
  assert.equal(labourTotal146(resave({})), 426.47)
  // A round trip through Firestore keeps the link.
  const stored = weeklyReportOverrideFromFirestore(weeklyReportOverrideToFirestore(signed.weeklyReportOverride!))
  assert.equal(stored?.lines.find((line) => line.id === 'op-b1-ot')?.reviewPartOf, 'op-b1-normal')
})

test('1.46.0 review 6: every snapshot line carries isPayeDay and isLeave, at signing, on re-apply and through Firestore', () => {
  const now = [booking146('07:00', '16:00')]
  const signed = applyWeeklyReportOverride({
    ...base146,
    bookings: now,
    draft: { ...emptyTimesheetDraft(), ...signed146, payrollLineReviews: editReviews146(now, '07:00', '19:00') },
  })
  const flags = (draft: typeof signed) => draft.weeklyReportOverride?.lines.map((line) => [line.id, line.isPayeDay, line.isLeave])
  assert.deepEqual(flags(signed), [['op-b1-normal', false, false], ['op-b1-ot', false, false]])
  const stored = weeklyReportOverrideToFirestore(signed.weeklyReportOverride!)
  assert.ok(stored.lines.every((line: Record<string, unknown>) => line.isPayeDay === false && line.isLeave === false))
  // An older snapshot without the flags gets them on the next save.
  const older = { ...signed, weeklyReportOverride: { ...signed.weeklyReportOverride!, lines: signed.weeklyReportOverride!.lines.map(({ isPayeDay: _p, isLeave: _l, ...line }) => line) } }
  const next = applyWeeklyReportOverride({ ...base146, bookings: now, draft: older })
  assert.deepEqual(flags(next), [['op-b1-normal', false, false], ['op-b1-ot', false, false]])
  const readBack = weeklyReportOverrideFromFirestore(stored)
  assert.equal(readBack?.lines[0].isPayeDay, false)
  // A line flagged PAYE on the signed copy never reaches the invoice.
  const paye = weeklyReportOverrideFromFirestore({ ...stored, lines: [{ ...stored.lines[0], isPayeDay: true }] })
  assert.equal(paye?.lines[0].isPayeDay, true)
})

test('1.54.0 third review of #337 (2): an exported sheet with late extras is frozen — its snapshot never changes', () => {
  const signed = applyWeeklyReportOverride({
    ...base,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
      managerSignedAt: day,
      managerSignedByUserId: 'mgr',
    },
  })
  const late = { kind: 'expense' as const, id: 'L1', title: 'Taxi', details: '', jobNumber: 'J-1', date: day, amount: 25, managerDecision: 'pending' as const }
  const exported = { ...signed, exportedAt: day, exportedAtStored: true, lateExtras: [late], payrollLineReviews: { 'op-b1-normal': { decision: 'declined' as const } } }
  const after = applyWeeklyReportOverride({ ...base, draft: exported })
  assert.equal(after.weeklyReportOverride, exported.weeklyReportOverride)
  // Without late extras an exported sheet behaves as before 1.54.0 (the decline still re-prices its snapshot).
  const legacy = applyWeeklyReportOverride({ ...base, draft: { ...exported, lateExtras: undefined } })
  assert.equal(legacy.weeklyReportOverride?.lines.find((row) => row.id === 'op-b1-normal')?.decision, 'declined')
})

test('1.67.0: a signed day-rate overtime line reads in hours only from the rate stored at signing (S1)', () => {
  const overtimeLine = (id: string, otMultiplier: number | null, stored = false) => ({
    id,
    date: day,
    jobNumber: 'J-1',
    projectName: 'Site One (Overtime)',
    locationKind: 'project' as const,
    details: '16:00–22:00',
    paidHours: 6,
    days: 6 / 8.5,
    amount: 238.24,
    payBasis: 'day' as const,
    isOvertime: true,
    otMultiplier,
    ...(stored ? { otBaseDayRate: 225, otDayRateHours: 8.5 } : {}),
    decision: 'approved' as const,
    bookingId: id,
  })
  const lines = invoiceLinesForTimesheet({
    payroll: { totalHours: 6, overtimeHours: 6, shiftCount: 1, baseAmount: 0, overtimeAmount: 238.24, workAmount: 238.24, lineItems: [] },
    timeZone: 'Europe/London',
    extrasMode: 'export',
    standardDayHours: 8.5,
    draft: {
      ...emptyTimesheetDraft(),
      weeklyReportOverride: {
        approvedAt: day,
        approvedByUserId: 'mgr',
        approvedByName: 'Morgan',
        selfSigned: false,
        // b1 stored its rate and divisor at signing (1.67.0); b3 stored only its multiplier (signed before 1.67.0);
        // b2 is an older line with no multiplier and no multiplied text.
        lines: [overtimeLine('b1', 1.5, true), overtimeLine('b2', null), overtimeLine('b3', 1.5)],
        priceWork: [],
        expenses: [],
      },
    },
  })
  assert.equal(lines[0].amount, 238.24)
  assert.equal(
    lines[0].details,
    '16:00–22:00 · 6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (£225.00/day ÷ 8.5h)'
  )
  // Multiplier unknown: the older wording stays (never a guessed ×1).
  assert.equal(lines[1].details, '16:00–22:00 · 0.71 days × £337.51/day = £238.24')
  // Signed before 1.67.0 (no stored rate): the older wording, never a rate worked out from the amount.
  assert.equal(lines[2].details, '16:00–22:00 · 0.71 days × £337.51/day = £238.24')
  assert.deepEqual(lines.map((line) => line.amount), [238.24, 238.24, 238.24])
})

test('1.67.0 S1: signing stores the real day rate and divisor; amounts are the same with or without them', () => {
  // Default working day 07:30–16:00 (8h), ×1.5; 07:30–19:00 at £200/day → 3h overtime.
  const longDay = booking({ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '19:00' } as Partial<Booking>)
  const signedDraft = applyWeeklyReportOverride({
    ...base,
    bookings: [longDay],
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
      managerSignedAt: day,
      managerSignedByUserId: 'mgr',
      managerSignedByName: 'Morgan Manager',
    },
  })
  const override = signedDraft.weeklyReportOverride!
  const ot = override.lines.find((row) => row.isOvertime)!
  assert.ok(ot, 'an overtime line was signed')
  assert.equal(ot.otBaseDayRate, 200, "the person's own day rate, never multiplied")
  assert.equal(ot.otDayRateHours, 8)
  // Firestore round trip keeps them.
  const stored = weeklyReportOverrideFromFirestore(weeklyReportOverrideToFirestore(override))!
  const storedOt = stored.lines.find((row) => row.isOvertime)!
  assert.equal(storedOt.otBaseDayRate, 200)
  assert.equal(storedOt.otDayRateHours, 8)
  const payroll = collectTimesheetPayroll({ ...base, bookings: [longDay], periodStart: base.weekStart, periodEnd: base.weekEnd } as never)
  const liveOt = payroll.lineItems.find((line) => line.isOvertimeLine)!
  assert.equal(ot.amount, liveOt.amount)
  const invoice = (lines: typeof override.lines) =>
    invoiceLinesForTimesheet({
      // The booking is gone from the period: the signed rows are shown from the snapshot alone.
      payroll: { ...payroll, lineItems: [] },
      timeZone: 'Europe/London',
      extrasMode: 'export',
      standardDayHours: 8,
      draft: { ...emptyTimesheetDraft(), weeklyReportOverride: { ...override, lines } },
    })
  const withRate = invoice(stored.lines)
  // "Before" (a line signed before 1.67.0): the same lines without the stored rate and divisor.
  const withoutRate = invoice(stored.lines.map(({ otBaseDayRate: _r, otDayRateHours: _d, ...rest }) => rest))
  assert.deepEqual(withRate.map((line) => line.amount), withoutRate.map((line) => line.amount), 'amounts never depend on the wording')
  const otIndex = stored.lines.findIndex((row) => row.isOvertime)
  assert.match(withRate[otIndex].details, new RegExp(`${ot.paidHours}h × 1\\.5 = .* × £25\\.00/h = `), withRate[otIndex].details)
  assert.match(withoutRate[otIndex].details, /days? × £300\.00\/day/, withoutRate[otIndex].details)
})
