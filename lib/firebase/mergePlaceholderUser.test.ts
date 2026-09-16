import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeholderMergeFields } from './mergePlaceholderUser.ts'

test('placeholder merge copies fields, lowercases email and sets passwordSet', () => {
  const merged = placeholderMergeFields(
    {
      email: 'Invitee@Example.com',
      organizationId: 'ORG',
      firstName: 'Pat',
      passwordSet: false,
      adminAccess: false,
    },
    'Invitee@Example.com',
    'ORG'
  )
  assert.equal(merged.email, 'invitee@example.com')
  assert.equal(merged.passwordSet, true)
  assert.equal(merged.organizationId, 'ORG')
  assert.equal(merged.firstName, 'Pat')
})
