import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { invitePlaceholderIdToMigrate } from './completeInviteSetup.ts'

const source = readFileSync(new URL('./completeInviteSetup.ts', import.meta.url), 'utf8')

test('password setup creates Auth before reading userEmails and never scans users by email', () => {
  const authAt = source.indexOf('authWithPassword')
  const claimAt = source.indexOf('claimedUserIdAfterSignIn')
  const emailGetAt = source.indexOf("doc(db, 'organizations', organizationId, 'userEmails', email)")
  assert.ok(authAt > 0)
  assert.ok(claimAt > authAt)
  assert.ok(emailGetAt > 0)
  assert.equal(source.includes('findExistingAuthUserByEmail'), false)
  assert.equal(source.includes("collection(db, 'users')"), false)
  assert.equal(source.includes("where('email'"), false)
  assert.match(source, /isAnonymisedDeletedProfile/)
  assert.match(source, /invitePlaceholderIdToMigrate/)
  assert.equal(source.includes('updateDoc(orgRef'), false)
})

test('a Deleted-user tombstone is not the invite placeholder', () => {
  const tombstone = {
    email: '',
    name: 'Deleted user',
    displayName: 'Deleted user',
    firstName: 'Deleted',
    surname: 'user',
    passwordSet: true,
    isActive: true,
  }
  assert.equal(
    invitePlaceholderIdToMigrate({
      claimedUserId: 'QAlPe29vLLP4spK554UtpaBLW7N2',
      authUid: 'new-auth-uid',
      claimedUser: tombstone,
    }),
    ''
  )
  assert.equal(
    invitePlaceholderIdToMigrate({
      claimedUserId: '7A27FFF5-65FD-4563-8A0D-D074647C2739',
      authUid: 'new-auth-uid',
      claimedUser: {
        email: 'invited@site.com',
        firstName: 'Pat',
        surname: 'Lee',
        passwordSet: false,
        isActive: true,
      },
    }),
    '7A27FFF5-65FD-4563-8A0D-D074647C2739'
  )
  assert.equal(
    invitePlaceholderIdToMigrate({
      claimedUserId: 'same-uid',
      authUid: 'same-uid',
      claimedUser: { email: 'invited@site.com', passwordSet: false },
    }),
    ''
  )
})
