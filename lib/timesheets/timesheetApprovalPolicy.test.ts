import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import {
  awaitingManagerSignOff,
  hoursWarningCopy,
  isTimesheetFullyApproved,
  postSignExtraWarningCopy,
  requiresLineManagerCounterSign,
  userHasLineManager,
} from './timesheetApprovalPolicy.ts'
import { emptyTimesheetDraft } from './timesheetDraft.ts'

function user(partial: Partial<User> & { id: string }): User {
  return {
    email: `${partial.id}@test.com`,
    firstName: 'Test',
    surname: 'User',
    organizationId: 'org',
    role: 'admin',
    passwordSet: true,
    policyAccepted: true,
    permissions: {
      adminAccess: true,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: false,
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

test('admin with no line manager is fully approved after self-sign', () => {
  const admin = user({ id: 'admin' })
  assert.equal(userHasLineManager(admin), false)
  assert.equal(requiresLineManagerCounterSign(admin), false)
  const unsigned = emptyTimesheetDraft()
  assert.equal(isTimesheetFullyApproved(unsigned, admin), false)
  const signed = { ...emptyTimesheetDraft(), operativeSignedAt: new Date() }
  assert.equal(isTimesheetFullyApproved(signed, admin), true)
  assert.equal(awaitingManagerSignOff(signed, admin), false)
  assert.match(hoursWarningCopy(admin), /amend your booking schedule/)
})

test('operative with a line manager only appears in awaiting after they have signed', () => {
  const operative = user({
    id: 'op1',
    assignedManagerUserIds: ['mgr'],
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
  })
  const draft = emptyTimesheetDraft()
  assert.equal(awaitingManagerSignOff(draft, operative), false)
  assert.equal(isTimesheetFullyApproved(draft, operative), false)
  const signed = { ...draft, operativeSignedAt: new Date() }
  assert.equal(awaitingManagerSignOff(signed, operative), true)
  assert.equal(isTimesheetFullyApproved(signed, operative), false)
  const countersigned = { ...signed, managerSignedAt: new Date() }
  assert.equal(awaitingManagerSignOff(countersigned, operative), false)
  assert.equal(isTimesheetFullyApproved(countersigned, operative), true)
  assert.match(hoursWarningCopy(operative), /contact your line manager/)
})

test('hasNoLineManager wins over leftover assigned manager ids', () => {
  const founder = user({ id: 'founder', assignedManagerUserIds: ['ghost'], hasNoLineManager: true })
  assert.equal(userHasLineManager(founder), false)
})

test('post-sign extras copy distinguishes line-manager counter-sign', () => {
  const admin = user({ id: 'admin' })
  const signed = { ...emptyTimesheetDraft(), operativeSignedAt: new Date() }
  assert.match(postSignExtraWarningCopy(admin, signed), /sign it again before generating an invoice/)
  const operative = user({ id: 'op', assignedManagerUserIds: ['mgr'] })
  const countersigned = { ...signed, managerSignedAt: new Date() }
  assert.match(postSignExtraWarningCopy(operative, countersigned), /yourself and your line manager/)
})
