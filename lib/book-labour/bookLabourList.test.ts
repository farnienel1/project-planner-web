/**
 * Owner decision 3 (5 Nov 2026), guardrail 7: Book labour's list wiring moved into `bookLabourList` so Home's unbooked
 * banner counts the same people. This test proves the move changed nothing: for admins and managers, ready and
 * loading, the shared function returns the same phase and the same people as the wiring Book labour had before.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { UserRole, type Booking, type Operative, type User } from '../../types/index.ts'
import { DEFAULT_PAYROLL_POLICY, DEFAULT_WARNING_DETECTION } from '../settings/organizationSettings.ts'
import { webJobAccessViewer } from '../access/readPlan.ts'
import { mergeProjectsAndSmallWorks } from '../projects/workStatus.ts'
import { partitionRowsByOrganization, warningScanUsers } from '../warnings/warningsScan.ts'
import { orgWarningScope } from '../warnings/warningScopeRoster.ts'
import { bookLabourListPhase, buildBookLabourCandidates } from './candidates.ts'
import { bookLabourList, type BookLabourListInput } from './bookLabourList.ts'

const ORG = 'org'
const DAY = '2026-11-05'

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
    operativeMode: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

function person(id: string, firstName: string, partial: Partial<User> = {}): User {
  return {
    id,
    email: `${id}@site.test`,
    firstName,
    surname: 'Test',
    organizationId: ORG,
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: perms({ operativeMode: true }),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as User
}

const admin = person('u-admin', 'Ada', { role: UserRole.ADMIN, permissions: perms({ adminAccess: true }) })
const manager = person('u-mgr', 'Max', { role: UserRole.MANAGER, permissions: perms({ manager: true }), assignedManagerUserIds: ['u-admin'] } as Partial<User>)
const report1 = person('u-op1', 'Olly', { assignedManagerUserIds: ['u-mgr'] } as Partial<User>)
const report2 = person('u-op2', 'Pat', { assignedManagerUserIds: ['u-mgr'] } as Partial<User>)
const other = person('u-op3', 'Rae', { assignedManagerUserIds: ['u-admin'] } as Partial<User>)
const users = [admin, manager, report1, report2, other]
const operatives: Operative[] = []
const day = new Date('2026-11-05T12:00:00Z')
const bookings: Booking[] = [
  { id: 'B1', operativeId: 'u-op1', projectId: 'P1', date: day, timeSlot: 'FULL DAY', bookedBy: 'a', status: 'Confirmed', createdAt: day, updatedAt: day } as Booking,
]
const projects = [{ id: 'P1', jobNumber: 'C646', siteName: 'Site', managerIds: ['u-mgr'], isLive: true, organizationId: ORG }] as never[]
const liveDetails = {
  warningDetection: DEFAULT_WARNING_DETECTION,
  payrollTimePolicy: DEFAULT_PAYROLL_POLICY,
  payrollTimePolicyState: null,
}

function input(viewer: User, ready: boolean): BookLabourListInput {
  return {
    organizationId: ORG,
    viewer,
    enforcedReads: false,
    dayKey: DAY,
    timeZone: 'Europe/London',
    users,
    rosterLoadedOrgId: ORG,
    usersError: null,
    userIdAliases: {},
    operatives,
    bookings,
    managerSiteBookings: [],
    holidays: [],
    projects,
    smallWorks: [],
    liveDetails,
    sources: {
      organization: { ready: true, error: null },
      operatives: { ready: true, error: null },
      bookings: { ready, error: null },
      managerBookings: { ready: true, error: null },
      holidays: { ready: true, error: null },
      jobs: { ready: true },
    },
  }
}

/** The wiring `BookLabourFlowScreen.tsx` had before the move. */
function legacy(i: BookLabourListInput) {
  const orgId = i.organizationId
  const userScope = warningScanUsers(i.users, orgId, Boolean(orgId) && i.rosterLoadedOrgId === orgId)
  const operativeScope = partitionRowsByOrganization(i.operatives, orgId)
  const bookingScope = partitionRowsByOrganization(i.bookings, orgId)
  const managerScope = partitionRowsByOrganization(i.managerSiteBookings, orgId)
  const holidayScope = partitionRowsByOrganization(i.holidays, orgId)
  const projectScope = partitionRowsByOrganization(mergeProjectsAndSmallWorks(i.projects, i.smallWorks), orgId)
  const viewerScope = orgWarningScope({
    viewer: webJobAccessViewer(i.viewer),
    enforcedReads: i.enforcedReads,
    projects: projectScope.rows,
    users: userScope.rows,
    userIdAliases: i.userIdAliases,
    operatives: operativeScope.rows,
  })
  const listPhase = bookLabourListPhase(
    {
      organization: i.sources.organization,
      roster: { ready: i.rosterLoadedOrgId === orgId && !userScope.foreign, error: i.usersError },
      operatives: { ready: i.sources.operatives.ready && !operativeScope.foreign, error: i.sources.operatives.error },
      bookings: { ready: i.sources.bookings.ready && !bookingScope.foreign, error: i.sources.bookings.error },
      managerBookings: { ready: i.sources.managerBookings.ready && !managerScope.foreign, error: i.sources.managerBookings.error },
      holidays: { ready: i.sources.holidays.ready && !holidayScope.foreign, error: i.sources.holidays.error },
      jobs: { ready: i.sources.jobs.ready && !projectScope.foreign },
    },
    viewerScope
  )
  const candidates =
    listPhase !== 'ready' || !i.liveDetails
      ? []
      : buildBookLabourCandidates({
          dayKey: i.dayKey,
          timeZone: i.timeZone,
          users: userScope.rows,
          operatives: operativeScope.rows,
          bookings: bookingScope.rows,
          managerSiteBookings: managerScope.rows,
          holidays: holidayScope.rows,
          warningDetection: i.liveDetails.warningDetection,
          payrollPolicy: i.liveDetails.payrollTimePolicy,
          payrollPolicyState: i.liveDetails.payrollTimePolicyState,
          userIdAliases: i.userIdAliases,
          scope: viewerScope,
          focusedUserIds: i.focusedUserIds,
        })
  return { phase: listPhase, candidates }
}

for (const [label, viewer] of [['admin', admin], ['manager', manager]] as const) {
  for (const ready of [true, false]) {
    test(`Book labour list is unchanged by the shared function (${label}, ${ready ? 'ready' : 'loading'})`, () => {
      const shared = bookLabourList(input(viewer, ready))
      const before = legacy(input(viewer, ready))
      assert.equal(shared.phase, before.phase)
      assert.deepEqual(shared.candidates, before.candidates)
    })
  }
}

test('admins see every unbooked person; a manager only their reports and themselves (Home banner = Book labour)', () => {
  const adminList = bookLabourList(input(admin, true))
  const managerList = bookLabourList(input(manager, true))
  assert.equal(adminList.phase, 'ready')
  assert.deepEqual(adminList.candidates.map((c) => c.id).sort(), ['u-admin', 'u-mgr', 'u-op2', 'u-op3'])
  assert.deepEqual(managerList.candidates.map((c) => c.id).sort(), ['u-mgr', 'u-op2'])
  // Loading: nothing listed, never "everyone is unbooked".
  assert.equal(bookLabourList(input(admin, false)).phase, 'loading')
  assert.deepEqual(bookLabourList(input(admin, false)).candidates, [])
})
