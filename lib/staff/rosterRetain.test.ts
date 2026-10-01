import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAppUserDocument } from '../ios-parity/converters.ts'
import { classifyManageUsersTab } from './manageUsersUtils.ts'
import {
  markRowsRemoved,
  mergeRetainedRoster,
  retainLoadedRows,
  retainParsedRows,
  retainScopedRows,
  userFromRosterRecord,
} from './rosterRetain.ts'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'

const permissions: UserPermissions = {
  adminAccess: true,
  manager: true,
  operatives: true,
  skills: false,
  qualifications: true,
  materials: true,
  projects: true,
  smallWorks: true,
  operativeMode: false,
  siteAudit: true,
  subContractors: true,
  wholesalersOrderHistory: true,
}

function user(partial: Partial<User> & Pick<User, 'id' | 'email' | 'firstName'>): User {
  return {
    surname: 'Test',
    organizationId: 'org',
    role: UserRole.OPERATIVE,
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

test('a missing passwordSet stays on the active roster', () => {
  const parsed = parseAppUserDocument('u1', {
    email: 'ada@site.com',
    organizationId: 'org',
    firstName: 'Ada',
    surname: 'Admin',
    isActive: true,
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.passwordSet, true)
})

test('an explicit passwordSet false stays pending', () => {
  const parsed = parseAppUserDocument('u2', {
    email: 'new@site.com',
    organizationId: 'org',
    firstName: 'New',
    surname: 'Invite',
    passwordSet: false,
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.passwordSet, false)
})

test('a short user query cannot drop people already on the roster', () => {
  const admin = user({ id: 'admin', email: 'ada@site.com', firstName: 'Ada', role: UserRole.ADMIN })
  const operative = user({
    id: 'op',
    email: 'ollie@site.com',
    firstName: 'Ollie',
    permissions: { ...permissions, adminAccess: false, manager: false, operativeMode: true },
  })
  const merged = mergeRetainedRoster([admin, operative], [admin])
  assert.deepEqual(merged.map((row) => row.id).sort(), ['admin', 'op'])
})

test('an empty refresh keeps the last roster', () => {
  const operative = user({ id: 'op', email: 'ollie@site.com', firstName: 'Ollie' })
  const merged = mergeRetainedRoster([operative], [])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 'op')
})

test('a confirmed missing user document is the only way someone leaves', () => {
  const admin = user({ id: 'admin', email: 'ada@site.com', firstName: 'Ada' })
  const gone = user({ id: 'gone', email: 'gone@site.com', firstName: 'Gone' })
  const merged = mergeRetainedRoster([admin, gone], [admin], new Set(['gone']))
  assert.deepEqual(merged.map((row) => row.id), ['admin'])
})

test('a roster record still produces a person when the user query missed them', () => {
  const row = userFromRosterRecord({
    id: 'OP1',
    organizationId: 'org',
    firstName: 'Ollie',
    surname: 'Site',
    email: 'ollie@site.com',
    kind: 'operative',
  })
  assert.ok(row)
  assert.equal(row?.permissions.operativeMode, true)
  assert.equal(row?.passwordSet, true)
  const admin = user({ id: 'admin', email: 'ada@site.com', firstName: 'Ada' })
  const merged = mergeRetainedRoster([admin], [admin, row!])
  assert.equal(merged.some((person) => person.email === 'ollie@site.com'), true)
})

test('an empty company collection does not wipe rows already loaded', () => {
  assert.deepEqual(retainLoadedRows([{ id: 'b1' }], []), [{ id: 'b1' }])
  assert.deepEqual(retainLoadedRows([], []), [])
  assert.deepEqual(retainLoadedRows([{ id: 'b1' }], [{ id: 'b2' }]), [{ id: 'b2' }])
})

test('a failed parse of a non-empty snapshot does not clear the screen', () => {
  assert.deepEqual(retainParsedRows(4, [{ id: 'b1' }], []), [{ id: 'b1' }])
  assert.deepEqual(retainParsedRows(0, [{ id: 'b1' }], []), [])
})

test('an in-app delete stays gone and an empty refresh keeps everyone else', () => {
  markRowsRemoved('bookings:org', ['b1'])
  const kept = retainScopedRows('bookings:org', [{ id: 'b1' }, { id: 'b2' }], [])
  assert.deepEqual(kept, [{ id: 'b2' }])
})

test('an admin stays on the admins tab when operativeMode is also set', () => {
  const admin = user({
    id: 'admin',
    email: 'ada@site.com',
    firstName: 'Ada',
    role: UserRole.ADMIN,
    isSuperAdmin: true,
    permissions: { ...permissions, adminAccess: true, manager: true, operativeMode: true },
  })
  assert.equal(classifyManageUsersTab(admin), 'admins')
  const parsed = parseAppUserDocument('admin', {
    email: 'ada@site.com',
    organizationId: 'org',
    firstName: 'Ada',
    surname: 'Admin',
    role: 'admin',
    isSuperAdmin: true,
    adminAccess: true,
    operativeMode: true,
    isActive: true,
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.isSuperAdmin, true)
  assert.equal(parsed.value.permissions.adminAccess, true)
  assert.equal(parsed.value.permissions.operativeMode, false)
  assert.equal(classifyManageUsersTab(parsed.value), 'admins')
})

test('an inactive account stays inactive', () => {
  const parsed = parseAppUserDocument('op', {
    email: 'ollie@site.com',
    organizationId: 'org',
    firstName: 'Ollie',
    surname: 'Site',
    operativeMode: true,
    isActive: false,
    passwordSet: true,
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.isActive, false)
  assert.equal(parsed.value.permissions.operativeMode, true)
  assert.equal(classifyManageUsersTab(parsed.value), 'operatives')
})
