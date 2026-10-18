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
  setDoc,
  Timestamp,
  updateDoc,
  where,
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

test('self-create with age confirmation is allowed', async () => {
  const uid = 'founder-ok'
  const email = 'founder-ok@test.com'
  const db = authDb(uid, email)
  await assertSucceeds(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: ORG_A,
      firstName: 'New',
      role: 'admin',
      ageConfirmed: true,
      ageConfirmedYears: 16,
      ageConfirmedAt: Timestamp.now(),
    })
  )
})

test('existing user without ageConfirmed can read and self-update', async () => {
  const db = authDb(ADMIN_A, 'admin-a@test.com')
  const snap = await assertSucceeds(getDoc(doc(db, 'users', ADMIN_A)))
  assert.equal(snap.data()?.ageConfirmed, undefined)
  await assertSucceeds(updateDoc(doc(db, 'users', ADMIN_A), { lastSeenAt: Timestamp.now() }))
})

test('returning login can reclaim a stale email pointer then self-create with age confirmation', async () => {
  const uid = 'returning-uid'
  const email = 'returning@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: 'dead-placeholder' })
  })
  const db = authDb(uid, email)
  await assertFails(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: ORG_A,
      firstName: 'Back',
      role: 'admin',
      ageConfirmed: true,
      ageConfirmedYears: 16,
      ageConfirmedAt: Timestamp.now(),
    })
  )
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: uid }))
  await assertSucceeds(
    setDoc(doc(db, 'users', uid), {
      email,
      organizationId: ORG_A,
      firstName: 'Back',
      role: 'admin',
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
  })

  // Claim still names the placeholder: self-create is allowed (pending placeholder, same email, same org).
  await assertFails(setDoc(doc(db, 'users', authUid), { ...selfProfile(), ageConfirmed: false }))
  await assertSucceeds(setDoc(doc(db, 'users', authUid), selfProfile()))
  // Then the claim moves to authUid, then the placeholder goes.
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: authUid }))
  await assertSucceeds(deleteDoc(doc(db, 'users', placeholderId)))
  const moved = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'userEmails', email)))
  assert.equal(moved.data()?.userId, authUid)
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
