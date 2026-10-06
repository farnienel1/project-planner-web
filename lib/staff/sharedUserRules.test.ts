import assert from 'node:assert/strict'
import test from 'node:test'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'
import { buildSaveUserPayload, displayedLineManagerId, userWithLineManagerChoice } from '../firebase/userPayload.ts'
import { applyAccountTypeChange } from './accountTypeChange.ts'
import { applyDeviceOrgMembership } from '../orgMembership/webActiveOrg.ts'
import { isSuperAdminSuccessor, superAdminSuccessors, SUPER_ADMIN_SUCCESSOR_EMPTY } from './superAdminTransfer.ts'

const permissions: UserPermissions = {
  adminAccess: false,
  manager: true,
  operatives: true,
  skills: false,
  qualifications: true,
  materials: true,
  projects: false,
  smallWorks: false,
  operativeMode: false,
  siteAudit: true,
  subContractors: true,
  wholesalersOrderHistory: false,
  weeklyReports: false,
  dailyOverview: false,
}

function user(partial: Partial<User> & Pick<User, 'id' | 'email'>): User {
  return {
    firstName: 'Sam',
    surname: 'Stone',
    organizationId: 'org-a',
    role: UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-06-01'),
    permissions,
    ...partial,
  }
}

test('a name save keeps the stored role and writes the name fields', () => {
  const manager = user({
    id: 'mgr',
    email: 'sam@site.com',
    firstName: 'Samantha',
    surname: 'Stone',
    role: UserRole.MANAGER,
    permissions: { ...permissions, adminAccess: true },
  })
  const payload = buildSaveUserPayload(manager)
  assert.equal(payload.role, UserRole.MANAGER)
  assert.equal(payload.firstName, 'Samantha')
  assert.equal(payload.surname, 'Stone')
  assert.equal(payload.lastName, 'Stone')
  assert.equal(payload.name, 'Samantha Stone')
  assert.equal(payload.displayName, 'Samantha Stone')
  assert.equal(payload.organizationId, undefined)
  assert.equal(payload.skills, false)
})

test('no line manager clears a leftover manager id on save', () => {
  const cleared = userWithLineManagerChoice(
    user({
      id: 'mgr',
      email: 'sam@site.com',
      assignedManagerUserId: 'boss',
      assignedManagerUserIds: ['boss'],
      hasNoLineManager: false,
    }),
    ''
  )
  assert.equal(cleared.hasNoLineManager, true)
  assert.equal(cleared.assignedManagerUserId, undefined)
  assert.deepEqual(cleared.assignedManagerUserIds, [])
  assert.equal(displayedLineManagerId(cleared), '')
  const payload = buildSaveUserPayload(cleared)
  assert.equal(payload.hasNoLineManager, true)
  assert.equal(Array.isArray(payload.assignedManagerUserIds), false)
  assert.equal(typeof payload.assignedManagerUserId, 'object')
})

test('change user type sets role and does not turn the four page toggles on', () => {
  const manager = user({ id: 'mgr', email: 'sam@site.com' })
  const admin = applyAccountTypeChange(manager, 'admin')
  assert.equal(admin.role, UserRole.ADMIN)
  assert.equal(admin.permissions.adminAccess, true)
  assert.equal(admin.permissions.projects, false)
  assert.equal(admin.permissions.smallWorks, false)
  assert.equal(admin.permissions.weeklyReports, false)
  assert.equal(admin.permissions.dailyOverview, false)
  assert.equal(admin.isSuperAdmin, false)
})

test('the super admin picker lists another active administrator only', () => {
  const self = user({ id: 'self', email: 'ada@site.com', isSuperAdmin: true, role: UserRole.ADMIN, permissions: { ...permissions, adminAccess: true } })
  const operative = user({
    id: 'op',
    email: 'ollie@site.com',
    role: UserRole.ADMIN,
    permissions: { ...permissions, adminAccess: true, operativeMode: true },
  })
  const pending = user({
    id: 'new',
    email: 'new@site.com',
    role: UserRole.ADMIN,
    passwordSet: false,
    permissions: { ...permissions, adminAccess: true },
  })
  const inactive = user({
    id: 'off',
    email: 'off@site.com',
    role: UserRole.ADMIN,
    isActive: false,
    permissions: { ...permissions, adminAccess: true },
  })
  const manager = user({ id: 'mgr', email: 'sam@site.com' })
  const next = user({
    id: 'next',
    email: 'next@site.com',
    role: UserRole.ADMIN,
    permissions: { ...permissions, adminAccess: true },
  })
  assert.equal(isSuperAdminSuccessor(self, self.id), false)
  assert.equal(isSuperAdminSuccessor(operative, self.id), false)
  assert.equal(isSuperAdminSuccessor(pending, self.id), false)
  assert.equal(isSuperAdminSuccessor(inactive, self.id), false)
  assert.equal(isSuperAdminSuccessor(manager, self.id), false)
  assert.equal(isSuperAdminSuccessor(next, self.id), true)
  assert.deepEqual(superAdminSuccessors([self, operative, next], self.id).map((row) => row.id), ['next'])
  assert.equal(superAdminSuccessors([self], self.id).length, 0)
  assert.equal(SUPER_ADMIN_SUCCESSOR_EMPTY, 'You need another administrator first.')
})

test('a device organisation uses that membership and does not copy super admin from another company', () => {
  const signedIn = user({
    id: 'ada',
    email: 'ada@site.com',
    organizationId: 'ios-org',
    isSuperAdmin: true,
    role: UserRole.ADMIN,
    permissions: { ...permissions, adminAccess: true, projects: true },
  })
  const switched = applyDeviceOrgMembership(signedIn, 'ios-org', 'web-org', {
    role: 'manager',
    isSuperAdmin: false,
    accountActive: true,
    manager: true,
    adminAccess: false,
    projects: false,
  })
  assert.equal(switched.organizationId, 'web-org')
  assert.equal(switched.isSuperAdmin, false)
  assert.equal(switched.permissions.adminAccess, false)
  assert.equal(switched.permissions.projects, false)

  const sameCompany = applyDeviceOrgMembership(signedIn, 'ios-org', 'ios-org', {
    role: 'admin',
    isSuperAdmin: false,
    adminAccess: true,
  })
  assert.equal(sameCompany.isSuperAdmin, true)
})
