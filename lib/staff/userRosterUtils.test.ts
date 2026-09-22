import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'
import { getVisibilityManagerUsers, getVisibilityOperativeUsers } from './userRosterUtils.ts'

const emptyPermissions: UserPermissions = {
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
  dailyOverview: false,
  subContractors: false,
  siteAudit: false,
  wholesalersOrderHistory: false,
}

function user(partial: Partial<User> & Pick<User, 'id' | 'email' | 'firstName'>): User {
  return {
    surname: 'Test',
    organizationId: 'org',
    role: UserRole.MANAGER,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    permissions: { ...emptyPermissions, ...partial.permissions },
  }
}

test('view access lists admins under managers and everyone else under operatives', () => {
  const users = [
    user({
      id: 'admin',
      email: 'admin@site.com',
      firstName: 'Ada',
      permissions: { ...emptyPermissions, adminAccess: true, operativeMode: true },
    }),
    user({
      id: 'mgr',
      email: 'mgr@site.com',
      firstName: 'Mo',
      permissions: { ...emptyPermissions, manager: true },
    }),
    user({
      id: 'op',
      email: 'op@site.com',
      firstName: 'Ollie',
      role: UserRole.OPERATIVE,
      permissions: { ...emptyPermissions, operativeMode: true },
    }),
    user({
      id: 'other',
      email: 'other@site.com',
      firstName: 'Pat',
    }),
  ]
  assert.deepEqual(
    getVisibilityManagerUsers(users)
      .map((row) => row.id)
      .sort(),
    ['admin', 'mgr']
  )
  assert.deepEqual(
    getVisibilityOperativeUsers(users)
      .map((row) => row.id)
      .sort(),
    ['op', 'other']
  )
})
