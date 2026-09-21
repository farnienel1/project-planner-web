import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import { canAccessMyTimesheetsWithPolicy } from './timesheetPayrollPolicy.ts'
import { DEFAULT_INVOICING } from '../settings/organizationSettings.ts'

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
    employmentType: 'self_employed',
    ...partial,
  } as User
}

test('self-employed users always keep My Timesheets', () => {
  assert.equal(
    canAccessMyTimesheetsWithPolicy(user({ id: 'u1' }), DEFAULT_INVOICING, new Date('2026-09-21T12:00:00Z')),
    true
  )
})

test('PAYE users keep My Timesheets until the open period is paid if it has SE days', () => {
  const switched = user({
    id: 'u1',
    employmentType: 'paye',
    employmentTypeTransitionFrom: 'self_employed',
    employmentTypeEffectiveAt: new Date('2026-09-25T00:00:00Z'),
  })
  assert.equal(
    canAccessMyTimesheetsWithPolicy(switched, DEFAULT_INVOICING, new Date('2026-09-21T12:00:00Z')),
    true
  )
})

test('PAYE users with no self-employed days in the period do not get My Timesheets', () => {
  const paye = user({ id: 'u1', employmentType: 'paye' })
  assert.equal(
    canAccessMyTimesheetsWithPolicy(paye, DEFAULT_INVOICING, new Date('2026-09-21T12:00:00Z')),
    false
  )
})
