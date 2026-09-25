import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import { canManageVariationTracker, canSeeJobVariations } from './variationAccess.ts'

function user(partial: Partial<User> & Pick<User, 'id'>): User {
  return {
    email: 'a@test.com',
    firstName: 'A',
    surname: 'B',
    organizationId: 'org',
    role: 'manager',
    passwordSet: true,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: true,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: true,
      smallWorks: true,
      operativeMode: false,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: false,
      subContractors: false,
      siteAudit: false,
      wholesalersOrderHistory: false,
    },
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User
}

const job = { managerId: 'mgr-1', managerIds: ['mgr-2'] }

test('admins see variations on every job, including ones they are not assigned to', () => {
  const admin = user({
    id: 'admin',
    role: 'admin',
    permissions: { ...user({ id: 'x' }).permissions, adminAccess: true, manager: false },
  })
  assert.equal(canSeeJobVariations(admin, { managerIds: [] }), true)
  assert.equal(canManageVariationTracker(admin), true)
})

test('a manager sees variations only on jobs they are assigned to', () => {
  const assigned = user({ id: 'mgr-2' })
  const other = user({ id: 'mgr-9' })
  assert.equal(canSeeJobVariations(assigned, job), true)
  assert.equal(canSeeJobVariations(other, job), false)
  assert.equal(canManageVariationTracker(assigned), false)
})

test('operatives never see variations, even if their id is on the manager list', () => {
  const operative = user({
    id: 'mgr-1',
    role: 'operative',
    permissions: { ...user({ id: 'x' }).permissions, manager: false, operativeMode: true },
  })
  assert.equal(canSeeJobVariations(operative, job), false)
})
