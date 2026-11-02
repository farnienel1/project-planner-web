import assert from 'node:assert/strict'
import test from 'node:test'
import { receivesTimesheetSubmissionReminder } from './deliverTimesheetSubmissionReminders.ts'
import type { User } from '../../types/index.ts'

function user(partial: Partial<User> & Pick<User, 'id' | 'employmentType'>): User {
  return {
    email: `${partial.id}@firm.test`,
    firstName: 'Test',
    surname: 'User',
    role: 'operative',
    isActive: true,
    isSuperAdmin: false,
    organizationId: 'org',
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
      siteAudit: false,
      subContractors: false,
      wholesalersOrderHistory: false,
    },
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User
}

test('timesheet submission reminders go to people who submit timesheets, not inactive PAYE staff', () => {
  const now = new Date('2026-10-17T08:00:00+01:00')
  assert.equal(
    receivesTimesheetSubmissionReminder(user({ id: 'se', employmentType: 'self_employed' }), now, 'Europe/London'),
    true
  )
  assert.equal(
    receivesTimesheetSubmissionReminder(
      user({ id: 'paye-on', employmentType: 'paye', timesheetsEnabled: true }),
      now,
      'Europe/London'
    ),
    true
  )
  // Rulebook 1.10.0 `timesheetParticipant` (§8 `defaultTimesheetsEnabled`): a PAYE operative with the toggle not
  // stored takes part; switched off, or a PAYE manager, does not.
  assert.equal(
    receivesTimesheetSubmissionReminder(user({ id: 'paye-op', employmentType: 'paye' }), now, 'Europe/London'),
    true
  )
  assert.equal(
    receivesTimesheetSubmissionReminder(user({ id: 'paye-off', employmentType: 'paye', timesheetsEnabled: false }), now, 'Europe/London'),
    false
  )
  assert.equal(
    receivesTimesheetSubmissionReminder(
      user({ id: 'paye-mgr', employmentType: 'paye', role: 'manager', permissions: { ...user({}).permissions, operativeMode: false, manager: true } } as Partial<User>),
      now,
      'Europe/London'
    ),
    false
  )
  assert.equal(
    receivesTimesheetSubmissionReminder(
      user({ id: 'gone', employmentType: 'self_employed', isActive: false }),
      now,
      'Europe/London'
    ),
    false
  )
})
