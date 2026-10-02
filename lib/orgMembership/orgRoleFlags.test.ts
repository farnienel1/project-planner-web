import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FOUNDER_PERMISSIONS,
  membershipSnapshotFromUserDoc,
  userPatchForActiveOrg,
} from './orgRoleFlags.ts'

test('being the organisation creator does not make someone super admin', () => {
  const patch = userPatchForActiveOrg({
    organizationId: 'ORG-B',
    isCreator: true,
    permissions: { adminAccess: false, operativeMode: true, manager: false },
  })
  assert.equal(patch.organizationId, 'ORG-B')
  assert.equal(patch.isSuperAdmin, false)
  assert.equal(patch.adminAccess, false)
  assert.equal(patch.operativeMode, true)
})

test('switching to an invited org applies that membership, not founder flags', () => {
  const patch = userPatchForActiveOrg({
    organizationId: 'ORG-A',
    role: 'operative',
    isCreator: false,
    membershipIsSuperAdmin: false,
    permissions: {
      adminAccess: false,
      manager: false,
      operativeMode: true,
      projects: true,
      smallWorks: true,
    },
  })
  assert.equal(patch.isSuperAdmin, false)
  assert.equal(patch.role, 'operative')
  assert.equal(patch.adminAccess, false)
  assert.equal(patch.operativeMode, true)
})

test('founder permission set keeps adminAccess', () => {
  assert.equal(FOUNDER_PERMISSIONS.adminAccess, true)
  assert.equal(FOUNDER_PERMISSIONS.operativeMode, false)
})

test('switching copies accountActive onto isActive and treats a missing flag as active', () => {
  const inactive = userPatchForActiveOrg({
    organizationId: 'ORG-A',
    role: 'operative',
    accountActive: false,
    permissions: { operativeMode: true, projects: true },
  })
  assert.equal(inactive.isActive, false)
  const legacy = userPatchForActiveOrg({
    organizationId: 'ORG-B',
    role: 'manager',
    permissions: { manager: true, projects: true },
  })
  assert.equal(legacy.isActive, true)
  const snap = membershipSnapshotFromUserDoc({ isActive: false, role: 'operative', operativeMode: true })
  assert.equal(snap.accountActive, false)
})

test('membership snapshot captures the active org flags, not leftover founder admin', () => {
  const snap = membershipSnapshotFromUserDoc({
    role: 'operative',
    isSuperAdmin: false,
    adminAccess: false,
    operativeMode: true,
    manager: false,
    projects: true,
  })
  assert.equal(snap.role, 'operative')
  assert.equal(snap.status, 'active')
  assert.equal(snap.isSuperAdmin, false)
  assert.equal(snap.permissions.operativeMode, true)
  assert.equal(snap.permissions.adminAccess, false)
})
