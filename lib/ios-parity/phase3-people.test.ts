import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole } from '../../types/index.ts'
import type { User } from '../../types/index.ts'
import {
  filterRosterByNameQuery,
  getManagerUsers,
  getManagersRosterUsers,
} from '../staff/userRosterUtils.ts'
import { coversCalendarDay, dayKey } from './londonTime.ts'
import { normalizeTimeSlot } from './enums.ts'

function user(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Ada',
    surname: 'Lovelace',
    organizationId: 'org',
    role: UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: true,
      operatives: true,
      skills: false,
      qualifications: false,
      materials: false,
      projects: true,
      smallWorks: true,
      operativeMode: false,
      annualLeaveSelfBook: false,
      weeklyReports: true,
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

test('getManagersRosterUsers excludes admins; getManagerUsers still includes them', () => {
  const manager = user({ id: 'm', email: 'm@x.com', firstName: 'Mo', surname: 'Manager' })
  const admin = user({
    id: 'a',
    email: 'a@x.com',
    firstName: 'Al',
    surname: 'Admin',
    role: UserRole.ADMIN,
    permissions: { ...manager.permissions, adminAccess: true, manager: true },
  })
  const roster = getManagersRosterUsers([manager, admin])
  const pickers = getManagerUsers([manager, admin])
  assert.equal(roster.length, 1)
  assert.equal(roster[0].id, 'm')
  assert.equal(pickers.length, 2)
})

test('filterRosterByNameQuery token-matches name email and phone', () => {
  const rows = [
    user({ id: '1', email: 'ada@x.com', firstName: 'Ada', surname: 'Booked', mobileNumber: '07700' }),
    user({ id: '2', email: 'bob@x.com', firstName: 'Bob', surname: 'Free' }),
  ]
  assert.equal(filterRosterByNameQuery(rows, 'ada booked').length, 1)
  assert.equal(filterRosterByNameQuery(rows, '077').length, 1)
  assert.equal(filterRosterByNameQuery(rows, 'zzz').length, 0)
})

test('coversCalendarDay matches UTC midnight and London midnight', () => {
  const londonDay = new Date('2026-09-16T12:00:00Z')
  assert.equal(dayKey(londonDay), '2026-09-16')
  assert.equal(coversCalendarDay(new Date('2026-09-16T00:00:00Z'), londonDay), true)
  assert.equal(coversCalendarDay(new Date('2026-09-15T23:00:00Z'), londonDay), true)
  assert.equal(coversCalendarDay(new Date('2026-09-14T12:00:00Z'), londonDay), false)
  // Adjacent UTC calendar dates must not leak in via toDateString().
  assert.equal(coversCalendarDay(new Date('2026-09-15T12:00:00Z'), londonDay), false)
})

test('normalizeTimeSlot accepts Full Day aliases', () => {
  assert.equal(normalizeTimeSlot('Full Day'), 'FULL DAY')
  assert.equal(normalizeTimeSlot('FULL_DAY'), 'FULL DAY')
  assert.equal(normalizeTimeSlot('morning'), 'AM')
})
