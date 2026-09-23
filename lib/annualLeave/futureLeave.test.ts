import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type HolidayBooking, type User } from '../../types/index.ts'
import { canManagePersonAnnualLeave, type AnnualLeavePerson } from './annualLeavePerson.ts'
import { isFutureAcceptedAnnualLeave } from './holidayApprovalUtils.ts'

function booking(partial: Partial<HolidayBooking> & { id: string; startDate: Date; endDate: Date }): HolidayBooking {
  return {
    organizationId: 'org',
    status: 'approved',
    timeSlot: 'FULL DAY',
    createdAt: partial.startDate,
    updatedAt: partial.startDate,
    ...partial,
  }
}

const today = new Date('2026-09-23T12:00:00+01:00')

test('future accepted leave is listed and past or today-only leave is not', () => {
  const tomorrow = booking({
    id: 'future',
    startDate: new Date('2026-09-24T12:00:00+01:00'),
    endDate: new Date('2026-09-24T12:00:00+01:00'),
  })
  const spanning = booking({
    id: 'span',
    startDate: new Date('2026-09-22T12:00:00+01:00'),
    endDate: new Date('2026-09-25T12:00:00+01:00'),
  })
  const todayOnly = booking({
    id: 'today',
    startDate: today,
    endDate: today,
  })
  const past = booking({
    id: 'past',
    startDate: new Date('2026-09-01T12:00:00+01:00'),
    endDate: new Date('2026-09-02T12:00:00+01:00'),
  })
  const pending = booking({
    id: 'pending',
    startDate: new Date('2026-10-01T12:00:00+01:00'),
    endDate: new Date('2026-10-01T12:00:00+01:00'),
    status: 'pending',
  })

  assert.equal(isFutureAcceptedAnnualLeave(tomorrow, today), true)
  assert.equal(isFutureAcceptedAnnualLeave(spanning, today), true)
  assert.equal(isFutureAcceptedAnnualLeave(todayOnly, today), false)
  assert.equal(isFutureAcceptedAnnualLeave(past, today), false)
  assert.equal(isFutureAcceptedAnnualLeave(pending, today), false)
})

function person(partial: Partial<AnnualLeavePerson> & { id: string }): AnnualLeavePerson {
  return {
    displayName: 'Sam Operative',
    subtitle: 'Operative',
    tradeLabel: 'General',
    firstNameSort: 'Sam',
    surnameSort: 'Operative',
    ...partial,
  }
}

function member(partial: Partial<User> & { id: string }): User {
  return {
    email: `${partial.id}@site.test`,
    firstName: 'Sam',
    surname: 'Operative',
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
    createdAt: today,
    updatedAt: today,
    ...partial,
  } as User
}

test('admins manage every person and managers only their line reports', () => {
  const admin = member({
    id: 'admin',
    role: UserRole.ADMIN,
    permissions: {
      adminAccess: true,
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
  })
  const manager = member({
    id: 'mgr',
    role: UserRole.MANAGER,
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
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
  })
  const report = member({ id: 'op', assignedManagerUserIds: ['mgr'] })
  const other = member({ id: 'other', assignedManagerUserId: 'someone-else' })
  const users = [admin, manager, report, other]
  const reportPerson = person({ id: 'user-op', userId: 'op' })
  const otherPerson = person({ id: 'user-other', userId: 'other', displayName: 'Other' })

  assert.equal(canManagePersonAnnualLeave(admin, reportPerson, users), true)
  assert.equal(canManagePersonAnnualLeave(admin, otherPerson, users), true)
  assert.equal(canManagePersonAnnualLeave(manager, reportPerson, users), true)
  assert.equal(canManagePersonAnnualLeave(manager, otherPerson, users), false)
})
