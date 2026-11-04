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

test('Continue order: Auth, own-email claim read, placeholder read, users/{authUid}, claim to authUid, placeholder delete, invitation used', () => {
  const body = source.slice(source.indexOf('export async function completeInvitationPasswordSetup'))
  const steps = [
    'authWithPassword(email',
    'claimedUserIdAfterSignIn(record.organizationId, email)',
    'loadPlaceholderIfOwnInvite(hintedId)',
    // 1.26.0: the users document is `sharedDocumentPayWrite(nextUser, …)` (no pay while `privatePay` is on).
    // 1.31.1 (F5): created in one batch with the invitation marked used.
    "batch.set(doc(db, 'users', authUid), { ...accountUser, invitationId: params.invitationId })",
    "setDoc(doc(db, 'organizations', record.organizationId, 'userEmails', email)",
    "deleteDoc(doc(db, 'users', placeholderId))",
    'ensurePrimaryOrgMembership(',
    "updateDoc(doc(db, 'invitations'",
  ].map((needle) => ({ needle, at: body.indexOf(needle) }))
  for (const step of steps) assert.ok(step.at > 0, `missing: ${step.needle}`)
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(steps[i].at > steps[i - 1].at, `${steps[i].needle} must come after ${steps[i - 1].needle}`)
  }
})

test('a denied own-email claim read is surfaced, not treated as no claim', () => {
  const start = source.indexOf('async function claimedUserIdAfterSignIn')
  const fn = source.slice(start, source.indexOf('async function loadOwnUserIfSetUp'))
  assert.equal(fn.includes('catch'), false)
})

test('placeholder is read by id, never found by email, and the invitation write stays isUsed/usedAt', () => {
  assert.equal(source.includes('getDocs'), false)
  assert.equal(source.includes('query('), false)
  // Rulebook 1.9.0: the shared partial update `invitationUsedWriteFields` → `{ isUsed: true, usedAt }`.
  assert.match(source, /updateDoc\(doc\(db, 'invitations', params\.invitationId\), invitationUsedWriteFields\(Timestamp\.now\(\)\)\.set\)/)
})

test('1.31.1 (F5): the account is created with the invitation id and the invitation marked used in one batch', () => {
  const batchAt = source.indexOf("batch.set(doc(db, 'users', authUid), { ...accountUser, invitationId: params.invitationId })")
  const usedAt = source.indexOf("batch.update(doc(db, 'invitations', params.invitationId), invitationUsedWriteFields(now).set)")
  assert.ok(batchAt > 0, 'users/{authUid} carries invitationId')
  assert.ok(usedAt > batchAt, 'the invitation is marked used in the same batch')
  assert.ok(source.indexOf('await batch.commit()', usedAt) > usedAt)
  assert.equal(source.includes("await setDoc(doc(db, 'users', authUid), accountUser)"), false)
})

test('1.31.1 (S-1): the membership is written in the accept batch, in the inviteMembershipWrites shape', () => {
  const at = source.indexOf("batch.set(doc(db, 'users', authUid), { ...accountUser, invitationId: params.invitationId })")
  const membership = source.indexOf("batch.set(doc(db, 'users', authUid, 'orgMemberships', membershipWrite.organizationId), membershipWrite.membership)")
  const used = source.indexOf("batch.update(doc(db, 'invitations', params.invitationId), invitationUsedWriteFields(now).set)")
  assert.ok(at > 0 && membership > at && used > membership)
  assert.match(source, /const membershipWrite = inviteMembershipWrites\(\{ invitation: record\.raw, invitationId: params\.invitationId, authUid, now \}\)/)
  const later = source.indexOf('await ensurePrimaryOrgMembership(authUid, record.organizationId, plan.role)')
  assert.ok(source.lastIndexOf('try {', later) > used, 'the fallback membership write never stops the setup')
})
