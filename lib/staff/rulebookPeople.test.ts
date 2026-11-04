import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import { inboxOwnerIds, rulebookPerson, rulebookRoster } from './rulebookPeople.ts'
import {
  ADMIN_LINE_MANAGER_REQUIRED_MESSAGE,
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

test('1.28.0: an admin self-signs and self-books by the self-manage toggles, not by having no line manager', () => {
  const boss = person('manager', { id: 'boss', isActive: false })
  const soloAdmin = person('admin', { id: 'solo', hasNoLineManager: true })
  const toggled = person('admin', {
    id: 'solo2',
    hasNoLineManager: true,
    permissions: { ...basePermissions, adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true },
  })
  const inactiveLm = person('admin', { id: 'adm2', assignedManagerUserIds: ['boss'] })
  const activeBoss = person('manager', { id: 'boss2' })
  const managedAdmin = person('admin', { id: 'adm3', assignedManagerUserIds: ['boss2'] })
  const users = [boss, soloAdmin, toggled, inactiveLm, activeBoss, managedAdmin]

  // No line manager and the toggles off: not self-approved, and the save is refused.
  assert.equal(userTimesheetSelfSigned(soloAdmin, users), false)
  assert.equal(requiresLineManagerCounterSign(soloAdmin, users), true)
  assert.equal(userCanSelfBookAnnualLeave(soloAdmin, users), false)
  assert.equal(userLeaveSubmitLabel(soloAdmin, users), 'Submit request')
  assert.equal(userLineManagerRequiredError(soloAdmin, users), ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)

  assert.equal(userTimesheetSelfSigned(toggled, users), true)
  assert.equal(requiresLineManagerCounterSign(toggled, users), false)
  assert.equal(userCanSelfBookAnnualLeave(toggled, users), true)
  assert.equal(userLeaveSubmitLabel(toggled, users), 'Submit')
  assert.equal(userLineManagerRequiredError(toggled, users), null)

  // Only line manager inactive → no active line manager; still not self-approved without the toggle.
  assert.equal(userTimesheetSelfSigned(inactiveLm, users), false)

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
  // 1.28.0: an admin with no line manager and the self-manage toggles off is listed too.
  assert.equal(userLineManagerRequiredError(admin, users), ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(userLineManagerRequiredError(op, users), null)
  assert.deepEqual(usersWithoutRequiredLineManager(users).map((user) => user.id), ['adm', 'mgr'])
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
