import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import { inboxOwnerIds, rulebookPerson, rulebookRoster } from './rulebookPeople.ts'
import {
  LINE_MANAGER_REQUIRED_MESSAGE,
  holidayRequestRecipients,
  timesheetSubmittedRecipients,
} from '../canonical/index.ts'
import {
  requiresLineManagerCounterSign,
  userTimesheetSelfSigned,
} from '../timesheets/timesheetApprovalPolicy.ts'
import {
  userCanSelfBookAnnualLeave,
  userLeaveSubmitLabel,
  userLineManagerRequiredError,
  usersWithoutRequiredLineManager,
} from '../annualLeave/holidayApprovalUtils.ts'

const basePermissions = {
  adminAccess: false,
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
  siteAudit: false,
  wholesalersOrderHistory: false,
}

function person(kind: 'admin' | 'manager' | 'operative', partial: Partial<User> & { id: string }): User {
  return {
    email: `${partial.id}@test.com`,
    firstName: partial.id,
    surname: 'Test',
    organizationId: 'org',
    role: kind,
    passwordSet: true,
    policyAccepted: true,
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    permissions: {
      ...basePermissions,
      adminAccess: kind === 'admin',
      manager: kind !== 'operative',
      operativeMode: kind === 'operative',
      ...(partial.permissions ?? {}),
    },
  } as User
}

test('rulebookPerson passes the full person: flags, aliases and line-manager fields', () => {
  const op = person('operative', { id: 'op', email: 'Op@Test.com', formerUserIds: ['invite-op'], assignedManagerUserIds: ['mgr'] })
  const alias = person('operative', { id: 'op-old', email: 'op@test.com' })
  const row = rulebookPerson(op, [op, alias])
  assert.equal(row.id, 'op')
  assert.equal(row.email, 'Op@Test.com')
  assert.equal(row.isActive, true)
  assert.equal(row.operativeMode, true)
  assert.equal(row.adminAccess, false)
  assert.equal(row.role.isOperativeMode, true)
  assert.deepEqual(row.formerUserIds, ['invite-op'])
  assert.deepEqual(row.sameEmailUserIds, ['op-old'])
  assert.deepEqual(row.assignedManagerUserIds, ['mgr'])
  assert.deepEqual(inboxOwnerIds(op, [op, alias]).sort(), ['invite-op', 'op', 'op-old'])
})

test('admin with no active line manager is self-signed and self-books; with one they ask', () => {
  const boss = person('manager', { id: 'boss', isActive: false })
  const soloAdmin = person('admin', { id: 'solo', hasNoLineManager: true })
  const inactiveLm = person('admin', { id: 'adm2', assignedManagerUserIds: ['boss'] })
  const activeBoss = person('manager', { id: 'boss2' })
  const managedAdmin = person('admin', { id: 'adm3', assignedManagerUserIds: ['boss2'] })
  const users = [boss, soloAdmin, inactiveLm, activeBoss, managedAdmin]

  assert.equal(userTimesheetSelfSigned(soloAdmin, users), true)
  assert.equal(requiresLineManagerCounterSign(soloAdmin, users), false)
  assert.equal(userCanSelfBookAnnualLeave(soloAdmin, users), true)
  assert.equal(userLeaveSubmitLabel(soloAdmin, users), 'Submit')

  // Only line manager inactive → no active line manager → self-approved.
  assert.equal(userTimesheetSelfSigned(inactiveLm, users), true)

  assert.equal(userTimesheetSelfSigned(managedAdmin, users), false)
  assert.equal(userCanSelfBookAnnualLeave(managedAdmin, users), false)
  assert.equal(userLeaveSubmitLabel(managedAdmin, users), 'Submit request')
})

test('operative with no line manager is never self-signed (admins counter-sign)', () => {
  const admin = person('admin', { id: 'adm', hasNoLineManager: true })
  const op = person('operative', { id: 'op', hasNoLineManager: true })
  const users = [admin, op]
  assert.equal(userTimesheetSelfSigned(op, users), false)
  assert.equal(requiresLineManagerCounterSign(op, users), true)
  assert.equal(userCanSelfBookAnnualLeave(op, users), false)
  assert.deepEqual(timesheetSubmittedRecipients(rulebookPerson(op, users), rulebookRoster(users)), ['adm'])
})

test('Manage Users: operatives and managers need an active line manager whatever the self-book toggle', () => {
  const admin = person('admin', { id: 'adm', hasNoLineManager: true })
  const selfBooker = person('manager', {
    id: 'mgr',
    hasNoLineManager: true,
    permissions: { ...basePermissions, manager: true, annualLeaveSelfBook: true },
  })
  const op = person('operative', { id: 'op', assignedManagerUserIds: ['mgr'] })
  const users = [admin, selfBooker, op]
  assert.equal(userLineManagerRequiredError(selfBooker, users), LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(userLineManagerRequiredError(admin, users), null)
  assert.equal(userLineManagerRequiredError(op, users), null)
  assert.deepEqual(usersWithoutRequiredLineManager(users).map((user) => user.id), ['mgr'])
})

test('line manager on the same email as the person is the person: never a recipient or approver', () => {
  const admin = person('admin', { id: 'adm', hasNoLineManager: true })
  const op = person('operative', { id: 'op', email: 'same@test.com', assignedManagerUserIds: ['op-mgr'] })
  const ownManagerAccount = person('manager', { id: 'op-mgr', email: 'SAME@test.com', assignedManagerUserIds: ['adm'] })
  const users = [admin, op, ownManagerAccount]
  const roster = rulebookRoster(users)
  assert.deepEqual(timesheetSubmittedRecipients(rulebookPerson(op, users), roster), ['adm'])
  assert.deepEqual(holidayRequestRecipients(rulebookPerson(op, users), roster), ['adm'])
  assert.equal(userLineManagerRequiredError(op, users), LINE_MANAGER_REQUIRED_MESSAGE)
})
