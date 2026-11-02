import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import { UserRole } from '../../types/index.ts'
import { buildSaveUserPayload, changedUserPayload } from './userPayload.ts'

function person(partial: Partial<User> = {}): User {
  return {
    id: 'OP1',
    email: 'op@example.com',
    firstName: 'Test',
    surname: 'Operative',
    organizationId: 'ORG',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-10-07T06:00:00Z'),
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: true,
      projects: true,
      smallWorks: true,
      operativeMode: true,
      siteAudit: true,
      subContractors: false,
      wholesalersOrderHistory: true,
    },
    ...partial,
  }
}

test('a profile save never writes or deletes profilePhotoURL', () => {
  assert.equal('profilePhotoURL' in buildSaveUserPayload(person()), false)
  assert.equal('profilePhotoURL' in buildSaveUserPayload(person({ profilePhotoURL: 'https://x/p.jpg' })), false)
})

test('a save from a loaded copy writes only the fields the editor changed', () => {
  const loaded = person({ mobileNumber: '0700', dayRate: 200, payBasis: 'day' })
  const edited = { ...loaded, firstName: 'Renamed' }
  const patch = changedUserPayload(buildSaveUserPayload(edited), buildSaveUserPayload(loaded))
  assert.equal(patch.firstName, 'Renamed')
  assert.equal(patch.name, 'Renamed Operative')
  assert.ok('updatedAt' in patch)
  assert.equal('mobileNumber' in patch, false)
  assert.equal('dayRate' in patch, false)
  assert.equal('assignedManagerUserId' in patch, false)
  assert.equal('permissions' in patch, false)
})

test('clearing a field still sends its delete', () => {
  const loaded = person({ mobileNumber: '0700' })
  const patch = changedUserPayload(buildSaveUserPayload({ ...loaded, mobileNumber: '' }), buildSaveUserPayload(loaded))
  assert.ok('mobileNumber' in patch)
})

test('a field the loaded copy lacks is never deleted (another device may have set it)', () => {
  const loaded = person()
  const patch = changedUserPayload(buildSaveUserPayload({ ...loaded, firstName: 'New' }), buildSaveUserPayload(loaded))
  assert.equal('mobileNumber' in patch, false)
  assert.equal('tradeTypePreset' in patch, false)
})

test('changing the pay basis writes the basis, the new amount and removes the old amount together', () => {
  const loaded = person({ payBasis: 'day', dayRate: 200 })
  const patch = changedUserPayload(
    buildSaveUserPayload({ ...loaded, payBasis: 'hourly', dayRate: undefined, hourlyRate: 25 }),
    buildSaveUserPayload(loaded)
  )
  assert.equal(patch.payBasis, 'hourly')
  assert.equal(patch.hourlyRate, 25)
  assert.ok('dayRate' in patch)
})
