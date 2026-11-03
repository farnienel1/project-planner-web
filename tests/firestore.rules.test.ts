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
  deleteField,
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

test('annual leave: self-bookers save their own leave approved; operatives with a line manager cannot', async () => {
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
  // OP_A has no line manager in the seed. Rulebook 1.2.0: that no longer self-books, it asks.
  await assertFails(setDoc(ref(authDb(OP_A, 'op-a@test.com'), 'hol-noline-1'), leave(OP_A, 'approved')))
  await assertSucceeds(setDoc(ref(authDb(OP_A, 'op-a@test.com'), 'hol-noline-1'), leave(OP_A, 'pending')))
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
    await setDoc(doc(db, 'organizations', ORG_A, 'managerSiteBookings', 'MSB-T1'), { userId: LM_A, locationType: 'office' })
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

  // Manager schedule bookings (1.10.0): a manager deletes their own non-job booking, with the tombstone; it cannot come back.
  const mgr = authDb(LM_A, 'lm-a@test.com')
  const msb = writeBatch(mgr)
  msb.delete(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'MSB-T1'))
  msb.set(tomb(mgr, 'MSB-T1'), fields('MSB-T1', 'managerSiteBookings', LM_A, 'ios'))
  await assertSucceeds(msb.commit())
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'MSB-T1'), { userId: LM_A, locationType: 'office' }, { merge: true }))

  // Untombstoned bookings still save as before (an admin; operatives never write bookings, 1.10.0).
  await assertSucceeds(setDoc(doc(admin, 'organizations', ORG_A, 'bookings', 'BOOK-NEW-1'), { operativeId: OP_A, status: 'Confirmed' }))
  await assertFails(setDoc(doc(op, 'organizations', ORG_A, 'bookings', 'BOOK-NEW-2'), { operativeId: OP_A, status: 'Confirmed' }))

  // Admin clears the tombstone; the id can be used again.
  await assertSucceeds(deleteDoc(tomb(admin, 'BOOK-T1')))
  await assertSucceeds(setDoc(doc(admin, 'organizations', ORG_A, 'bookings', 'BOOK-T1'), { operativeId: OP_A, status: 'Confirmed' }))
})

test('cancelled bookings: an operative replay is refused (1.10.0: operatives never write bookings); the job manager reinstates', async () => {
  await seedLeaveAndTimesheetPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', 'JOB-C1'), { managerIds: [MGR_OTHER_A] })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'BOOK-C1'), { operativeId: OP_A, projectId: 'JOB-C1', status: 'Cancelled', notes: '' })
  })
  const op = authDb(OP_A, 'op-a@test.com')
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'organizations', ORG_A, 'bookings', 'BOOK-C1')
  await assertFails(setDoc(ref(op), { operativeId: OP_A, status: 'Confirmed', notes: '' }, { merge: true }))
  await assertFails(setDoc(ref(op), { operativeId: OP_A, status: 'Cancelled', notes: 'still off' }, { merge: true }))
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

// ---------------------------------------------------------------------------
// A person cannot change their own pay on any path: operativeProfiles,
// operativeDayRateHistory, and the reviewer-only parts of a timesheet.
// ---------------------------------------------------------------------------

const PAY_MGR_OPS = 'pay-manager-ops-a'
const PAY_OP = 'pay-op-a'
const PAY_OP_ROW = 'pay-op-row-a'
const PAY_MGR_OP_ROW = 'pay-mgr-op-row-a'

async function seedPayPeople() {
  await seedLeaveAndTimesheetPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', PAY_MGR_OPS), {
      email: 'pay-mgr-ops@test.com', organizationId: ORG_A, role: 'manager', manager: true, operatives: true,
      permissions: { manager: true, operatives: true, operativeMode: false },
    })
    await setDoc(doc(db, 'users', PAY_OP), {
      email: 'pay-op@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true,
      assignedManagerUserId: LM_A, dayRate: 200,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'operativeProfiles', PAY_OP), {
      userId: PAY_OP, dayRate: 200, assignedManagerUserId: LM_A, updatedAt: Timestamp.now(),
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'operativeProfiles', PAY_MGR_OPS), {
      userId: PAY_MGR_OPS, dayRate: 300, updatedAt: Timestamp.now(),
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', PAY_OP_ROW), {
      email: 'pay-op@test.com', name: 'Pat', dayRate: 200,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', PAY_MGR_OP_ROW), {
      email: 'pay-mgr-ops@test.com', name: 'Morgan', dayRate: 300,
    })
  })
}

test('operativeProfiles: the person cannot change their own pay; unchanged resends pass; admins and operatives managers can', async () => {
  await seedPayPeople()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'operativeProfiles', id)
  const op = authDb(PAY_OP, 'pay-op@test.com')
  const mgr = authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  const admin = authDb(ADMIN_A, 'admin-a@test.com')

  // The operative's own pay, line manager or employment on the mirror: refused (update and create).
  await assertFails(setDoc(ref(op, PAY_OP), { userId: PAY_OP, dayRate: 999, updatedAt: Timestamp.now() }, { merge: true }))
  await assertFails(updateDoc(ref(op, PAY_OP), { payBasis: 'hourly', hourlyRate: 80 }))
  await assertFails(updateDoc(ref(op, PAY_OP), { assignedManagerUserId: PAY_OP }))
  await assertFails(updateDoc(ref(op, PAY_OP), { employmentType: 'self_employed' }))
  await assertFails(setDoc(ref(authDb(REPORT_A, 'report-a@test.com'), REPORT_A), { userId: REPORT_A, dayRate: 999 }))
  // Nor anyone else's.
  await assertFails(updateDoc(ref(op, PAY_MGR_OPS), { dayRate: 1 }))
  // iOS saveOperativeProfileMetadataFallback / web saveUser resend of the same values: allowed.
  await assertSucceeds(setDoc(ref(op, PAY_OP), {
    userId: PAY_OP, dayRate: 200.0, assignedManagerUserId: LM_A, updatedAt: Timestamp.now(),
  }, { merge: true }))
  await assertSucceeds(updateDoc(ref(op, PAY_OP), { updatedAt: serverTimestamp(), updatedBy: PAY_OP, updatedFrom: 'web' }))

  // A manager with operatives access changes an operative's pay, never their own or a manager's.
  await assertSucceeds(updateDoc(ref(mgr, PAY_OP), { dayRate: 210, assignedManagerUserId: PAY_MGR_OPS, updatedAt: Timestamp.now() }))
  await assertFails(updateDoc(ref(mgr, PAY_MGR_OPS), { dayRate: 999 }))
  await assertFails(setDoc(ref(mgr, LM_A), { userId: LM_A, dayRate: 999 }))
  // A doc id for someone else whose userId names the manager does not slip through.
  await assertFails(setDoc(ref(mgr, PAY_OP), { userId: PAY_MGR_OPS, dayRate: 999 }, { merge: true }))
  // A manager without operatives access cannot.
  await assertFails(updateDoc(ref(authDb(LM_A, 'lm-a@test.com'), PAY_OP), { dayRate: 220 }))
  // Admins can, including a profile that does not exist yet.
  await assertSucceeds(updateDoc(ref(admin, PAY_OP), { dayRate: 230, payBasis: 'day' }))
  await assertSucceeds(setDoc(ref(admin, REPORT_A), { userId: REPORT_A, dayRate: 240 }, { merge: true }))
  // Another company's admin cannot.
  await assertFails(updateDoc(ref(authDb(ADMIN_B, 'admin-b@test.com'), PAY_OP), { dayRate: 1 }))
  // Delete: the person's own mirror or a pay manager, not a colleague.
  await assertFails(deleteDoc(ref(op, PAY_MGR_OPS)))
  await assertSucceeds(deleteDoc(ref(mgr, PAY_OP)))
})

test('operativeDayRateHistory: nobody records their own rate; admins and operatives managers record an operative\'s', async () => {
  await seedPayPeople()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', id)
  const row = (extra: Record<string, unknown>) => ({
    dayRate: 999, effectiveAt: Timestamp.fromMillis(Date.parse('2026-10-01T00:00:00Z')), createdAt: Timestamp.now(), ...extra,
  })
  const op = authDb(PAY_OP, 'pay-op@test.com')
  const mgr = authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')

  // The operative: not their own row (by user id or by their operatives record), not anyone else's.
  await assertFails(setDoc(ref(op, 'r1'), row({ userId: PAY_OP }), { merge: true }))
  await assertFails(setDoc(ref(op, 'r2'), row({ operativeId: PAY_OP_ROW })))
  await assertFails(setDoc(ref(op, 'r3'), row({ userId: REPORT_A })))
  // The manager: an operative's row (iOS shape, then web shape with payBasis and stamps).
  await assertSucceeds(setDoc(ref(mgr, 'r4'), row({ userId: PAY_OP, operativeId: PAY_OP_ROW, dayRate: 210 }), { merge: true }))
  await assertSucceeds(setDoc(ref(mgr, 'r5'), {
    ...row({ userId: PAY_OP, operativeId: '', dayRate: 25, payBasis: 'hourly' }),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: PAY_MGR_OPS, updatedFrom: 'web',
  }, { merge: true }))
  await assertSucceeds(setDoc(ref(mgr, 'r6'), row({ operativeId: PAY_OP_ROW })))
  // ...never their own, by user id or by their own operatives row, and never a manager's.
  await assertFails(setDoc(ref(mgr, 'r7'), row({ userId: PAY_MGR_OPS })))
  await assertFails(setDoc(ref(mgr, 'r8'), row({ operativeId: PAY_MGR_OP_ROW })))
  await assertFails(setDoc(ref(mgr, 'r9'), row({ userId: LM_A })))
  // Rewriting a row about someone else into a row about yourself is refused too.
  await assertFails(updateDoc(ref(mgr, 'r4'), { userId: PAY_MGR_OPS }))
  // A manager without operatives access cannot record pay.
  await assertFails(setDoc(ref(authDb(LM_A, 'lm-a@test.com'), 'r10'), row({ userId: PAY_OP })))
  // Admins can.
  await assertSucceeds(setDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'r11'), row({ userId: PAY_OP, dayRate: 220 })))
  // Everyone in the company still reads history (payRateOnDay on both apps).
  await assertSucceeds(getDoc(ref(op, 'r4')))
  await assertFails(setDoc(ref(authDb(ADMIN_B, 'admin-b@test.com'), 'r12'), row({ userId: PAY_OP })))
})

test('timesheets: the owner cannot change line reviews, entry decisions or the approved snapshot; the line manager and admins can', async () => {
  await seedPayPeople()
  const id = `timesheet_${REPORT_A}_1770000000`
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'organizations', ORG_A, 'settings', id)
  const rep = authDb(REPORT_A, 'report-a@test.com')
  const lm = authDb(LM_A, 'lm-a@test.com')
  // iOS asFirestoreMap shape: the whole draft, manager parts empty, inline decision 'approved'.
  const expense = (amount: number, managerDecision = 'approved', managerRevisedAmount: number | null = null) => ({
    id: 'E1', title: 'Parking', details: '', jobNumber: 'J1',
    date: Timestamp.fromMillis(Date.parse('2026-10-03T00:00:00Z') + 0.123), amount, receiptName: '',
    managerDecision, managerRevisedAmount,
  })
  const iosSave = (extra: Record<string, unknown> = {}) => ({
    userId: REPORT_A, weekStartKey: '2026-10-01', weekEndKey: '2026-10-15',
    managerNote: '', operativeSignedAt: null, operativeSignedByName: '', operativeSignatureImageBase64: '',
    managerSignedAt: null, managerSignedByName: '', managerSignedByUserId: '', managerSignatureImageBase64: '',
    approvedAt: null, approvedByName: '', exportedAt: null, weeklyReportOverride: null,
    expenseEntries: [expense(40)], priceWorkEntries: [], payrollLineReviews: {},
    updatedAt: Timestamp.now(),
    ...extra,
  })
  await assertSucceeds(setDoc(ref(rep), iosSave(), { merge: true }))
  // The owner writes their note to the manager and edits their own expense before sign-off.
  await assertSucceeds(setDoc(ref(rep), iosSave({ managerNote: 'Tuesday ran late', expenseEntries: [expense(50)] }), { merge: true }))

  // Manager-only parts: refused for the owner.
  await assertFails(setDoc(ref(rep), { payrollLineReviews: { 'op-1': { decision: 'edited', revisedAmount: 999 } } }, { merge: true }))
  await assertFails(setDoc(ref(rep), { extraEntryReviews: { E1: { decision: 'approved', reviewedAmount: 50 } } }, { merge: true }))
  await assertFails(updateDoc(ref(rep), { 'extraEntryReviews.E1': { decision: 'edited', revisedAmount: 999, reviewedAmount: 50 } }))
  await assertFails(setDoc(ref(rep), { weeklyReportOverride: { approvedByUserId: REPORT_A, selfSigned: true, lines: [] } }, { merge: true }))

  // The line manager reviews: a line decision, and an entry decision as a dotted update.
  await assertSucceeds(setDoc(ref(lm), { payrollLineReviews: { 'op-1': { decision: 'declined', revisedAmount: null } } }, { merge: true }))
  await assertSucceeds(updateDoc(ref(lm), {
    'extraEntryReviews.E1': { decision: 'edited', revisedAmount: 30, reviewedAmount: 50, reviewedByUserId: LM_A, reviewedAtMs: 1 },
  }))
  // An admin can too.
  await assertSucceeds(updateDoc(ref(authDb(ADMIN_A, 'admin-a@test.com')), { 'payrollLineReviews.op-2': { decision: 'approved', revisedAmount: null } }))

  // The owner's iOS full resend with the same reviews: allowed. Undoing a review: refused.
  const reviews = {
    payrollLineReviews: {
      'op-1': { decision: 'declined', revisedAmount: null },
      'op-2': { decision: 'approved', revisedAmount: null },
    },
  }
  await assertSucceeds(setDoc(ref(rep), iosSave({ managerNote: 'Tuesday ran late', expenseEntries: [expense(50, 'edited', 30)], ...reviews }), { merge: true }))
  await assertFails(setDoc(ref(rep), iosSave({ payrollLineReviews: {} }), { merge: true }))
  await assertFails(updateDoc(ref(rep), { 'payrollLineReviews.op-1': { decision: 'approved', revisedAmount: null } }))
  await assertFails(updateDoc(ref(rep), { extraEntryReviews: null }))
  await assertFails(deleteDoc(ref(rep)))
  // The owner may still rewrite the inline value; readers ignore it (timesheetEntryDecision).
  await assertSucceeds(setDoc(ref(rep), iosSave({ managerNote: 'Tuesday ran late', expenseEntries: [expense(50, 'approved', null)], ...reviews }), { merge: true }))

  // The line manager signs. After that the owner cannot change price work or expenses...
  const signed = Timestamp.fromMillis(Date.parse('2026-10-16T10:00:00.123Z') + 0.789)
  await assertSucceeds(setDoc(ref(lm), {
    managerSignedAt: signed, managerSignedByName: 'Lou', managerSignedByUserId: LM_A, approvedAt: signed, approvedByName: 'Lou',
    weeklyReportOverride: { approvedByUserId: LM_A, selfSigned: false, lines: [], priceWork: [], expenses: [] },
  }, { merge: true }))
  const signedResend = {
    managerSignedAt: Timestamp.fromMillis(signed.toMillis()), managerSignedByName: 'Lou', managerSignedByUserId: LM_A,
    approvedAt: Timestamp.fromMillis(signed.toMillis()), approvedByName: 'Lou',
  }
  await assertFails(setDoc(ref(rep), { ...signedResend, expenseEntries: [expense(500)] }, { merge: true }))
  await assertFails(setDoc(ref(rep), { ...signedResend, priceWorkEntries: [{ id: 'P1', title: 'Extra', amount: 900, managerDecision: 'approved' }] }, { merge: true }))
  // ...or the approved snapshot, but a save that leaves them out (web timesheetOwnerWriteFields) passes.
  await assertFails(setDoc(ref(rep), { ...signedResend, weeklyReportOverride: null }, { merge: true }))
  await assertSucceeds(setDoc(ref(rep), {
    ...signedResend, userId: REPORT_A, managerNote: 'Thanks', updatedAt: Timestamp.now(), updatedBy: REPORT_A, updatedFrom: 'web',
  }, { merge: true }))
  // The line manager still can.
  await assertSucceeds(setDoc(ref(lm), { expenseEntries: [expense(50, 'edited', 30)] }, { merge: true }))
})

test('timesheets: a person with no line manager writes their own self-signed snapshot but never reviews', async () => {
  await seedPayPeople()
  // OP_A has no line manager in the seed.
  const ref = doc(authDb(OP_A, 'op-a@test.com'), 'organizations', ORG_A, 'settings', `timesheet_${OP_A}_1770000000`)
  await assertSucceeds(setDoc(ref, {
    userId: OP_A, operativeSignedAt: Timestamp.now(), operativeSignedByName: 'Ollie',
    managerSignedAt: null, managerSignedByName: '', managerSignedByUserId: '', managerSignatureImageBase64: '',
    approvedAt: null, approvedByName: '', exportedAt: null, payrollLineReviews: {},
    weeklyReportOverride: { approvedByUserId: OP_A, selfSigned: true, lines: [], priceWork: [], expenses: [] },
  }, { merge: true }))
  await assertFails(setDoc(ref, { payrollLineReviews: { 'op-1': { decision: 'edited', revisedAmount: 999 } } }, { merge: true }))
  await assertFails(setDoc(ref, { extraEntryReviews: { E1: { decision: 'approved' } } }, { merge: true }))
})

test('roster rows: operatives and managers pay is changed only by admins or an operatives manager (never their own)', async () => {
  await seedPayPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'managers', 'pay-mgr-row-a'), {
      email: 'pay-mgr-ops@test.com', name: 'Morgan', dayRate: 300,
    })
  })
  const opRow = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'operatives', id)
  const mgrRow = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'managers', id)
  const op = authDb(PAY_OP, 'pay-op@test.com')
  const mgr = authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  const admin = authDb(ADMIN_A, 'admin-a@test.com')

  // An operative cannot change pay on any operatives row, own or not; other fields and unchanged resends pass.
  await assertFails(updateDoc(opRow(op, PAY_OP_ROW), { dayRate: 999 }))
  await assertFails(updateDoc(opRow(op, PAY_MGR_OP_ROW), { payBasis: 'hourly', hourlyRate: 90 }))
  await assertFails(setDoc(opRow(op, 'new-row-a'), { email: 'x@test.com', name: 'X', dayRate: 10 }))
  await assertSucceeds(setDoc(opRow(op, PAY_OP_ROW), { email: 'pay-op@test.com', name: 'Pat B', dayRate: 200 }, { merge: true }))
  await assertSucceeds(setDoc(opRow(op, 'new-row-b'), { email: 'y@test.com', name: 'Y' }))
  // A manager with operatives access changes an operative's row, never their own row.
  await assertSucceeds(updateDoc(opRow(mgr, PAY_OP_ROW), { dayRate: 210 }))
  await assertFails(updateDoc(opRow(mgr, PAY_MGR_OP_ROW), { dayRate: 999 }))
  // Manager rows: admins only.
  await assertFails(updateDoc(mgrRow(mgr, 'pay-mgr-row-a'), { dayRate: 999 }))
  await assertSucceeds(updateDoc(mgrRow(mgr, 'pay-mgr-row-a'), { name: 'Morgan B' }))
  await assertSucceeds(updateDoc(mgrRow(admin, 'pay-mgr-row-a'), { dayRate: 320 }))
  await assertSucceeds(updateDoc(opRow(admin, PAY_MGR_OP_ROW), { dayRate: 310 }))
  // Another company's admin cannot.
  await assertFails(updateDoc(opRow(authDb(ADMIN_B, 'admin-b@test.com'), PAY_OP_ROW), { dayRate: 1 }))
})

// ---------------------------------------------------------------------------
// Rulebook 1.2.0 (decisions 2, 3, 5, 14, 15).
// ---------------------------------------------------------------------------

const NOLM_MGR_A = 'no-line-manager-mgr-a'
const SB_OPMODE_A = 'self-book-operative-mode-a'
const ADMIN_OPMODE_A = 'admin-operative-mode-a'

async function seedRulebook120People() {
  await seedPayPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    // Self-book off, marked as having no line manager.
    await setDoc(doc(db, 'users', NOLM_MGR_A), {
      email: 'nolm-mgr-a@test.com', organizationId: ORG_A, role: 'manager', manager: true, hasNoLineManager: true,
      permissions: { manager: true, annualLeaveSelfBook: false, operativeMode: false },
    })
    // Self-book flag on, but in operative mode: does not self-book.
    await setDoc(doc(db, 'users', SB_OPMODE_A), {
      email: 'sb-opmode-a@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true,
      annualLeaveSelfBook: true, permissions: { annualLeaveSelfBook: true, operativeMode: true },
    })
    // An admin working in operative mode, line manager of nobody.
    await setDoc(doc(db, 'users', ADMIN_OPMODE_A), {
      email: 'admin-opmode-a@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, operativeMode: true,
      permissions: { adminAccess: true, operativeMode: true },
    })
  })
}

test('1.2.0 decision 2: only the self-book flag (not operative mode) self-books; no line manager alone does not', async () => {
  await seedRulebook120People()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const nolm = authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com')
  const sbOp = authDb(SB_OPMODE_A, 'sb-opmode-a@test.com')
  // hasNoLineManager, self-book off: asks, never saves approved, never edits the dates once decided.
  await assertFails(setDoc(ref(nolm, 'hb120-1'), leave(NOLM_MGR_A, 'approved')))
  await assertFails(setDoc(ref(nolm, 'hb120-1'), leave(NOLM_MGR_A, 'approved', { approvedByUserId: NOLM_MGR_A })))
  await assertSucceeds(setDoc(ref(nolm, 'hb120-1'), leave(NOLM_MGR_A, 'pending')))
  await assertFails(updateDoc(ref(nolm, 'hb120-1'), { status: 'approved', approvedByUserId: NOLM_MGR_A, approvedAt: Timestamp.now() }))
  // Self-book flag in operative mode: asks too.
  await assertFails(setDoc(ref(sbOp, 'hb120-2'), leave(SB_OPMODE_A, 'approved')))
  await assertSucceeds(setDoc(ref(sbOp, 'hb120-2'), leave(SB_OPMODE_A, 'pending')))
  // Nobody is stranded: an admin (not in operative mode) decides the no-line-manager request.
  await assertSucceeds(updateDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'hb120-1'), { status: 'approved', approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() }))
  // Once approved, a non-self-booker (not a manager) cannot delete it themselves (they ask to cancel).
  await assertSucceeds(updateDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'hb120-2'), { status: 'approved', approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() }))
  await assertFails(deleteDoc(ref(sbOp, 'hb120-2')))
  // A pending request may still be withdrawn.
  await assertSucceeds(setDoc(ref(sbOp, 'hb120-3'), leave(SB_OPMODE_A, 'pending')))
  await assertSucceeds(deleteDoc(ref(sbOp, 'hb120-3')))
})

test('1.2.0 decision 3: nobody decides their own leave, admins included; an admin in operative mode decides only as line manager', async () => {
  await seedRulebook120People()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const adminOp = authDb(ADMIN_OPMODE_A, 'admin-opmode-a@test.com')
  const approve = (uid: string) => ({ status: 'approved', approvedByUserId: uid, approvedAt: Timestamp.now() })

  // 1.3.0: ADMIN_A has no line manager, so their own leave is self-approved.
  await assertSucceeds(setDoc(ref(admin, 'hb130-own-0'), leave(ADMIN_A, 'approved', { approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() })))
  // With a line manager (and no self-book flag) the admin's own request waits; they cannot approve it or save it approved.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ADMIN_A), { assignedManagerUserIds: [LM_A] }, { merge: true })
  })
  await assertFails(setDoc(ref(admin, 'hb120-own-1'), leave(ADMIN_A, 'approved', { approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() })))
  await assertSucceeds(setDoc(ref(admin, 'hb120-own-1'), leave(ADMIN_A, 'pending')))
  await assertFails(updateDoc(ref(admin, 'hb120-own-1'), approve(ADMIN_A)))
  await assertFails(updateDoc(ref(admin, 'hb120-own-1'), { status: 'rejected', decisionNote: 'no' }))
  // Another admin (not in operative mode) can decide it; the admin in operative mode cannot.
  await assertFails(updateDoc(ref(adminOp, 'hb120-own-1'), approve(ADMIN_OPMODE_A)))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ADMIN_A), { assignedManagerUserIds: [] }, { merge: true })
  })

  // Requests from people with and without a line manager.
  await assertSucceeds(setDoc(ref(authDb(REPORT_A, 'report-a@test.com'), 'hb120-rep'), leave(REPORT_A, 'pending')))
  await assertSucceeds(setDoc(ref(authDb(OP_A, 'op-a@test.com'), 'hb120-noline'), leave(OP_A, 'pending')))
  // Admin in operative mode: neither (not the line manager; no admin fallback in operative mode).
  await assertFails(updateDoc(ref(adminOp, 'hb120-rep'), approve(ADMIN_OPMODE_A)))
  await assertFails(updateDoc(ref(adminOp, 'hb120-noline'), approve(ADMIN_OPMODE_A)))
  // Admin not in operative mode: both.
  await assertSucceeds(updateDoc(ref(admin, 'hb120-rep'), approve(ADMIN_A)))
  await assertSucceeds(updateDoc(ref(admin, 'hb120-noline'), approve(ADMIN_A)))

  // An admin in operative mode who is the line manager decides as line manager.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', REPORT_A), { assignedManagerUserIds: [ADMIN_OPMODE_A] }, { merge: true })
  })
  await assertSucceeds(setDoc(ref(authDb(REPORT_A, 'report-a@test.com'), 'hb120-rep-2'), leave(REPORT_A, 'pending')))
  await assertSucceeds(updateDoc(ref(adminOp, 'hb120-rep-2'), approve(ADMIN_OPMODE_A)))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', REPORT_A), { assignedManagerUserIds: [] }, { merge: true })
  })
})

test('1.2.0 decision 5: managers un-approve a booking clash (delete); operatives and other companies cannot', async () => {
  await seedRulebook120People()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', id)
  const fields = { bookingAId: 'C', bookingBId: 'D', acceptedByUserId: ADMIN_A }
  await env.withSecurityRulesDisabled(async (ctx) => {
    // One firestore() per context: a second call fails with "Firestore has already been started".
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', 'C|D'), fields)
    await setDoc(doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', 'E|F'), fields)
  })
  const mgr = authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  await assertFails(deleteDoc(ref(authDb(OP_A, 'op-a@test.com'), 'C|D')))
  await assertFails(deleteDoc(ref(authDb(ADMIN_B, 'admin-b@test.com'), 'C|D')))
  await assertSucceeds(deleteDoc(ref(mgr, 'C|D')))
  await assertSucceeds(deleteDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'E|F')))
})

test('1.2.0 decision 7 (1.10.0): a manager who does not manage the job cannot delete its labour booking or tombstone it', async () => {
  await seedRulebook120People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'bookings', 'book-120'), { organizationId: ORG_A, userId: OP_A })
  })
  const mgr = authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const tombstone = (uid: string) => ({ bookingId: 'book-120', collection: 'bookings', deletedAt: serverTimestamp(), deletedBy: uid, deletedFrom: 'web' })
  await assertFails(deleteDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'book-120')))
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'deletedBookings', 'book-120'), tombstone(MGR_OTHER_A)))
  const batch = writeBatch(admin)
  batch.delete(doc(admin, 'organizations', ORG_A, 'bookings', 'book-120'))
  batch.set(doc(admin, 'organizations', ORG_A, 'deletedBookings', 'book-120'), tombstone(ADMIN_A))
  await assertSucceeds(batch.commit())
})

test('1.2.0 decision 14: hasNoLineManager is a line-manager field: never the person; admins; operatives managers for an operative', async () => {
  await seedRulebook120People()
  const user = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'users', id)
  const op = authDb(PAY_OP, 'pay-op@test.com')
  const mgrOps = authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  // The person never changes their own (on or off).
  await assertFails(updateDoc(user(op, PAY_OP), { hasNoLineManager: true }))
  await assertFails(updateDoc(user(authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), NOLM_MGR_A), { hasNoLineManager: false }))
  // Resending the unchanged value passes (missing and false are the same; true stays true).
  await assertSucceeds(updateDoc(user(op, PAY_OP), { hasNoLineManager: false, firstName: 'Pat' }))
  await assertSucceeds(updateDoc(user(authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), NOLM_MGR_A), { hasNoLineManager: true, firstName: 'Nia' }))
  // An operatives manager sets it for an operative, alongside the line manager; not for a manager, not their own.
  await assertSucceeds(updateDoc(user(mgrOps, PAY_OP), { hasNoLineManager: true, assignedManagerUserIds: [], assignedManagerUserId: '' }))
  await assertSucceeds(updateDoc(user(mgrOps, PAY_OP), { hasNoLineManager: false, assignedManagerUserIds: [LM_A], assignedManagerUserId: LM_A }))
  await assertFails(updateDoc(user(mgrOps, LM_A), { hasNoLineManager: true }))
  await assertFails(updateDoc(user(mgrOps, PAY_MGR_OPS), { hasNoLineManager: true }))
  // A manager without operatives access cannot.
  await assertFails(updateDoc(user(authDb(LM_A, 'lm-a@test.com'), PAY_OP), { hasNoLineManager: true }))
  // Admins can, for anyone in their company; another company's admin cannot.
  await assertSucceeds(updateDoc(user(authDb(ADMIN_A, 'admin-a@test.com'), NOLM_MGR_A), { hasNoLineManager: false }))
  await assertSucceeds(updateDoc(user(authDb(ADMIN_A, 'admin-a@test.com'), PAY_OP), { hasNoLineManager: true }))
  await assertFails(updateDoc(user(authDb(ADMIN_B, 'admin-b@test.com'), PAY_OP), { hasNoLineManager: false }))
})

test('1.2.0 decision 15: a cleared-rate history row (dayRate null, payBasis null) is accepted for the same writers', async () => {
  await seedRulebook120People()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', id)
  const cleared = (extra: Record<string, unknown>) => ({
    dayRate: null, payBasis: null, effectiveAt: Timestamp.fromMillis(Date.parse('2026-11-01T00:00:00Z')), createdAt: Timestamp.now(), ...extra,
  })
  const op = authDb(PAY_OP, 'pay-op@test.com')
  const mgr = authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  // Same writers as a normal row: operatives manager for an operative (user id or operatives row), admins.
  await assertSucceeds(setDoc(ref(mgr, 'clr-1'), cleared({ userId: PAY_OP, operativeId: PAY_OP_ROW }), { merge: true }))
  await assertSucceeds(setDoc(ref(mgr, 'clr-2'), { ...cleared({ operativeId: PAY_OP_ROW }), updatedAt: serverTimestamp(), updatedBy: PAY_MGR_OPS, updatedFrom: 'ios' }))
  await assertSucceeds(setDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'clr-3'), cleared({ userId: REPORT_A })))
  // An existing row can be turned into a cleared row by the same writers.
  await assertSucceeds(setDoc(ref(mgr, 'clr-4'), cleared({ userId: PAY_OP, dayRate: 200, payBasis: 'day' })))
  await assertSucceeds(updateDoc(ref(mgr, 'clr-4'), { dayRate: null, payBasis: null }))
  // ...and the same people are still refused: own row, a manager's row, no operatives access, another company.
  await assertFails(setDoc(ref(op, 'clr-5'), cleared({ userId: PAY_OP })))
  await assertFails(setDoc(ref(mgr, 'clr-6'), cleared({ userId: PAY_MGR_OPS })))
  await assertFails(setDoc(ref(mgr, 'clr-7'), cleared({ userId: LM_A })))
  await assertFails(setDoc(ref(authDb(LM_A, 'lm-a@test.com'), 'clr-8'), cleared({ userId: PAY_OP })))
  await assertFails(setDoc(ref(authDb(ADMIN_B, 'admin-b@test.com'), 'clr-9'), cleared({ userId: PAY_OP })))
})

test('1.2.0 holiday delete: only a decider (never on their own leave), the owner withdrawing, or a self-booker deletes', async () => {
  await seedRulebook120People()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const approved = (uid: string, extra: Record<string, unknown> = {}) => leave(uid, 'approved', { approvedByUserId: ADMIN_A, approvedAt: Timestamp.now(), ...extra })
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-mgr-own'), approved(NOLM_MGR_A))
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-admin-own'), approved(ADMIN_A))
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-rep-cancel'), approved(REPORT_A, {
      cancellationRequestedAt: Timestamp.now(), cancellationRequestedByUserId: REPORT_A,
    }))
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-rep-2'), approved(REPORT_A))
  })
  const lm = authDb(LM_A, 'lm-a@test.com')
  // A manager (not a self-booker) cannot delete their own approved leave; nor can an admin who has a line
  // manager (1.3.0: an admin without one is self-approved and may).
  await assertFails(deleteDoc(ref(authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), 'hbdel-mgr-own')))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ADMIN_A), { assignedManagerUserIds: [LM_A] }, { merge: true })
  })
  await assertFails(deleteDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'hbdel-admin-own')))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ADMIN_A), { assignedManagerUserIds: [] }, { merge: true })
  })
  // A manager who is not the line manager cannot delete a report's booking; an admin in operative mode cannot either.
  await assertFails(deleteDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hbdel-rep-cancel')))
  await assertFails(deleteDoc(ref(authDb(ADMIN_OPMODE_A, 'admin-opmode-a@test.com'), 'hbdel-rep-cancel')))
  // Another company cannot.
  await assertFails(deleteDoc(ref(authDb(ADMIN_B, 'admin-b@test.com'), 'hbdel-rep-cancel')))
  // The line manager accepts the cancellation by deleting it.
  await assertSucceeds(deleteDoc(ref(lm, 'hbdel-rep-cancel')))
  // An admin (not in operative mode) removes someone else's booking (cleanup, Team screen).
  await assertSucceeds(deleteDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'hbdel-rep-2')))
  // Another admin may remove ADMIN_A's own booking.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'admin-a2'), { email: 'admin-a2@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true })
  })
  await assertSucceeds(deleteDoc(ref(authDb('admin-a2', 'admin-a2@test.com'), 'hbdel-admin-own')))
})

test('1.2.0 decision 5: any manager un-approves a warning resolution someone else approved; operatives and other companies cannot', async () => {
  await seedRulebook120People()
  const key = 'clash|book-x|book-y'
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'organizations', ORG_A, 'warningResolutions', key)
  const seed = async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'warningResolutions', key), {
        resolutionKey: key, status: 'approved', resolvedByUserId: LM_A, resolvedAt: Timestamp.now(),
      })
    })
  }
  await seed()
  await assertFails(deleteDoc(ref(authDb(OP_A, 'op-a@test.com'))))
  await assertFails(deleteDoc(ref(authDb(ADMIN_B, 'admin-b@test.com'))))
  await assertSucceeds(deleteDoc(ref(authDb(MGR_OTHER_A, 'mgr-other-a@test.com'))))
  await seed()
  await assertSucceeds(deleteDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'))))
})

// ---------------------------------------------------------------------------
// Rulebook 1.3.0: line managers (A.5) and notification actorUserId (B).
// ---------------------------------------------------------------------------

const GONE_MGR_A = 'inactive-manager-a'

async function seedRulebook130People() {
  await seedRulebook120People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', GONE_MGR_A), {
      email: 'gone-a@test.com', organizationId: ORG_A, role: 'manager', manager: true, isActive: false,
      permissions: { manager: true },
    })
  })
}

async function setAdminLineManagers(ids: string[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ADMIN_A), { assignedManagerUserIds: ids, assignedManagerUserId: ids[0] ?? '' }, { merge: true })
  })
}

test('1.3.0 A5: with no line manager, only admins decide leave — never any manager', async () => {
  await seedRulebook130People()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const mgr = authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const approve = (uid: string) => ({ status: 'approved', approvedByUserId: uid, approvedAt: Timestamp.now() })
  // OP_A has no line manager (legacy data).
  await assertSucceeds(setDoc(ref(authDb(OP_A, 'op-a@test.com'), 'hb130-legacy'), leave(OP_A, 'pending')))
  await assertFails(updateDoc(ref(mgr, 'hb130-legacy'), approve(MGR_OTHER_A)))
  await assertFails(updateDoc(ref(mgr, 'hb130-legacy'), { status: 'rejected', approvedByUserId: MGR_OTHER_A }))
  await assertFails(deleteDoc(ref(mgr, 'hb130-legacy')))
  await assertSucceeds(updateDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'hb130-legacy'), approve(ADMIN_A)))
  // A legacy operativeId-only row: admins only too.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'holidayBookings', 'hb130-opid'), { ...leave(OP_A, 'pending'), userId: null, operativeId: 'legacy-operative-row' })
  })
  await assertFails(updateDoc(ref(mgr, 'hb130-opid'), approve(MGR_OTHER_A)))
  await assertSucceeds(updateDoc(ref(authDb(ADMIN_A, 'admin-a@test.com'), 'hb130-opid'), approve(ADMIN_A)))
  // The line manager still decides their report's request.
  await assertSucceeds(setDoc(ref(authDb(REPORT_A, 'report-a@test.com'), 'hb130-rep'), leave(REPORT_A, 'pending')))
  await assertSucceeds(updateDoc(ref(authDb(LM_A, 'lm-a@test.com'), 'hb130-rep'), approve(LM_A)))
})

test('1.3.0 A4/A5: an admin with no current line manager self-books leave; with one they ask; operative mode never', async () => {
  await seedRulebook130People()
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const approved = () => leave(ADMIN_A, 'approved', { approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() })
  try {
    await setAdminLineManagers([])
    await assertSucceeds(setDoc(ref(admin, 'hb130-a1'), approved()))
    await assertSucceeds(updateDoc(ref(admin, 'hb130-a1'), { timeSlot: 'PM' }))
    await assertSucceeds(deleteDoc(ref(admin, 'hb130-a1')))
    // Only line manager listed is themself, or an inactive manager, or a missing account: still none.
    await setAdminLineManagers([ADMIN_A])
    await assertSucceeds(setDoc(ref(admin, 'hb130-a2'), approved()))
    await setAdminLineManagers([GONE_MGR_A])
    await assertSucceeds(setDoc(ref(admin, 'hb130-a3'), approved()))
    await setAdminLineManagers(['no-such-user'])
    await assertSucceeds(setDoc(ref(admin, 'hb130-a4'), approved()))
    // An active line manager: the admin asks.
    await setAdminLineManagers([LM_A])
    await assertFails(setDoc(ref(admin, 'hb130-a5'), approved()))
    await assertSucceeds(setDoc(ref(admin, 'hb130-a5'), leave(ADMIN_A, 'pending')))
    await assertFails(updateDoc(ref(admin, 'hb130-a5'), { status: 'approved', approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() }))
  } finally {
    await setAdminLineManagers([])
  }
  // An admin in operative mode with no line manager does not self-book.
  await assertFails(setDoc(ref(authDb(ADMIN_OPMODE_A, 'admin-opmode-a@test.com'), 'hb130-aop'), leave(ADMIN_OPMODE_A, 'approved')))
  // A manager with no line manager (and no self-book flag) still asks.
  await assertFails(setDoc(ref(authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), 'hb130-m'), leave(NOLM_MGR_A, 'approved')))
})

test('1.3.0 A4: an admin with no current line manager writes their self-signed snapshot; with one they cannot', async () => {
  await seedRulebook130People()
  const ref = doc(authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'settings', `timesheet_${ADMIN_A}_1790000000`)
  const save = (n: number) => ({
    userId: ADMIN_A, operativeSignedAt: Timestamp.now(), operativeSignedByName: 'Ada',
    weeklyReportOverride: { approvedByUserId: ADMIN_A, selfSigned: true, lines: [], priceWork: [], expenses: [], n },
  })
  try {
    await setAdminLineManagers([])
    await assertSucceeds(setDoc(ref, save(1), { merge: true }))
    await setAdminLineManagers([GONE_MGR_A])
    await assertSucceeds(setDoc(ref, save(2), { merge: true }))
    // Admins are timesheet reviewers, so the owner check is shown on a non-admin: REPORT_A with an active LM.
  } finally {
    await setAdminLineManagers([])
  }
  const rep = doc(authDb(REPORT_A, 'report-a@test.com'), 'organizations', ORG_A, 'settings', `timesheet_${REPORT_A}_1790000000`)
  await assertFails(setDoc(rep, { userId: REPORT_A, weeklyReportOverride: { approvedByUserId: REPORT_A, selfSigned: true, lines: [] } }, { merge: true }))
  // REPORT_A whose only line manager is inactive has no current line manager (legacy data): the snapshot passes the rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', REPORT_A), { assignedManagerUserId: GONE_MGR_A }, { merge: true })
  })
  try {
    await assertSucceeds(setDoc(rep, { userId: REPORT_A, weeklyReportOverride: { approvedByUserId: REPORT_A, selfSigned: true, lines: [] } }, { merge: true }))
  } finally {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', REPORT_A), { assignedManagerUserId: LM_A }, { merge: true })
    })
  }
})

test('1.3.0 B: a notification actorUserId, when written, is the signed-in user', async () => {
  const ref = (db: ReturnType<typeof authDb>, id: string) => doc(db, 'organizations', ORG_A, 'notifications', id)
  const op = authDb(OP_A, 'op-a@test.com')
  const row = (extra: Record<string, unknown> = {}) => ({ userId: ADMIN_A, type: 'holiday_request_submitted', isRead: false, title: 't', message: 'm', ...extra })
  await assertSucceeds(setDoc(ref(op, 'n130-1'), row({ actorUserId: OP_A })))
  await assertSucceeds(setDoc(ref(op, 'n130-2'), row()))
  await assertFails(setDoc(ref(op, 'n130-3'), row({ actorUserId: ADMIN_A })))
  await assertFails(setDoc(ref(op, 'n130-4'), row({ actorUserId: null })))
  // Another company's member cannot write here at all.
  await assertFails(setDoc(ref(authDb(OP_B, 'op-b@test.com'), 'n130-5'), row({ actorUserId: OP_B })))
  // The addressee marks it read; nobody rewrites the actor to someone else.
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  await assertSucceeds(updateDoc(ref(admin, 'n130-1'), { isRead: true }))
  await assertFails(updateDoc(ref(admin, 'n130-1'), { actorUserId: OP_A + '-x' }))
  await assertSucceeds(updateDoc(ref(admin, 'n130-1'), { actorUserId: ADMIN_A }))
})

test('1.9.0: a staff material status write may carry updatedBy / updatedFrom (validated)', async () => {
  const STAFF_A = 'staff-a-190'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', STAFF_A), {
      email: 'staff-a-190@test.com',
      organizationId: ORG_A,
      role: 'staff',
      adminAccess: false,
      operativeMode: false,
    })
    await setDoc(doc(db, 'organizations', ORG_A), { members: { [STAFF_A]: 'member' } }, { merge: true })
    await setDoc(doc(db, 'organizations', ORG_A, 'materials', 'mat-190'), {
      organizationId: ORG_A,
      addedByUserId: ADMIN_A,
      status: 'draft',
    })
  })
  const staff = authDb(STAFF_A, 'staff-a-190@test.com')
  const ref = doc(staff, 'organizations', ORG_A, 'materials', 'mat-190')
  await assertSucceeds(updateDoc(ref, { status: 'ordered', updatedAt: serverTimestamp(), updatedBy: STAFF_A, updatedFrom: 'ios' }))
  await assertSucceeds(updateDoc(ref, { status: 'ordered', lastSentRequestType: 'order', updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(ref, { status: 'ordered', updatedBy: ADMIN_A }))
  await assertFails(updateDoc(ref, { status: 'ordered', updatedFrom: 'desktop' }))
  await assertFails(updateDoc(ref, { status: 'ordered', name: 'Changed' }))
})

test('1.9.0: only admins and managers dismiss a warning (§16)', async () => {
  const row = { kind: 'qualification_expired', dismissKey: 'd190', dismissedByUserId: 'x' }
  await assertFails(setDoc(doc(authDb(OP_A, 'op-a@test.com'), 'organizations', ORG_A, 'dismissedWarnings', 'd190-op'), { ...row, dismissedByUserId: OP_A }))
  await assertSucceeds(setDoc(doc(authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'dismissedWarnings', 'd190-admin'), { ...row, dismissedByUserId: ADMIN_A }))
  await assertFails(setDoc(doc(authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'dismissedWarnings', 'd190-b'), { ...row, dismissedByUserId: ADMIN_B }))
})


// --- Rulebook 1.10.0 -------------------------------------------------------------------------------------------

const MGR_JOB_A = 'mgr-job-a'
const MGR_ROW_A = 'mgr-row-a'
const MGR_ROWMAIL_A = 'mgr-rowmail-a'
const MULTI = 'multi-org-person'

async function seed110() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', MGR_JOB_A), { email: 'mgr-job-a@test.com', organizationId: ORG_A, role: 'manager', manager: true, permissions: { manager: true } })
    await setDoc(doc(db, 'users', MGR_ROWMAIL_A), { email: 'rowmail@test.com', organizationId: ORG_A, role: 'manager', manager: true, permissions: { manager: true } })
    await setDoc(doc(db, 'users', MGR_OTHER_A), { email: 'mgr-other-a@test.com', organizationId: ORG_A, role: 'manager', manager: true, permissions: { manager: true } })
    await setDoc(doc(db, 'organizations', ORG_A, 'managers', MGR_ROW_A), { email: 'RowMail@test.com', firstName: 'Row' })
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', 'JOB-110'), { managerIds: [`user:${MGR_JOB_A}`, 'SOME-ROW'], managerId: `user:${MGR_JOB_A}` })
    await setDoc(doc(db, 'organizations', ORG_A, 'smallWorks', 'SW-110'), { managerIds: [MGR_ROW_A], managerId: MGR_ROW_A })
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', 'JOB-UID'), { managerUserIds: [MGR_JOB_A.toUpperCase()] })
    // A manager in company B who is only an operative (members map) in company A.
    await setDoc(doc(db, 'users', MULTI), { email: 'multi@test.com', organizationId: ORG_B, role: 'manager', manager: true, permissions: { manager: true } })
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${MULTI}`]: 'operative' })
    await updateDoc(doc(db, 'organizations', ORG_B), { [`members.${MULTI}`]: 'manager' })
  })
}

const labour = (projectId: string, extra: Record<string, unknown> = {}) => ({ operativeId: OP_A, projectId, status: 'Confirmed', timeSlot: 'FULL DAY', ...extra })

test('1.10.0 bookings: admin any job; manager only jobs they manage (uid, user: prefix, managerUserIds, managers-row email); operative never', async () => {
  await seed110()
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const mgr = authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  const other = authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const rowMail = authDb(MGR_ROWMAIL_A, 'rowmail@test.com')
  const op = authDb(OP_A, 'op-a@test.com')
  const ref = (db: ReturnType<typeof authDb>, coll: string, id: string) => doc(db, 'organizations', ORG_A, coll, id)

  await assertSucceeds(setDoc(ref(admin, 'bookings', 'b110-1'), labour('ANY-JOB')))
  await assertSucceeds(setDoc(ref(mgr, 'bookings', 'b110-2'), labour('JOB-110')))
  await assertSucceeds(setDoc(ref(mgr, 'bookings', 'b110-3'), labour('job-uid')))
  await assertFails(setDoc(ref(other, 'bookings', 'b110-4'), labour('JOB-110')))
  await assertFails(setDoc(ref(op, 'bookings', 'b110-5'), labour('JOB-110')))
  // Small works whose managerId is a managers-list row: matched by that row's email.
  await assertSucceeds(setDoc(ref(rowMail, 'bookings', 'b110-6'), labour('SW-110')))
  await assertFails(setDoc(ref(mgr, 'bookings', 'b110-7'), labour('SW-110')))
  // Edit and cancel on their job; moving a booking onto a job they do not manage is refused.
  await assertSucceeds(updateDoc(ref(mgr, 'bookings', 'b110-2'), { status: 'Cancelled' }))
  await assertFails(updateDoc(ref(mgr, 'bookings', 'b110-2'), { projectId: 'SW-110' }))
  await assertFails(updateDoc(ref(other, 'bookings', 'b110-2'), { notes: 'x' }))
  await assertFails(updateDoc(ref(op, 'bookings', 'b110-2'), { notes: 'x' }))
  // Subcontractor bookings follow the same rule (projectId or iOS projectID).
  await assertSucceeds(setDoc(ref(mgr, 'subcontractorBookings', 's110-1'), { subcontractorId: 'SUB', projectID: 'JOB-110' }))
  await assertFails(setDoc(ref(other, 'subcontractorBookings', 's110-2'), { subcontractorId: 'SUB', projectId: 'JOB-110' }))
  await assertFails(setDoc(ref(op, 'subcontractorBookings', 's110-3'), { subcontractorId: 'SUB', projectId: 'JOB-110' }))
  // Manager site bookings: at a job only for its managers; office/WFH only their own.
  await assertSucceeds(setDoc(ref(mgr, 'managerSiteBookings', 'm110-1'), { userId: MGR_JOB_A, locationType: 'project', locationId: 'JOB-110' }))
  await assertFails(setDoc(ref(other, 'managerSiteBookings', 'm110-2'), { userId: MGR_OTHER_A, locationType: 'project', locationId: 'JOB-110' }))
  await assertSucceeds(setDoc(ref(other, 'managerSiteBookings', 'm110-3'), { userId: MGR_OTHER_A, locationType: 'office' }))
  await assertFails(setDoc(ref(other, 'managerSiteBookings', 'm110-4'), { userId: MGR_JOB_A, locationType: 'office' }))
  await assertFails(setDoc(ref(op, 'managerSiteBookings', 'm110-5'), { userId: OP_A, locationType: 'office' }))
})

test('1.10.0 booking delete: a manager deletes (with tombstone) on their job; another manager and operatives cannot', async () => {
  await seed110()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'del-110-1'), labour('JOB-110'))
    await setDoc(doc(db, 'organizations', ORG_A, 'subcontractorBookings', 'del-110-2'), { subcontractorId: 'SUB', projectId: 'JOB-110' })
  })
  const tomb = (uid: string, id: string, coll: string) => ({ bookingId: id, collection: coll, deletedAt: serverTimestamp(), deletedBy: uid, deletedFrom: 'web' })
  for (const [id, coll] of [['del-110-1', 'bookings'], ['del-110-2', 'subcontractorBookings']]) {
    for (const [uid, email] of [[MGR_OTHER_A, 'mgr-other-a@test.com'], [OP_A, 'op-a@test.com']]) {
      const db = authDb(uid, email)
      const batch = writeBatch(db)
      batch.delete(doc(db, 'organizations', ORG_A, coll, id))
      batch.set(doc(db, 'organizations', ORG_A, 'deletedBookings', id), tomb(uid, id, coll))
      await assertFails(batch.commit())
    }
    const mgr = authDb(MGR_JOB_A, 'mgr-job-a@test.com')
    const batch = writeBatch(mgr)
    batch.delete(doc(mgr, 'organizations', ORG_A, coll, id))
    batch.set(doc(mgr, 'organizations', ORG_A, 'deletedBookings', id), tomb(MGR_JOB_A, id, coll))
    await assertSucceeds(batch.commit())
    // Tombstoned: cannot come back, even for the admin.
    await assertFails(setDoc(doc(authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, coll, id), labour('JOB-110')))
  }
  // With the booking already gone, only an admin writes a tombstone.
  await assertFails(setDoc(doc(authDb(MGR_JOB_A, 'mgr-job-a@test.com'), 'organizations', ORG_A, 'deletedBookings', 'gone-110'), tomb(MGR_JOB_A, 'gone-110', 'bookings')))
  await assertSucceeds(setDoc(doc(authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'deletedBookings', 'gone-110'), tomb(ADMIN_A, 'gone-110', 'bookings')))
})

test('1.10.0 a manager removed from the job loses booking writes; re-added gets them back', async () => {
  await seed110()
  const mgr = authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  const ref = doc(mgr, 'organizations', ORG_A, 'bookings', 'rm-110')
  await assertSucceeds(setDoc(ref, labour('JOB-110')))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'projects', 'JOB-110'), { managerIds: ['SOME-ROW'] })
  })
  await assertFails(updateDoc(ref, { notes: 'after removal' }))
  await assertFails(deleteDoc(ref))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'projects', 'JOB-110'), { managerIds: ['SOME-ROW', MGR_JOB_A] })
  })
  await assertSucceeds(updateDoc(ref, { notes: 're-added' }))
})

test('1.10.0 H2: a manager in company B who is an operative in company A is not a manager in A', async () => {
  await seed110()
  const multi = authDb(MULTI, 'multi@test.com')
  // Company A: no manager writes (settings, wholesalers, clash approvals, bookings).
  await assertFails(setDoc(doc(multi, 'organizations', ORG_A, 'settings', 'jobTypes'), { jobTypes: ['X'] }))
  await assertFails(setDoc(doc(multi, 'organizations', ORG_A, 'wholesalers', 'w-110'), { name: 'W' }))
  await assertFails(setDoc(doc(multi, 'organizations', ORG_A, 'acceptedBookingClashes', 'c-110'), { bookingAId: 'a', bookingBId: 'b' }))
  await assertFails(setDoc(doc(multi, 'organizations', ORG_A, 'bookings', 'multi-1'), labour('JOB-110')))
  // Company B (home): still a manager.
  await assertSucceeds(setDoc(doc(multi, 'organizations', ORG_B, 'settings', 'jobTypes'), { jobTypes: ['X'] }))
  await assertSucceeds(setDoc(doc(multi, 'organizations', ORG_B, 'wholesalers', 'w-110'), { name: 'W' }))
})

test('1.10.0 H2: a members-map manager of company A whose home company is B is a manager in A', async () => {
  await seed110()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', ORG_A), { [`members.${MULTI}`]: 'manager' })
  })
  const multi = authDb(MULTI, 'multi@test.com')
  await assertSucceeds(setDoc(doc(multi, 'organizations', ORG_A, 'wholesalers', 'w-111'), { name: 'W' }))
})

test('1.10.0 M10: a person cannot raise their own membership role or permissions; an admin of that org can', async () => {
  await seed110()
  const op = authDb(OP_A, 'op-a@test.com')
  const ref = (db: ReturnType<typeof authDb>) => doc(db, 'users', OP_A, 'orgMemberships', ORG_A)
  // OP_A is 'member' in ORG_A's members map.
  await assertFails(setDoc(ref(op), { role: 'admin', status: 'active' }))
  await assertFails(setDoc(ref(op), { role: 'member', status: 'active', permissions: { adminAccess: true } }))
  await assertFails(setDoc(ref(op), { role: 'member', status: 'active', adminAccess: true }))
  await assertSucceeds(setDoc(ref(op), { role: 'member', status: 'active', acceptedAt: Timestamp.now() }))
  await assertFails(updateDoc(ref(op), { 'permissions.manager': true }))
  await assertFails(updateDoc(ref(op), { accountActive: true }))
  await assertSucceeds(updateDoc(ref(op), { status: 'active', updatedAt: Timestamp.now() }))
  await assertSucceeds(updateDoc(ref(authDb(ADMIN_A, 'admin-a@test.com')), { role: 'manager', 'permissions.manager': true }))
  // The admin of another company cannot.
  await assertFails(updateDoc(ref(authDb(ADMIN_B, 'admin-b@test.com')), { role: 'admin' }))
})

test('1.10.0 H1: deleting users/{uid}, its tax ids, membership, email claim and members entry in one batch; an admin cannot delete an admin', async () => {
  await seed110()
  const VICTIM = 'victim-110'
  const ADMIN2 = 'admin2-110'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', VICTIM), { email: 'victim@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true })
    await setDoc(doc(db, 'users', VICTIM, 'private', 'taxIds'), { utrNumber: '1', vatNumber: '', updatedByUserId: VICTIM, updatedAt: Timestamp.now() })
    await setDoc(doc(db, 'users', VICTIM, 'orgMemberships', ORG_A), { role: 'operative' })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'victim@test.com'), { userId: VICTIM })
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${VICTIM}`]: 'operative' })
    await setDoc(doc(db, 'users', ADMIN2), { email: 'admin2@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'users', ADMIN2, 'private', 'taxIds'), { utrNumber: '2', vatNumber: '', updatedByUserId: ADMIN2, updatedAt: Timestamp.now() })
  })
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const accountBatch = (target: string, email: string) => {
    const batch = writeBatch(admin)
    batch.delete(doc(admin, 'users', target))
    batch.delete(doc(admin, 'users', target, 'private', 'taxIds'))
    batch.delete(doc(admin, 'users', target, 'orgMemberships', ORG_A))
    batch.delete(doc(admin, 'organizations', ORG_A, 'userEmails', email))
    batch.update(doc(admin, 'organizations', ORG_A), { [`members.${target}`]: deleteField() })
    return batch
  }
  // ADMIN_A is not super admin: deleting another admin is refused, and nothing in the batch is applied.
  await assertFails(accountBatch(ADMIN2, 'admin2@test.com').commit())
  await env.withSecurityRulesDisabled(async (ctx) => {
    assert.equal((await getDoc(doc(ctx.firestore(), 'users', ADMIN2, 'private', 'taxIds'))).exists(), true)
  })
  await assertSucceeds(accountBatch(VICTIM, 'victim@test.com').commit())
})

// --- Rulebook 1.10.0 round 2: job add/edit/manager list and enforced reads (§16, §17) ---------------------------

const MGR_TOGGLE_A = 'mgr-toggle-a'
const MGR_PROJ_ONLY_A = 'mgr-proj-only-a'

async function seedR2() {
  await seed110()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', MGR_TOGGLE_A), { email: 'toggle@test.com', organizationId: ORG_A, role: 'manager', permissions: { manager: true, projects: true, smallWorks: true } })
    await setDoc(doc(db, 'users', MGR_PROJ_ONLY_A), { email: 'projonly@test.com', organizationId: ORG_A, role: 'manager', permissions: { manager: true, projects: true } })
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', 'JOB-R2'), { siteName: 'Mine', managerIds: [MGR_JOB_A], managerUserIds: [MGR_JOB_A] })
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', 'OTHER-R2'), { siteName: 'Theirs', managerIds: [MGR_OTHER_A], managerUserIds: [MGR_OTHER_A] })
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', 'job-lc'), { siteName: 'Lower', managerUserIds: [MGR_JOB_A] })
    await setDoc(doc(db, 'organizations', ORG_A, 'smallWorks', 'Sw-Mix'), { siteName: 'Mixed', managerUserIds: [MGR_JOB_A] })
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', 'OPROW-A'), { email: 'OP-A@test.com', firstName: 'Ollie' })
    const day = Timestamp.fromDate(new Date('2026-11-02T00:00:00Z'))
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'r2-mine'), { operativeId: OP_B, projectId: 'JOB-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'r2-theirs'), { operativeId: OP_B, projectId: 'OTHER-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'r2-upper'), { operativeId: OP_B, projectId: 'JOB-LC', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'r2-sw'), { operativeId: OP_B, projectId: 'SW-MIX', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'r2-op-uid'), { operativeId: OP_A, projectId: 'OTHER-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'r2-op-row'), { operativeId: 'OPROW-A', projectId: 'OTHER-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'r2-mgr-own'), { operativeId: MGR_JOB_A, projectId: 'OTHER-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'subcontractorBookings', 'r2-sub'), { subcontractorId: 'SUB', projectId: 'JOB-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'subcontractorBookings', 'r2-sub-other'), { subcontractorId: 'SUB', projectId: 'OTHER-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'managerSiteBookings', 'r2-msb'), { userId: MGR_OTHER_A, locationType: 'project', locationId: 'JOB-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'managerSiteBookings', 'r2-msb-own'), { userId: MGR_JOB_A, locationType: 'office', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'managerSiteBookings', 'r2-msb-other'), { userId: MGR_OTHER_A, locationType: 'project', locationId: 'OTHER-R2', date: day })
  })
}

const colA = (db: ReturnType<typeof authDb>, name: string) => collection(db, 'organizations', ORG_A, name)
const since = Timestamp.fromDate(new Date('2026-10-26T00:00:00Z'))

test('1.10.0 r2 reads: an admin and a manager with the toggle read every job and booking', async () => {
  await seedR2()
  for (const [uid, email] of [[ADMIN_A, 'admin-a@test.com'], [MGR_TOGGLE_A, 'toggle@test.com']]) {
    const db = authDb(uid, email)
    for (const name of ['projects', 'smallWorks', 'bookings', 'managerSiteBookings', 'subcontractorBookings']) {
      await assertSucceeds(getDocs(colA(db, name)))
    }
    await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'projects', 'OTHER-R2')))
    await assertSucceeds(getDocs(query(colA(db, 'bookings'), where('date', '>=', since))))
  }
  // Projects toggle only: every project, but small works only by managerUserIds; every booking.
  const projOnly = authDb(MGR_PROJ_ONLY_A, 'projonly@test.com')
  await assertSucceeds(getDocs(colA(projOnly, 'projects')))
  await assertFails(getDocs(colA(projOnly, 'smallWorks')))
  await assertSucceeds(getDocs(colA(projOnly, 'bookings')))
})

test('1.10.0 r2 reads: a manager without the toggle reads only their jobs, those jobs\' bookings and their own', async () => {
  await seedR2()
  const mgr = authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  // Jobs: the whole collection is refused; the managerUserIds query and their own documents are allowed.
  await assertFails(getDocs(colA(mgr, 'projects')))
  await assertFails(getDocs(colA(mgr, 'smallWorks')))
  const mine = await assertSucceeds(getDocs(query(colA(mgr, 'projects'), where('managerUserIds', 'array-contains', MGR_JOB_A))))
  assert.deepEqual(mine.docs.map((d) => d.id).sort(), ['JOB-R2', 'job-lc'])
  await assertSucceeds(getDocs(query(colA(mgr, 'smallWorks'), where('managerUserIds', 'array-contains', MGR_JOB_A))))
  await assertFails(getDocs(query(colA(mgr, 'projects'), where('managerUserIds', 'array-contains', MGR_OTHER_A))))
  await assertSucceeds(getDoc(doc(mgr, 'organizations', ORG_A, 'projects', 'JOB-R2')))
  await assertSucceeds(getDoc(doc(mgr, 'organizations', ORG_A, 'projects', 'JOB-110')))
  await assertFails(getDoc(doc(mgr, 'organizations', ORG_A, 'projects', 'OTHER-R2')))
  // Bookings: never the whole collection; one job's spellings at a time, with the download bound.
  for (const name of ['bookings', 'managerSiteBookings', 'subcontractorBookings']) await assertFails(getDocs(colA(mgr, name)))
  const onJob = await assertSucceeds(getDocs(query(colA(mgr, 'bookings'), where('projectId', 'in', ['JOB-R2', 'job-r2']), where('date', '>=', since))))
  assert.deepEqual(onJob.docs.map((d) => d.id), ['r2-mine'])
  await assertSucceeds(getDocs(query(colA(mgr, 'bookings'), where('projectId', 'in', ['job-lc', 'JOB-LC']))))
  // A mixed-case job id is queried only as stored (`jobIdQueryValues`): the rules cannot trace SW-MIX back to Sw-Mix.
  await assertSucceeds(getDocs(query(colA(mgr, 'bookings'), where('projectId', 'in', ['Sw-Mix']))))
  await assertFails(getDocs(query(colA(mgr, 'bookings'), where('projectId', 'in', ['Sw-Mix', 'SW-MIX']))))
  await assertFails(getDocs(query(colA(mgr, 'bookings'), where('projectId', 'in', ['OTHER-R2']))))
  await assertFails(getDocs(query(colA(mgr, 'bookings'), where('projectId', 'in', ['JOB-R2', 'OTHER-R2']))))
  await assertFails(getDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'r2-theirs')))
  await assertSucceeds(getDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'r2-mine')))
  await assertSucceeds(getDocs(query(colA(mgr, 'subcontractorBookings'), where('projectId', 'in', ['JOB-R2', 'job-r2']))))
  await assertFails(getDocs(query(colA(mgr, 'subcontractorBookings'), where('projectId', 'in', ['OTHER-R2']))))
  await assertSucceeds(getDocs(query(colA(mgr, 'managerSiteBookings'), where('locationId', 'in', ['JOB-R2', 'job-r2']))))
  await assertFails(getDocs(query(colA(mgr, 'managerSiteBookings'), where('locationId', 'in', ['OTHER-R2']))))
  // Their own bookings anywhere.
  const ownSite = await assertSucceeds(getDocs(query(colA(mgr, 'managerSiteBookings'), where('userId', '==', MGR_JOB_A), where('date', '>=', since))))
  assert.deepEqual(ownSite.docs.map((d) => d.id), ['r2-msb-own'])
  await assertSucceeds(getDocs(query(colA(mgr, 'bookings'), where('operativeId', 'in', [MGR_JOB_A]))))
  // Health & safety under a job follows the job.
  await assertSucceeds(getDocs(collection(mgr, 'organizations', ORG_A, 'projects', 'JOB-R2', 'healthSafety')))
  await assertFails(getDocs(collection(mgr, 'organizations', ORG_A, 'projects', 'OTHER-R2', 'healthSafety')))
})

test('1.10.0 r2 reads: an operative reads their own bookings (account id or operatives row) and their jobs by id, never a list', async () => {
  await seedR2()
  const op = authDb(OP_A, 'op-a@test.com')
  const own = await assertSucceeds(getDocs(query(colA(op, 'bookings'), where('operativeId', 'in', [OP_A, 'OPROW-A']), where('date', '>=', since))))
  assert.deepEqual(own.docs.map((d) => d.id).sort(), ['r2-op-row', 'r2-op-uid'])
  await assertSucceeds(getDoc(doc(op, 'organizations', ORG_A, 'bookings', 'r2-op-uid')))
  await assertFails(getDocs(query(colA(op, 'bookings'), where('operativeId', 'in', [OP_B]))))
  await assertFails(getDocs(colA(op, 'bookings')))
  await assertFails(getDoc(doc(op, 'organizations', ORG_A, 'bookings', 'r2-mine')))
  await assertFails(getDocs(colA(op, 'managerSiteBookings')))
  await assertFails(getDocs(colA(op, 'subcontractorBookings')))
  // The job of their booking, by id (My Schedule); never a job list.
  await assertSucceeds(getDoc(doc(op, 'organizations', ORG_A, 'projects', 'OTHER-R2')))
  await assertFails(getDocs(colA(op, 'projects')))
  await assertFails(getDocs(query(colA(op, 'projects'), where('managerUserIds', 'array-contains', OP_A))))
  // Another company's admin reads nothing here.
  await assertFails(getDocs(colA(authDb(ADMIN_B, 'admin-b@test.com'), 'projects')))
  await assertFails(getDoc(doc(authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'projects', 'JOB-R2')))
})

test('1.10.0 r2 jobs: admins and toggle managers add jobs and change manager lists; other managers edit details of their jobs only', async () => {
  await seedR2()
  const ref = (db: ReturnType<typeof authDb>, coll: string, id: string) => doc(db, 'organizations', ORG_A, coll, id)
  const admin = authDb(ADMIN_A, 'admin-a@test.com')
  const toggle = authDb(MGR_TOGGLE_A, 'toggle@test.com')
  const projOnly = authDb(MGR_PROJ_ONLY_A, 'projonly@test.com')
  const mgr = authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  const op = authDb(OP_A, 'op-a@test.com')
  await assertSucceeds(setDoc(ref(admin, 'projects', 'NEW-ADMIN'), { siteName: 'A', managerIds: [MGR_JOB_A], managerUserIds: [MGR_JOB_A] }))
  await assertSucceeds(setDoc(ref(toggle, 'smallWorks', 'NEW-TOGGLE'), { siteName: 'T' }))
  await assertSucceeds(setDoc(ref(projOnly, 'projects', 'NEW-PROJONLY'), { siteName: 'P' }))
  await assertFails(setDoc(ref(projOnly, 'smallWorks', 'NEW-PROJONLY-SW'), { siteName: 'P' }))
  await assertFails(setDoc(ref(mgr, 'projects', 'NEW-MGR'), { siteName: 'M', managerUserIds: [MGR_JOB_A] }))
  await assertFails(setDoc(ref(op, 'projects', 'NEW-OP'), { siteName: 'O' }))
  // A manager without the toggle: details of their own job yes, its manager list never, other jobs never.
  await assertSucceeds(updateDoc(ref(mgr, 'projects', 'JOB-R2'), { siteName: 'Renamed', notes: 'x' }))
  await assertFails(updateDoc(ref(mgr, 'projects', 'JOB-R2'), { managerUserIds: [MGR_JOB_A, MGR_OTHER_A] }))
  await assertFails(updateDoc(ref(mgr, 'projects', 'JOB-R2'), { managerIds: [] }))
  await assertFails(updateDoc(ref(mgr, 'projects', 'JOB-R2'), { managerId: MGR_OTHER_A }))
  await assertFails(updateDoc(ref(mgr, 'projects', 'OTHER-R2'), { siteName: 'Nope' }))
  // Resending the same manager list is not a change.
  await assertSucceeds(updateDoc(ref(mgr, 'projects', 'JOB-R2'), { siteName: 'Again', managerUserIds: [MGR_JOB_A] }))
  await assertFails(updateDoc(ref(op, 'projects', 'JOB-R2'), { siteName: 'Op' }))
  // Admins and toggle managers change manager lists (add and remove).
  await assertSucceeds(updateDoc(ref(toggle, 'projects', 'OTHER-R2'), { managerIds: [MGR_OTHER_A, MGR_JOB_A], managerUserIds: [MGR_OTHER_A, MGR_JOB_A] }))
  await assertSucceeds(updateDoc(ref(admin, 'projects', 'OTHER-R2'), { managerIds: [MGR_OTHER_A], managerUserIds: [MGR_OTHER_A] }))
  await assertFails(updateDoc(ref(projOnly, 'smallWorks', 'Sw-Mix'), { managerUserIds: [] }))
})

test('1.10.0 r2 jobs: the toggle of a non-home organisation comes from that organisation\'s membership document', async () => {
  await seedR2()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${MULTI}`]: 'manager' })
    await setDoc(doc(db, 'users', MULTI, 'orgMemberships', ORG_A), { role: 'manager', permissions: { manager: true, projects: true, smallWorks: false } })
  })
  const multi = authDb(MULTI, 'multi@test.com')
  await assertSucceeds(setDoc(doc(multi, 'organizations', ORG_A, 'projects', 'NEW-MULTI'), { siteName: 'M' }))
  await assertFails(setDoc(doc(multi, 'organizations', ORG_A, 'smallWorks', 'NEW-MULTI-SW'), { siteName: 'M' }))
  await assertSucceeds(getDocs(colA(multi, 'projects')))
  // Their home company's toggles (none) do not leak the other way: in company B MULTI is a manager without them.
  await assertFails(setDoc(doc(multi, 'organizations', ORG_B, 'projects', 'NEW-MULTI-B'), { siteName: 'B' }))
})

test('1.10.0 r2: a manager can never book themselves onto a job they do not manage', async () => {
  await seedR2()
  const mgr = authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'self-other'), { userId: MGR_JOB_A, locationType: 'project', locationId: 'OTHER-R2' }))
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'self-other-labour'), { operativeId: MGR_JOB_A, projectId: 'OTHER-R2', status: 'Confirmed', timeSlot: 'FULL DAY' }))
  // Even a manager with the toggle (who sees the job) is not its manager.
  const toggle = authDb(MGR_TOGGLE_A, 'toggle@test.com')
  await assertFails(setDoc(doc(toggle, 'organizations', ORG_A, 'managerSiteBookings', 'self-toggle'), { userId: MGR_TOGGLE_A, locationType: 'project', locationId: 'OTHER-R2' }))
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'self-mine'), { userId: MGR_JOB_A, locationType: 'project', locationId: 'JOB-R2' }))
})
