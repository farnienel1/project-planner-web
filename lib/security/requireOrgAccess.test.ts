import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  membershipAllows,
  membershipFromOrgFields,
  parseOrganizationId,
  timestampMs,
} from './requireOrgAccess.ts'

test('membershipFromOrgFields reads members map and creator', () => {
  const membership = membershipFromOrgFields(
    { members: { admin1: 'admin', mgr1: 'manager', op1: 'operative' }, creatorUserId: 'creator1' },
    'mgr1'
  )
  assert.deepEqual(membership, { role: 'manager', isCreator: false })
  assert.deepEqual(membershipFromOrgFields({ creatorUserId: 'creator1' }, 'creator1'), {
    role: 'none',
    isCreator: true,
  })
  assert.equal(membershipFromOrgFields({ members: { other: 'admin' } }, 'missing').role, 'none')
})

test('membershipAllows: creator counts as admin; staff is admin or manager', () => {
  const creator = { role: 'none' as const, isCreator: true }
  const manager = { role: 'manager' as const, isCreator: false }
  const operative = { role: 'operative' as const, isCreator: false }
  const outsider = { role: 'none' as const, isCreator: false }

  assert.equal(membershipAllows(creator, 'admin'), true)
  assert.equal(membershipAllows(manager, 'staff'), true)
  assert.equal(membershipAllows(manager, 'admin'), false)
  assert.equal(membershipAllows(operative, 'member'), true)
  assert.equal(membershipAllows(operative, 'staff'), false)
  assert.equal(membershipAllows(outsider, 'member'), false)
})

test('parseOrganizationId accepts UUID only', () => {
  assert.equal(parseOrganizationId('2c1d8b5a-4f3e-4a1b-9c0d-1234567890ab'), '2c1d8b5a-4f3e-4a1b-9c0d-1234567890ab')
  assert.equal(parseOrganizationId('not-an-id'), null)
  assert.equal(parseOrganizationId(''), null)
})

test('timestampMs reads Date, number, and ISO string', () => {
  const at = new Date('2026-10-14T08:00:00.000Z')
  assert.equal(timestampMs(at), at.getTime())
  assert.equal(timestampMs(at.getTime()), at.getTime())
  assert.equal(timestampMs(at.toISOString()), at.getTime())
  assert.equal(timestampMs('nope'), null)
})
