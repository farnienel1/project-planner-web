import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'
import {
  aliasIdsForRoster,
  dedupeUsersByEmail,
  findUserByAnyId,
  rosterDisplayName,
  samePersonIds,
  getOperativeModeUsers,
  getVisibilityManagerUsers,
  getVisibilityOperativeUsers,
  matchesRosterSegment,
} from './userRosterUtils.ts'

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

test('operatives list keeps flagless accounts and leaves admins and managers off it', () => {
  const rows = dedupeUsersByEmail([
    user({ id: 'admin', email: 'ada@site.com', firstName: 'Ada', role: UserRole.ADMIN, isSuperAdmin: true, permissions: { ...emptyPermissions, adminAccess: true } }),
    user({ id: 'mgr', email: 'mo@site.com', firstName: 'Mo', permissions: { ...emptyPermissions, manager: true } }),
    user({ id: 'op', email: 'ollie@site.com', firstName: 'Ollie', permissions: { ...emptyPermissions, operativeMode: true } }),
    user({ id: 'plain', email: 'pat@site.com', firstName: 'Pat' }),
  ])
  const ids = getOperativeModeUsers(rows).map((row) => row.id).sort()
  assert.deepEqual(ids, ['op', 'plain'])
})

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

test('a booking stored on the other profile of the same email still names Test Manager', () => {
  const live = user({
    id: 'auth-manager',
    email: 'farnie@raccordmep.co.uk',
    firstName: 'Test',
    surname: 'Manager',
    updatedAt: new Date('2026-10-08T15:16:08Z'),
    permissions: { ...emptyPermissions, manager: true },
  })
  const duplicate = user({
    id: '463952DE-0375-435D-8AB3-67570C902C56',
    email: 'farnie@raccordmep.co.uk',
    firstName: 'Test',
    surname: 'Manager',
    updatedAt: new Date('2026-10-08T15:16:07Z'),
    permissions: { ...emptyPermissions, manager: true },
  })
  const kept = dedupeUsersByEmail([duplicate, live])
  const aliases = aliasIdsForRoster([duplicate, live])
  const resolved = findUserByAnyId(kept, duplicate.id, aliases)
  assert.equal(kept.length, 1)
  assert.equal(kept[0]?.id, 'auth-manager')
  assert.equal(rosterDisplayName(resolved), 'Test Manager')
  assert.equal(rosterDisplayName(undefined), '')
  assert.equal(samePersonIds(duplicate.id, kept, aliases).has('auth-manager'), true)
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

test('a booking stored on the other profile of the same email resolves to the kept person', () => {
  const kept = user({
    id: 'signed-in',
    email: 'farnie@raccordmep.co.uk',
    firstName: 'Test',
    surname: 'Manager',
    updatedAt: new Date('2026-10-01'),
    permissions: { ...emptyPermissions, manager: true },
  })
  const other = user({
    id: 'other-profile',
    email: 'Farnie@raccordmep.co.uk',
    firstName: '',
    surname: '',
    updatedAt: new Date('2026-01-01'),
    permissions: { ...emptyPermissions, manager: true },
  })
  const aliases = aliasIdsForRoster([other, kept])
  const roster = dedupeUsersByEmail([other, kept])
  const resolved = findUserByAnyId(roster, 'other-profile', aliases)
  assert.equal(resolved?.id, 'signed-in')
  assert.equal(`${resolved?.firstName} ${resolved?.surname}`.trim(), 'Test Manager')
  assert.equal(findUserByAnyId(roster, 'other-profile'), undefined)
  assert.equal(rosterDisplayName(resolved), 'Test Manager')
  assert.equal(rosterDisplayName({ firstName: 'Manager', surname: '', email: 'boss@site.test' }), 'boss@site.test')
  assert.equal(rosterDisplayName(null), '')
  const ids = samePersonIds('signed-in', [other, kept], aliases)
  assert.equal(ids.has('other-profile'), true)
  assert.equal(ids.has('signed-in'), true)
})
