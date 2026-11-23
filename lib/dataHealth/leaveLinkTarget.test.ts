import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leaveLinkTarget } from './leaveLinkTarget.ts'

test('a leave record is linked by its stored userId, as stored', () => {
  assert.deepEqual(leaveLinkTarget({ userId: ' 6A9632BA-X ', operativeId: 'op-1' }), {
    reason: 'id',
    id: '6A9632BA-X',
    key: '6a9632ba-x',
    value: '6A9632BA-X',
  })
})

test('a leave record with no userId is linked by its operativeId', () => {
  assert.equal(leaveLinkTarget({ userId: '', operativeId: 'op-1' }).id, 'op-1')
  assert.equal(leaveLinkTarget({ userId: null, operativeId: 'op-1' }).id, 'op-1')
})

test('a leave record stored under an email is never offered for linking', () => {
  const target = leaveLinkTarget({ userId: 'Jane@Example.com', operativeId: 'op-1' })
  assert.equal(target.reason, 'email')
  assert.equal(target.id, '')
  assert.equal(target.value, 'Jane@Example.com')
})

test('a leave record with no ids has nothing to link', () => {
  assert.equal(leaveLinkTarget({}).reason, 'blank')
})
