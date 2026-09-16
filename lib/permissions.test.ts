/**
 * iOS parity source: Core/UserStore.swift ~L445–900
 * Spec: docs/ios-parity/01-data-model.md §9
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User, UserPermissions } from '../types/index.ts'
import { UserRole } from '../types/index.ts'
import {
  canAccessTimesheetsSurface,
  canManageSubcontractors,
  canManageUsers,
  canViewDailyOverview,
  canViewOperatives,
  canViewProjects,
  canViewWeeklyReports,
  hasAdminAccess,
  isOperativeMode,
  canManageWorkCatalogue,
} from './permissions.ts'

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

test('hasAdminAccess is false when operativeMode is on, even for super admin', () => {
  const u = user({ isSuperAdmin: true, permissions: { operativeMode: true, adminAccess: true } })
  assert.equal(hasAdminAccess(u), false)
  assert.equal(isOperativeMode(u), true)
})

test('hasAdminAccess is true for role admin without adminAccess flag', () => {
  const u = user({ role: UserRole.ADMIN })
  assert.equal(hasAdminAccess(u), true)
  assert.equal(isOperativeMode(u), false)
})

test('canViewProjects is always true', () => {
  const op = user({ role: UserRole.OPERATIVE, permissions: { operativeMode: true } })
  assert.equal(canViewProjects(op), true)
})

test('canViewOperatives: manager needs operatives flag', () => {
  const manager = user({ role: UserRole.MANAGER, permissions: { manager: true } })
  assert.equal(canViewOperatives(manager), false)
  const withFlag = user({ role: UserRole.MANAGER, permissions: { manager: true, operatives: true } })
  assert.equal(canViewOperatives(withFlag), true)
})

test('canManageUsers is admin-only, not manager+operatives', () => {
  const mgr = user({ role: UserRole.MANAGER, permissions: { manager: true, operatives: true } })
  assert.equal(canManageUsers(mgr), false)
  const admin = user({ role: UserRole.ADMIN, permissions: { adminAccess: true } })
  assert.equal(canManageUsers(admin), true)
})

test('canManageSubcontractors is true while profile is loading', () => {
  assert.equal(canManageSubcontractors(null, true), true)
  const mgr = user({ permissions: { manager: true, subContractors: false } })
  assert.equal(canManageSubcontractors(mgr, false), false)
  const withFlag = user({ permissions: { manager: true, subContractors: true } })
  assert.equal(canManageSubcontractors(withFlag, false), true)
})

test('canViewWeeklyReports is the flag, not admin-always', () => {
  const admin = user({ role: UserRole.ADMIN, permissions: { adminAccess: true } })
  assert.equal(canViewWeeklyReports(admin), false)
  const flagged = user({ role: UserRole.ADMIN, permissions: { adminAccess: true, weeklyReports: true } })
  assert.equal(canViewWeeklyReports(flagged), true)
})

test('canViewDailyOverview defaults true', () => {
  const manager = user({ permissions: { manager: true } })
  assert.equal(canViewDailyOverview(manager), true)
})

test('canManageWorkCatalogue uses manager flags', () => {
  const mgr = user({ permissions: { manager: true, projects: true } })
  assert.equal(canManageWorkCatalogue(mgr, 'projects'), true)
  assert.equal(canManageWorkCatalogue(mgr, 'smallWorks'), false)
})

test('canAccessTimesheetsSurface is true for self-employed', () => {
  const se = user({ employmentType: 'self_employed', permissions: { operativeMode: true } })
  assert.equal(canAccessTimesheetsSurface(se), true)
})
