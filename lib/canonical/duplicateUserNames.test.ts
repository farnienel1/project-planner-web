/**
 * Rulebook 1.36.0 §11 (owner decision 10 Nov): `usersWithSameName` — the duplicate-name warning on Add User.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DUPLICATE_NAME_CANCEL_LABEL,
  DUPLICATE_NAME_CONFIRM_LABEL,
  DUPLICATE_NAME_NO_EMAIL_LABEL,
  DUPLICATE_NAME_WARNING_MESSAGE,
  sameNamePersonContactLabel,
  usersWithSameName,
  type SameNameRosterRow,
} from './duplicateUserNames'

const sam: SameNameRosterRow = {
  id: 'u-sam',
  email: 'sam@example.com',
  firstName: 'Sam',
  surname: 'Smith',
  passwordSet: true,
  isActive: true,
  role: 'operative',
  operativeMode: true,
}

test('1.36.0 usersWithSameName: exact match', () => {
  const out = usersWithSameName([sam], { firstName: 'Sam', lastName: 'Smith' })
  assert.deepEqual(out, [
    { id: 'u-sam', displayName: 'Sam Smith', email: 'sam@example.com', level: 'operative', active: true, segment: 'active', ghost: false },
  ])
})

test('1.36.0 usersWithSameName: letter case and spaces are ignored', () => {
  assert.equal(usersWithSameName([sam], { firstName: '  sAM ', lastName: 'SMITH  ' }).length, 1)
  assert.equal(usersWithSameName([{ ...sam, firstName: ' Sam  ', surname: ' smith' }], { firstName: 'Sam', lastName: 'Smith' }).length, 1)
  // Inner runs of spaces read as one.
  assert.equal(
    usersWithSameName([{ ...sam, firstName: 'Mary  Ann' }], { firstName: 'mary ann', lastName: 'smith' }).length,
    1
  )
})

test('1.36.0 usersWithSameName: a different surname or first name gives no match', () => {
  assert.deepEqual(usersWithSameName([sam], { firstName: 'Sam', lastName: 'Smyth' }), [])
  assert.deepEqual(usersWithSameName([sam], { firstName: 'Samuel', lastName: 'Smith' }), [])
})

test('1.36.0 usersWithSameName: empty names give no match', () => {
  assert.deepEqual(usersWithSameName([sam], { firstName: '', lastName: 'Smith' }), [])
  assert.deepEqual(usersWithSameName([sam], { firstName: 'Sam', lastName: '   ' }), [])
  assert.deepEqual(usersWithSameName([{ ...sam, firstName: '', surname: '' }], { firstName: '', lastName: '' }), [])
  assert.deepEqual(usersWithSameName(null, { firstName: 'Sam', lastName: 'Smith' }), [])
})

test('1.36.0 usersWithSameName: two rows that are one person are counted once (same email, former id, case)', () => {
  const placeholder: SameNameRosterRow = { ...sam, id: 'INVITE-1', passwordSet: false, isActive: true, email: 'SAM@example.com' }
  const out = usersWithSameName([placeholder, sam], { firstName: 'Sam', lastName: 'Smith' })
  assert.equal(out.length, 1)
  // The active row speaks for the person.
  assert.equal(out[0].id, 'u-sam')
  const aliased: SameNameRosterRow = { ...sam, id: 'u-sam-2', email: '', formerUserIds: ['U-SAM'] }
  assert.equal(usersWithSameName([sam, aliased], { firstName: 'Sam', lastName: 'Smith' }).length, 1)
})

test('1.36.0 usersWithSameName: two different people with the name are both listed', () => {
  const other: SameNameRosterRow = { ...sam, id: 'u-other', email: 'sam.smith@other.com' }
  assert.equal(usersWithSameName([sam, other], { firstName: 'Sam', lastName: 'Smith' }).length, 2)
})

test('1.36.0 usersWithSameName: inactive people and ghosts count; deleted profiles and leftover invites do not', () => {
  const inactive: SameNameRosterRow = { ...sam, isActive: false }
  const [row] = usersWithSameName([inactive], { firstName: 'Sam', lastName: 'Smith' })
  assert.equal(row.active, false)
  assert.equal(row.segment, 'inactive')
  const ghost: SameNameRosterRow = { id: 'g1', email: '', firstName: 'Sam', surname: 'Smith', ghost: true, passwordSet: false, operativeMode: true }
  const [g] = usersWithSameName([ghost], { firstName: 'Sam', lastName: 'Smith' })
  assert.equal(g.ghost, true)
  assert.equal(g.active, true)
  assert.equal(g.email, '')
  // An anonymised deleted profile.
  const deleted: SameNameRosterRow = { id: 'd1', email: '', firstName: 'Deleted', surname: 'user', passwordSet: true, isActive: true }
  assert.deepEqual(usersWithSameName([deleted], { firstName: 'Deleted', lastName: 'User' }), [])
  // A pending invite whose email claim is gone (the people lists hide it too).
  const leftover: SameNameRosterRow = { ...sam, id: 'p1', passwordSet: false }
  assert.deepEqual(usersWithSameName([leftover], { firstName: 'Sam', lastName: 'Smith' }, { claimedEmails: [] }), [])
  // Still claimed, or claims not loaded: a live pending invite counts.
  assert.equal(usersWithSameName([leftover], { firstName: 'Sam', lastName: 'Smith' }, { claimedEmails: ['sam@example.com'] }).length, 1)
  assert.equal(usersWithSameName([leftover], { firstName: 'Sam', lastName: 'Smith' }).length, 1)
})

test('1.36.0 usersWithSameName: level and older single-name documents', () => {
  const admin: SameNameRosterRow = { ...sam, id: 'a1', email: 'a@x.com', adminAccess: true, operativeMode: false, role: 'admin' }
  assert.equal(usersWithSameName([admin], { firstName: 'Sam', lastName: 'Smith' })[0].level, 'admin')
  const named: SameNameRosterRow = { id: 'n1', email: 'n@x.com', name: 'Sam Smith', passwordSet: true, isActive: true }
  assert.equal(usersWithSameName([named], { firstName: 'sam', lastName: 'smith' }).length, 1)
})

test('1.36.0 duplicate-name copy', () => {
  assert.equal(DUPLICATE_NAME_WARNING_MESSAGE, 'A user with this name already exists. Are you sure you want to add this user?')
  assert.equal(DUPLICATE_NAME_CONFIRM_LABEL, 'Add anyway')
  assert.equal(DUPLICATE_NAME_CANCEL_LABEL, 'Cancel')
})

test('1.36.0 sameNamePersonContactLabel: email, else "No app login" for a ghost only, else "No email"', () => {
  assert.equal(sameNamePersonContactLabel({ email: ' sam@example.com ', ghost: false }), 'sam@example.com')
  assert.equal(sameNamePersonContactLabel({ email: '', ghost: true }), 'No app login')
  assert.equal(sameNamePersonContactLabel({ email: '', ghost: false }), DUPLICATE_NAME_NO_EMAIL_LABEL)
  assert.equal(DUPLICATE_NAME_NO_EMAIL_LABEL, 'No email')
})
