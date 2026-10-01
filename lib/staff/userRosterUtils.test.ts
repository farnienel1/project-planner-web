import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'
import { dedupeUsersByEmail, getVisibilityManagerUsers, getVisibilityOperativeUsers, matchesRosterSegment } from './userRosterUtils.ts'

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

test('an admin wins over an operative duplicate of the same email', () => {
  const operative = user({
    id: 'op-copy',
    email: 'ada@site.com',
    firstName: 'Ada',
    role: UserRole.OPERATIVE,
    updatedAt: new Date('2026-09-01'),
    permissions: { ...emptyPermissions, operativeMode: true },
  })
  const admin = user({
    id: 'admin',
    email: 'ada@site.com',
    firstName: 'Ada',
    role: UserRole.ADMIN,
    isSuperAdmin: true,
    updatedAt: new Date('2026-01-01'),
    permissions: { ...emptyPermissions, adminAccess: true },
  })
  const [kept] = dedupeUsersByEmail([operative, admin])
  assert.equal(kept.id, 'admin')
  assert.equal(kept.permissions.operativeMode, false)
})

test('a person with no email address is still kept on the roster', () => {
  const kept = dedupeUsersByEmail([
    user({ id: 'op', email: '', firstName: 'Ollie', permissions: { ...emptyPermissions, operativeMode: true } }),
  ])
  assert.equal(kept.length, 1)
  assert.equal(kept[0].id, 'op')
})

test('a freshly deactivated account wins over an older active duplicate', () => {
  const olderActive = user({
    id: 'old',
    email: 'sam@site.com',
    firstName: 'Sam',
    isActive: true,
    updatedAt: new Date('2026-01-01'),
    permissions: { ...emptyPermissions, operativeMode: true },
  })
  const newerInactive = user({
    id: 'new',
    email: 'sam@site.com',
    firstName: 'Sam',
    isActive: false,
    updatedAt: new Date('2026-09-01'),
    permissions: { ...emptyPermissions, operativeMode: true },
  })
  const [kept] = dedupeUsersByEmail([olderActive, newerInactive])
  assert.equal(kept.id, 'new')
  assert.equal(matchesRosterSegment(kept, 'inactive'), true)
  assert.equal(matchesRosterSegment(kept, 'active'), false)
})

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
