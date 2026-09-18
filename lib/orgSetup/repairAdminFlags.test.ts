import { test } from 'node:test'
import assert from 'node:assert/strict'
import { topLevelAdminFlagPatch } from './repairAdminFlags.ts'

test('flattens nested-only admin flags for org founders', () => {
  const patch = topLevelAdminFlagPatch(
    {
      role: 'admin',
      isSuperAdmin: true,
      permissions: { adminAccess: true, manager: true },
    },
    {
      isSuperAdmin: true,
      role: 'admin',
      permissions: { adminAccess: true },
    }
  )
  assert.equal(patch.adminAccess, true)
  assert.equal(patch.manager, true)
  assert.equal(patch.role, undefined)
  assert.equal(patch.isSuperAdmin, undefined)
})

test('does not promote operatives or managers', () => {
  assert.deepEqual(
    topLevelAdminFlagPatch(
      {},
      { isSuperAdmin: false, role: 'manager', permissions: { adminAccess: false } }
    ),
    {}
  )
  assert.deepEqual(
    topLevelAdminFlagPatch(
      {},
      {
        isSuperAdmin: false,
        role: 'admin',
        permissions: { adminAccess: true, operativeMode: true },
      }
    ),
    {}
  )
})
