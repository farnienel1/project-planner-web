import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Operative, type User } from '../../types/index.ts'
import { findUserAndOperative, resolvePersonTrade, signedLabourSlice } from './weeklyReportPayroll.ts'

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
  // Rulebook 1.51.0: the rate and pay of the row are `weeklyReportPayRows` (canonical tests).
})

test('1.44.0: a signed day-rate line shows its stored days and rate, never re-read on today\'s paid day', () => {
  // Signed before 1.44.0 on a stored 8h day (07:00–16:00, 30 min unpaid): FULL DAY 8.5h = 1.0625 days × £250 = £265.63.
  // Today's derived day is 8.5h; the line must still read 1.0625 days × £250/day, not "1 day × £265.63" / "0.94 days".
  const line = { paidHours: 8.5, days: 1.0625, amount: 265.63, isOvertime: false, payBasis: 'day' }
  const slice = signedLabourSlice(line, 8.5, null)
  assert.deepEqual([slice.standardDayHours, slice.rate, slice.pay], [8, 250, 265.63])
  // Today's day changing again never moves it.
  assert.deepEqual(signedLabourSlice(line, 7.25, null).standardDayHours, 8)
})
