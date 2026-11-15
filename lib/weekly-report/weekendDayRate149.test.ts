// Rulebook 1.49.0 §8 (owner decision 15 Nov, option A): a full Saturday / Sunday set window pays exactly one day rate.
// The owner's reference fortnight (Test Admin, 1–15 Nov 2026): the weekly report pay rows, the timesheet totals and
// the invoice rows must all give £3,141.76.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { buildWeeklyReportData } from './weeklyReportData.ts'
import { collectTimesheetPayroll } from '../timesheets/timesheetPayrollCollector.ts'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '../settings/organizationSettings.ts'
import type { OperativeDayRateHistoryCollection } from '../timesheets/dayRateHistoryStorage.ts'
import { payrollDayRateHours, payrollHoursResult, timesheetInvoiceRows, timesheetTotals } from '../canonical/index.ts'

const zone = 'Europe/London'

// 07:00–16:00 with a 30-minute unpaid break: the weekday paid day is 8.5h. Saturday and Sunday: 07:30–14:00 counts as
// 8h (paid break), outside ×1.5.
const weekend = {
  allHoursAtMultiplierMode: false,
  allHoursMultiplier: 2,
  definedWindowStart: '07:30',
  definedWindowEnd: '14:00',
  countsAsStandardHours: 8,
  outsideWindowMultiplier: 1.5,
  breakPaid: true,
}
const policy: OrgPayrollTimePolicy = {
  ...DEFAULT_PAYROLL_POLICY,
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  standardPaidHours: 8.5,
  paidHoursDerived: true,
  weekdayOutsideStandardMultiplier: 1.5,
  saturday: { ...weekend },
  sunday: { ...weekend, sameAsSaturday: false },
} as OrgPayrollTimePolicy

const at = new Date('2026-11-01T00:00:00Z')

const admin = {
  id: 'u-admin',
  email: 'admin@x.com',
  firstName: 'Test',
  surname: 'Admin',
  organizationId: 'org',
  role: 'admin',
  passwordSet: true,
  policyAccepted: true,
  permissions: {
    adminAccess: true,
    manager: true,
    operatives: true,
    skills: true,
    qualifications: true,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    annualLeaveSelfBook: true,
    weeklyReports: true,
    dailyOverview: true,
    subContractors: true,
    siteAudit: true,
    wholesalersOrderHistory: true,
  },
  isSuperAdmin: false,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: at,
  payBasis: 'day',
  dayRate: 240,
  employmentType: 'self_employed',
} as User

const operative: Operative = {
  id: 'op-admin',
  firstName: 'Test',
  lastName: 'Admin',
  email: 'admin@x.com',
  startDate: at,
  hourlyRate: 0,
  dayRate: 240,
  skills: [],
  qualifications: [],
  isActive: true,
  createdAt: at,
  updatedAt: at,
}

const project: Project = {
  id: 'proj1',
  jobNumber: 'C646',
  siteName: '1 Carnaby Street',
  addressLine1: '1 Carnaby Street',
  townCity: 'London',
  postcode: 'W1F 9PS',
  client: { id: 'c1', name: 'Client', createdAt: at, updatedAt: at },
  startDate: at,
  endDate: new Date('2026-12-31T00:00:00Z'),
  jobType: 'CAT A',
  manager: { name: 'Custom', email: '' },
  isLive: true,
  createdAt: at,
  updatedAt: at,
}

// £250/day until 13 Nov; £240/day from 14 Nov (organisation-zone midnight; GMT in November).
const history: OperativeDayRateHistoryCollection = {
  byUserId: {
    'u-admin': [
      { id: 'h1', userId: 'u-admin', operativeId: '', dayRate: 250, payBasis: 'day', effectiveAt: new Date('2026-01-01T00:00:00Z'), createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'h2', userId: 'u-admin', operativeId: '', dayRate: 240, payBasis: 'day', effectiveAt: new Date('2026-11-14T00:00:00Z'), createdAt: new Date('2026-11-14T00:00:00Z') },
    ],
  },
  byOperativeId: {},
}

function custom(id: string, day: string, start: string, end: string, otMultiplierOverride?: number): Booking {
  return {
    id,
    operativeId: 'u-admin',
    projectId: 'proj1',
    date: new Date(`${day}T12:00:00Z`),
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: start,
    workEndTime: end,
    bookedBy: 'Test Admin',
    status: 'Confirmed',
    createdAt: at,
    updatedAt: at,
    ...(otMultiplierOverride != null ? { otMultiplierOverride } : {}),
  } as Booking
}

// Mon–Fri: 7 working days (59.5h standard), 12h of overtime at ×1.5 and 6.5h at ×2 = 90.5 paid hours at £250/day.
const bookings: Booking[] = [
  custom('b02', '2026-11-02', '07:00', '16:00'),
  custom('b03', '2026-11-03', '07:00', '16:00'),
  custom('b04', '2026-11-04', '07:00', '16:00'),
  custom('b05', '2026-11-05', '07:00', '21:00'),
  custom('b06', '2026-11-06', '07:00', '23:00'),
  custom('b09', '2026-11-09', '07:00', '22:30', 2),
  custom('b10', '2026-11-10', '07:00', '16:00'),
  // Saturday 14 and Sunday 15: the whole 07:30–14:00 window, counts as 8h, at £240/day.
  custom('b14', '2026-11-14', '07:30', '14:00'),
  custom('b15', '2026-11-15', '07:30', '14:00'),
]

const periodStart = new Date('2026-11-01T00:00:00Z')
const periodEnd = new Date('2026-11-15T23:59:59Z')

test('1.49.0 payrollDayRateHours: a set-window weekend day divides its standard part by that day\'s "counts as"', () => {
  assert.deepEqual(payrollDayRateHours({ policy, dayKey: '2026-11-14', timeZone: zone }), { standardDayHours: 8, overtimeDayHours: 8.5 })
  assert.deepEqual(payrollDayRateHours({ policy, dayKey: '2026-11-13', timeZone: zone }), { standardDayHours: 8.5, overtimeDayHours: 8.5 })
  // A weekend day paid every hour at N× keeps the weekday paid day for everything.
  const allHours = { ...policy, sunday: { ...policy.sunday, allHoursAtMultiplierMode: true } } as OrgPayrollTimePolicy
  assert.deepEqual(payrollDayRateHours({ policy: allHours, dayKey: '2026-11-15', timeZone: zone }), { standardDayHours: 8.5, overtimeDayHours: 8.5 })
  // Partial window stays pro rata: 07:30–10:30 of a 6.5h window counting 8h credits 3.69h = 3.69/8 of a day.
  const partial = payrollHoursResult({ booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '10:30' }, dayKey: '2026-11-14', policy, timeZone: zone })
  assert.equal(Math.round(partial.standardHours * 100) / 100, 3.69)
  assert.equal(partial.standardPartDayHours, 8)
})

test('1.49.0 owner reference fortnight: weekly report, timesheet totals and invoice all give £3,141.76', () => {
  const summary = collectTimesheetPayroll({
    user: admin,
    bookings,
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart,
    periodEnd,
    payrollPolicy: policy,
    timeZone: zone,
    history,
  })
  const weekendLines = summary.lineItems.filter((line) => line.id === 'op-b14-normal' || line.id === 'op-b15-normal')
  assert.deepEqual(weekendLines.map((line) => line.amount), [240, 240])
  assert.deepEqual(weekendLines.map((line) => line.paidHours / line.standardDayHours), [1, 1])
  const weekday = summary.lineItems.filter((line) => !line.id.startsWith('op-b14') && !line.id.startsWith('op-b15'))
  const weekdayTotal = Math.round(weekday.reduce((sum, line) => sum + line.amount, 0) * 100) / 100
  assert.equal(weekdayTotal, 2661.76)

  const rows = timesheetInvoiceRows({ sheet: {}, payrollLines: summary.lineItems, extrasMode: 'raw', timeZone: zone })
  const invoiceTotal = Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
  assert.equal(invoiceTotal, 3141.76)
  assert.equal(timesheetTotals({ sheet: {}, payrollLines: summary.lineItems, extrasMode: 'raw', timeZone: zone }).total, 3141.76)

  const report = buildWeeklyReportData({
    organizationName: 'Raccord MEP',
    period: { start: periodStart, end: periodEnd, label: '1 – 15 November 2026' },
    bookings,
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [admin],
    projects: [project],
    smallWorks: [],
    holidays: [],
    history,
    orgDetails: { countryCode: 'GB', payrollTimePolicy: policy } as never,
  })
  assert.equal(report.grandTotal, 3141.76)
  const person = report.paySummary.find((row) => row.person === 'Test Admin')
  assert.ok(person)
  assert.equal(person!.personTotal, 3141.76)
  const weekendRow = person!.lines.find((line) => line.rate === 240)
  assert.ok(weekendRow)
  assert.equal(weekendRow!.days.toFixed(2), '2.00')
  assert.equal(weekendRow!.pay, 480)
  assert.match(String(weekendRow!.quantityText), /2\.00 days?/)
  // Today's code divided the 16 weekend hours by the weekday 8.5h: 1.88 days, £451.76.
  assert.ok(!person!.lines.some((line) => Math.abs(line.pay - 451.76) < 0.005))
})
