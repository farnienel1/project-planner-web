/**
 * Wave 1 + Wave 2 Firestore rules. Runs against the emulator only.
 *
 *   npm run test:rules
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const ADMIN_A = 'admin-a'
const OP_A = 'op-a'
const ADMIN_B = 'admin-b'
const OP_B = 'op-b'

let env: RulesTestEnvironment

function authDb(uid: string, email: string) {
  return env.authenticatedContext(uid, { email }).firestore()
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-rules',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A), {
      name: 'Company A',
      members: { [ADMIN_A]: 'admin', [OP_A]: 'member' },
      creatorUserId: ADMIN_A,
    })
    await setDoc(doc(db, 'organizations', ORG_B), {
      name: 'Company B',
      members: { [ADMIN_B]: 'admin', [OP_B]: 'member' },
      creatorUserId: ADMIN_B,
    })
    await setDoc(doc(db, 'users', ADMIN_A), {
      email: 'admin-a@test.com',
      organizationId: ORG_A,
      role: 'admin',
      adminAccess: true,
      firstName: 'Ada',
    })
    await setDoc(doc(db, 'users', OP_A), {
      email: 'op-a@test.com',
      organizationId: ORG_A,
      role: 'operative',
      adminAccess: false,
      isSuperAdmin: false,
      operativeMode: true,
      firstName: 'Ollie',
    })
    await setDoc(doc(db, 'users', ADMIN_B), {
      email: 'admin-b@test.com',
      organizationId: ORG_B,
      role: 'admin',
      adminAccess: true,
      firstName: 'Bea',
    })
    await setDoc(doc(db, 'users', OP_B), {
      email: 'op-b@test.com',
      organizationId: ORG_B,
      role: 'operative',
      adminAccess: false,
      operativeMode: true,
      firstName: 'Ben',
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'book-a'), {
      organizationId: ORG_A,
      userId: OP_A,
    })
    await setDoc(doc(db, 'organizations', ORG_B, 'bookings', 'book-b'), {
      organizationId: ORG_B,
      userId: OP_B,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'materials', 'mat-a'), {
      organizationId: ORG_A,
      addedByUserId: ADMIN_A,
    })
    await setDoc(doc(db, 'organizations', ORG_B, 'materials', 'mat-b'), {
      organizationId: ORG_B,
      addedByUserId: ADMIN_B,
    })
    await setDoc(doc(db, 'organizations', ORG_B, 'settings', `timesheet_${OP_B}_1000`), {
      userId: OP_B,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hol-a'), {
      userId: OP_A,
      organizationId: ORG_A,
    })
    await setDoc(doc(db, 'organizations', ORG_B, 'holidayBookings', 'hol-b'), {
      userId: OP_B,
      organizationId: ORG_B,
    })
    await setDoc(doc(db, 'invitations', 'invite-a'), {
      organizationId: ORG_A,
      email: 'new-a@test.com',
      isUsed: false,
    })
    await setDoc(doc(db, 'invitations', 'invite-b'), {
      organizationId: ORG_B,
      email: 'new-b@test.com',
      isUsed: false,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'notifications', 'note-a'), {
      userId: ADMIN_A,
      isRead: false,
      type: 'holiday_request_approved',
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'notifications', 'note-op-a'), {
      userId: OP_A,
      isRead: false,
      type: 'holiday_request_approved',
    })
    await setDoc(doc(db, 'organizations', ORG_B, 'notifications', 'note-b'), {
      userId: ADMIN_B,
      isRead: false,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'settings', `timesheet_${ADMIN_A}_2000`), {
      userId: ADMIN_A,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'settings', `timesheet_${OP_A}_1000`), {
      userId: OP_A,
    })
  })
})

test.after(async () => {
  await env.cleanup()
})

test('company A cannot read company B bookings', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'bookings', 'book-b')))
})

test('company A cannot read company B timesheet settings', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'settings', `timesheet_${OP_B}_1000`)))
})

test('company A cannot read a company B user document', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'users', OP_B)))
  await assertFails(getDoc(doc(db, 'users', ADMIN_B)))
})

test('company A cannot read company B materials', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'materials', 'mat-b')))
})

test('company A cannot read company B holidays', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'holidayBookings', 'hol-b')))
})

test('an operative cannot make themselves admin', async () => {
  const db = authDb(OP_A, 'op-a@test.com')
  await assertFails(updateDoc(doc(db, 'users', OP_A), { adminAccess: true }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { role: 'admin' }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { isSuperAdmin: true }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { 'permissions.adminAccess': true }))
})

test('an outsider cannot join another company by rewriting members', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(
    updateDoc(doc(db, 'organizations', ORG_B), {
      members: { [ADMIN_B]: 'admin', [OP_B]: 'member', [ADMIN_A]: 'admin' },
    })
  )
})

test('company A can still read its own bookings and materials', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const booking = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'bookings', 'book-a')))
  const material = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'materials', 'mat-a')))
  const colleague = await assertSucceeds(getDoc(doc(db, 'users', OP_A)))
  assert.equal(booking.exists(), true)
  assert.equal(material.exists(), true)
  assert.equal(colleague.exists(), true)
})

test('an operative can still update their own name', async () => {
  const db = authDb(OP_A, 'op-a@test.com')
  await assertSucceeds(updateDoc(doc(db, 'users', OP_A), { firstName: 'Oliver' }))
})

test('existing users without age confirmation can read and update their own profile', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const snap = await assertSucceeds(getDoc(doc(db, 'users', ADMIN_A)))
  assert.equal(snap.exists(), true)
  assert.equal(snap.data()?.ageConfirmed, undefined)
  await assertSucceeds(updateDoc(doc(db, 'users', ADMIN_A), { firstName: 'Ada-existing' }))
})

test('invite get-by-id stays public', async () => {
  const db = env.unauthenticatedContext().firestore()
  const snap = await assertSucceeds(getDoc(doc(db, 'invitations', 'invite-b')))
  assert.equal(snap.exists(), true)
})

test('company A cannot list company B invitations', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDocs(query(collection(db, 'invitations'), where('organizationId', '==', ORG_B))))
})

test('company A cannot create or change a company B invitation', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(
    setDoc(doc(db, 'invitations', 'invite-from-a'), {
      organizationId: ORG_B,
      email: 'x@test.com',
      isUsed: false,
    })
  )
  await assertFails(updateDoc(doc(db, 'invitations', 'invite-b'), { firstName: 'Nope' }))
  await assertFails(deleteDoc(doc(db, 'invitations', 'invite-b')))
})

test('admin A can list and create invitations for company A', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const listed = await assertSucceeds(
    getDocs(query(collection(db, 'invitations'), where('organizationId', '==', ORG_A)))
  )
  assert.ok(listed.size >= 1)
  await assertSucceeds(
    setDoc(doc(db, 'invitations', 'invite-a-new'), {
      organizationId: ORG_A,
      email: 'another-a@test.com',
      isUsed: false,
    })
  )
})

test('leftover Auth can create an organisation then self-create only with age confirmation', async () => {
  const uid = 'leftover-auth'
  const email = 'leftover@test.com'
  const orgId = 'org-leftover'
  const db = authDb(uid, email)
  await assertSucceeds(
    setDoc(doc(db, 'organizations', orgId), {
      name: 'Leftover Co',
      members: { [uid]: 'admin' },
      creatorUserId: uid,
    })
  )
  await assertFails(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: orgId,
      firstName: 'Left',
      role: 'admin',
    })
  )
  await assertSucceeds(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: orgId,
      firstName: 'Left',
      role: 'admin',
      ageConfirmed: true,
      ageConfirmedYears: 16,
      ageConfirmedAt: Timestamp.now(),
    })
  )
})

test('self-create without age confirmation is denied', async () => {
  const uid = 'founder-no-age'
  const email = 'founder-no-age@test.com'
  const db = authDb(uid, email)
  await assertFails(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: ORG_A,
      firstName: 'New',
      role: 'admin',
    })
  )
  await assertFails(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: ORG_A,
      firstName: 'New',
      role: 'admin',
      ageConfirmed: false,
      ageConfirmedYears: 16,
      ageConfirmedAt: Timestamp.now(),
    })
  )
  await assertFails(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: ORG_A,
      firstName: 'New',
      role: 'admin',
      ageConfirmed: true,
      ageConfirmedYears: '16',
      ageConfirmedAt: Timestamp.now(),
    })
  )
})

test('hole 1: a stranger cannot self-create into a company that never invited them', async () => {
  const uid = 'stranger-1'
  const email = 'stranger-1@test.com'
  const db = authDb(uid, email)
  const profile = {
    email,
    organizationId: ORG_A,
    firstName: 'New',
    ageConfirmed: true,
    ageConfirmedYears: 16,
    ageConfirmedAt: Timestamp.now(),
  }
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, role: 'admin', adminAccess: true }))
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, isSuperAdmin: true }))
  // Not even as an operative: company A has no claim or membership for this account.
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, role: 'operative', operativeMode: true }))
  await assertFails(getDoc(doc(db, 'organizations', ORG_A, 'bookings', 'book-a')))
})

test('existing user without ageConfirmed can read and self-update', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const snap = await assertSucceeds(getDoc(doc(db, 'users', ADMIN_A)))
  assert.equal(snap.data()?.ageConfirmed, undefined)
  await assertSucceeds(updateDoc(doc(db, 'users', ADMIN_A), { lastSeenAt: Timestamp.now() }))
})

test('a stale email pointer can be reclaimed, but that alone does not let a non-member join', async () => {
  const uid = 'returning-uid'
  const email = 'returning@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: 'dead-placeholder' })
  })
  const db = authDb(uid, email)
  const profile = {
    email,
    organizationId: ORG_A,
    firstName: 'Back',
    ageConfirmed: true,
    ageConfirmedYears: 16,
    ageConfirmedAt: Timestamp.now(),
  }
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, role: 'admin' }))
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: uid }))
  // The claim now names this account, but company A's members map does not list it.
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, role: 'admin' }))
  await assertFails(setDoc(doc(db, 'users', uid), profile))
})

test('a returning member listed in the members map can self-create, without raising their own privileges', async () => {
  const uid = 'returning-member'
  const email = 'returning-member@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${uid}`]: 'member' })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: uid })
  })
  const db = authDb(uid, email)
  const profile = {
    email,
    organizationId: ORG_A,
    firstName: 'Back',
    ageConfirmed: true,
    ageConfirmedYears: 16,
    ageConfirmedAt: Timestamp.now(),
  }
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, role: 'admin', adminAccess: true }))
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, manager: true }))
  await assertSucceeds(setDoc(doc(db, 'users', uid), { ...profile, role: 'operative', operativeMode: true }))
})

test('a returning admin listed as admin in the members map can self-create as admin', async () => {
  const uid = 'returning-admin'
  const email = 'returning-admin@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${uid}`]: 'admin' })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: uid })
  })
  const db = authDb(uid, email)
  await assertSucceeds(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: ORG_A,
      firstName: 'Boss',
      role: 'admin',
      adminAccess: true,
      ageConfirmed: true,
      ageConfirmedYears: 16,
      ageConfirmedAt: Timestamp.now(),
    })
  )
})

test('admin invite placeholder create is allowed without age confirmation', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertSucceeds(
    setDoc(doc(db, 'users', 'invite-placeholder-1'), {
      email: 'invited-placeholder@test.com',
      organizationId: ORG_A,
      firstName: 'Invited',
      role: 'operative',
      passwordSet: false,
      isActive: true,
    })
  )
})

test('admin cannot list users by another email across every organisation', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(
    getDocs(query(collection(db, 'users'), where('email', '==', 'brand-new@test.com'), where('passwordSet', '==', true)))
  )
  await assertFails(getDocs(query(collection(db, 'users'), where('email', '==', 'op-b@test.com'))))
})

test('admin can list this organisation\'s users by email and organizationId', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const listed = await assertSucceeds(
    getDocs(
      query(collection(db, 'users'), where('email', '==', 'op-a@test.com'), where('organizationId', '==', ORG_A))
    )
  )
  assert.equal(listed.size, 1)
})

test('admin invite can reclaim userEmails and overwrite a leftover UUID without age fields', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'leftover-uuid-1'), {
      email: 'leftover-invite@test.com',
      organizationId: ORG_A,
      firstName: 'Old',
      surname: 'Placeholder',
      passwordSet: false,
      isActive: true,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'leftover-invite@test.com'), {
      userId: 'leftover-uuid-1',
    })
  })
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertSucceeds(
    setDoc(doc(db, 'users', 'leftover-uuid-1'), {
      email: 'leftover-invite@test.com',
      organizationId: ORG_A,
      firstName: 'Reinvited',
      surname: 'Person',
      role: 'operative',
      passwordSet: false,
      isActive: true,
    })
  )
  await assertSucceeds(
    setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'leftover-invite@test.com'), {
      userId: 'leftover-uuid-1',
    })
  )
  await assertSucceeds(
    setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'brand-new-invite@test.com'), {
      userId: 'invite-placeholder-new',
    })
  )
})

test('invitee can mark their invitation used', async () => {
  const db = authDb('invitee-a', 'new-a@test.com')
  await assertSucceeds(updateDoc(doc(db, 'invitations', 'invite-a'), { isUsed: true }))
})

test('signed-out visitor cannot read userEmails or users', async () => {
  const db = env.unauthenticatedContext().firestore()
  await assertFails(getDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'new-a@test.com')))
  await assertFails(getDoc(doc(db, 'users', ADMIN_A)))
  await assertFails(getDocs(collection(db, 'users')))
  await assertFails(getDocs(collection(db, 'invitations')))
})

test('invitee can finish password setup: own email claim, placeholder get, then users/{authUid}', async () => {
  const placeholderId = '7A27FFF5-65FD-4563-8A0D-D074647C2739'
  const authUid = 'invitee-auth-uid'
  const email = 'invited-finish@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', placeholderId), {
      email,
      organizationId: ORG_A,
      firstName: 'Pat',
      surname: 'Lee',
      passwordSet: false,
      isActive: true,
      isSuperAdmin: false,
      policyAccepted: false,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: placeholderId })
    await setDoc(doc(db, 'users', 'QAlPe29vLLP4spK554UtpaBLW7N2'), {
      email: '',
      name: 'Deleted user',
      displayName: 'Deleted user',
      firstName: 'Deleted',
      surname: 'user',
      passwordSet: true,
      isActive: true,
      organizationId: ORG_A,
    })
  })

  const signedOut = env.unauthenticatedContext().firestore()
  await assertFails(getDoc(doc(signedOut, 'organizations', ORG_A, 'userEmails', email)))

  const db = authDb(authUid, email)
  const claim = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'userEmails', email)))
  assert.equal(claim.data()?.userId, placeholderId)
  await assertFails(getDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'op-a@test.com')))
  await assertFails(getDocs(collection(db, 'organizations', ORG_A, 'userEmails')))

  const placeholder = await assertSucceeds(getDoc(doc(db, 'users', placeholderId)))
  assert.equal(placeholder.data()?.passwordSet, false)
  await assertFails(getDoc(doc(db, 'users', 'QAlPe29vLLP4spK554UtpaBLW7N2')))
  await assertFails(getDoc(doc(db, 'users', OP_A)))
  await assertFails(getDocs(collection(db, 'users')))

  // The age fields are the invitee's own 16+ tick on the setup page (self-create), not on the placeholder.
  const selfProfile = () => ({
    email,
    organizationId: ORG_A,
    firstName: 'Pat',
    surname: 'Lee',
    passwordSet: true,
    isActive: true,
    ageConfirmed: true,
    ageConfirmedYears: 16,
    ageConfirmedAt: Timestamp.now(),
    // inviteMigrationFormerIdWriteFields: bookings made while pending keep counting.
    formerUserIds: [placeholderId],
  })

  // Claim still names the placeholder: self-create is allowed (pending placeholder, same email, same org).
  await assertFails(setDoc(doc(db, 'users', authUid), { ...selfProfile(), ageConfirmed: false }))
  await assertSucceeds(setDoc(doc(db, 'users', authUid), selfProfile()))
  // Then the claim moves to authUid, then the placeholder goes.
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: authUid }))
  await assertSucceeds(deleteDoc(doc(db, 'users', placeholderId)))
  const moved = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'userEmails', email)))
  assert.equal(moved.data()?.userId, authUid)
  // iOS mergePlaceholderUserDocOntoAuthUidIfNeeded appends to formerUserIds on the account's own document.
  await assertSucceeds(
    setDoc(doc(db, 'users', authUid), { formerUserIds: [placeholderId, 'OLDER-PLACEHOLDER-ID'] }, { merge: true })
  )
  await assertFails(
    updateDoc(doc(db, 'users', 'QAlPe29vLLP4spK554UtpaBLW7N2'), { passwordSet: true })
  )
})

test('self-create is refused when the email claim names a live member or the Deleted-user tombstone', async () => {
  const tombstoneId = 'QAlPe29vLLP4spK554UtpaBLW7N2'
  const liveEmail = 'live-member@test.com'
  const blankEmail = 'tombstone-claim@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'live-member-uid'), {
      email: liveEmail,
      organizationId: ORG_A,
      passwordSet: true,
      isActive: true,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', liveEmail), { userId: 'live-member-uid' })
    await setDoc(doc(db, 'users', tombstoneId), {
      email: '',
      name: 'Deleted user',
      firstName: 'Deleted',
      surname: 'user',
      passwordSet: true,
      isActive: true,
      organizationId: ORG_A,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', blankEmail), { userId: tombstoneId })
  })
  for (const [uid, email] of [
    ['live-claimant-uid', liveEmail],
    ['tombstone-claimant-uid', blankEmail],
  ] as const) {
    await assertFails(
      setDoc(doc(authDb(uid, email), 'users', uid), {
        email,
        organizationId: ORG_A,
        firstName: 'X',
        surname: 'Y',
        passwordSet: true,
        ageConfirmed: true,
        ageConfirmedYears: 16,
        ageConfirmedAt: Timestamp.now(),
      })
    )
  }
  await assertFails(getDoc(doc(authDb('live-claimant-uid', liveEmail), 'users', tombstoneId)))
})

test('company A cannot read a company B notification', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'notifications', 'note-b')))
})

test('an operative cannot read another person\'s notification', async () => {
  const db = authDb(OP_A, 'op-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_A, 'notifications', 'note-a')))
})

test('a user can read their own notification', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const snap = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'notifications', 'note-a')))
  assert.equal(snap.exists(), true)
})

test('an operative cannot write another person\'s timesheet settings', async () => {
  const db = authDb(OP_A, 'op-a@test.com')
  await assertFails(
    setDoc(
      doc(db, 'organizations', ORG_A, 'settings', `timesheet_${ADMIN_A}_2000`),
      { userId: ADMIN_A, signed: true },
      { merge: true }
    )
  )
})

test('admin A can write their own timesheet settings', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertSucceeds(
    setDoc(
      doc(db, 'organizations', ORG_A, 'settings', `timesheet_${ADMIN_A}_2000`),
      { userId: ADMIN_A, hours: 8 },
      { merge: true }
    )
  )
})

test('clients cannot create interest registrations', async () => {
  const guest = env.unauthenticatedContext().firestore()
  const member = authDb(ADMIN_A, 'admin-a@test.com')
  const payload = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    company: 'Analytical Engines',
    email: 'ada@example.com',
    phone: '',
    role: '',
    teamSize: '',
    sectors: [],
    currentTools: '',
    message: '',
    consent: true,
    status: 'new',
    source: 'direct',
    campaign: '',
    referrer: '',
    pagePath: '/register-interest',
    userAgent: 'test',
  }
  await assertFails(setDoc(doc(guest, 'interestRegistrations', 'interest-guest'), payload))
  await assertFails(setDoc(doc(member, 'interestRegistrations', 'interest-member'), payload))
})

test('clients cannot read or write email suppressions', async () => {
  const guest = env.unauthenticatedContext().firestore()
  const member = authDb(ADMIN_A, 'admin-a@test.com')
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'emailSuppressions', 'ada@example.com'), {
      email: 'ada@example.com',
      source: 'interest',
      tokenId: 'token-1',
    })
  })
  await assertFails(getDoc(doc(guest, 'emailSuppressions', 'ada@example.com')))
  await assertFails(getDoc(doc(member, 'emailSuppressions', 'ada@example.com')))
  await assertFails(
    setDoc(doc(guest, 'emailSuppressions', 'guest@example.com'), {
      email: 'guest@example.com',
      source: 'interest',
      tokenId: 'x',
    })
  )
  await assertFails(
    setDoc(doc(member, 'emailSuppressions', 'member@example.com'), {
      email: 'member@example.com',
      source: 'manual',
      tokenId: 'x',
    })
  )
})

// ---------------------------------------------------------------------------
// Tenant isolation: holes 1–5 from the October 2026 rules review, and the
// legitimate flows the fixes must keep working.
// ---------------------------------------------------------------------------

const ageFields = () => ({
  ageConfirmed: true,
  ageConfirmedYears: 16,
  ageConfirmedAt: Timestamp.now(),
})

test('hole 1b: deleting your own profile and re-creating it does not move you into another company', async () => {
  const uid = 'mover-op'
  const email = 'mover-op@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      email,
      organizationId: ORG_B,
      role: 'operative',
      operativeMode: true,
    })
  })
  const db = authDb(uid, email)
  await assertFails(updateDoc(doc(db, 'users', uid), { organizationId: ORG_A }))
  await assertSucceeds(deleteDoc(doc(db, 'users', uid)))
  await assertFails(
    setDoc(doc(db, 'users', uid), { email, organizationId: ORG_A, role: 'admin', adminAccess: true, ...ageFields() })
  )
  await assertFails(setDoc(doc(db, 'users', uid), { email, organizationId: ORG_A, ...ageFields() }))
})

test('hole 2: an admin of company B cannot create a user in company A', async () => {
  const db = authDb(ADMIN_B, 'admin-b@test.com')
  await assertFails(
    setDoc(doc(db, 'users', 'b-sock-puppet'), {
      email: 'puppet@test.com',
      organizationId: ORG_A,
      role: 'admin',
      adminAccess: true,
    })
  )
  await assertFails(
    setDoc(doc(db, 'users', 'b-sock-puppet-2'), {
      email: 'puppet2@test.com',
      organizationId: ORG_A,
      role: 'operative',
      operativeMode: true,
    })
  )
  // B can still create placeholders in its own company.
  await assertSucceeds(
    setDoc(doc(db, 'users', 'b-placeholder'), {
      email: 'b-new@test.com',
      organizationId: ORG_B,
      role: 'operative',
      passwordSet: false,
      isActive: true,
    })
  )
})

test('hole 3: an admin of company B cannot edit or move users in company A', async () => {
  const db = authDb(ADMIN_B, 'admin-b@test.com')
  await assertFails(updateDoc(doc(db, 'users', OP_A), { adminAccess: true }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { firstName: 'Hacked' }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { organizationId: ORG_B }))
  await assertFails(updateDoc(doc(db, 'users', ADMIN_A), { email: 'b-owns-you@test.com' }))
})

test('hole 3b: an admin cannot move their own profile into a company they do not run', async () => {
  const db = authDb(ADMIN_B, 'admin-b@test.com')
  await assertFails(updateDoc(doc(db, 'users', ADMIN_B), { organizationId: ORG_A }))
  // Their own profile otherwise still saves.
  await assertSucceeds(updateDoc(doc(db, 'users', ADMIN_B), { firstName: 'Beatrice' }))
})

test('admin A can still edit users in company A', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  await assertSucceeds(updateDoc(doc(db, 'users', OP_A), { firstName: 'Ollie-edited', dayRate: 180 }))
})

test('hole 4: a signed-in user cannot list every company', async () => {
  const db = authDb(OP_B, 'op-b@test.com')
  await assertFails(getDocs(collection(db, 'organizations')))
  await assertFails(getDocs(query(collection(db, 'organizations'), where('name', '==', 'Company A'))))
  await assertFails(getDocs(query(collection(db, 'organizations'), where(`members.${ADMIN_A}`, '!=', ''))))
  await assertFails(getDocs(query(collection(db, 'organizations'), where('creatorUserId', '==', ADMIN_A))))
})

test('both apps can still list their own companies by membership and by creator', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const byMember = await assertSucceeds(
    getDocs(query(collection(db, 'organizations'), where(`members.${ADMIN_A}`, '!=', '')))
  )
  assert.ok(byMember.docs.some((d) => d.id === ORG_A))
  assert.ok(byMember.docs.every((d) => d.id !== ORG_B))
  const byCreator = await assertSucceeds(
    getDocs(query(collection(db, 'organizations'), where('creatorUserId', '==', ADMIN_A)))
  )
  assert.ok(byCreator.docs.some((d) => d.id === ORG_A))
})

test('hole 5: nobody can take over another account\'s email claim or claim an email that is not theirs', async () => {
  const db = authDb(OP_B, 'op-b@test.com')
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'userEmails', 'op-a@test.com'), { userId: OP_A })
  })
  // Someone else's email.
  await assertFails(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'op-a@test.com'), { userId: OP_B }))
  await assertFails(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'unclaimed@test.com'), { userId: OP_B }))
  // An admin of company B cannot rewrite or delete company A's claims.
  const adminB = authDb(ADMIN_B, 'admin-b@test.com')
  await assertFails(setDoc(doc(adminB, 'organizations', ORG_A, 'userEmails', 'op-a@test.com'), { userId: ADMIN_B }))
  await assertFails(deleteDoc(doc(adminB, 'organizations', ORG_A, 'userEmails', 'op-a@test.com')))
})

test('hole 5b: a live claim on your own email for another account is not taken over', async () => {
  const email = 'shared-email@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'live-owner'), { email, organizationId: ORG_A, passwordSet: true })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: 'live-owner' })
  })
  const db = authDb('second-account', email)
  await assertFails(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: 'second-account' }))
})

test('founder: create a company, claim the email, then self-create as its admin', async () => {
  const uid = 'founder-new'
  const email = 'founder-new@test.com'
  const orgId = 'org-founder-new'
  const db = authDb(uid, email)
  await assertSucceeds(
    setDoc(doc(db, 'organizations', orgId), {
      name: 'Founder Co',
      members: { [uid]: 'admin' },
      creatorUserId: uid,
    })
  )
  await assertSucceeds(setDoc(doc(db, 'organizations', orgId, 'userEmails', email), { userId: uid }))
  await assertSucceeds(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: orgId,
      firstName: 'Fay',
      role: 'admin',
      adminAccess: true,
      isSuperAdmin: true,
      ...ageFields(),
    })
  )
  const own = await assertSucceeds(getDoc(doc(db, 'organizations', orgId)))
  assert.equal(own.exists(), true)
})

test('invite accept: an admin invited as admin copies the admin placeholder', async () => {
  const placeholderId = 'B1C2D3E4-0000-4000-8000-ADMININVITE1'
  const authUid = 'invited-admin-auth'
  const email = 'invited-admin@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', placeholderId), {
      email,
      organizationId: ORG_A,
      firstName: 'Ida',
      role: 'admin',
      adminAccess: true,
      manager: true,
      operatives: true,
      isSuperAdmin: false,
      passwordSet: false,
      isActive: true,
      permissions: { adminAccess: true, manager: true, operatives: true },
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: placeholderId })
  })
  const db = authDb(authUid, email)
  const placeholder = await assertSucceeds(getDoc(doc(db, 'users', placeholderId)))
  await assertSucceeds(
    setDoc(doc(db, 'users', authUid), {
      ...placeholder.data(),
      email,
      organizationId: ORG_A,
      passwordSet: true,
      ...ageFields(),
    })
  )
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: authUid }))
  await assertSucceeds(deleteDoc(doc(db, 'users', placeholderId)))
})

test('invite accept: an invitee cannot add privileges the placeholder does not have', async () => {
  const placeholderId = 'B1C2D3E4-0000-4000-8000-OPINVITE0001'
  const authUid = 'invited-op-auth'
  const email = 'invited-op@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', placeholderId), {
      email,
      organizationId: ORG_A,
      firstName: 'Opal',
      role: 'operative',
      operativeMode: true,
      adminAccess: false,
      isSuperAdmin: false,
      passwordSet: false,
      isActive: true,
      permissions: { operativeMode: true, adminAccess: false },
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: placeholderId })
  })
  const db = authDb(authUid, email)
  const base = {
    email,
    organizationId: ORG_A,
    firstName: 'Opal',
    role: 'operative',
    operativeMode: true,
    passwordSet: true,
    isActive: true,
    ...ageFields(),
  }
  await assertFails(setDoc(doc(db, 'users', authUid), { ...base, adminAccess: true }))
  await assertFails(setDoc(doc(db, 'users', authUid), { ...base, isSuperAdmin: true }))
  await assertFails(setDoc(doc(db, 'users', authUid), { ...base, role: 'admin' }))
  await assertFails(setDoc(doc(db, 'users', authUid), { ...base, permissions: { adminAccess: true } }))
  await assertFails(setDoc(doc(db, 'users', authUid), { ...base, manager: true }))
  // Dropping operative mode turns an operative into staff.
  await assertFails(setDoc(doc(db, 'users', authUid), { ...base, operativeMode: false, role: 'member' }))
  await assertSucceeds(setDoc(doc(db, 'users', authUid), base))
})

test('a manager with operatives access can still invite an operative in their own company only', async () => {
  const managerId = 'manager-a'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', managerId), {
      email: 'manager-a@test.com',
      organizationId: ORG_A,
      role: 'manager',
      manager: true,
      operatives: true,
      operativeMode: false,
    })
  })
  const db = authDb(managerId, 'manager-a@test.com')
  await assertSucceeds(
    setDoc(doc(db, 'users', 'manager-invited-op'), {
      email: 'mgr-op@test.com',
      organizationId: ORG_A,
      role: 'operative',
      operativeMode: true,
      passwordSet: false,
      isActive: true,
    })
  )
  await assertSucceeds(
    setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'mgr-op@test.com'), { userId: 'manager-invited-op' })
  )
  await assertFails(
    setDoc(doc(db, 'users', 'manager-invited-b'), {
      email: 'mgr-b@test.com',
      organizationId: ORG_B,
      role: 'operative',
      operativeMode: true,
    })
  )
  await assertFails(
    setDoc(doc(db, 'users', 'manager-invited-admin'), {
      email: 'mgr-admin@test.com',
      organizationId: ORG_A,
      role: 'admin',
      adminAccess: true,
    })
  )
})

function fileReport(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG_A,
    storagePath: `organizations/${ORG_A}/siteAudits/AUDIT-1/photo.jpg`,
    surface: 'site_audit',
    parentId: 'AUDIT-1',
    fileName: 'photo.jpg',
    reason: 'copyright',
    details: '',
    reportedByUserId: OP_A,
    status: 'open',
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

test('anyone in the company can report a file as themselves', async () => {
  const db = authDb(OP_A, 'op-a@test.com')
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'fileReports', 'REPORT-OK'), fileReport()))
})

test('a file report cannot be filed for someone else, another company, or already closed', async () => {
  const db = authDb(OP_A, 'op-a@test.com')
  const ref = (id: string) => doc(db, 'organizations', ORG_A, 'fileReports', id)
  await assertFails(setDoc(ref('R-OTHER-USER'), fileReport({ reportedByUserId: ADMIN_A })))
  await assertFails(setDoc(ref('R-OTHER-PATH'), fileReport({ storagePath: `organizations/${ORG_B}/siteAudits/x.jpg` })))
  await assertFails(setDoc(ref('R-DOTS'), fileReport({ storagePath: `organizations/${ORG_A}/../${ORG_B}/x.jpg` })))
  await assertFails(setDoc(ref('R-CLOSED'), fileReport({ status: 'removed' })))
  await assertFails(setDoc(ref('R-REASON'), fileReport({ reason: 'spam' })))
  await assertFails(setDoc(ref('R-EXTRA'), fileReport({ downloadURL: 'https://example.com/x?token=1' })))
  await assertFails(setDoc(ref('R-LONG'), fileReport({ details: 'x'.repeat(1001) })))
  await assertFails(
    setDoc(doc(db, 'organizations', ORG_B, 'fileReports', 'R-ORG-B'), fileReport({ organizationId: ORG_B }))
  )
})

test('only admins read and close file reports, and nobody deletes them', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'fileReports', 'REPORT-SEED'), {
      ...fileReport(),
      createdAt: Timestamp.now(),
    })
  })
  const op = authDb(OP_A, 'op-a@test.com')
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const otherAdmin = authDb(ADMIN_B, 'admin-b@test.com')
  await assertFails(getDoc(doc(op, 'organizations', ORG_A, 'fileReports', 'REPORT-SEED')))
  await assertFails(getDocs(collection(op, 'organizations', ORG_A, 'fileReports')))
  await assertFails(getDoc(doc(otherAdmin, 'organizations', ORG_A, 'fileReports', 'REPORT-SEED')))
  await assertSucceeds(getDocs(collection(admin, 'organizations', ORG_A, 'fileReports')))
  const seeded = doc(admin, 'organizations', ORG_A, 'fileReports', 'REPORT-SEED')
  await assertFails(updateDoc(seeded, { status: 'removed', reviewedByUserId: ADMIN_A, reviewedAt: serverTimestamp(), reason: 'other' }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG_A, 'fileReports', 'REPORT-SEED'), { status: 'reviewed', reviewedByUserId: OP_A, reviewedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(seeded, { status: 'removed', reviewedByUserId: ADMIN_A, reviewedAt: serverTimestamp() }))
  await assertFails(deleteDoc(seeded))
})

function taxIds(by: string, overrides: Record<string, unknown> = {}) {
  return { utrNumber: '1234567890', vatNumber: 'GB123456789', updatedByUserId: by, updatedAt: serverTimestamp(), ...overrides }
}

test('tax identifiers: the person and their admin read and write; colleagues, managers and other admins cannot', async () => {
  const managerId = 'tax-manager-a'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', managerId), {
      email: 'tax-manager-a@test.com',
      organizationId: ORG_A,
      role: 'manager',
      adminAccess: false,
      permissions: { manager: true, operatives: true },
      firstName: 'Max',
    })
    await setDoc(doc(db, 'users', OP_A, 'private', 'taxIds'), { utrNumber: '1111111111', vatNumber: '', updatedByUserId: OP_A, updatedAt: Timestamp.now() })
  })
  const own = authDb(OP_A, 'op-a@test.com')
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const manager = authDb(managerId, 'tax-manager-a@test.com')
  const otherAdmin = authDb(ADMIN_B, 'admin-b@test.com')
  const colleague = authDb(OP_B, 'op-b@test.com')
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'users', OP_A, 'private', 'taxIds')

  await assertSucceeds(getDoc(ref(own)))
  await assertSucceeds(getDoc(ref(admin)))
  await assertFails(getDoc(ref(manager)))
  await assertFails(getDoc(ref(otherAdmin)))
  await assertFails(getDoc(ref(colleague)))

  await assertSucceeds(setDoc(ref(own), taxIds(OP_A)))
  await assertSucceeds(setDoc(ref(admin), taxIds(ADMIN_A)))
  await assertFails(setDoc(ref(manager), taxIds(managerId)))
  await assertFails(setDoc(ref(admin), taxIds(OP_A)))
  await assertFails(setDoc(ref(admin), taxIds(ADMIN_A, { utrNumber: 'x'.repeat(21) })))
  await assertFails(setDoc(ref(admin), taxIds(ADMIN_A, { niNumber: 'AB123456C' })))
  await assertFails(setDoc(doc(admin, 'users', OP_A, 'private', 'other'), taxIds(ADMIN_A)))
})

test('tax identifiers: an invitee reads and removes the placeholder copy but cannot write it', async () => {
  const placeholderId = 'PLACEHOLDER-TAX-1'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', placeholderId), { email: 'new-tax@test.com', organizationId: ORG_A, passwordSet: false })
    await setDoc(doc(db, 'users', placeholderId, 'private', 'taxIds'), { utrNumber: '2222222222', vatNumber: '', updatedByUserId: ADMIN_A, updatedAt: Timestamp.now() })
  })
  const invitee = authDb('invitee-auth-uid', 'new-tax@test.com')
  const stranger = authDb('stranger-uid', 'someone@test.com')
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'users', placeholderId, 'private', 'taxIds')
  await assertFails(getDoc(ref(stranger)))
  await assertSucceeds(getDoc(ref(invitee)))
  await assertFails(setDoc(ref(invitee), taxIds('invitee-auth-uid')))
  await assertSucceeds(deleteDoc(ref(invitee)))
})

test('job quote and order history: every admin and manager reads it without the Wholesalers toggle, operatives never', async () => {
  const MANAGER_A = 'manager-a-history'
  const ADMIN_OP_A = 'admin-op-a-history'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', MANAGER_A), {
      email: 'manager-a-history@test.com',
      organizationId: ORG_A,
      role: 'manager',
      adminAccess: false,
      isSuperAdmin: false,
      operativeMode: false,
      wholesalersOrderHistory: false,
      permissions: { manager: true, wholesalersOrderHistory: false, operativeMode: false },
      firstName: 'Mo',
    })
    await setDoc(doc(db, 'users', ADMIN_OP_A), {
      email: 'admin-op-a-history@test.com',
      organizationId: ORG_A,
      role: 'admin',
      permissions: { adminAccess: true, operativeMode: true },
      firstName: 'Ola',
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'materialSendRecords', 'SEND-HISTORY-1'), {
      id: 'SEND-HISTORY-1',
      projectId: 'job-1',
      requestType: 'Order',
      sentAt: Timestamp.now(),
      sentBy: 'Ada',
      recipients: [],
      lines: [],
    })
  })
  const ref = (uid: string, email: string) => doc(authDb(uid, email), 'organizations', ORG_A, 'materialSendRecords', 'SEND-HISTORY-1')
  await assertSucceeds(getDoc(ref(MANAGER_A, 'manager-a-history@test.com')))
  await assertSucceeds(getDoc(ref(ADMIN_A, 'admin-a@test.com')))
  await assertSucceeds(
    getDocs(query(collection(authDb(MANAGER_A, 'manager-a-history@test.com'), 'organizations', ORG_A, 'materialSendRecords'), where('projectId', '==', 'job-1')))
  )
  await assertFails(getDoc(ref(OP_A, 'op-a@test.com')))
  await assertFails(getDoc(ref(ADMIN_OP_A, 'admin-op-a-history@test.com')))
  await assertFails(getDoc(doc(authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'materialSendRecords', 'SEND-HISTORY-1')))
})

test('warningResolutions: a manager writes their own approval in their company only; operatives cannot; admins or the resolver delete it', async () => {
  const MANAGER_WR = 'manager-a-wr'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', MANAGER_WR), {
      email: 'manager-a-wr@test.com',
      organizationId: ORG_A,
      role: 'manager',
      manager: true,
      permissions: { manager: true, operativeMode: false },
    })
  })
  const key = 'mgr-clash-INVITED-ID-2026-10-22-0'
  const mgrRef = doc(authDb(MANAGER_WR, 'manager-a-wr@test.com'), 'organizations', ORG_A, 'warningResolutions', key)
  const fields = { resolutionKey: key, status: 'approved', resolvedByUserId: MANAGER_WR, resolvedAt: serverTimestamp() }
  // Operatives never approve or dismiss a warning.
  const opRef = doc(authDb(OP_A, 'op-a@test.com'), 'organizations', ORG_A, 'warningResolutions', key)
  await assertFails(setDoc(opRef, { ...fields, resolvedByUserId: OP_A }))
  await assertSucceeds(setDoc(mgrRef, fields))
  await assertSucceeds(getDoc(mgrRef))
  await assertSucceeds(getDoc(opRef))
  // Wrong shape, wrong status, wrong key, someone else's name, or an extra field is refused.
  await assertFails(setDoc(mgrRef, { ...fields, status: 'snoozed' }))
  await assertFails(setDoc(mgrRef, { ...fields, resolutionKey: 'other' }))
  await assertFails(setDoc(mgrRef, { ...fields, resolvedByUserId: ADMIN_A }))
  await assertFails(setDoc(mgrRef, { ...fields, note: 'x' }))
  await assertFails(setDoc(mgrRef, { resolutionKey: key, status: 'approved', resolvedByUserId: MANAGER_WR }))
  // Another company cannot read or write it.
  const foreign = doc(authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'warningResolutions', key)
  await assertFails(getDoc(foreign))
  await assertFails(setDoc(foreign, { ...fields, resolvedByUserId: ADMIN_B }))
  // An operative cannot delete it; the resolver can undo it; an admin can delete anyone's.
  await assertFails(deleteDoc(opRef))
  await assertSucceeds(deleteDoc(mgrRef))
  await assertSucceeds(setDoc(mgrRef, fields))
  await assertSucceeds(deleteDoc(doc(authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'warningResolutions', key)))
})

// ---------------------------------------------------------------------------
// Security tightening: leave approval, timesheet sign-off, staff-only warning
// decisions and settings, self-update locks, organisation ownership, and
// deleted-booking tombstones.
// ---------------------------------------------------------------------------

const LM_A = 'line-manager-a'
const MGR_OTHER_A = 'manager-other-a'
const SELF_BOOKER_A = 'self-booker-a'
const REPORT_A = 'report-op-a'

async function seedLeaveAndTimesheetPeople() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', LM_A), {
      email: 'lm-a@test.com', organizationId: ORG_A, role: 'manager', manager: true,
      permissions: { manager: true, operativeMode: false },
    })
    await setDoc(doc(db, 'users', MGR_OTHER_A), {
      email: 'mgr-other-a@test.com', organizationId: ORG_A, role: 'manager', manager: true,
      permissions: { manager: true, operativeMode: false },
    })
    await setDoc(doc(db, 'users', SELF_BOOKER_A), {
      email: 'self-a@test.com', organizationId: ORG_A, role: 'manager', manager: true,
      assignedManagerUserIds: [LM_A], assignedManagerUserId: LM_A,
      permissions: { manager: true, annualLeaveSelfBook: true, operativeMode: false },
    })
    // iOS-shaped report: legacy single line manager only, no list, no isActive/hasNoLineManager.
    await setDoc(doc(db, 'users', REPORT_A), {
      email: 'report-a@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true,
      assignedManagerUserId: LM_A, dayRate: 200,
      permissions: { operativeMode: true, manager: false, materials: false, siteAudit: false },
      firstName: 'Rae',
    })
  })
}

function leave(uid: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'x', organizationId: ORG_A, userId: uid,
    startDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    endDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    status, timeSlot: 'FULL DAY',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    ...extra,
  }
}

test('annual leave: a requester asks but never approves their own leave; the line manager or an admin decides', async () => {
  await seedLeaveAndTimesheetPeople()
  const rep = authDb(REPORT_A, 'report-a@test.com')
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)

  // Create: pending is fine; approved, or an approval stamp, is not.
  await assertSucceeds(setDoc(ref(rep, 'hol-req-1'), leave(REPORT_A, 'pending'), { merge: true }))
  await assertFails(setDoc(ref(rep, 'hol-req-2'), leave(REPORT_A, 'approved')))
  await assertFails(setDoc(ref(rep, 'hol-req-3'), leave(REPORT_A, 'pending', { approvedByUserId: REPORT_A })))
  await assertFails(setDoc(ref(rep, 'hol-req-4'), leave(REPORT_A, 'pending', { decisionNote: 'ok' })))

  // Update: approving own pending request is refused, as a web-style full merge resend.
  await assertFails(setDoc(ref(rep, 'hol-req-1'), { status: 'approved', approvedByUserId: REPORT_A, approvedAt: Timestamp.now() }, { merge: true }))
  // Editing the pending request itself (slot) is fine, with web nulls for fields iOS omitted.
  await assertSucceeds(setDoc(ref(rep, 'hol-req-1'), { timeSlot: 'AM', operativeId: null, approvedByUserId: null, approvedAt: null, cancellationRequestedAt: null }, { merge: true }))

  // A manager who is not the line manager cannot decide; the line manager and an admin can.
  await assertFails(updateDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hol-req-1'), { status: 'approved', approvedByUserId: MGR_OTHER_A, approvedAt: Timestamp.now() }))
  const approvedAt = Timestamp.fromMillis(Date.parse('2026-11-01T09:00:00.123Z') + 0.456)
  await assertSucceeds(updateDoc(ref(authDb(LM_A, 'lm-a@test.com'), 'hol-req-1'), { status: 'approved', approvedByUserId: LM_A, approvedAt }))
  await assertSucceeds(updateDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'hol-req-1'), { decisionNote: null }))

  // The requester asks to cancel an approved booking (full merge resend; approvedAt rounded to ms like web).
  await assertSucceeds(setDoc(ref(rep, 'hol-req-1'), {
    ...leave(REPORT_A, 'approved', { timeSlot: 'AM' }),
    createdAt: Timestamp.now(),
    approvedByUserId: LM_A,
    approvedAt: Timestamp.fromMillis(approvedAt.toMillis()),
    operativeId: null,
    decisionNote: null,
    cancellationRequestedAt: Timestamp.now(),
    cancellationRequestedByUserId: REPORT_A,
  }, { merge: true }))
  // ...but cannot move the dates of approved leave, re-approve it as themselves, or delete it.
  await assertFails(updateDoc(ref(rep, 'hol-req-1'), { timeSlot: 'PM' }))
  await assertFails(updateDoc(ref(rep, 'hol-req-1'), { approvedByUserId: REPORT_A }))
  await assertFails(updateDoc(ref(rep, 'hol-req-1'), { userId: OP_A }))
  await assertFails(deleteDoc(ref(rep, 'hol-req-1')))
  // The line manager approves the cancellation by deleting it.
  await assertSucceeds(deleteDoc(ref(authDb(LM_A, 'lm-a@test.com'), 'hol-req-1')))

  // A requester may withdraw their own pending request.
  await assertSucceeds(setDoc(ref(rep, 'hol-req-5'), leave(REPORT_A, 'pending')))
  await assertSucceeds(deleteDoc(ref(rep, 'hol-req-5')))

  // A manager on the Team screen may book a pending request for someone with a line manager.
  await assertSucceeds(setDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hol-req-6'), leave(REPORT_A, 'pending')))
  await assertFails(setDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hol-req-7'), leave(REPORT_A, 'approved', { approvedByUserId: MGR_OTHER_A })))
})

test('annual leave: self-bookers save their own leave approved; no-line-manager people too; operatives with a line manager cannot', async () => {
  await seedLeaveAndTimesheetPeople()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const selfDb = authDb(SELF_BOOKER_A, 'self-a@test.com')
  // iOS self-book: approved, no approvedByUserId. Web self-book: approvedByUserId == self.
  await assertSucceeds(setDoc(ref(selfDb, 'hol-self-1'), leave(SELF_BOOKER_A, 'approved', { decisionNote: null, cancellationRequestedAt: null }), { merge: true }))
  await assertSucceeds(setDoc(ref(selfDb, 'hol-self-2'), leave(SELF_BOOKER_A, 'approved', { approvedByUserId: SELF_BOOKER_A, approvedAt: Timestamp.now() })))
  await assertSucceeds(updateDoc(ref(selfDb, 'hol-self-2'), { timeSlot: 'PM' }))
  await assertSucceeds(deleteDoc(ref(selfDb, 'hol-self-2')))
  // Cannot approve as someone else.
  await assertFails(setDoc(ref(selfDb, 'hol-self-3'), leave(SELF_BOOKER_A, 'approved', { approvedByUserId: LM_A })))
  // OP_A has no line manager in the seed: web leaveSubmitStatus saves it approved.
  await assertSucceeds(setDoc(ref(authDb(OP_A, 'op-a@test.com'), 'hol-noline-1'), leave(OP_A, 'approved')))
  // Another company never writes here.
  await assertFails(setDoc(ref(authDb(ADMIN_B, 'admin-b@test.com'), 'hol-foreign'), leave(ADMIN_B, 'pending')))
})

test('timesheets: the owner cannot counter-sign or export their own sheet; the line manager and admins can', async () => {
  await seedLeaveAndTimesheetPeople()
  const id = `timesheet_${REPORT_A}_1760000000`
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'organizations', ORG_A, 'settings', id)
  const rep = authDb(REPORT_A, 'report-a@test.com')
  // Owner creates and signs their own part. Manager fields go as web writes them ('' / null).
  await assertSucceeds(setDoc(ref(rep), {
    userId: REPORT_A, weekStartKey: '2026-10-01', weekEndKey: '2026-10-15',
    operativeSignedAt: Timestamp.now(), operativeSignedByName: 'Rae',
    managerSignedAt: null, managerSignedByName: '', managerSignedByUserId: '', managerSignatureImageBase64: '',
    approvedAt: null, approvedByName: '', exportedAt: null,
  }, { merge: true }))
  // Owner may not counter-sign or export.
  await assertFails(setDoc(ref(rep), { managerSignedAt: Timestamp.now(), managerSignedByName: 'Rae' }, { merge: true }))
  await assertFails(setDoc(ref(rep), { approvedAt: Timestamp.now() }, { merge: true }))
  await assertFails(setDoc(ref(rep), { exportedAt: Timestamp.now() }, { merge: true }))
  await assertFails(setDoc(ref(rep), { managerSignedByUserId: REPORT_A }, { merge: true }))
  // A manager who is not their line manager cannot sign; the line manager can.
  await assertFails(setDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), { managerSignedAt: Timestamp.now() }, { merge: true }))
  const signed = Timestamp.fromMillis(Date.parse('2026-10-16T10:00:00.123Z') + 0.789)
  await assertSucceeds(setDoc(ref(authDb(LM_A, 'lm-a@test.com')), {
    managerSignedAt: signed, managerSignedByName: 'Lou', managerSignedByUserId: LM_A,
    approvedAt: signed, approvedByName: 'Lou',
  }, { merge: true }))
  // The owner's next full save resends the sign-off rounded to ms: allowed. Clearing it is not.
  await assertSucceeds(setDoc(ref(rep), {
    userId: REPORT_A, operativeSignedByName: 'Rae',
    managerSignedAt: Timestamp.fromMillis(signed.toMillis()), managerSignedByName: 'Lou', managerSignedByUserId: LM_A,
    managerSignatureImageBase64: '', approvedAt: Timestamp.fromMillis(signed.toMillis()), approvedByName: 'Lou', exportedAt: null,
    expenseEntries: [],
  }, { merge: true }))
  await assertFails(setDoc(ref(rep), { managerSignedAt: null }, { merge: true }))
  await assertFails(deleteDoc(ref(rep)))
  // An admin exports.
  await assertSucceeds(setDoc(ref(authDb(ADMIN_A, 'admin-a@test.com')), { exportedAt: Timestamp.now() }, { merge: true }))
})

test('staff warning decisions: operatives cannot accept a booking clash; managers and admins can', async () => {
  await seedLeaveAndTimesheetPeople()
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', 'A|B')
  const fields = (uid: string) => ({ bookingAId: 'A', bookingBId: 'B', acceptedByUserId: uid })
  await assertFails(setDoc(ref(authDb(OP_A, 'op-a@test.com')), fields(OP_A)))
  await assertSucceeds(setDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), fields(MGR_OTHER_A)))
  await assertSucceeds(setDoc(ref(authDb(ADMIN_A, 'admin-a@test.com')), fields(ADMIN_A)))
  await assertFails(setDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), { ...fields(MGR_OTHER_A), updatedBy: ADMIN_A }))
  await assertSucceeds(getDoc(ref(authDb(OP_A, 'op-a@test.com'))))
  await assertFails(setDoc(ref(authDb(ADMIN_B, 'admin-b@test.com')), fields(ADMIN_B)))
})

test('settings: operatives cannot write company settings; managers can; operatives keep deadlines and health & safety', async () => {
  await seedLeaveAndTimesheetPeople()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'settings', id)
  const op = authDb(OP_A, 'op-a@test.com')
  await assertFails(setDoc(ref(op, 'jobTypes'), { jobTypes: ['Hacked'] }))
  await assertFails(setDoc(ref(op, 'tradeTypeInventory'), { trades: ['x'] }, { merge: true }))
  await assertFails(setDoc(ref(op, 'variationTrades'), { trades: ['x'] }))
  await assertFails(setDoc(ref(op, 'somethingNew'), { a: 1 }))
  await assertSucceeds(setDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'jobTypes'), { jobTypes: ['Fit out'] }))
  await assertSucceeds(setDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'tradeTypeInventory'), { trades: ['Joiner'] }, { merge: true }))
  await assertSucceeds(getDoc(ref(op, 'jobTypes')))
  await assertSucceeds(setDoc(ref(op, 'deadlines_projects_AAAA-1'), { deadlines: [] }, { merge: true }))
  await assertSucceeds(setDoc(ref(op, 'deadlineAssignments'), { a: 1 }, { merge: true }))
  await assertSucceeds(setDoc(ref(op, 'healthSafety_projects_AAAA-1'), { talks: [] }, { merge: true }))
})

test('self-update: a person cannot change their own pay, line manager, active state, employment type or permissions', async () => {
  await seedLeaveAndTimesheetPeople()
  const rep = authDb(REPORT_A, 'report-a@test.com')
  const me = doc(rep, 'users', REPORT_A)
  await assertFails(updateDoc(me, { dayRate: 999 }))
  await assertFails(updateDoc(me, { hourlyRate: 50 }))
  await assertFails(updateDoc(me, { payBasis: 'hourly' }))
  await assertFails(updateDoc(me, { isActive: false }))
  await assertFails(updateDoc(me, { assignedManagerUserIds: [REPORT_A], assignedManagerUserId: REPORT_A }))
  await assertFails(updateDoc(me, { assignedManagerUserId: OP_A }))
  await assertFails(updateDoc(me, { hasNoLineManager: true }))
  await assertFails(updateDoc(me, { employmentType: 'self_employed' }))
  await assertFails(updateDoc(me, { 'permissions.weeklyReports': true }))
  await assertFails(updateDoc(me, { manager: true }))
  await assertFails(updateDoc(me, { 'permissions.materials': true }))
  // Leaving operative mode is an escalation (role 'operative' alone still marks an operative).
  await assertFails(updateDoc(me, { operativeMode: false, 'permissions.operativeMode': false, role: 'manager' }))
  // iOS saveUser full merge with the same values (defaults written out, legacy line manager as a list): allowed.
  await assertSucceeds(setDoc(me, {
    email: 'report-a@test.com', organizationId: ORG_A, role: 'operative', firstName: 'Rae', surname: 'Ray',
    isActive: true, passwordSet: true, adminAccess: false, manager: false, operatives: false, skills: false,
    qualifications: false, materials: false, projects: false, smallWorks: false, operativeMode: true,
    annualLeaveSelfBook: false, weeklyReports: false, dailyOverview: true, subContractors: false, siteAudit: false,
    wholesalersOrderHistory: true, isSuperAdmin: false, employmentType: 'paye', hasNoLineManager: false,
    assignedManagerUserId: LM_A, assignedManagerUserIds: [LM_A], dayRate: 200.0,
    permissions: {
      adminAccess: false, manager: false, operatives: false, skills: false, qualifications: false, materials: false,
      projects: false, smallWorks: false, operativeMode: true, siteAudit: false, subContractors: false,
      wholesalersOrderHistory: true, annualLeaveSelfBook: false, weeklyReports: false, dailyOverview: true,
    },
    updatedAt: Timestamp.now(),
  }, { merge: true }))
  // Turning a toggle off is not an escalation.
  await assertSucceeds(updateDoc(me, { dailyOverview: false, 'permissions.dailyOverview': false }))
  // A manager's iOS self-save forces materials and siteAudit on: allowed for a non-operative.
  await assertSucceeds(updateDoc(doc(authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'users', MGR_OTHER_A), {
    materials: true, siteAudit: true, 'permissions.materials': true, 'permissions.siteAudit': true, firstName: 'Max',
  }))
  // An admin still edits the person's pay and line manager.
  await assertSucceeds(updateDoc(doc(authDb(ADMIN_A, 'admin-a@test.com'), 'users', REPORT_A), { dayRate: 220, assignedManagerUserIds: [LM_A, MGR_OTHER_A] }))
})

test('organisation: admins edit; a demoted creator cannot; creatorUserId moves only by the Super Admin to another admin', async () => {
  const ORG_C = 'org-c-owner'
  const FOUNDER = 'founder-c'
  const ADMIN_C = 'admin-c'
  const MEMBER_C = 'member-c'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_C), {
      name: 'Company C', creatorUserId: FOUNDER,
      members: { [FOUNDER]: 'admin', [ADMIN_C]: 'admin', [MEMBER_C]: 'member' },
      billing: { status: 'active' },
    })
    await setDoc(doc(db, 'users', FOUNDER), { email: 'founder-c@test.com', organizationId: ORG_C, role: 'admin', adminAccess: true, isSuperAdmin: true })
    await setDoc(doc(db, 'users', ADMIN_C), { email: 'admin-c@test.com', organizationId: ORG_C, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'users', MEMBER_C), { email: 'member-c@test.com', organizationId: ORG_C, role: 'operative', operativeMode: true })
  })
  const org = (uid: string, email: string) => doc(authDb(uid, email), 'organizations', ORG_C)
  await assertSucceeds(updateDoc(org(ADMIN_C, 'admin-c@test.com'), { name: 'Company C Ltd' }))
  await assertFails(updateDoc(org(MEMBER_C, 'member-c@test.com'), { name: 'Hijack' }))
  // A plain admin cannot take ownership or give it to an operative; billing stays server-only.
  await assertFails(updateDoc(org(ADMIN_C, 'admin-c@test.com'), { creatorUserId: ADMIN_C }))
  await assertFails(updateDoc(org(FOUNDER, 'founder-c@test.com'), { creatorUserId: MEMBER_C }))
  await assertFails(updateDoc(org(FOUNDER, 'founder-c@test.com'), { billing: { status: 'active', plan: 'free' } }))
  // The Super Admin transfers to another admin.
  await assertSucceeds(updateDoc(org(FOUNDER, 'founder-c@test.com'), { creatorUserId: ADMIN_C }))
  // The old creator is demoted (users doc and members map): they cannot edit any more.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', FOUNDER), { email: 'founder-c@test.com', organizationId: ORG_C, role: 'manager', adminAccess: false, isSuperAdmin: false, manager: true })
    await updateDoc(doc(db, 'organizations', ORG_C), { creatorUserId: FOUNDER, [`members.${FOUNDER}`]: 'member' })
  })
  await assertFails(updateDoc(org(FOUNDER, 'founder-c@test.com'), { name: 'Mine again' }))
  await assertFails(updateDoc(org(FOUNDER, 'founder-c@test.com'), { creatorUserId: FOUNDER, [`members.${FOUNDER}`]: 'admin' }))
})

test('deleted bookings: the delete writes a tombstone and nobody can bring the booking back', async () => {
  await seedLeaveAndTimesheetPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'BOOK-T1'), { operativeId: OP_A, status: 'Confirmed', notes: '' })
    await setDoc(doc(db, 'organizations', ORG_A, 'managerSiteBookings', 'MSB-T1'), { managerUserId: LM_A })
  })
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const op = authDb(OP_A, 'op-a@test.com')
  const tomb = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'deletedBookings', id)
  const fields = (id: string, collectionName: string, uid: string, from = 'web') => ({
    bookingId: id, collection: collectionName, deletedAt: serverTimestamp(), deletedBy: uid, deletedFrom: from,
  })

  // An operative cannot tombstone a labour booking (only admins delete those).
  await assertFails(setDoc(tomb(op, 'BOOK-T1'), fields('BOOK-T1', 'bookings', OP_A)))
  // Wrong shape is refused.
  await assertFails(setDoc(tomb(admin, 'BOOK-T1'), fields('OTHER', 'bookings', ADMIN_A)))
  await assertFails(setDoc(tomb(admin, 'BOOK-T1'), fields('BOOK-T1', 'bookings', OP_A)))
  await assertFails(setDoc(tomb(admin, 'BOOK-T1'), { ...fields('BOOK-T1', 'bookings', ADMIN_A), deletedAt: Timestamp.fromMillis(0) }))
  await assertFails(setDoc(tomb(admin, 'BOOK-T1'), fields('BOOK-T1', 'bookings', ADMIN_A, 'desktop')))

  // Admin deletes with the tombstone in one batch.
  const batch = writeBatch(admin)
  batch.delete(doc(admin, 'organizations', ORG_A, 'bookings', 'BOOK-T1'))
  batch.set(tomb(admin, 'BOOK-T1'), fields('BOOK-T1', 'bookings', ADMIN_A))
  await assertSucceeds(batch.commit())

  // A queued offline save (create or merge) from any device is refused, admin included.
  await assertFails(setDoc(doc(op, 'organizations', ORG_A, 'bookings', 'BOOK-T1'), { operativeId: OP_A, status: 'Confirmed' }, { merge: true }))
  await assertFails(setDoc(doc(admin, 'organizations', ORG_A, 'bookings', 'BOOK-T1'), { operativeId: OP_A, status: 'Confirmed' }))
  // The tombstone is read by members, never edited, and removed only by an admin.
  await assertSucceeds(getDoc(tomb(op, 'BOOK-T1')))
  await assertFails(getDoc(tomb(authDb(ADMIN_B, 'admin-b@test.com'), 'BOOK-T1')))
  await assertFails(setDoc(tomb(admin, 'BOOK-T1'), { deletedFrom: 'ios' }, { merge: true }))
  await assertFails(deleteDoc(tomb(op, 'BOOK-T1')))

  // Manager schedule bookings: any member deletes, with the tombstone; it cannot come back.
  const mgr = authDb(LM_A, 'lm-a@test.com')
  const msb = writeBatch(mgr)
  msb.delete(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'MSB-T1'))
  msb.set(tomb(mgr, 'MSB-T1'), fields('MSB-T1', 'managerSiteBookings', LM_A, 'ios'))
  await assertSucceeds(msb.commit())
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'MSB-T1'), { managerUserId: LM_A }, { merge: true }))

  // Untombstoned bookings still save as before.
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG_A, 'bookings', 'BOOK-NEW-1'), { operativeId: OP_A, status: 'Confirmed' }))

  // Admin clears the tombstone; the id can be used again.
  await assertSucceeds(deleteDoc(tomb(admin, 'BOOK-T1')))
  await assertSucceeds(setDoc(doc(admin, 'organizations', ORG_A, 'bookings', 'BOOK-T1'), { operativeId: OP_A, status: 'Confirmed' }))
})

test('cancelled bookings: an operative replay cannot reinstate one; edits that keep it cancelled pass; a manager reinstates', async () => {
  await seedLeaveAndTimesheetPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'bookings', 'BOOK-C1'), { operativeId: OP_A, status: 'Cancelled', notes: '' })
  })
  const op = authDb(OP_A, 'op-a@test.com')
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'organizations', ORG_A, 'bookings', 'BOOK-C1')
  await assertFails(setDoc(ref(op), { operativeId: OP_A, status: 'Confirmed', notes: '' }, { merge: true }))
  await assertSucceeds(setDoc(ref(op), { operativeId: OP_A, status: 'Cancelled', notes: 'still off' }, { merge: true }))
  await assertSucceeds(setDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), { status: 'Confirmed' }, { merge: true }))
})

test('warning decisions accept optional write metadata (web) and still accept writes without it (iOS)', async () => {
  await seedLeaveAndTimesheetPeople()
  const mgr = authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const key = 'meta-key-1'
  const wr = doc(mgr, 'organizations', ORG_A, 'warningResolutions', key)
  const base = { resolutionKey: key, status: 'dismissed', resolvedByUserId: MGR_OTHER_A, resolvedAt: serverTimestamp() }
  const meta = { updatedBy: MGR_OTHER_A, updatedFrom: 'web', updatedAt: serverTimestamp() }
  await assertSucceeds(setDoc(wr, base))
  await assertSucceeds(setDoc(wr, { ...base, ...meta }))
  await assertFails(setDoc(wr, { ...base, ...meta, updatedBy: ADMIN_A }))
  await assertFails(setDoc(wr, { ...base, ...meta, updatedFrom: 'desktop' }))
  await assertFails(setDoc(wr, { ...base, ...meta, updatedAt: 'yesterday' }))

  const clash = doc(mgr, 'organizations', ORG_A, 'acceptedBookingClashes', 'META|PAIR')
  const clashFields = { bookingAId: 'META', bookingBId: 'PAIR', acceptedByUserId: MGR_OTHER_A, acceptedAt: serverTimestamp() }
  await assertSucceeds(setDoc(clash, clashFields))
  await assertSucceeds(setDoc(clash, { ...clashFields, ...meta }))
  await assertFails(setDoc(clash, { ...clashFields, ...meta, updatedFrom: 'desktop' }))

  const dismissed = doc(mgr, 'organizations', ORG_A, 'dismissedWarnings', 'meta-dismiss-1')
  await assertSucceeds(setDoc(dismissed, { dismissedAt: serverTimestamp() }))
  await assertSucceeds(setDoc(dismissed, { dismissedAt: serverTimestamp(), ...meta }))
  await assertFails(setDoc(dismissed, { dismissedAt: serverTimestamp(), ...meta, updatedBy: OP_A }))
})

test('a manager with operatives access edits an operative profile with write metadata; a forged updatedBy is refused', async () => {
  const MGR_OPS = 'manager-ops-a'
  const OP_META = 'op-meta-a'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', MGR_OPS), {
      email: 'mgr-ops@test.com', organizationId: ORG_A, role: 'manager', manager: true, operatives: true,
    })
    await setDoc(doc(db, 'users', OP_META), {
      email: 'op-meta@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true, dayRate: 150,
      updatedBy: ADMIN_A, updatedFrom: 'ios',
    })
  })
  const ref = doc(authDb(MGR_OPS, 'mgr-ops@test.com'), 'users', OP_META)
  await assertSucceeds(updateDoc(ref, { dayRate: 160, updatedBy: MGR_OPS, updatedFrom: 'web', updatedAt: serverTimestamp() }))
  // Without metadata (iOS today), even though the stored stamp names someone else.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', OP_META), { updatedBy: ADMIN_A })
  })
  await assertSucceeds(updateDoc(ref, { dayRate: 170, updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(ref, { dayRate: 180, updatedBy: ADMIN_A + '-x' }))
  await assertFails(updateDoc(ref, { dayRate: 180, updatedFrom: 'desktop' }))
  // Still only the listed profile fields.
  await assertFails(updateDoc(ref, { role: 'manager', updatedBy: MGR_OPS }))
})
