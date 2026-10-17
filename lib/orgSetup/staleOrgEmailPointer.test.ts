import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orgEmailPointerUserId, shouldReclaimOrgEmailPointer } from './staleOrgEmailPointer.ts'

test('live user with this email still owns the pointer', () => {
  assert.equal(
    shouldReclaimOrgEmailPointer({
      pointedUserExists: true,
      pointedEmail: 'pat@site.com',
      inviteEmail: 'pat@site.com',
    }),
    false
  )
})

test('anonymised tombstone pointer is reclaimable and is not a live claim', () => {
  assert.equal(
    shouldReclaimOrgEmailPointer({
      pointedUserExists: true,
      pointedEmail: '',
      inviteEmail: 'farnienel@hotmail.com',
    }),
    true
  )
})

test('missing, anonymised, or other-email pointers are reclaimable', () => {
  assert.equal(
    shouldReclaimOrgEmailPointer({
      pointedUserExists: false,
      pointedEmail: 'pat@site.com',
      inviteEmail: 'pat@site.com',
    }),
    true
  )
  assert.equal(
    shouldReclaimOrgEmailPointer({
      pointedUserExists: true,
      pointedEmail: '',
      inviteEmail: 'pat@site.com',
    }),
    true
  )
  assert.equal(
    shouldReclaimOrgEmailPointer({
      pointedUserExists: true,
      pointedEmail: 'other@site.com',
      inviteEmail: 'pat@site.com',
    }),
    true
  )
})

test('pointer userId is trimmed', () => {
  assert.equal(orgEmailPointerUserId({ userId: '  abc  ' }), 'abc')
  assert.equal(orgEmailPointerUserId({}), '')
})
