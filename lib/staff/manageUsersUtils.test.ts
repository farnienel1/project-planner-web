import assert from 'node:assert/strict'
import test from 'node:test'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'
import {
  filterUsersForManageTab,
  filterUsersForManageTabAndSegment,
  manageUsersListPhase,
} from './manageUsersUtils.ts'

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
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: false,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    permissions: { ...emptyPermissions, ...partial.permissions },
  }
}

test('Manage Users Pending keeps a claimed invite and hides a leftover after userEmails is gone', () => {
  const invite = user({
    id: 'invite-uuid',
    email: 'new.operative@site.com',
    firstName: 'New',
    surname: 'Operative',
    permissions: { ...emptyPermissions, operativeMode: true },
  })
  const leftover = user({
    id: 'leftover-uuid',
    email: 'farnienel@hotmail.com',
    firstName: 'Test',
    surname: 'Operative',
    permissions: { ...emptyPermissions, operativeMode: true },
  })
  const claimed = ['new.operative@site.com']

  const pendingClaimed = filterUsersForManageTabAndSegment([invite, leftover], 'operatives', 'pending', claimed)
  assert.equal(pendingClaimed.length, 1)
  assert.equal(pendingClaimed[0].email, 'new.operative@site.com')

  const pendingAfter = filterUsersForManageTabAndSegment([invite, leftover], 'operatives', 'pending', [])
  assert.equal(pendingAfter.length, 0)
  assert.deepEqual(filterUsersForManageTab([invite, leftover], 'operatives', []), [])

  const deleted = user({
    id: 'deleted',
    email: '',
    firstName: 'Deleted',
    surname: 'user',
    passwordSet: true,
    isActive: true,
    permissions: { ...emptyPermissions, operativeMode: true },
  })
  const inactive = filterUsersForManageTabAndSegment([deleted], 'operatives', 'inactive', [])
  assert.equal(inactive.length, 1)
  assert.equal(inactive[0].id, 'deleted')
})

test('manage users stays on loading until the roster load for this organisation finishes', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: null,
      userCount: 0,
      filteredCount: 0,
      error: null,
    }),
    'loading'
  )
  assert.equal(
    manageUsersListPhase({
      organizationId: null,
      rosterLoadedOrgId: null,
      userCount: 0,
      filteredCount: 0,
      error: null,
    }),
    'loading'
  )
})

test('a failed load is an error even before the roster is marked settled', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: null,
      userCount: 0,
      filteredCount: 0,
      error: 'Failed to load users',
    }),
    'error'
  )
})

test('a settled empty roster is the empty state, and a failed load is an error', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: 'org-1',
      userCount: 0,
      filteredCount: 0,
      error: null,
    }),
    'empty'
  )
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: 'org-1',
      userCount: 0,
      filteredCount: 0,
      error: 'Failed to load users',
    }),
    'error'
  )
})

test('people already in memory stay on the list while a refresh is still unmarked', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: null,
      userCount: 4,
      filteredCount: 2,
      error: null,
    }),
    'ready'
  )
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: 'org-1',
      userCount: 4,
      filteredCount: 0,
      error: null,
    }),
    'empty'
  )
})
