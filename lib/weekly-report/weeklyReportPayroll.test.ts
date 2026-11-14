import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Operative, type User } from '../../types/index.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { findUserAndOperative, labourPaySlices, paySliceDisplay, resolvePersonTrade, signedLabourSlice } from './weeklyReportPayroll.ts'

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
    operativeMode: true,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

function person(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Test',
    surname: 'Manager',
    organizationId: 'org',
    role: UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: perms({ manager: true }),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  } as User
}

function roster(partial: Partial<Operative> & { id: string }): Operative {
  return {
    firstName: 'Test',
    lastName: 'Manager',
    email: 'boss@site.test',
    startDate: new Date('2026-01-01'),
    hourlyRate: 0,
    dayRate: 25,
    payBasis: 'day',
    skills: ['CIjapy1jlgsS95wUUR4e'],
    qualifications: [],
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  } as Operative
}

const day = new Date('2026-10-08T12:00:00+01:00')

test('a booking on a duplicate operative profile uses that person\'s account rate and trade', () => {
  const blank = person({ id: 'U-BLANK', email: 'boss@site.test', tradeTypePreset: '' })
  const named = person({
    id: 'U-NAMED',
    email: 'boss@site.test',
    tradeTypePreset: 'Electrician',
    payBasis: 'hourly',
    hourlyRate: 25,
  })
  const profile = roster({ id: 'OP-DUP' })
  const linked = findUserAndOperative([blank, named], [profile], { operativeId: 'OP-DUP' })
  assert.equal(linked.user?.id, 'U-NAMED')
  assert.equal(resolvePersonTrade(linked.user, linked.operative), 'Electrician')
  assert.equal(resolvePersonTrade(undefined, profile), 'General')
  const slices = labourPaySlices({
    date: day,
    timeSlot: 'FULL DAY',
    user: linked.user,
    operative: linked.operative,
    payroll: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(slices[0]?.payBasis, 'hourly')
  assert.equal(slices[0]?.rate, 25)
  assert.equal(slices[0]?.pay, 200)
})

test('labourPaySlices pays unrounded hours, as the timesheet collector does (20 minutes at £20/h is £6.67)', () => {
  const user = {
    id: 'u-hourly',
    email: 'h@x.com',
    firstName: 'H',
    surname: 'Ourly',
    payBasis: 'hourly',
    hourlyRate: 20,
    employmentType: 'self_employed',
    isActive: true,
  } as unknown as User
  const slices = labourPaySlices({
    date: new Date('2026-10-08T08:00:00Z'),
    timeSlot: 'Custom',
    workStartTime: '07:30',
    workEndTime: '07:50',
    user,
    timeZone: 'Europe/London',
  })
  assert.equal(slices.length, 1)
  assert.equal(slices[0]?.pay, 6.67)
})

// Rulebook 1.20.3: the weekly report (on screen, PDF, XLSX, HTML all print `quantityText` / `rateText`) shows hours at
// a multiplier as clock hours with the break off as plain hours — never the back-calculated base — at the same pay.
test('1.20.3: weekly report overtime with a break shows "6.5h × 2 − 0.5h break = 12.5h" at the base rate; pay unchanged', () => {
  const user = {
    id: 'u-hourly',
    email: 'h@x.com',
    firstName: 'H',
    surname: 'Ourly',
    payBasis: 'hourly',
    hourlyRate: 20,
    employmentType: 'self_employed',
    isActive: true,
  } as unknown as User
  const payroll = {
    ...DEFAULT_PAYROLL_POLICY,
    saturday: {
      ...DEFAULT_PAYROLL_POLICY.saturday,
      allHoursAtMultiplierMode: false,
      definedWindowStart: '07:30',
      definedWindowEnd: '11:00',
      countsAsStandardHours: 4,
      outsideWindowMultiplier: 2,
      breakPaid: false,
    },
    sunday: { ...DEFAULT_PAYROLL_POLICY.sunday, allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false, breakPaid: false },
  }
  const slicesOn = (date: string) =>
    labourPaySlices({ date: new Date(`${date}T10:00:00Z`), timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '14:00', user, payroll, timeZone: 'Europe/London' })
  const sun = slicesOn('2026-11-08')
  assert.deepEqual(sun.map((slice) => [slice.isOvertime, slice.paidHours, slice.pay, slice.clockHours, slice.breakHours]), [[true, 6.25, 250, 6.5, 0.5]])
  const sunShown = paySliceDisplay(sun[0], 8, 'GBP')
  assert.deepEqual(
    [sunShown.rateType, sunShown.quantityText, sunShown.rateText, sunShown.pay, sunShown.days, sunShown.rate],
    ['Hourly OT x2', '6.5h × 2 − 0.5h break = 12.5h', '£20.00/hr', 250, 12.5, 20]
  )
  const sat = slicesOn('2026-11-07')
  assert.deepEqual(sat.map((slice) => [slice.isOvertime, slice.paidHours, slice.pay]), [[false, 4, 80], [true, 2.75, 110]])
  assert.equal(paySliceDisplay(sat[1], 8, 'GBP').quantityText, '3h × 2 − 0.5h break = 5.5h')
  // A signed sheet stored the line text only: the same display, the signed amount.
  const signed = signedLabourSlice(
    { paidHours: 6.25, days: 0, amount: 250, isOvertime: true, payBasis: 'hourly', otMultiplier: 2, details: 'OT 6.5h × 2 − 0.5h break = 12.5h' },
    8,
    2
  )
  const signedShown = paySliceDisplay(signed, 8, 'GBP')
  assert.deepEqual([signedShown.quantityText, signedShown.rateText, signedShown.pay], ['6.5h × 2 − 0.5h break = 12.5h', '£20.00/hr', 250])
  // Without a break nothing changes: "6.50 hours" × the multiplied rate.
  const paidBreak = labourPaySlices({
    date: new Date('2026-11-08T10:00:00Z'), timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '14:00', user,
    payroll: { ...payroll, sunday: { ...payroll.sunday, breakPaid: true } }, timeZone: 'Europe/London',
  })
  assert.deepEqual([paidBreak[0].pay, paySliceDisplay(paidBreak[0], 8, 'GBP').quantityText], [260, '6.50 hours'])
})

test('1.44.0: a signed day-rate line shows its stored days and rate, never re-read on today\'s paid day', () => {
  // Signed before 1.44.0 on a stored 8h day (07:00–16:00, 30 min unpaid): FULL DAY 8.5h = 1.0625 days × £250 = £265.63.
  // Today's derived day is 8.5h; the line must still read 1.0625 days × £250/day, not "1 day × £265.63" / "0.94 days".
  const line = { paidHours: 8.5, days: 1.0625, amount: 265.63, isOvertime: false, payBasis: 'day' }
  const slice = signedLabourSlice(line, 8.5, null)
  assert.deepEqual([slice.standardDayHours, slice.rate, slice.pay], [8, 250, 265.63])
  const shown = paySliceDisplay(slice, 8.5, 'GBP')
  assert.deepEqual([shown.days, shown.rateText, shown.pay], [1.0625, '£250.00/day', 265.63])
  // Today's day changing again never moves it.
  assert.deepEqual(paySliceDisplay(signedLabourSlice(line, 7.25, null), 7.25, 'GBP').days, 1.0625)
})
