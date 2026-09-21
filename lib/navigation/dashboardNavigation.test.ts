import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User, UserPermissions } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { getDashboardNavItems } from './dashboardNavigation.ts'

function perms(partial: Partial<UserPermissions>): UserPermissions {
  return {
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
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

function user(partial: Omit<Partial<User>, 'permissions'> & { permissions?: Partial<UserPermissions> }): User {
  return {
    id: 'U1',
    email: 'a@b.com',
    firstName: 'Ann',
    surname: 'Admin',
    organizationId: 'ORG',
    role: UserRole.BASIC,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    permissions: perms(partial.permissions ?? {}),
  }
}

test('Timesheets appears in the menu for a manager with direct reports and no operatives flag', () => {
  const manager = user({
    id: 'mgr',
    role: UserRole.MANAGER,
    permissions: { manager: true, operatives: false },
    employmentType: 'paye',
  })
  const report = user({
    id: 'op1',
    permissions: { operativeMode: true },
    assignedManagerUserIds: ['mgr'],
  })
  const ids = getDashboardNavItems(manager, null, [report]).map((item) => item.id)
  assert.equal(ids.includes('dashboard_timesheets'), true)
})
