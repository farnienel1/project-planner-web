import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Operative, type User } from '../../types/index.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { findUserAndOperative, labourPaySlices, resolvePersonTrade } from './weeklyReportPayroll.ts'

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
