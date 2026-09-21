import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Operative, User } from '../../types/index.ts'
import {
  rateFromHistory,
  resolveForTimesheetDay,
  resolvePayrollRate,
} from './payrollRateResolver.ts'
import type { OperativeDayRateHistoryCollection } from './dayRateHistoryStorage.ts'
import { emptyDayRateHistory } from './dayRateHistoryStorage.ts'

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

function historyFor(entries: Array<{ dayRate: number; effectiveAt: string }>): OperativeDayRateHistoryCollection {
  return {
    byUserId: {
      u1: entries.map((entry, index) => ({
        id: `h${index}`,
        userId: 'u1',
        operativeId: 'op1',
        dayRate: entry.dayRate,
        effectiveAt: new Date(entry.effectiveAt),
        createdAt: new Date(entry.effectiveAt),
      })),
    },
    byOperativeId: {},
  }
}

test('rateFromHistory uses the last entry on or before the day, including explicit £0', () => {
  const history = historyFor([
    { dayRate: 180, effectiveAt: '2026-01-01T00:00:00Z' },
    { dayRate: 0, effectiveAt: '2026-09-01T00:00:00Z' },
    { dayRate: 220, effectiveAt: '2026-10-01T00:00:00Z' },
  ])
  assert.equal(rateFromHistory(history, 'u1', 'op1', new Date('2026-08-15T12:00:00Z')), 180)
  assert.equal(rateFromHistory(history, 'u1', 'op1', new Date('2026-09-15T12:00:00Z')), 0)
  assert.equal(rateFromHistory(history, 'u1', 'op1', new Date('2026-10-15T12:00:00Z')), 220)
  assert.equal(rateFromHistory(emptyDayRateHistory(), 'u1', 'op1', new Date('2026-09-15T12:00:00Z')), null)
})

test('explicit history £0 wins over live day rate', () => {
  const history = historyFor([{ dayRate: 0, effectiveAt: '2026-01-01T00:00:00Z' }])
  const resolved = resolvePayrollRate({
    user: user({ id: 'u1', dayRate: 250 }),
    operative,
    day: new Date('2026-09-21T12:00:00Z'),
    history,
  })
  assert.equal(resolved.basis, 'dayRate')
  assert.equal(resolved.dayRate, 0)
  assert.equal(resolved.hourlyRate, null)
})

test('PAYE timesheet days return nil rates even when history exists', () => {
  const history = historyFor([{ dayRate: 180, effectiveAt: '2026-01-01T00:00:00Z' }])
  const resolved = resolveForTimesheetDay({
    user: user({ id: 'u1', employmentType: 'paye', dayRate: 200 }),
    operative,
    day: new Date('2026-09-21T12:00:00Z'),
    history,
  })
  assert.equal(resolved.dayRate, null)
  assert.equal(resolved.hourlyRate, null)
})
