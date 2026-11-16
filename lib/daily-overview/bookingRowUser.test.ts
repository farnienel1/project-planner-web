import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingRowUserId } from './bookingRowUser.ts'

// Scan 16 Nov (guardrail 1): a no-email operatives row is never matched to the first users document with an empty email.
const users = [
  { id: 'deleted-user', email: '', formerUserIds: [] },
  { id: 'other-ghost', email: '', formerUserIds: [] },
  { id: 'ghost-row', email: '', formerUserIds: [] },
  { id: 'u-ann', email: 'ann@x.com', formerUserIds: ['INVITE-ANN'] },
]

test('a converted ghost row (blank email) resolves to the users document under its own id', () => {
  const operatives = [{ id: 'ghost-row', email: '', linkedUserId: 'ghost-row' }]
  assert.equal(bookingRowUserId('ghost-row', { operatives, users }), 'ghost-row')
})

test('a blank-email catalogue row with no link and no users document names no account', () => {
  const operatives = [{ id: 'catalogue-only', email: '' }]
  assert.equal(bookingRowUserId('catalogue-only', { operatives, users }), undefined)
})

test('the stored account link wins, then the email, then former ids — ids without case', () => {
  assert.equal(bookingRowUserId('row-1', { operatives: [{ id: 'row-1', email: '', linkedUserId: 'U-ANN' }], users }), 'u-ann')
  assert.equal(bookingRowUserId('row-2', { operatives: [{ id: 'row-2', email: 'ANN@x.com' }], users }), 'u-ann')
  assert.equal(bookingRowUserId('invite-ann', { operatives: [], users }), 'u-ann')
  assert.equal(bookingRowUserId('', { operatives: [], users }), undefined)
})

test('a booking under a same-email alias resolves to the kept account (roster fold)', () => {
  assert.equal(
    bookingRowUserId('u-ann-2', { operatives: [], users, userIdAliases: { 'u-ann-2': 'u-ann' } }),
    'u-ann'
  )
})
