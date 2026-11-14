import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extraFormJobSuggestions,
  subjectForUser,
  timesheetRosterGroups,
} from './timesheetWeekUtils.ts'
import type { Operative, User } from '../../types/index.ts'

function user(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Ada',
    surname: 'Lovelace',
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
    ...partial,
  } as User
}

test('subjectForUser is the signed-in person only, including their operative link', () => {
  const me = user({ id: 'u1', email: 'me@test.com', firstName: 'Me', surname: 'Self' })
  const operatives = [
    { id: 'op1', firstName: 'Me', lastName: 'Self', email: 'me@test.com', qualifications: [] },
    { id: 'op2', firstName: 'Other', lastName: 'Person', email: 'other@test.com', qualifications: [] },
  ] as Operative[]
  const subject = subjectForUser(me, operatives)
  assert.equal(subject.userId, 'u1')
  assert.equal(subject.operativeId, 'op1')
})

test('timesheetRosterGroups keeps other people out: managers only see their reports', () => {
  const manager = user({
    id: 'mgr',
    email: 'mgr@test.com',
    role: 'manager',
    permissions: { ...user({ id: 'x', email: 'x' }).permissions, manager: true, operativeMode: false },
  })
  const report = user({ id: 'r1', email: 'r1@test.com', assignedManagerUserId: 'mgr' })
  const other = user({ id: 'r2', email: 'r2@test.com', assignedManagerUserId: 'someone-else' })
  const groups = timesheetRosterGroups(manager, [report, other, manager])
  assert.deepEqual(
    groups.map((group) => group.map((row) => row.id)),
    [['r1']]
  )
})

test('same email is one person for the line-manager queue', () => {
  const manager = user({
    id: 'mgr',
    email: 'mgr@test.com',
    role: 'manager',
    permissions: { ...user({ id: 'x', email: 'x' }).permissions, manager: true, operativeMode: false },
  })
  const invite = user({ id: 'invite', email: 'ada@test.com', assignedManagerUserId: 'mgr' })
  const auth = user({ id: 'auth', email: 'ada@test.com', payBasis: 'hourly', hourlyRate: 20 })
  const groups = timesheetRosterGroups(manager, [invite, auth, manager])
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].map((row) => row.id).sort(), ['auth', 'invite'])
})

test('extraFormJobSuggestions dedupes the same job number from projects and small works', () => {
  const jobs = extraFormJobSuggestions(
    [
      { jobNumber: 'J-1', siteName: 'Site One' },
      { jobNumber: 'J-1', siteName: 'Site One SW' },
      { jobNumber: 'J-22', siteName: 'Other' },
    ],
    'site one'
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0]?.jobNumber, 'J-1')
})

