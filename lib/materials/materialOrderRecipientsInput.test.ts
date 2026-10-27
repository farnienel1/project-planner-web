import assert from 'node:assert/strict'
import test from 'node:test'
import { materialOrderRecipients } from '../canonical/materialOrderRecipients.ts'
import { materialOrderPlacedCopy, materialOrderRecipientsInput } from './materialOrderRecipientsInput.ts'
import type { User } from '../../types/index.ts'

function person(id: string, email: string, extra: Partial<User> = {}): User {
  return {
    id,
    email,
    firstName: 'TEST',
    surname: id,
    organizationId: 'org',
    role: 'manager',
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: { manager: true } as User['permissions'],
    ...extra,
  } as User
}

test('a new web material line notifies the job managers only, never an admin off the job or the adder', () => {
  const pat = person('pat-uid', 'pat@test.com')
  const admin = person('admin-uid', 'admin@test.com', {
    role: 'admin',
    permissions: { adminAccess: true } as User['permissions'],
  })
  const adder = person('adder-uid', 'adder@test.com', { formerUserIds: ['adder-invite'] })
  const adderTwin = person('adder-twin', 'ADDER@test.com')
  const input = materialOrderRecipientsInput({
    project: { managerIds: ['ROW-PAT', 'ROW-ADDER'] },
    managers: [
      { id: 'row-pat', email: 'Pat@test.com' },
      { id: 'row-adder', email: 'adder@test.com' },
    ],
    users: [admin, pat, adder, adderTwin],
    adder,
  })
  assert.deepEqual(new Set(input.adderIds), new Set(['adder-uid', 'adder-invite', 'adder-twin']))
  assert.deepEqual(materialOrderRecipients(input).map((row) => row.userId), ['pat-uid'])
})

test('material_order_placed copy matches iOS', () => {
  assert.deepEqual(materialOrderPlacedCopy({ addedByName: 'Ada', materialName: ' Pipe ', siteName: 'TEST-Site' }), {
    title: 'Material added',
    message: 'Ada added Pipe on TEST-Site.',
  })
  assert.equal(materialOrderPlacedCopy({ addedByName: 'Ada', materialName: '', siteName: 'S' }).message, 'Ada added a material on S.')
})
