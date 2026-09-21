import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User, UserPermissions } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { createMenuItems } from './createMenu.ts'

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

test('operatives do not get a + New menu', () => {
  const op = user({ role: UserRole.OPERATIVE, permissions: { operativeMode: true } })
  assert.deepEqual(createMenuItems(op).map((row) => row.id), [])
})

test('admins see every + New item', () => {
  const admin = user({ role: UserRole.ADMIN, permissions: { adminAccess: true, manager: true } })
  assert.deepEqual(
    createMenuItems(admin).map((row) => row.id),
    [
      'project',
      'small-works',
      'user',
      'client',
      'qualification',
      'job-type',
      'sub-contractor',
      'wholesaler',
      'material',
    ]
  )
})

test('managers only see items their flags allow', () => {
  const mgr = user({
    role: UserRole.MANAGER,
    permissions: {
      manager: true,
      projects: true,
      smallWorks: false,
      operatives: true,
      qualifications: false,
      subContractors: true,
    },
  })
  assert.deepEqual(
    createMenuItems(mgr).map((row) => row.id),
    ['project', 'user', 'client', 'sub-contractor', 'wholesaler', 'material']
  )
})
