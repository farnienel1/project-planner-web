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
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { assertFails, assertLogicalDeny, assertSucceedsWithinBudget } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
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
  limit,
} from 'firebase/firestore'

import { accountTypeChangeWrites } from '../lib/canonical/permissionLevels.ts'
import { orgMembershipWriteFields } from '../lib/canonical/orgMembership.ts'
import { writeMetadataFields } from '../lib/canonical/writeMetadata.ts'
import { inviteMembershipWrites } from '../lib/canonical/inviteAccept.ts'
import { ghostCreateWrites } from '../lib/canonical/ghostOperatives.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const ADMIN_A = 'admin-a'
const OP_A = 'op-a'
const ADMIN_B = 'admin-b'
const OP_B = 'op-b'

let env: RulesTestEnvironment

/** Rulebook 1.32.4: the caller's token carries the auth claims of the data seeded so far (`tests/authClaimsContext.ts`). */
async function authDb(uid: string, email: string) {
  return (await claimsContext(env, uid, { email })).firestore()
}

/** Rulebook 1.31.1 (F5): an unused invitation to `email` in `organizationId`, written with the rules off. */
async function seedInvitation(invitationId: string, organizationId: string, email: string, extra: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invitations', invitationId), { organizationId, email, isUsed: false, ...extra })
  })
}

/**
 * Rulebook 1.31.1 (F5): accepting an invitation creates `users/{authUid}` with the invitation's secret id and marks the
 * invitation used in the same batch (web `completeInviteSetup`). Returns the commit promise.
 */
function acceptInviteBatch(
  db: Awaited<ReturnType<typeof authDb>>,
  authUid: string,
  profile: Record<string, unknown>,
  invitationId: string
) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', authUid), { ...profile, invitationId })
  batch.update(doc(db, 'invitations', invitationId), { isUsed: true, usedAt: Timestamp.now() })
  return batch.commit()
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-rules',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    // 1.12.0: the 1.10.0 / 1.11.0 read-scoping tests below run with the owner's switch on; the "enforcedReads absent"
    // test turns it off and back on.
    await setDoc(doc(db, 'platformConfig', 'app'), { enforcedReads: true })
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
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'bookings', 'book-b')))
})

test('company A cannot read company B timesheet settings', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'settings', `timesheet_${OP_B}_1000`)))
})

test('company A cannot read a company B user document', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'users', OP_B)))
  await assertFails(getDoc(doc(db, 'users', ADMIN_B)))
})

test('company A cannot read company B materials', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'materials', 'mat-b')))
})

test('company A cannot read company B holidays', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'holidayBookings', 'hol-b')))
})

test('an operative cannot make themselves admin', async () => {
  const db = await authDb(OP_A, 'op-a@test.com')
  await assertFails(updateDoc(doc(db, 'users', OP_A), { adminAccess: true }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { role: 'admin' }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { isSuperAdmin: true }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { 'permissions.adminAccess': true }))
})

test('an outsider cannot join another company by rewriting members', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(
    updateDoc(doc(db, 'organizations', ORG_B), {
      members: { [ADMIN_B]: 'admin', [OP_B]: 'member', [ADMIN_A]: 'admin' },
    })
  )
})

test('company A can still read its own bookings and materials', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  const booking = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'bookings', 'book-a')))
  const material = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'materials', 'mat-a')))
  const colleague = await assertSucceeds(getDoc(doc(db, 'users', OP_A)))
  assert.equal(booking.exists(), true)
  assert.equal(material.exists(), true)
  assert.equal(colleague.exists(), true)
})

test('an operative can still update their own name', async () => {
  const db = await authDb(OP_A, 'op-a@test.com')
  await assertSucceeds(updateDoc(doc(db, 'users', OP_A), { firstName: 'Oliver' }))
})

test('existing users without age confirmation can read and update their own profile', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDocs(query(collection(db, 'invitations'), where('organizationId', '==', ORG_B))))
})

test('company A cannot create or change a company B invitation', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(uid, email)
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
  const db = await authDb(uid, email)
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
  const db = await authDb(uid, email)
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
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(uid, email)
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
  const db = await authDb(uid, email)
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
  const db = await authDb(uid, email)
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
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(
    getDocs(query(collection(db, 'users'), where('email', '==', 'brand-new@test.com'), where('passwordSet', '==', true)))
  )
  await assertFails(getDocs(query(collection(db, 'users'), where('email', '==', 'op-b@test.com'))))
})

test('admin can list this organisation\'s users by email and organizationId', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  // Rulebook 1.31.1 (F5): only together with the account (or membership) that carries the invitation's id.
  const db = await authDb('invitee-a', 'new-a@test.com')
  await assertLogicalDeny(updateDoc(doc(db, 'invitations', 'invite-a'), { isUsed: true }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'invitee-a'), {
      email: 'new-a@test.com',
      organizationId: ORG_A,
      passwordSet: true,
      invitationId: 'invite-a',
    })
  })
  await assertSucceeds(updateDoc(doc(db, 'invitations', 'invite-a'), { isUsed: true }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await deleteDoc(doc(db, 'users', 'invitee-a'))
    await setDoc(doc(db, 'invitations', 'invite-a'), { organizationId: ORG_A, email: 'new-a@test.com', isUsed: false })
  })
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

  const db = await authDb(authUid, email)
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
    // 1.31.1 (F1): the web copy keeps every placeholder flag (completeInviteSetup spreads the placeholder).
    isSuperAdmin: false,
  })

  // Claim still names the placeholder: self-create is allowed (pending placeholder, same email, same org) — 1.31.1
  // (F5) only with the emailed invitation's id and the invitation marked used in the same batch.
  await seedInvitation('invite-finish', ORG_A, email)
  await assertLogicalDeny(setDoc(doc(db, 'users', authUid), selfProfile()))
  await assertFails(acceptInviteBatch(db, authUid, { ...selfProfile(), ageConfirmed: false }, 'invite-finish'))
  await assertSucceeds(acceptInviteBatch(db, authUid, selfProfile(), 'invite-finish'))
  // Then the claim moves to authUid, then the placeholder goes.
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: authUid }))
  await assertSucceeds(deleteDoc(doc(db, 'users', placeholderId)))
  const moved = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'userEmails', email)))
  assert.equal(moved.data()?.userId, authUid)
  // 1.12.0 (B3): the account never adds alias ids to its own document afterwards (older iOS builds appended here;
  // current iOS stops with INVITE_SETUP_INCOMPLETE and the web invite link writes them on create, above).
  await assertFails(
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
      setDoc(doc(await authDb(uid, email), 'users', uid), {
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
  await assertFails(getDoc(doc(await authDb('live-claimant-uid', liveEmail), 'users', tombstoneId)))
})

test('company A cannot read a company B notification', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_B, 'notifications', 'note-b')))
})

test('an operative cannot read another person\'s notification', async () => {
  const db = await authDb(OP_A, 'op-a@test.com')
  await assertFails(getDoc(doc(db, 'organizations', ORG_A, 'notifications', 'note-a')))
})

test('a user can read their own notification', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  const snap = await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'notifications', 'note-a')))
  assert.equal(snap.exists(), true)
})

test('an operative cannot write another person\'s timesheet settings', async () => {
  const db = await authDb(OP_A, 'op-a@test.com')
  await assertFails(
    setDoc(
      doc(db, 'organizations', ORG_A, 'settings', `timesheet_${ADMIN_A}_2000`),
      { userId: ADMIN_A, signed: true },
      { merge: true }
    )
  )
})

test('admin A can write their own timesheet settings', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const member = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const member = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(uid, email)
  await assertFails(updateDoc(doc(db, 'users', uid), { organizationId: ORG_A }))
  // 1.31.1 (fourth review): nobody deletes their own users document; accounts are deleted through
  // /api/account/delete (service credentials). The document is removed with the rules off to test the re-create.
  await assertLogicalDeny(deleteDoc(doc(db, 'users', uid)))
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'users', uid)) })
  await assertFails(
    setDoc(doc(db, 'users', uid), { email, organizationId: ORG_A, role: 'admin', adminAccess: true, ...ageFields() })
  )
  await assertFails(setDoc(doc(db, 'users', uid), { email, organizationId: ORG_A, ...ageFields() }))
})

test('hole 2: an admin of company B cannot create a user in company A', async () => {
  const db = await authDb(ADMIN_B, 'admin-b@test.com')
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
  const db = await authDb(ADMIN_B, 'admin-b@test.com')
  await assertFails(updateDoc(doc(db, 'users', OP_A), { adminAccess: true }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { firstName: 'Hacked' }))
  await assertFails(updateDoc(doc(db, 'users', OP_A), { organizationId: ORG_B }))
  await assertFails(updateDoc(doc(db, 'users', ADMIN_A), { email: 'b-owns-you@test.com' }))
})

test('hole 3b: an admin cannot move their own profile into a company they do not run', async () => {
  const db = await authDb(ADMIN_B, 'admin-b@test.com')
  await assertFails(updateDoc(doc(db, 'users', ADMIN_B), { organizationId: ORG_A }))
  // Their own profile otherwise still saves.
  await assertSucceeds(updateDoc(doc(db, 'users', ADMIN_B), { firstName: 'Beatrice' }))
})

test('admin A can still edit users in company A', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertSucceeds(updateDoc(doc(db, 'users', OP_A), { firstName: 'Ollie-edited', dayRate: 180 }))
})

test('hole 4: a signed-in user cannot list every company', async () => {
  const db = await authDb(OP_B, 'op-b@test.com')
  await assertFails(getDocs(collection(db, 'organizations')))
  await assertFails(getDocs(query(collection(db, 'organizations'), where('name', '==', 'Company A'))))
  await assertFails(getDocs(query(collection(db, 'organizations'), where(`members.${ADMIN_A}`, '!=', ''))))
  await assertFails(getDocs(query(collection(db, 'organizations'), where('creatorUserId', '==', ADMIN_A))))
})

test('both apps can still list their own companies by membership and by creator', async () => {
  const db = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const db = await authDb(OP_B, 'op-b@test.com')
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'userEmails', 'op-a@test.com'), { userId: OP_A })
  })
  // Someone else's email.
  await assertFails(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'op-a@test.com'), { userId: OP_B }))
  await assertFails(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'unclaimed@test.com'), { userId: OP_B }))
  // An admin of company B cannot rewrite or delete company A's claims.
  const adminB = await authDb(ADMIN_B, 'admin-b@test.com')
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
  const db = await authDb('second-account', email)
  await assertFails(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: 'second-account' }))
})

test('founder: create a company, claim the email, then self-create as its admin', async () => {
  const uid = 'founder-new'
  const email = 'founder-new@test.com'
  const orgId = 'org-founder-new'
  const db = await authDb(uid, email)
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
  await seedInvitation('invite-admin-copy', ORG_A, email, { role: 'admin' })
  const db = await authDb(authUid, email)
  const placeholder = await assertSucceeds(getDoc(doc(db, 'users', placeholderId)))
  await assertSucceeds(
    acceptInviteBatch(
      db,
      authUid,
      {
        ...placeholder.data(),
        email,
        organizationId: ORG_A,
        passwordSet: true,
        formerUserIds: [placeholderId],
        ...ageFields(),
      },
      'invite-admin-copy'
    )
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
  await seedInvitation('invite-op-priv', ORG_A, email)
  const db = await authDb(authUid, email)
  const base = {
    email,
    organizationId: ORG_A,
    firstName: 'Opal',
    role: 'operative',
    operativeMode: true,
    passwordSet: true,
    isActive: true,
    adminAccess: false,
    isSuperAdmin: false,
    permissions: { operativeMode: true, adminAccess: false },
    ...ageFields(),
  }
  await assertFails(acceptInviteBatch(db, authUid, { ...base, adminAccess: true }, 'invite-op-priv'))
  await assertFails(acceptInviteBatch(db, authUid, { ...base, isSuperAdmin: true }, 'invite-op-priv'))
  await assertFails(acceptInviteBatch(db, authUid, { ...base, role: 'admin' }, 'invite-op-priv'))
  await assertFails(acceptInviteBatch(db, authUid, { ...base, permissions: { adminAccess: true } }, 'invite-op-priv'))
  await assertFails(acceptInviteBatch(db, authUid, { ...base, manager: true }, 'invite-op-priv'))
  // Dropping operative mode turns an operative into staff.
  await assertFails(acceptInviteBatch(db, authUid, { ...base, operativeMode: false, role: 'member' }, 'invite-op-priv'))
  await assertSucceeds(acceptInviteBatch(db, authUid, base, 'invite-op-priv'))
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
  const db = await authDb(managerId, 'manager-a@test.com')
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
  const db = await authDb(OP_A, 'op-a@test.com')
  await assertSucceeds(setDoc(doc(db, 'organizations', ORG_A, 'fileReports', 'REPORT-OK'), fileReport()))
})

test('a file report cannot be filed for someone else, another company, or already closed', async () => {
  const db = await authDb(OP_A, 'op-a@test.com')
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
  const op = await authDb(OP_A, 'op-a@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const otherAdmin = await authDb(ADMIN_B, 'admin-b@test.com')
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
  const own = await authDb(OP_A, 'op-a@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const manager = await authDb(managerId, 'tax-manager-a@test.com')
  const otherAdmin = await authDb(ADMIN_B, 'admin-b@test.com')
  const colleague = await authDb(OP_B, 'op-b@test.com')
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'users', OP_A, 'private', 'taxIds')

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
  const invitee = await authDb('invitee-tax-uid', 'new-tax@test.com')
  const stranger = await authDb('stranger-uid', 'someone@test.com')
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'users', placeholderId, 'private', 'taxIds')
  await assertFails(getDoc(ref(stranger)))
  // 1.31.1 (F5): someone who only signed up on the invitee's email (no accepted account yet) reads nothing.
  await assertLogicalDeny(getDoc(ref(invitee)))
  await assertLogicalDeny(deleteDoc(ref(invitee)))
  // Once the account is created from the invitation (it lists the placeholder in formerUserIds) the move proceeds.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'invitee-tax-uid'), {
      email: 'new-tax@test.com',
      organizationId: ORG_A,
      passwordSet: true,
      formerUserIds: [placeholderId],
      invitationId: 'invite-tax',
    })
  })
  await assertSucceeds(getDoc(ref(invitee)))
  await assertFails(setDoc(ref(invitee), taxIds('invitee-tax-uid')))
  await assertSucceeds(deleteDoc(ref(invitee)))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'users', 'invitee-tax-uid'))
  })
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
  const ref = async (uid: string, email: string) => doc(await authDb(uid, email), 'organizations', ORG_A, 'materialSendRecords', 'SEND-HISTORY-1')
  await assertSucceeds(getDoc(await ref(MANAGER_A, 'manager-a-history@test.com')))
  await assertSucceeds(getDoc(await ref(ADMIN_A, 'admin-a@test.com')))
  await assertSucceeds(
    getDocs(query(collection(await authDb(MANAGER_A, 'manager-a-history@test.com'), 'organizations', ORG_A, 'materialSendRecords'), where('projectId', '==', 'job-1')))
  )
  await assertFails(getDoc(await ref(OP_A, 'op-a@test.com')))
  // 1.11.0: an admin has no operative mode — a stray flag on an admin is ignored (permissionLevelOf).
  await assertSucceeds(getDoc(await ref(ADMIN_OP_A, 'admin-op-a-history@test.com')))
  await assertFails(getDoc(doc(await authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'materialSendRecords', 'SEND-HISTORY-1')))
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
  const mgrRef = doc(await authDb(MANAGER_WR, 'manager-a-wr@test.com'), 'organizations', ORG_A, 'warningResolutions', key)
  const fields = { resolutionKey: key, status: 'approved', resolvedByUserId: MANAGER_WR, resolvedAt: serverTimestamp() }
  // Operatives never approve or dismiss a warning.
  const opRef = doc(await authDb(OP_A, 'op-a@test.com'), 'organizations', ORG_A, 'warningResolutions', key)
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
  const foreign = doc(await authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'warningResolutions', key)
  await assertFails(getDoc(foreign))
  await assertFails(setDoc(foreign, { ...fields, resolvedByUserId: ADMIN_B }))
  // An operative cannot delete it; the resolver can undo it; an admin can delete anyone's.
  await assertFails(deleteDoc(opRef))
  await assertSucceeds(deleteDoc(mgrRef))
  await assertSucceeds(setDoc(mgrRef, fields))
  await assertSucceeds(deleteDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'warningResolutions', key)))
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
  const rep = await authDb(REPORT_A, 'report-a@test.com')
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)

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
  await assertFails(updateDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hol-req-1'), { status: 'approved', approvedByUserId: MGR_OTHER_A, approvedAt: Timestamp.now() }))
  const approvedAt = Timestamp.fromMillis(Date.parse('2026-11-01T09:00:00.123Z') + 0.456)
  await assertSucceeds(updateDoc(ref(await authDb(LM_A, 'lm-a@test.com'), 'hol-req-1'), { status: 'approved', approvedByUserId: LM_A, approvedAt }))
  await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hol-req-1'), { decisionNote: null }))

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
  await assertSucceeds(deleteDoc(ref(await authDb(LM_A, 'lm-a@test.com'), 'hol-req-1')))

  // A requester may withdraw their own pending request.
  await assertSucceeds(setDoc(ref(rep, 'hol-req-5'), leave(REPORT_A, 'pending')))
  await assertSucceeds(deleteDoc(ref(rep, 'hol-req-5')))

  // A manager on the Team screen may book a pending request for someone with a line manager.
  await assertSucceeds(setDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hol-req-6'), leave(REPORT_A, 'pending')))
  await assertFails(setDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hol-req-7'), leave(REPORT_A, 'approved', { approvedByUserId: MGR_OTHER_A })))
})

test('annual leave: self-bookers save their own leave approved; operatives with a line manager cannot', async () => {
  await seedLeaveAndTimesheetPeople()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const selfDb = await authDb(SELF_BOOKER_A, 'self-a@test.com')
  // iOS self-book: approved, no approvedByUserId. Web self-book: approvedByUserId == self.
  await assertSucceeds(setDoc(ref(selfDb, 'hol-self-1'), leave(SELF_BOOKER_A, 'approved', { decisionNote: null, cancellationRequestedAt: null }), { merge: true }))
  await assertSucceeds(setDoc(ref(selfDb, 'hol-self-2'), leave(SELF_BOOKER_A, 'approved', { approvedByUserId: SELF_BOOKER_A, approvedAt: Timestamp.now() })))
  await assertSucceeds(updateDoc(ref(selfDb, 'hol-self-2'), { timeSlot: 'PM' }))
  await assertSucceeds(deleteDoc(ref(selfDb, 'hol-self-2')))
  // Cannot approve as someone else.
  await assertFails(setDoc(ref(selfDb, 'hol-self-3'), leave(SELF_BOOKER_A, 'approved', { approvedByUserId: LM_A })))
  // OP_A has no line manager in the seed. Rulebook 1.2.0: that no longer self-books, it asks.
  await assertFails(setDoc(ref(await authDb(OP_A, 'op-a@test.com'), 'hol-noline-1'), leave(OP_A, 'approved')))
  await assertSucceeds(setDoc(ref(await authDb(OP_A, 'op-a@test.com'), 'hol-noline-1'), leave(OP_A, 'pending')))
  // Another company never writes here.
  await assertFails(setDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com'), 'hol-foreign'), leave(ADMIN_B, 'pending')))
})

test('timesheets: the owner cannot counter-sign or export their own sheet; the line manager and admins can', async () => {
  await seedLeaveAndTimesheetPeople()
  const id = `timesheet_${REPORT_A}_1760000000`
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'settings', id)
  const rep = await authDb(REPORT_A, 'report-a@test.com')
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
  await assertFails(setDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), { managerSignedAt: Timestamp.now() }, { merge: true }))
  const signed = Timestamp.fromMillis(Date.parse('2026-10-16T10:00:00.123Z') + 0.789)
  await assertSucceeds(setDoc(ref(await authDb(LM_A, 'lm-a@test.com')), {
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
  await assertSucceeds(setDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com')), { exportedAt: Timestamp.now() }, { merge: true }))
})

test('staff warning decisions: operatives cannot accept a booking clash; managers and admins can', async () => {
  await seedLeaveAndTimesheetPeople()
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', 'A|B')
  const fields = (uid: string) => ({ bookingAId: 'A', bookingBId: 'B', acceptedByUserId: uid })
  await assertFails(setDoc(ref(await authDb(OP_A, 'op-a@test.com')), fields(OP_A)))
  await assertSucceeds(setDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), fields(MGR_OTHER_A)))
  await assertSucceeds(setDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com')), fields(ADMIN_A)))
  await assertFails(setDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), { ...fields(MGR_OTHER_A), updatedBy: ADMIN_A }))
  await assertSucceeds(getDoc(ref(await authDb(OP_A, 'op-a@test.com'))))
  await assertFails(setDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com')), fields(ADMIN_B)))
})

test('settings: operatives cannot write company settings; managers can; operatives keep deadlines and health & safety', async () => {
  await seedLeaveAndTimesheetPeople()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'settings', id)
  const op = await authDb(OP_A, 'op-a@test.com')
  await assertFails(setDoc(ref(op, 'jobTypes'), { jobTypes: ['Hacked'] }))
  await assertFails(setDoc(ref(op, 'tradeTypeInventory'), { trades: ['x'] }, { merge: true }))
  await assertFails(setDoc(ref(op, 'variationTrades'), { trades: ['x'] }))
  await assertFails(setDoc(ref(op, 'somethingNew'), { a: 1 }))
  await assertSucceeds(setDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'jobTypes'), { jobTypes: ['Fit out'] }))
  await assertSucceeds(setDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'tradeTypeInventory'), { trades: ['Joiner'] }, { merge: true }))
  await assertSucceeds(getDoc(ref(op, 'jobTypes')))
  await assertSucceeds(setDoc(ref(op, 'deadlines_projects_AAAA-1'), { deadlines: [] }, { merge: true }))
  await assertSucceeds(setDoc(ref(op, 'deadlineAssignments'), { a: 1 }, { merge: true }))
  await assertSucceeds(setDoc(ref(op, 'healthSafety_projects_AAAA-1'), { talks: [] }, { merge: true }))
})

test('self-update: a person cannot change their own pay, line manager, active state, employment type or permissions', async () => {
  await seedLeaveAndTimesheetPeople()
  const rep = await authDb(REPORT_A, 'report-a@test.com')
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
  await assertSucceeds(updateDoc(doc(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'users', MGR_OTHER_A), {
    materials: true, siteAudit: true, 'permissions.materials': true, 'permissions.siteAudit': true, firstName: 'Max',
  }))
  // An admin still edits the person's pay and line manager.
  await assertSucceeds(updateDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', REPORT_A), { dayRate: 220, assignedManagerUserIds: [LM_A, MGR_OTHER_A] }))
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
  const org = async (uid: string, email: string) => doc(await authDb(uid, email), 'organizations', ORG_C)
  await assertSucceeds(updateDoc(await org(ADMIN_C, 'admin-c@test.com'), { name: 'Company C Ltd' }))
  await assertFails(updateDoc(await org(MEMBER_C, 'member-c@test.com'), { name: 'Hijack' }))
  // A plain admin cannot take ownership or give it to an operative; billing stays server-only.
  await assertFails(updateDoc(await org(ADMIN_C, 'admin-c@test.com'), { creatorUserId: ADMIN_C }))
  await assertFails(updateDoc(await org(FOUNDER, 'founder-c@test.com'), { creatorUserId: MEMBER_C }))
  await assertFails(updateDoc(await org(FOUNDER, 'founder-c@test.com'), { billing: { status: 'active', plan: 'free' } }))
  // The Super Admin transfers to another admin.
  await assertSucceeds(updateDoc(await org(FOUNDER, 'founder-c@test.com'), { creatorUserId: ADMIN_C }))
  // The old creator is demoted (users doc and members map): they cannot edit any more.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', FOUNDER), { email: 'founder-c@test.com', organizationId: ORG_C, role: 'manager', adminAccess: false, isSuperAdmin: false, manager: true })
    await updateDoc(doc(db, 'organizations', ORG_C), { creatorUserId: FOUNDER, [`members.${FOUNDER}`]: 'member' })
  })
  await assertFails(updateDoc(await org(FOUNDER, 'founder-c@test.com'), { name: 'Mine again' }))
  await assertFails(updateDoc(await org(FOUNDER, 'founder-c@test.com'), { creatorUserId: FOUNDER, [`members.${FOUNDER}`]: 'admin' }))
})

test('deleted bookings: the delete writes a tombstone and nobody can bring the booking back', async () => {
  await seedLeaveAndTimesheetPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'BOOK-T1'), { operativeId: OP_A, status: 'Confirmed', notes: '' })
    await setDoc(doc(db, 'organizations', ORG_A, 'managerSiteBookings', 'MSB-T1'), { userId: LM_A, locationType: 'office' })
  })
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const op = await authDb(OP_A, 'op-a@test.com')
  const tomb = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'deletedBookings', id)
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
  await assertFails(getDoc(tomb(await authDb(ADMIN_B, 'admin-b@test.com'), 'BOOK-T1')))
  await assertFails(setDoc(tomb(admin, 'BOOK-T1'), { deletedFrom: 'ios' }, { merge: true }))
  await assertFails(deleteDoc(tomb(op, 'BOOK-T1')))

  // Manager schedule bookings (1.10.0): a manager deletes their own non-job booking, with the tombstone; it cannot come back.
  const mgr = await authDb(LM_A, 'lm-a@test.com')
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
  const op = await authDb(OP_A, 'op-a@test.com')
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'bookings', 'BOOK-C1')
  await assertFails(setDoc(ref(op), { operativeId: OP_A, status: 'Confirmed', notes: '' }, { merge: true }))
  await assertFails(setDoc(ref(op), { operativeId: OP_A, status: 'Cancelled', notes: 'still off' }, { merge: true }))
  await assertSucceeds(setDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')), { status: 'Confirmed' }, { merge: true }))
})

test('warning decisions accept optional write metadata (web) and still accept writes without it (iOS)', async () => {
  await seedLeaveAndTimesheetPeople()
  const mgr = await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
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
  const ref = doc(await authDb(MGR_OPS, 'mgr-ops@test.com'), 'users', OP_META)
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
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'operativeProfiles', id)
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const mgr = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')

  // The operative's own pay, line manager or employment on the mirror: refused (update and create).
  await assertFails(setDoc(ref(op, PAY_OP), { userId: PAY_OP, dayRate: 999, updatedAt: Timestamp.now() }, { merge: true }))
  await assertFails(updateDoc(ref(op, PAY_OP), { payBasis: 'hourly', hourlyRate: 80 }))
  await assertFails(updateDoc(ref(op, PAY_OP), { assignedManagerUserId: PAY_OP }))
  await assertFails(updateDoc(ref(op, PAY_OP), { employmentType: 'self_employed' }))
  await assertFails(setDoc(ref(await authDb(REPORT_A, 'report-a@test.com'), REPORT_A), { userId: REPORT_A, dayRate: 999 }))
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
  await assertFails(updateDoc(ref(await authDb(LM_A, 'lm-a@test.com'), PAY_OP), { dayRate: 220 }))
  // Admins can, including a profile that does not exist yet.
  await assertSucceeds(updateDoc(ref(admin, PAY_OP), { dayRate: 230, payBasis: 'day' }))
  await assertSucceeds(setDoc(ref(admin, REPORT_A), { userId: REPORT_A, dayRate: 240 }, { merge: true }))
  // Another company's admin cannot.
  await assertFails(updateDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com'), PAY_OP), { dayRate: 1 }))
  // Delete: the person's own mirror or a pay manager, not a colleague.
  await assertFails(deleteDoc(ref(op, PAY_MGR_OPS)))
  await assertSucceeds(deleteDoc(ref(mgr, PAY_OP)))
})

test('operativeDayRateHistory: nobody records their own rate; admins and operatives managers record an operative\'s', async () => {
  await seedPayPeople()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', id)
  const row = (extra: Record<string, unknown>) => ({
    dayRate: 999, effectiveAt: Timestamp.fromMillis(Date.parse('2026-10-01T00:00:00Z')), createdAt: Timestamp.now(), ...extra,
  })
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const mgr = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')

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
  await assertFails(setDoc(ref(await authDb(LM_A, 'lm-a@test.com'), 'r10'), row({ userId: PAY_OP })))
  // Admins can.
  await assertSucceeds(setDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'r11'), row({ userId: PAY_OP, dayRate: 220 })))
  // Everyone in the company still reads history (payRateOnDay on both apps).
  await assertSucceeds(getDoc(ref(op, 'r4')))
  await assertFails(setDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com'), 'r12'), row({ userId: PAY_OP })))
})

test('timesheets: the owner cannot change line reviews, entry decisions or the approved snapshot; the line manager and admins can', async () => {
  await seedPayPeople()
  const id = `timesheet_${REPORT_A}_1770000000`
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'settings', id)
  const rep = await authDb(REPORT_A, 'report-a@test.com')
  const lm = await authDb(LM_A, 'lm-a@test.com')
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
  await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com')), { 'payrollLineReviews.op-2': { decision: 'approved', revisedAmount: null } }))

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

test('timesheets: 1.28.0 a person with no line manager signs but never writes a self-signed snapshot or reviews', async () => {
  await seedPayPeople()
  // OP_A has no line manager in the seed (legacy data): their sheet waits for the admins.
  const ref = doc(await authDb(OP_A, 'op-a@test.com'), 'organizations', ORG_A, 'settings', `timesheet_${OP_A}_1770000000`)
  const signed = {
    userId: OP_A, operativeSignedAt: Timestamp.now(), operativeSignedByName: 'Ollie',
    managerSignedAt: null, managerSignedByName: '', managerSignedByUserId: '', managerSignatureImageBase64: '',
    approvedAt: null, approvedByName: '', exportedAt: null, payrollLineReviews: {},
  }
  await assertFails(setDoc(ref, {
    ...signed,
    weeklyReportOverride: { approvedByUserId: OP_A, selfSigned: true, lines: [], priceWork: [], expenses: [] },
  }, { merge: true }))
  await assertSucceeds(setDoc(ref, signed, { merge: true }))
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
  const opRow = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'operatives', id)
  const mgrRow = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'managers', id)
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const mgr = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')

  // An operative cannot change pay on any operatives row, own or not; other fields and unchanged resends pass.
  await assertFails(updateDoc(opRow(op, PAY_OP_ROW), { dayRate: 999 }))
  await assertFails(updateDoc(opRow(op, PAY_MGR_OP_ROW), { payBasis: 'hourly', hourlyRate: 90 }))
  await assertFails(setDoc(opRow(op, 'new-row-a'), { email: 'x@test.com', name: 'X', dayRate: 10 }))
  await assertSucceeds(setDoc(opRow(op, PAY_OP_ROW), { email: 'pay-op@test.com', name: 'Pat B', dayRate: 200 }, { merge: true }))
  // 1.12.0 (H3): an operative never adds a roster row (its email is who it is).
  await assertFails(setDoc(opRow(op, 'new-row-b'), { email: 'y@test.com', name: 'Y' }))
  // A manager with operatives access changes an operative's row, never their own row.
  await assertSucceeds(updateDoc(opRow(mgr, PAY_OP_ROW), { dayRate: 210 }))
  await assertFails(updateDoc(opRow(mgr, PAY_MGR_OP_ROW), { dayRate: 999 }))
  // Manager rows: admins only.
  await assertFails(updateDoc(mgrRow(mgr, 'pay-mgr-row-a'), { dayRate: 999 }))
  await assertSucceeds(updateDoc(mgrRow(mgr, 'pay-mgr-row-a'), { name: 'Morgan B' }))
  await assertSucceeds(updateDoc(mgrRow(admin, 'pay-mgr-row-a'), { dayRate: 320 }))
  await assertSucceeds(updateDoc(opRow(admin, PAY_MGR_OP_ROW), { dayRate: 310 }))
  // Another company's admin cannot.
  await assertFails(updateDoc(opRow(await authDb(ADMIN_B, 'admin-b@test.com'), PAY_OP_ROW), { dayRate: 1 }))
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
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const nolm = await authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com')
  const sbOp = await authDb(SB_OPMODE_A, 'sb-opmode-a@test.com')
  // hasNoLineManager, self-book off: asks, never saves approved, never edits the dates once decided.
  await assertFails(setDoc(ref(nolm, 'hb120-1'), leave(NOLM_MGR_A, 'approved')))
  await assertFails(setDoc(ref(nolm, 'hb120-1'), leave(NOLM_MGR_A, 'approved', { approvedByUserId: NOLM_MGR_A })))
  await assertSucceeds(setDoc(ref(nolm, 'hb120-1'), leave(NOLM_MGR_A, 'pending')))
  await assertFails(updateDoc(ref(nolm, 'hb120-1'), { status: 'approved', approvedByUserId: NOLM_MGR_A, approvedAt: Timestamp.now() }))
  // Self-book flag in operative mode: asks too.
  await assertFails(setDoc(ref(sbOp, 'hb120-2'), leave(SB_OPMODE_A, 'approved')))
  await assertSucceeds(setDoc(ref(sbOp, 'hb120-2'), leave(SB_OPMODE_A, 'pending')))
  // Nobody is stranded: an admin (not in operative mode) decides the no-line-manager request.
  await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hb120-1'), { status: 'approved', approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() }))
  // Once approved, a non-self-booker (not a manager) cannot delete it themselves (they ask to cancel).
  await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hb120-2'), { status: 'approved', approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() }))
  await assertFails(deleteDoc(ref(sbOp, 'hb120-2')))
  // A pending request may still be withdrawn.
  await assertSucceeds(setDoc(ref(sbOp, 'hb120-3'), leave(SB_OPMODE_A, 'pending')))
  await assertSucceeds(deleteDoc(ref(sbOp, 'hb120-3')))
})

test('1.2.0 decision 3: nobody decides their own leave, admins included; an admin in operative mode decides only as line manager', async () => {
  await seedRulebook120People()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const adminOp = await authDb(ADMIN_OPMODE_A, 'admin-opmode-a@test.com')
  const approve = (uid: string) => ({ status: 'approved', approvedByUserId: uid, approvedAt: Timestamp.now() })

  // 1.28.0: ADMIN_A is the Super Admin (the organisation's creator), so their own leave saves approved.
  await assertSucceeds(setDoc(ref(admin, 'hb130-own-0'), leave(ADMIN_A, 'approved', { approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() })))
  // An admin with Annual Leave Management off asks (line manager or not); they cannot approve it or save it approved.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ADMIN_OPMODE_A), { assignedManagerUserIds: [LM_A] }, { merge: true })
  })
  await assertFails(setDoc(ref(adminOp, 'hb120-own-1'), leave(ADMIN_OPMODE_A, 'approved', { approvedByUserId: ADMIN_OPMODE_A, approvedAt: Timestamp.now() })))
  await assertSucceeds(setDoc(ref(adminOp, 'hb120-own-1'), leave(ADMIN_OPMODE_A, 'pending')))
  await assertFails(updateDoc(ref(adminOp, 'hb120-own-1'), approve(ADMIN_OPMODE_A)))
  await assertFails(updateDoc(ref(adminOp, 'hb120-own-1'), { status: 'rejected', decisionNote: 'no' }))
  // Another admin can decide it.
  await assertSucceeds(updateDoc(ref(admin, 'hb120-own-1'), approve(ADMIN_A)))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ADMIN_OPMODE_A), { assignedManagerUserIds: [] }, { merge: true })
  })

  // Requests from people with and without a line manager.
  await assertSucceeds(setDoc(ref(await authDb(REPORT_A, 'report-a@test.com'), 'hb120-rep'), leave(REPORT_A, 'pending')))
  await assertSucceeds(setDoc(ref(await authDb(OP_A, 'op-a@test.com'), 'hb120-noline'), leave(OP_A, 'pending')))
  // 1.11.0: an admin with a stray operative-mode flag is an admin (no operative mode) and decides like one —
  // covered by '1.11.0 levels' and the hb120-own-1 decision above.
  // Admin not in operative mode: both.
  await assertSucceeds(updateDoc(ref(admin, 'hb120-rep'), approve(ADMIN_A)))
  await assertSucceeds(updateDoc(ref(admin, 'hb120-noline'), approve(ADMIN_A)))

  // An admin in operative mode who is the line manager decides as line manager.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', REPORT_A), { assignedManagerUserIds: [ADMIN_OPMODE_A] }, { merge: true })
  })
  await assertSucceeds(setDoc(ref(await authDb(REPORT_A, 'report-a@test.com'), 'hb120-rep-2'), leave(REPORT_A, 'pending')))
  await assertSucceeds(updateDoc(ref(adminOp, 'hb120-rep-2'), approve(ADMIN_OPMODE_A)))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', REPORT_A), { assignedManagerUserIds: [] }, { merge: true })
  })
})

test('1.2.0 decision 5: managers un-approve a booking clash (delete); operatives and other companies cannot', async () => {
  await seedRulebook120People()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', id)
  const fields = { bookingAId: 'C', bookingBId: 'D', acceptedByUserId: ADMIN_A }
  await env.withSecurityRulesDisabled(async (ctx) => {
    // One firestore() per context: a second call fails with "Firestore has already been started".
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', 'C|D'), fields)
    await setDoc(doc(db, 'organizations', ORG_A, 'acceptedBookingClashes', 'E|F'), fields)
  })
  const mgr = await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  await assertFails(deleteDoc(ref(await authDb(OP_A, 'op-a@test.com'), 'C|D')))
  await assertFails(deleteDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com'), 'C|D')))
  await assertSucceeds(deleteDoc(ref(mgr, 'C|D')))
  await assertSucceeds(deleteDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'E|F')))
})

test('1.2.0 decision 7 (1.10.0): a manager who does not manage the job cannot delete its labour booking or tombstone it', async () => {
  await seedRulebook120People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'bookings', 'book-120'), { organizationId: ORG_A, userId: OP_A })
  })
  const mgr = await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const user = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'users', id)
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const mgrOps = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  // The person never changes their own (on or off).
  await assertFails(updateDoc(user(op, PAY_OP), { hasNoLineManager: true }))
  await assertFails(updateDoc(user(await authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), NOLM_MGR_A), { hasNoLineManager: false }))
  // Resending the unchanged value passes (missing and false are the same; true stays true).
  await assertSucceeds(updateDoc(user(op, PAY_OP), { hasNoLineManager: false, firstName: 'Pat' }))
  await assertSucceeds(updateDoc(user(await authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), NOLM_MGR_A), { hasNoLineManager: true, firstName: 'Nia' }))
  // 1.31.0 (audit finding 9): "No line manager" is for admins only — an operatives manager never sets it on an
  // operative; they set the line manager (and clear the flag).
  await assertFails(updateDoc(user(mgrOps, PAY_OP), { hasNoLineManager: true, assignedManagerUserIds: [], assignedManagerUserId: '' }))
  await assertSucceeds(updateDoc(user(mgrOps, PAY_OP), { hasNoLineManager: false, assignedManagerUserIds: [LM_A], assignedManagerUserId: LM_A }))
  await assertFails(updateDoc(user(mgrOps, LM_A), { hasNoLineManager: true }))
  await assertFails(updateDoc(user(mgrOps, PAY_MGR_OPS), { hasNoLineManager: true }))
  // A manager without operatives access cannot.
  await assertFails(updateDoc(user(await authDb(LM_A, 'lm-a@test.com'), PAY_OP), { hasNoLineManager: true }))
  // Admins can, for anyone in their company; another company's admin cannot.
  await assertSucceeds(updateDoc(user(await authDb(ADMIN_A, 'admin-a@test.com'), NOLM_MGR_A), { hasNoLineManager: false }))
  // 1.31.0: an admin sets it on an admin only — never on an operative or a manager.
  await assertFails(updateDoc(user(await authDb(ADMIN_A, 'admin-a@test.com'), PAY_OP), { hasNoLineManager: true }))
  await assertFails(updateDoc(user(await authDb(ADMIN_B, 'admin-b@test.com'), PAY_OP), { hasNoLineManager: false }))
})

test('1.2.0 decision 15: a cleared-rate history row (dayRate null, payBasis null) is accepted for the same writers', async () => {
  await seedRulebook120People()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', id)
  const cleared = (extra: Record<string, unknown>) => ({
    dayRate: null, payBasis: null, effectiveAt: Timestamp.fromMillis(Date.parse('2026-11-01T00:00:00Z')), createdAt: Timestamp.now(), ...extra,
  })
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const mgr = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  // Same writers as a normal row: operatives manager for an operative (user id or operatives row), admins.
  await assertSucceeds(setDoc(ref(mgr, 'clr-1'), cleared({ userId: PAY_OP, operativeId: PAY_OP_ROW }), { merge: true }))
  await assertSucceeds(setDoc(ref(mgr, 'clr-2'), { ...cleared({ operativeId: PAY_OP_ROW }), updatedAt: serverTimestamp(), updatedBy: PAY_MGR_OPS, updatedFrom: 'ios' }))
  await assertSucceeds(setDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'clr-3'), cleared({ userId: REPORT_A })))
  // An existing row can be turned into a cleared row by the same writers.
  await assertSucceeds(setDoc(ref(mgr, 'clr-4'), cleared({ userId: PAY_OP, dayRate: 200, payBasis: 'day' })))
  await assertSucceeds(updateDoc(ref(mgr, 'clr-4'), { dayRate: null, payBasis: null }))
  // ...and the same people are still refused: own row, a manager's row, no operatives access, another company.
  await assertFails(setDoc(ref(op, 'clr-5'), cleared({ userId: PAY_OP })))
  await assertFails(setDoc(ref(mgr, 'clr-6'), cleared({ userId: PAY_MGR_OPS })))
  await assertFails(setDoc(ref(mgr, 'clr-7'), cleared({ userId: LM_A })))
  await assertFails(setDoc(ref(await authDb(LM_A, 'lm-a@test.com'), 'clr-8'), cleared({ userId: PAY_OP })))
  await assertFails(setDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com'), 'clr-9'), cleared({ userId: PAY_OP })))
})

test('1.2.0 holiday delete: only a decider (never on their own leave), the owner withdrawing, or a self-booker deletes', async () => {
  await seedRulebook120People()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const approved = (uid: string, extra: Record<string, unknown> = {}) => leave(uid, 'approved', { approvedByUserId: ADMIN_A, approvedAt: Timestamp.now(), ...extra })
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-mgr-own'), approved(NOLM_MGR_A))
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-admin-own'), approved(ADMIN_OPMODE_A))
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-super-own'), approved(ADMIN_A))
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-rep-cancel'), approved(REPORT_A, {
      cancellationRequestedAt: Timestamp.now(), cancellationRequestedByUserId: REPORT_A,
    }))
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hbdel-rep-2'), approved(REPORT_A))
  })
  const lm = await authDb(LM_A, 'lm-a@test.com')
  // A manager (not a self-booker) cannot delete their own approved leave; nor can an admin with Annual Leave
  // Management off (1.28.0: having no line manager no longer self-approves an admin). The Super Admin (the
  // organisation's creator) always self-books and may.
  await assertFails(deleteDoc(ref(await authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), 'hbdel-mgr-own')))
  await assertFails(deleteDoc(ref(await authDb(ADMIN_OPMODE_A, 'admin-opmode-a@test.com'), 'hbdel-admin-own')))
  await assertSucceeds(deleteDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hbdel-super-own')))
  // A manager who is not the line manager cannot delete a report's booking. (1.11.0: an admin with a stray
  // operative-mode flag is an admin and could; not asserted here so the line manager's delete below still runs.)
  await assertFails(deleteDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com'), 'hbdel-rep-cancel')))
  // Another company cannot.
  await assertFails(deleteDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com'), 'hbdel-rep-cancel')))
  // The line manager accepts the cancellation by deleting it.
  await assertSucceeds(deleteDoc(ref(lm, 'hbdel-rep-cancel')))
  // An admin (not in operative mode) removes someone else's booking (cleanup, Team screen).
  await assertSucceeds(deleteDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hbdel-rep-2')))
  // Another admin may remove ADMIN_A's own booking.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'admin-a2'), { email: 'admin-a2@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true })
  })
  await assertSucceeds(deleteDoc(ref(await authDb('admin-a2', 'admin-a2@test.com'), 'hbdel-admin-own')))
})

test('1.2.0 decision 5: any manager un-approves a warning resolution someone else approved; operatives and other companies cannot', async () => {
  await seedRulebook120People()
  const key = 'clash|book-x|book-y'
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'warningResolutions', key)
  const seed = async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'warningResolutions', key), {
        resolutionKey: key, status: 'approved', resolvedByUserId: LM_A, resolvedAt: Timestamp.now(),
      })
    })
  }
  await seed()
  await assertFails(deleteDoc(ref(await authDb(OP_A, 'op-a@test.com'))))
  await assertFails(deleteDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com'))))
  await assertSucceeds(deleteDoc(ref(await authDb(MGR_OTHER_A, 'mgr-other-a@test.com'))))
  await seed()
  await assertSucceeds(deleteDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'))))
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
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  const mgr = await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const approve = (uid: string) => ({ status: 'approved', approvedByUserId: uid, approvedAt: Timestamp.now() })
  // OP_A has no line manager (legacy data).
  await assertSucceeds(setDoc(ref(await authDb(OP_A, 'op-a@test.com'), 'hb130-legacy'), leave(OP_A, 'pending')))
  await assertFails(updateDoc(ref(mgr, 'hb130-legacy'), approve(MGR_OTHER_A)))
  await assertFails(updateDoc(ref(mgr, 'hb130-legacy'), { status: 'rejected', approvedByUserId: MGR_OTHER_A }))
  await assertFails(deleteDoc(ref(mgr, 'hb130-legacy')))
  await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hb130-legacy'), approve(ADMIN_A)))
  // A legacy operativeId-only row: admins only too.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'holidayBookings', 'hb130-opid'), { ...leave(OP_A, 'pending'), userId: null, operativeId: 'legacy-operative-row' })
  })
  await assertFails(updateDoc(ref(mgr, 'hb130-opid'), approve(MGR_OTHER_A)))
  await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hb130-opid'), approve(ADMIN_A)))
  // The line manager still decides their report's request.
  await assertSucceeds(setDoc(ref(await authDb(REPORT_A, 'report-a@test.com'), 'hb130-rep'), leave(REPORT_A, 'pending')))
  await assertSucceeds(updateDoc(ref(await authDb(LM_A, 'lm-a@test.com'), 'hb130-rep'), approve(LM_A)))
})

const ADMIN2_A = 'admin2-a'
const SUPER_FLAG_A = 'super-flag-a'

async function seedRulebook1280People() {
  await seedRulebook130People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    // A plain admin (not the Super Admin), no line manager, both self-manage toggles off.
    await setDoc(doc(db, 'users', ADMIN2_A), {
      email: 'admin2-a@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, firstName: 'Abe',
      permissions: { adminAccess: true, annualLeaveSelfBook: false, timesheetSelfSign: false },
    })
    // A Super Admin by flag (not the creator).
    await setDoc(doc(db, 'users', SUPER_FLAG_A), {
      email: 'super-flag-a@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, isSuperAdmin: true,
    })
  })
}

async function setUserFields(uid: string, fields: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), fields, { merge: true })
  })
}

test('1.28.0: an admin self-books leave only with Annual Leave Management (or as the Super Admin); no line manager alone never', async () => {
  await seedRulebook1280People()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'holidayBookings', id)
  // 1.32.4: a fresh context after each change below = the token refresh the claims marker triggers.
  let admin2 = await authDb(ADMIN2_A, 'admin2-a@test.com')
  const approved = (uid: string) => leave(uid, 'approved', { approvedByUserId: uid, approvedAt: Timestamp.now() })
  try {
    // No line manager, toggle off: asks (the other admins decide), never saves approved.
    await assertFails(setDoc(ref(admin2, 'hb128-a1'), approved(ADMIN2_A)))
    await assertSucceeds(setDoc(ref(admin2, 'hb128-a1'), leave(ADMIN2_A, 'pending')))
    await assertFails(updateDoc(ref(admin2, 'hb128-a1'), { status: 'approved', approvedByUserId: ADMIN2_A, approvedAt: Timestamp.now() }))
    // Not stranded: the Super Admin decides it.
    await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hb128-a1'), { status: 'approved', approvedByUserId: ADMIN_A, approvedAt: Timestamp.now() }))
    // Timesheet self-sign alone does not self-book.
    await setUserFields(ADMIN2_A, { permissions: { adminAccess: true, annualLeaveSelfBook: false, timesheetSelfSign: true } })
    admin2 = await authDb(ADMIN2_A, 'admin2-a@test.com')
    await assertFails(setDoc(ref(admin2, 'hb128-a2'), approved(ADMIN2_A)))
    // Annual Leave Management on: saves approved, with or without a line manager (the toggles are independent).
    await setUserFields(ADMIN2_A, { permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: false } })
    admin2 = await authDb(ADMIN2_A, 'admin2-a@test.com')
    await assertSucceeds(setDoc(ref(admin2, 'hb128-a3'), approved(ADMIN2_A)))
    await setUserFields(ADMIN2_A, { assignedManagerUserIds: [LM_A], assignedManagerUserId: LM_A })
    await assertSucceeds(setDoc(ref(admin2, 'hb128-a4'), approved(ADMIN2_A)))
  } finally {
    await setUserFields(ADMIN2_A, {
      assignedManagerUserIds: [], assignedManagerUserId: '',
      permissions: { adminAccess: true, annualLeaveSelfBook: false, timesheetSelfSign: false },
    })
  }
  // The Super Admin always self-books — the creator even with a line manager and the toggle off, and a flagged one.
  try {
    await setAdminLineManagers([LM_A])
    await assertSucceeds(setDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com'), 'hb128-sa1'), approved(ADMIN_A)))
  } finally {
    await setAdminLineManagers([])
  }
  await assertSucceeds(setDoc(ref(await authDb(SUPER_FLAG_A, 'super-flag-a@test.com'), 'hb128-sa2'), approved(SUPER_FLAG_A)))
  // An admin with a stray operative-mode flag and no toggle asks like any admin.
  await assertFails(setDoc(ref(await authDb(ADMIN_OPMODE_A, 'admin-opmode-a@test.com'), 'hb128-aop'), approved(ADMIN_OPMODE_A)))
  // A manager with no line manager (and no self-book flag) still asks.
  await assertFails(setDoc(ref(await authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), 'hb128-m'), leave(NOLM_MGR_A, 'approved')))
})

test('1.28.0: only the Super Admin or an admin with Timesheet self-sign writes their own self-signed snapshot', async () => {
  await seedRulebook1280People()
  const sheet = async (uid: string, email: string) =>
    doc(await authDb(uid, email), 'organizations', ORG_A, 'settings', `timesheet_${uid}_1790000000`)
  const save = (uid: string, n: number) => ({
    userId: uid, operativeSignedAt: Timestamp.now(), operativeSignedByName: 'Self',
    weeklyReportOverride: { approvedByUserId: uid, selfSigned: true, lines: [], priceWork: [], expenses: [], n },
  })
  // The Super Admin's own sheet is self-signed (1.30.2: through the owner path — nobody reviews their own sheet).
  await assertSucceeds(setDoc(await sheet(ADMIN_A, 'admin-a@test.com'), save(ADMIN_A, 1), { merge: true }))
  // REPORT_A (an operative with an active line manager): never.
  const rep = await sheet(REPORT_A, 'report-a@test.com')
  await assertFails(setDoc(rep, save(REPORT_A, 1), { merge: true }))
  try {
    // 1.28.0: with only an inactive line manager (no current one) it is still refused — no line manager no longer
    // self-signs anyone.
    await setUserFields(REPORT_A, { assignedManagerUserId: GONE_MGR_A, assignedManagerUserIds: [GONE_MGR_A] })
    await assertFails(setDoc(rep, save(REPORT_A, 2), { merge: true }))
    // A Timesheet self-sign flag on someone who is not an admin (a demoted admin) does not count.
    await setUserFields(REPORT_A, { timesheetSelfSign: true, permissions: { timesheetSelfSign: true } })
    await assertFails(setDoc(rep, save(REPORT_A, 3), { merge: true }))
  } finally {
    await setUserFields(REPORT_A, {
      assignedManagerUserId: LM_A, assignedManagerUserIds: [LM_A], timesheetSelfSign: false, permissions: { timesheetSelfSign: false },
    })
  }
  // The manager with no line manager: never.
  await assertFails(setDoc(await sheet(NOLM_MGR_A, 'nolm-mgr-a@test.com'), save(NOLM_MGR_A, 1), { merge: true }))
})

test('1.28.0: nobody changes their own self-manage toggles; another admin sets them; a non-admin never raises them', async () => {
  await seedRulebook1280People()
  const own = doc(await authDb(ADMIN2_A, 'admin2-a@test.com'), 'users', ADMIN2_A)
  await assertFails(updateDoc(own, { timesheetSelfSign: true }))
  await assertFails(updateDoc(own, { 'permissions.timesheetSelfSign': true }))
  await assertFails(updateDoc(own, { annualLeaveSelfBook: true, 'permissions.annualLeaveSelfBook': true }))
  // Unchanged resends and other fields still pass.
  await assertSucceeds(updateDoc(own, { firstName: 'Abel', 'permissions.timesheetSelfSign': false }))
  // Another admin (here the Super Admin) sets them.
  const other = doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', ADMIN2_A)
  await assertSucceeds(updateDoc(other, { timesheetSelfSign: true, 'permissions.timesheetSelfSign': true, annualLeaveSelfBook: true, 'permissions.annualLeaveSelfBook': true }))
  // Turning their own off is a change too.
  await assertFails(updateDoc(own, { timesheetSelfSign: false, 'permissions.timesheetSelfSign': false }))
  await assertSucceeds(updateDoc(other, { timesheetSelfSign: false, 'permissions.timesheetSelfSign': false, annualLeaveSelfBook: false, 'permissions.annualLeaveSelfBook': false }))
  // A non-admin never turns Timesheet self-sign on for themself.
  await assertFails(updateDoc(doc(await authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), 'users', NOLM_MGR_A), { timesheetSelfSign: true }))
  await assertFails(updateDoc(doc(await authDb(NOLM_MGR_A, 'nolm-mgr-a@test.com'), 'users', NOLM_MGR_A), { 'permissions.timesheetSelfSign': true }))
})

test('1.3.0 B: a notification actorUserId, when written, is the signed-in user', async () => {
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'notifications', id)
  const op = await authDb(OP_A, 'op-a@test.com')
  const row = (extra: Record<string, unknown> = {}) => ({ userId: ADMIN_A, type: 'holiday_request_submitted', isRead: false, title: 't', message: 'm', ...extra })
  await assertSucceeds(setDoc(ref(op, 'n130-1'), row({ actorUserId: OP_A })))
  await assertSucceeds(setDoc(ref(op, 'n130-2'), row()))
  await assertFails(setDoc(ref(op, 'n130-3'), row({ actorUserId: ADMIN_A })))
  await assertFails(setDoc(ref(op, 'n130-4'), row({ actorUserId: null })))
  // Another company's member cannot write here at all.
  await assertFails(setDoc(ref(await authDb(OP_B, 'op-b@test.com'), 'n130-5'), row({ actorUserId: OP_B })))
  // The addressee marks it read; nobody rewrites the actor to someone else.
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
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
  const staff = await authDb(STAFF_A, 'staff-a-190@test.com')
  const ref = doc(staff, 'organizations', ORG_A, 'materials', 'mat-190')
  await assertSucceeds(updateDoc(ref, { status: 'ordered', updatedAt: serverTimestamp(), updatedBy: STAFF_A, updatedFrom: 'ios' }))
  await assertSucceeds(updateDoc(ref, { status: 'ordered', lastSentRequestType: 'order', updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(ref, { status: 'ordered', updatedBy: ADMIN_A }))
  await assertFails(updateDoc(ref, { status: 'ordered', updatedFrom: 'desktop' }))
  await assertFails(updateDoc(ref, { status: 'ordered', name: 'Changed' }))
})

test('1.9.0: only admins and managers dismiss a warning (§16)', async () => {
  const row = { kind: 'qualification_expired', dismissKey: 'd190', dismissedByUserId: 'x' }
  await assertFails(setDoc(doc(await authDb(OP_A, 'op-a@test.com'), 'organizations', ORG_A, 'dismissedWarnings', 'd190-op'), { ...row, dismissedByUserId: OP_A }))
  await assertSucceeds(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'dismissedWarnings', 'd190-admin'), { ...row, dismissedByUserId: ADMIN_A }))
  await assertFails(setDoc(doc(await authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'dismissedWarnings', 'd190-b'), { ...row, dismissedByUserId: ADMIN_B }))
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
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const mgr = await authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  const other = await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const rowMail = await authDb(MGR_ROWMAIL_A, 'rowmail@test.com')
  const op = await authDb(OP_A, 'op-a@test.com')
  const ref = (db: Awaited<ReturnType<typeof authDb>>, coll: string, id: string) => doc(db, 'organizations', ORG_A, coll, id)

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
      const db = await authDb(uid, email)
      const batch = writeBatch(db)
      batch.delete(doc(db, 'organizations', ORG_A, coll, id))
      batch.set(doc(db, 'organizations', ORG_A, 'deletedBookings', id), tomb(uid, id, coll))
      await assertFails(batch.commit())
    }
    const mgr = await authDb(MGR_JOB_A, 'mgr-job-a@test.com')
    const batch = writeBatch(mgr)
    batch.delete(doc(mgr, 'organizations', ORG_A, coll, id))
    batch.set(doc(mgr, 'organizations', ORG_A, 'deletedBookings', id), tomb(MGR_JOB_A, id, coll))
    await assertSucceeds(batch.commit())
    // Tombstoned: cannot come back, even for the admin.
    await assertFails(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, coll, id), labour('JOB-110')))
  }
  // With the booking already gone, only an admin writes a tombstone.
  await assertFails(setDoc(doc(await authDb(MGR_JOB_A, 'mgr-job-a@test.com'), 'organizations', ORG_A, 'deletedBookings', 'gone-110'), tomb(MGR_JOB_A, 'gone-110', 'bookings')))
  await assertSucceeds(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'deletedBookings', 'gone-110'), tomb(ADMIN_A, 'gone-110', 'bookings')))
})

test('1.10.0 a manager removed from the job loses booking writes; re-added gets them back', async () => {
  await seed110()
  const mgr = await authDb(MGR_JOB_A, 'mgr-job-a@test.com')
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
  const multi = await authDb(MULTI, 'multi@test.com')
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
  const multi = await authDb(MULTI, 'multi@test.com')
  await assertSucceeds(setDoc(doc(multi, 'organizations', ORG_A, 'wholesalers', 'w-111'), { name: 'W' }))
})

test('1.10.0 M10: a person cannot raise their own membership role or permissions; an admin of that org can', async () => {
  await seed110()
  const op = await authDb(OP_A, 'op-a@test.com')
  const ref = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'users', OP_A, 'orgMemberships', ORG_A)
  // OP_A is 'member' in ORG_A's members map.
  await assertFails(setDoc(ref(op), { role: 'admin', status: 'active' }))
  await assertFails(setDoc(ref(op), { role: 'member', status: 'active', permissions: { adminAccess: true } }))
  await assertFails(setDoc(ref(op), { role: 'member', status: 'active', adminAccess: true }))
  await assertSucceeds(setDoc(ref(op), { role: 'member', status: 'active', acceptedAt: Timestamp.now() }))
  await assertFails(updateDoc(ref(op), { 'permissions.manager': true }))
  await assertFails(updateDoc(ref(op), { accountActive: true }))
  await assertSucceeds(updateDoc(ref(op), { status: 'active', updatedAt: Timestamp.now() }))
  await assertSucceeds(updateDoc(ref(await authDb(ADMIN_A, 'admin-a@test.com')), { role: 'manager', 'permissions.manager': true }))
  // The admin of another company cannot.
  await assertFails(updateDoc(ref(await authDb(ADMIN_B, 'admin-b@test.com')), { role: 'admin' }))
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
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
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

const colA = (db: Awaited<ReturnType<typeof authDb>>, name: string) => collection(db, 'organizations', ORG_A, name)
const since = Timestamp.fromDate(new Date('2026-10-26T00:00:00Z'))

test('1.10.0 r2 / 1.33.0 reads: an admin reads everything; every manager reads every job and booking, toggles or not', async () => {
  await seedR2()
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  for (const name of ['projects', 'smallWorks', 'bookings', 'managerSiteBookings', 'subcontractorBookings']) {
    await assertSucceeds(getDocs(colA(admin, name)))
  }
  await assertSucceeds(getDocs(query(colA(admin, 'bookings'), where('date', '>=', since))))
  const toggle = await authDb(MGR_TOGGLE_A, 'toggle@test.com')
  await assertSucceeds(getDocs(colA(toggle, 'projects')))
  await assertSucceeds(getDocs(colA(toggle, 'smallWorks')))
  await assertSucceeds(getDoc(doc(toggle, 'organizations', ORG_A, 'projects', 'OTHER-R2')))
  // 1.33.0 (owner decision 6 Nov, every manager sees every job): whole booking collections too…
  for (const name of ['bookings', 'managerSiteBookings', 'subcontractorBookings']) await assertSucceeds(getDocs(colA(toggle, name)))
  // …and the 1.11.0 queries by `jobCollection` still work.
  for (const name of ['bookings', 'managerSiteBookings', 'subcontractorBookings']) {
    await assertSucceeds(getDocs(query(colA(toggle, name), where('jobCollection', '==', 'projects'), where('date', '>=', since))))
    await assertSucceeds(getDocs(query(colA(toggle, name), where('jobCollection', '==', 'smallWorks'))))
  }
  // 1.33.0: a single toggle no longer narrows reads (it governs creating jobs and changing manager lists only).
  const projOnly = await authDb(MGR_PROJ_ONLY_A, 'projonly@test.com')
  await assertSucceeds(getDocs(colA(projOnly, 'projects')))
  await assertSucceeds(getDocs(colA(projOnly, 'smallWorks')))
  await assertSucceeds(getDocs(colA(projOnly, 'bookings')))
  await assertSucceeds(getDocs(query(colA(projOnly, 'bookings'), where('jobCollection', '==', 'smallWorks'))))
})

test('1.10.0 r2 / 1.33.0 reads: a manager without any toggle reads every job, every booking and their own', async () => {
  await seedR2()
  const mgr = await authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  // 1.33.0 (owner decision 6 Nov): every manager sees every project and small works, and every booking.
  await assertSucceeds(getDocs(colA(mgr, 'projects')))
  await assertSucceeds(getDocs(colA(mgr, 'smallWorks')))
  const mine = await assertSucceeds(getDocs(query(colA(mgr, 'projects'), where('managerUserIds', 'array-contains', MGR_JOB_A))))
  assert.deepEqual(mine.docs.map((d) => d.id).sort(), ['JOB-R2', 'job-lc'])
  await assertSucceeds(getDocs(query(colA(mgr, 'projects'), where('managerUserIds', 'array-contains', MGR_OTHER_A))))
  await assertSucceeds(getDoc(doc(mgr, 'organizations', ORG_A, 'projects', 'OTHER-R2')))
  for (const name of ['bookings', 'managerSiteBookings', 'subcontractorBookings']) await assertSucceeds(getDocs(colA(mgr, name)))
  await assertSucceeds(getDocs(query(colA(mgr, 'bookings'), where('projectId', 'in', ['OTHER-R2']))))
  await assertSucceeds(getDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'r2-theirs')))
  await assertSucceeds(getDocs(query(colA(mgr, 'managerSiteBookings'), where('locationId', 'in', ['OTHER-R2']))))
  // Their own bookings anywhere (the 1.10.0 queries still work).
  const ownSite = await assertSucceeds(getDocs(query(colA(mgr, 'managerSiteBookings'), where('userId', '==', MGR_JOB_A), where('date', '>=', since))))
  assert.deepEqual(ownSite.docs.map((d) => d.id), ['r2-msb-own'])
  // Health & safety under a job follows the job: every manager reads it.
  await assertSucceeds(getDocs(collection(mgr, 'organizations', ORG_A, 'projects', 'OTHER-R2', 'healthSafety')))
  // Writes are unchanged: still only the jobs they manage (1.10.0 r2 jobs / bookings tests).
  await assertFails(updateDoc(doc(mgr, 'organizations', ORG_A, 'projects', 'OTHER-R2'), { name: 'renamed' }))
  // Another company's manager or admin reads nothing here.
  await assertFails(getDocs(colA(await authDb(ADMIN_B, 'admin-b@test.com'), 'bookings')))
})

test('1.10.0 r2 reads: an operative reads their own bookings (account id or operatives row) and their jobs by id, never a list', async () => {
  await seedR2()
  const op = await authDb(OP_A, 'op-a@test.com')
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
  await assertFails(getDocs(colA(await authDb(ADMIN_B, 'admin-b@test.com'), 'projects')))
  await assertFails(getDoc(doc(await authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'projects', 'JOB-R2')))
})

test('1.10.0 r2 jobs: admins and toggle managers add jobs and change manager lists; other managers edit details of their jobs only', async () => {
  await seedR2()
  const ref = (db: Awaited<ReturnType<typeof authDb>>, coll: string, id: string) => doc(db, 'organizations', ORG_A, coll, id)
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const toggle = await authDb(MGR_TOGGLE_A, 'toggle@test.com')
  const projOnly = await authDb(MGR_PROJ_ONLY_A, 'projonly@test.com')
  const mgr = await authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  const op = await authDb(OP_A, 'op-a@test.com')
  await assertSucceeds(setDoc(ref(admin, 'projects', 'NEW-ADMIN'), { siteName: 'A', managerIds: [MGR_JOB_A], managerUserIds: [MGR_JOB_A] }))
  await assertSucceeds(setDoc(ref(toggle, 'smallWorks', 'NEW-TOGGLE'), { siteName: 'T', managerIds: [MGR_TOGGLE_A] }))
  await assertSucceeds(setDoc(ref(projOnly, 'projects', 'NEW-PROJONLY'), { siteName: 'P', managerUserIds: [MGR_PROJ_ONLY_A] }))
  await assertFails(setDoc(ref(projOnly, 'smallWorks', 'NEW-PROJONLY-SW'), { siteName: 'P', managerUserIds: [MGR_PROJ_ONLY_A] }))
  // 1.31.0 (owner decision): a new job names a manager.
  await assertFails(setDoc(ref(admin, 'projects', 'NEW-NO-MANAGER'), { siteName: 'A' }))
  await assertFails(setDoc(ref(admin, 'projects', 'NEW-EMPTY-MANAGERS'), { siteName: 'A', managerIds: [], managerUserIds: [] }))
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
  const multi = await authDb(MULTI, 'multi@test.com')
  await assertSucceeds(setDoc(doc(multi, 'organizations', ORG_A, 'projects', 'NEW-MULTI'), { siteName: 'M', managerUserIds: [MULTI] }))
  await assertFails(setDoc(doc(multi, 'organizations', ORG_A, 'smallWorks', 'NEW-MULTI-SW'), { siteName: 'M', managerUserIds: [MULTI] }))
  await assertSucceeds(getDocs(colA(multi, 'projects')))
  // Their home company's toggles (none) do not leak the other way: in company B MULTI is a manager without them.
  await assertFails(setDoc(doc(multi, 'organizations', ORG_B, 'projects', 'NEW-MULTI-B'), { siteName: 'B', managerUserIds: [MULTI] }))
})

test('1.10.0 r2: a manager can never book themselves onto a job they do not manage', async () => {
  await seedR2()
  const mgr = await authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'self-other'), { userId: MGR_JOB_A, locationType: 'project', locationId: 'OTHER-R2' }))
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'self-other-labour'), { operativeId: MGR_JOB_A, projectId: 'OTHER-R2', status: 'Confirmed', timeSlot: 'FULL DAY' }))
  // Even a manager with the toggle (who sees the job) is not its manager.
  const toggle = await authDb(MGR_TOGGLE_A, 'toggle@test.com')
  await assertFails(setDoc(doc(toggle, 'organizations', ORG_A, 'managerSiteBookings', 'self-toggle'), { userId: MGR_TOGGLE_A, locationType: 'project', locationId: 'OTHER-R2' }))
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'self-mine'), { userId: MGR_JOB_A, locationType: 'project', locationId: 'JOB-R2' }))
})

// MARK: - 1.11.0 (owner decisions round 3)

const MGR_SW_ONLY_A = 'mgr-sw-only-a'

async function seed111() {
  await seedR2()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', MGR_SW_ONLY_A), { email: 'swonly@test.com', organizationId: ORG_A, role: 'manager', permissions: { manager: true, smallWorks: true } })
    await setDoc(doc(db, 'organizations', ORG_A, 'smallWorks', 'SW-111'), { siteName: 'Small', managerUserIds: [MGR_OTHER_A] })
    const day = Timestamp.fromDate(new Date('2026-11-02T00:00:00Z'))
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'k-proj'), { operativeId: OP_B, projectId: 'OTHER-R2', jobCollection: 'projects', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'k-sw'), { operativeId: OP_B, projectId: 'SW-111', jobCollection: 'smallWorks', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'k-none'), { operativeId: OP_B, projectId: 'OTHER-R2', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'managerSiteBookings', 'k-msb-sw'), { userId: MGR_OTHER_A, locationType: 'small_work', locationId: 'SW-111', jobCollection: 'smallWorks', date: day })
    await setDoc(doc(db, 'organizations', ORG_A, 'subcontractorBookings', 'k-sub-proj'), { subcontractorId: 'SUB', projectId: 'OTHER-R2', jobCollection: 'projects', date: day })
  })
}

test('1.11.0 / 1.33.0 reads by kind: every manager reads every booking, with or without jobCollection; operatives never list', async () => {
  await seed111()
  const swOnly = await authDb(MGR_SW_ONLY_A, 'swonly@test.com')
  for (const id of ['k-sw', 'k-proj', 'k-none']) await assertSucceeds(getDoc(doc(swOnly, 'organizations', ORG_A, 'bookings', id)))
  await assertSucceeds(getDoc(doc(swOnly, 'organizations', ORG_A, 'managerSiteBookings', 'k-msb-sw')))
  await assertSucceeds(getDoc(doc(swOnly, 'organizations', ORG_A, 'subcontractorBookings', 'k-sub-proj')))
  const sw = await assertSucceeds(getDocs(query(colA(swOnly, 'bookings'), where('jobCollection', '==', 'smallWorks'))))
  assert.deepEqual(sw.docs.map((d) => d.id), ['k-sw'])
  await assertSucceeds(getDocs(query(colA(swOnly, 'bookings'), where('jobCollection', '==', 'projects'))))
  await assertSucceeds(getDoc(doc(await authDb(MGR_PROJ_ONLY_A, 'projonly@test.com'), 'organizations', ORG_A, 'bookings', 'k-none')))
  await assertSucceeds(getDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'bookings', 'k-none')))
  // An operative never lists by kind.
  await assertFails(getDocs(query(colA(await authDb(OP_A, 'op-a@test.com'), 'bookings'), where('jobCollection', '==', 'projects'))))
})

test('1.11.0 writes: jobCollection must name the kind of a job the manager manages; a toggle does not extend writes', async () => {
  await seed111()
  const mgr = await authDb(MGR_JOB_A, 'mgr-job-a@test.com')
  const base = { operativeId: OP_B, status: 'Confirmed', timeSlot: 'FULL DAY' }
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'jc-ok'), { ...base, projectId: 'JOB-R2', jobCollection: 'projects' }))
  // The wrong kind for the job, or an unknown kind, is refused.
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'jc-wrong'), { ...base, projectId: 'JOB-R2', jobCollection: 'smallWorks' }))
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'jc-bad'), { ...base, projectId: 'JOB-R2', jobCollection: 'tasks' }))
  // Small works by kind, any id spelling.
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_A, 'subcontractorBookings', 'jc-sw'), { subcontractorId: 'SUB', projectId: 'Sw-Mix', jobCollection: 'smallWorks' }))
  // A manager site booking with no job never carries jobCollection.
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'jc-office'), { userId: MGR_JOB_A, locationType: 'office', jobCollection: 'projects' }))
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_A, 'managerSiteBookings', 'jc-office-ok'), { userId: MGR_JOB_A, locationType: 'office' }))
  // Editing an older booking adds jobCollection.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'bookings', 'jc-old'), { ...base, projectId: 'JOB-R2' })
  })
  await assertSucceeds(updateDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'jc-old'), { jobCollection: 'projects', notes: 'x' }))
  await assertFails(updateDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'jc-old'), { jobCollection: 'smallWorks' }))
  // A toggle manager who does not manage the job cannot write its bookings.
  await assertFails(setDoc(doc(await authDb(MGR_PROJ_ONLY_A, 'projonly@test.com'), 'organizations', ORG_A, 'bookings', 'jc-toggle'), { ...base, projectId: 'OTHER-R2', jobCollection: 'projects' }))
  // Admins write any booking.
  await assertSucceeds(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'bookings', 'jc-admin'), { ...base, projectId: 'OTHER-R2', jobCollection: 'projects' }))
})

test('1.11.0 invites: accepting a genuine unused invitation writes exactly its membership and role in company B — nothing more', async () => {
  const JOINER = 'joiner-a'
  const email = 'joiner@test.com'
  const perms = { manager: true, projects: true, smallWorks: false, operatives: false }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', JOINER), { email, organizationId: ORG_A, role: 'operative', operativeMode: true, passwordSet: true })
    await setDoc(doc(db, 'invitations', 'inv-111'), { email, organizationId: ORG_B, role: 'manager', permissions: perms, invitedBy: ADMIN_B, isUsed: false })
    await setDoc(doc(db, 'invitations', 'inv-111-used'), { email, organizationId: ORG_B, role: 'admin', permissions: { adminAccess: true }, invitedBy: ADMIN_B, isUsed: true })
    await setDoc(doc(db, 'invitations', 'inv-111-other'), { email: 'someone@test.com', organizationId: ORG_B, role: 'admin', permissions: { adminAccess: true }, invitedBy: ADMIN_B, isUsed: false })
  })
  const db = await authDb(JOINER, email)
  const membership = (invitationId: string, overrides: Record<string, unknown> = {}) => ({
    organizationId: ORG_B,
    role: 'manager',
    status: 'active',
    isSuperAdmin: false,
    accountActive: true,
    permissions: perms,
    invitationId,
    invitedBy: ADMIN_B,
    invitedAt: Timestamp.now(),
    acceptedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  })
  const accept = (invitationId: string, member: Record<string, unknown>, role: string, markUsed = true) => {
    const batch = writeBatch(db)
    batch.set(doc(db, 'users', JOINER, 'orgMemberships', ORG_B), member)
    batch.update(doc(db, 'organizations', ORG_B), { [`members.${JOINER}`]: role })
    if (markUsed) batch.update(doc(db, 'invitations', invitationId), { isUsed: true, usedAt: Timestamp.now() })
    return batch.commit()
  }
  // More than the invitation gives: a higher role, other permissions, super admin — refused.
  await assertFails(accept('inv-111', membership('inv-111', { role: 'admin' }), 'admin'))
  await assertFails(accept('inv-111', membership('inv-111'), 'admin'))
  await assertFails(accept('inv-111', membership('inv-111', { permissions: { ...perms, operatives: true } }), 'manager'))
  await assertFails(accept('inv-111', membership('inv-111', { isSuperAdmin: true }), 'manager'))
  await assertFails(accept('inv-111', membership('inv-111', { extra: true }), 'manager'))
  // Not marked used in the same batch, a used invitation, or another person's invitation — refused.
  await assertFails(accept('inv-111', membership('inv-111'), 'manager', false))
  await assertFails(accept('inv-111-used', membership('inv-111-used', { role: 'admin', permissions: { adminAccess: true } }), 'admin'))
  await assertFails(accept('inv-111-other', membership('inv-111-other', { role: 'admin', permissions: { adminAccess: true } }), 'admin'))
  // Exactly the invitation: accepted.
  await assertSucceeds(accept('inv-111', membership('inv-111'), 'manager'))
  let org: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    org = (await getDoc(doc(ctx.firestore(), 'organizations', ORG_B))).data()
  })
  assert.equal((org?.members as Record<string, string> | undefined)?.[JOINER], 'manager')
  // The invitation is now used: the same accept cannot run again, and they cannot raise their role afterwards.
  await assertFails(updateDoc(doc(db, 'organizations', ORG_B), { [`members.${JOINER}`]: 'admin' }))
  await assertFails(updateDoc(doc(db, 'users', JOINER, 'orgMemberships', ORG_B), { role: 'admin' }))
  await assertFails(updateDoc(doc(db, 'users', JOINER, 'orgMemberships', ORG_B), { 'permissions.operatives': true }))
  // As a manager in B they read every job there (1.33.0: every manager reads every job; toggles govern writes only).
  // 1.32.4: after the token refresh the claims marker triggers (a fresh context).
  const joined = await authDb(JOINER, email)
  await assertSucceeds(getDocs(collection(joined, 'organizations', ORG_B, 'projects')))
  await assertSucceeds(getDocs(collection(joined, 'organizations', ORG_B, 'smallWorks')))
})

test('1.11.0 levels: an admin with a stray operative-mode flag is an admin in the rules (no operative mode)', async () => {
  await seed111()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'admin-stray-op'), {
      email: 'admin-stray@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, operativeMode: true,
    })
  })
  const db = await authDb('admin-stray-op', 'admin-stray@test.com')
  await assertSucceeds(getDocs(colA(db, 'bookings')))
  await assertSucceeds(getDocs(colA(db, 'smallWorks')))
})

test('1.11.0 accountTypeChangeWrites: an admin or super admin writes the users doc, members entry and membership; nobody else', async () => {
  const TARGET = 'type-target-a'
  const SUPER = 'super-a-111'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', TARGET), { email: 'type-target@test.com', organizationId: ORG_A, role: 'manager', manager: true, permissions: { manager: true } })
    await setDoc(doc(db, 'users', SUPER), { email: 'super-a@test.com', organizationId: ORG_A, role: 'admin', isSuperAdmin: true, adminAccess: true })
    await setDoc(doc(db, 'users', 'type-other-co'), { email: 'other-co@test.com', organizationId: ORG_B, role: 'manager', manager: true })
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${TARGET}`]: 'manager', [`members.${SUPER}`]: 'admin', 'members.type-other-co': 'manager' })
  })
  const change = (db: Awaited<ReturnType<typeof authDb>>, uid: string, role: string) => {
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', uid), { role, adminAccess: role === 'admin', manager: role !== 'operative', operativeMode: role === 'operative', 'permissions.adminAccess': role === 'admin' })
    batch.update(doc(db, 'organizations', ORG_A), { [`members.${uid}`]: role })
    batch.set(doc(db, 'users', uid, 'orgMemberships', ORG_A), { organizationId: ORG_A, role, status: 'active', permissions: { adminAccess: role === 'admin' } })
    return batch.commit()
  }
  await assertSucceeds(change(await authDb(ADMIN_A, 'admin-a@test.com'), TARGET, 'admin'))
  await assertSucceeds(change(await authDb(SUPER, 'super-a@test.com'), TARGET, 'operative'))
  // A manager (even the person themself) cannot.
  await assertFails(change(await authDb(MGR_OTHER_A, 'manager-other-a@test.com'), TARGET, 'admin'))
  await assertFails(change(await authDb(TARGET, 'type-target@test.com'), TARGET, 'admin'))
  // An admin of company A cannot rewrite a profile that belongs to company B (accountTypeChangeWrites refuses it too).
  await assertFails(change(await authDb(ADMIN_A, 'admin-a@test.com'), 'type-other-co', 'admin'))
})

test('1.11.0 roster: a co-member reads a member or the creator whose users document names another company; nobody else does', async () => {
  const ROAMER = 'roamer-111'
  const CREATOR_ELSEWHERE = 'creator-elsewhere-111'
  const ORG_X = 'org-x-111'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_X), { name: 'X', members: { 'x-member': 'manager', [ROAMER]: 'admin' }, creatorUserId: CREATOR_ELSEWHERE })
    await setDoc(doc(db, 'users', 'x-member'), { email: 'x-member@test.com', organizationId: ORG_X, role: 'manager', manager: true })
    await setDoc(doc(db, 'users', ROAMER), { email: 'roamer@test.com', organizationId: ORG_B, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'users', CREATOR_ELSEWHERE), { email: 'creator-elsewhere@test.com', organizationId: `organizations/${ORG_B}`, isSuperAdmin: true })
  })
  const member = await authDb('x-member', 'x-member@test.com')
  await assertSucceeds(getDoc(doc(member, 'users', ROAMER)))
  await assertSucceeds(getDoc(doc(member, 'users', CREATOR_ELSEWHERE)))
  // Someone who is not anchored on X (company B's operative) stays unreadable to X's members.
  await assertFails(getDoc(doc(member, 'users', OP_B)))
  // A member of A does not read X's anchored people.
  await assertFails(getDoc(doc(await authDb(OP_A, 'op-a@test.com'), 'users', ROAMER)))
})

test('1.11.0 accountTypeChangeWrites for a profile of another company: an admin writes members and the membership only', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'type-other-co-2'), { email: 'other-co-2@test.com', organizationId: ORG_B, role: 'manager', manager: true })
    await updateDoc(doc(db, 'organizations', ORG_A), { 'members.type-other-co-2': 'manager' })
  })
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const batch = writeBatch(admin)
  batch.update(doc(admin, 'organizations', ORG_A), { 'members.type-other-co-2': 'admin' })
  batch.set(doc(admin, 'users', 'type-other-co-2', 'orgMemberships', ORG_A), { organizationId: ORG_A, role: 'admin', status: 'active', permissions: { adminAccess: true } })
  await assertSucceeds(batch.commit())
  await assertFails(updateDoc(doc(admin, 'users', 'type-other-co-2'), { role: 'admin' }))
})

// ---------------------------------------------------------------------------
// Rulebook 1.12.0: security hardening. Each test starts from a probe that proved a hole on the 1.11.0 rules
// (scratchpad probe.test.ts / probe2.test.ts) and now refuses the bad write, then checks the app paths that must
// keep working.
// ---------------------------------------------------------------------------

const ORG_H = 'org-h-112'
const ORG_H2 = 'org-h2-112'
const H_SA = 'h-super-admin'
const H_AD = 'h-admin'
const H_MGR_OPS = 'h-mgr-ops'
const H_MGR = 'h-mgr'
const H_MGR2 = 'h-mgr2'
const H_OP = 'h-op'
const H_OP2 = 'h-op2'
const H_OP3 = 'h-op3'
const H_INACTIVE = 'h-inactive'
const H_ROAM_OFF = 'h-roamer-deactivated'
const OWNER_EMAIL = 'info@projectplanner.us'

async function verifiedDb(uid: string, email: string, emailVerified: boolean) {
  return (await claimsContext(env, uid, { email, email_verified: emailVerified })).firestore()
}

async function seed112() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_H), {
      name: 'H',
      creatorUserId: H_SA,
      members: {
        [H_SA]: 'admin', [H_AD]: 'admin', [H_MGR_OPS]: 'manager', [H_MGR]: 'manager', [H_MGR2]: 'manager',
        [H_OP]: 'member', [H_OP2]: 'member', [H_OP3]: 'member', [H_INACTIVE]: 'member', [H_ROAM_OFF]: 'manager',
      },
    })
    await setDoc(doc(db, 'organizations', ORG_H2), { name: 'H2', creatorUserId: 'h2-admin', members: { 'h2-admin': 'admin' } })
    await setDoc(doc(db, 'users', 'h2-admin'), { email: 'h2-admin@test.com', organizationId: ORG_H2, role: 'admin', adminAccess: true, dayRate: 300 })
    await setDoc(doc(db, 'users', H_SA), { email: 'h-sa@test.com', organizationId: ORG_H, role: 'admin', adminAccess: true, isSuperAdmin: true })
    await setDoc(doc(db, 'users', H_AD), { email: 'h-ad@test.com', organizationId: ORG_H, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'users', H_MGR_OPS), {
      email: 'h-mgr-ops@test.com', organizationId: ORG_H, role: 'manager', manager: true, operatives: true,
      permissions: { manager: true, operatives: true, operativeMode: false },
    })
    await setDoc(doc(db, 'users', H_MGR), { email: 'h-mgr@test.com', organizationId: ORG_H, role: 'manager', manager: true })
    await setDoc(doc(db, 'users', H_MGR2), { email: 'h-mgr2@test.com', organizationId: ORG_H, role: 'manager', manager: true })
    await setDoc(doc(db, 'users', H_OP), {
      email: 'h-op@test.com', organizationId: ORG_H, role: 'operative', operativeMode: true, assignedManagerUserIds: [H_MGR_OPS], dayRate: 150,
    })
    await setDoc(doc(db, 'users', H_OP2), {
      email: 'h-op2@test.com', organizationId: ORG_H, role: 'operative', operativeMode: true, assignedManagerUserIds: [H_MGR_OPS], dayRate: 180,
    })
    await setDoc(doc(db, 'users', H_OP3), {
      email: 'h-op3@test.com', organizationId: ORG_H, role: 'operative', operativeMode: true, assignedManagerUserIds: [H_MGR2],
    })
    await setDoc(doc(db, 'users', H_INACTIVE), {
      email: 'h-inactive@test.com', organizationId: ORG_H, role: 'operative', operativeMode: true, isActive: false,
    })
    // Home company is H2; a manager in H whose H membership is deactivated.
    await setDoc(doc(db, 'users', H_ROAM_OFF), { email: 'h-roam@test.com', organizationId: ORG_H2, role: 'operative', operativeMode: true })
    await setDoc(doc(db, 'users', H_ROAM_OFF, 'orgMemberships', ORG_H), { organizationId: ORG_H, role: 'manager', accountActive: false })
    await setDoc(doc(db, 'organizations', ORG_H, 'settings', `timesheet_${H_OP2}_1000`), { userId: H_OP2, expenseEntries: [{ amount: 5 }] })
    await setDoc(doc(db, 'organizations', ORG_H, 'bookings', 'h-bk-op2'), { operativeId: H_OP2, projectId: 'h-p1', date: '2026-11-03' })
    await setDoc(doc(db, 'organizations', ORG_H, 'managers', 'h-row-mgr2'), { email: 'h-mgr2@test.com', name: 'M2' })
    await setDoc(doc(db, 'organizations', ORG_H, 'operatives', 'h-row-op'), { email: 'h-op@test.com', name: 'Op' })
    await setDoc(doc(db, 'organizations', ORG_H, 'operatives', 'h-row-op2'), { email: 'h-op2@test.com', name: 'Op2' })
    await setDoc(doc(db, 'organizations', ORG_H, 'projects', 'h-p1'), { name: 'P1', managerId: 'h-row-mgr2' })
    await setDoc(doc(db, 'invitations', 'h-admin-invite'), {
      organizationId: ORG_H, email: 'later@test.com', role: 'admin', permissions: { adminAccess: true }, isUsed: false,
    })
    await setDoc(doc(db, 'invitations', 'h-op-invite'), {
      organizationId: ORG_H, email: 'op-later@test.com', role: 'operative', permissions: { operativeMode: true, siteAudit: true }, isUsed: false,
      invitedBy: H_MGR_OPS,
    })
    await setDoc(doc(db, 'accountConfirmations', 'h-confirm'), { userId: 'h-founder', email: 'h-founder@test.com', organizationId: ORG_H2, isUsed: false })
  })
}

test('1.12.0 B1: changing your own users email never makes you platform owner; only a verified owner token is', async () => {
  await seed112()
  const op = await authDb(H_OP, 'h-op@test.com')
  // Probe P1: the email write is refused, and another company stays closed.
  await assertFails(updateDoc(doc(op, 'users', H_OP), { email: OWNER_EMAIL }))
  await assertFails(updateDoc(doc(op, 'users', H_OP), { email: 'someone-else@test.com' }))
  await assertFails(getDoc(doc(op, 'organizations', ORG_H2)))
  await assertFails(updateDoc(doc(op, 'users', 'h2-admin'), { dayRate: 1 }))
  // Even with the owner email already on the users document (written by an older rule), the users document is not read.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', H_OP3), { email: OWNER_EMAIL })
  })
  await assertFails(getDoc(doc(await authDb(H_OP3, 'h-op3@test.com'), 'organizations', ORG_H2)))
  // The owner's token: verified opens it, unverified does not.
  await assertFails(getDoc(doc(await verifiedDb('owner-unverified', OWNER_EMAIL, false), 'organizations', ORG_H2)))
  await assertSucceeds(getDoc(doc(await verifiedDb('owner-verified', OWNER_EMAIL, true), 'organizations', ORG_H2)))
  // The sign-in email sync after Firebase Auth changed the address: the users email may become the token email.
  await assertSucceeds(updateDoc(doc(await authDb(H_OP, 'h-op-new@test.com'), 'users', H_OP), { email: 'h-op-new@test.com' }))
  // Admins still change a person's email from Manage Users.
  await assertSucceeds(updateDoc(doc(await authDb(H_AD, 'h-ad@test.com'), 'users', H_OP2), { email: 'h-op2-new@test.com' }))
})

test('1.12.0 B2: a manager with operatives access invites operatives only; admins invite any level', async () => {
  await seed112()
  const mgr = await authDb(H_MGR_OPS, 'h-mgr-ops@test.com')
  // Probe P4: an admin invitation from a manager is refused, as role or as permissions.
  await assertFails(setDoc(doc(mgr, 'invitations', 'h-evil'), {
    organizationId: ORG_H, email: 'sock@test.com', role: 'admin', permissions: { adminAccess: true }, isUsed: false,
  }))
  await assertFails(setDoc(doc(mgr, 'invitations', 'h-evil2'), {
    organizationId: ORG_H, email: 'sock@test.com', permissions: { adminAccess: true }, isUsed: false,
  }))
  await assertFails(setDoc(doc(mgr, 'invitations', 'h-evil3'), {
    organizationId: ORG_H, email: 'sock@test.com', role: 'manager', permissions: { manager: true }, isUsed: false,
  }))
  await assertFails(setDoc(doc(mgr, 'invitations', 'h-evil4'), {
    organizationId: ORG_H, email: 'sock@test.com', role: 'operative', permissions: { operativeMode: true, operatives: true }, isUsed: false,
  }))
  // Nor can they repoint an admin's invitation, or turn an operative invitation into an admin one.
  await assertFails(updateDoc(doc(mgr, 'invitations', 'h-admin-invite'), { email: 'sock@test.com' }))
  await assertFails(updateDoc(doc(mgr, 'invitations', 'h-op-invite'), { role: 'admin', permissions: { adminAccess: true } }))
  // An operative invitation as both apps write it (invitationCreateFields: role + permissions) passes.
  await assertSucceeds(setDoc(doc(mgr, 'invitations', 'h-op-ok'), {
    organizationId: ORG_H, email: 'new-op@test.com', role: 'operative',
    permissions: { operativeMode: true, siteAudit: true, projects: true, smallWorks: true, adminAccess: false, manager: false, operatives: false },
    isUsed: false, invitedBy: H_MGR_OPS,
  }))
  await assertSucceeds(updateDoc(doc(mgr, 'invitations', 'h-op-invite'), { firstName: 'Olly' }))
  await assertSucceeds(deleteDoc(doc(mgr, 'invitations', 'h-op-ok')))
  // Admins invite admins.
  await assertSucceeds(setDoc(doc(await authDb(H_AD, 'h-ad@test.com'), 'invitations', 'h-admin-ok'), {
    organizationId: ORG_H, email: 'new-admin@test.com', role: 'admin', permissions: { adminAccess: true }, isUsed: false,
  }))
})

test('1.12.0 B3: nobody adds alias ids to their own profile; reviews and bookings stay closed', async () => {
  await seed112()
  const op3 = await authDb(H_OP3, 'h-op3@test.com')
  // Probe P3: the self-update is refused and nothing opens.
  await assertFails(updateDoc(doc(op3, 'users', H_OP3), { formerUserIds: [H_MGR_OPS, H_OP2] }))
  await assertFails(updateDoc(doc(op3, 'users', H_OP3), { sameEmailUserIds: [H_OP2] }))
  await assertFails(getDoc(doc(op3, 'organizations', ORG_H, 'bookings', 'h-bk-op2')))
  await assertFails(updateDoc(doc(op3, 'organizations', ORG_H, 'settings', `timesheet_${H_OP2}_1000`), { managerSignedByUserId: H_OP3 }))
  // Deleting and re-creating your own profile is not a way round it (members-map returning member, Path 1).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_H, 'userEmails', 'h-op3@test.com'), { userId: H_OP3 })
  })
  // 1.31.1 (fourth review): nobody deletes their own users document; accounts are deleted through
  // /api/account/delete (service credentials). The document is removed with the rules off to test the re-create.
  await assertLogicalDeny(deleteDoc(doc(op3, 'users', H_OP3)))
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'users', H_OP3)) })
  const back = {
    email: 'h-op3@test.com', organizationId: ORG_H, role: 'operative', operativeMode: true,
    ageConfirmed: true, ageConfirmedYears: 16, ageConfirmedAt: Timestamp.now(),
  }
  await assertFails(setDoc(doc(op3, 'users', H_OP3), { ...back, formerUserIds: [H_MGR_OPS] }))
  await assertSucceeds(setDoc(doc(op3, 'users', H_OP3), back))
  // An unchanged resend still passes, and an admin still records an alias.
  await assertSucceeds(updateDoc(doc(op3, 'users', H_OP3), { firstName: 'Ola' }))
  await assertSucceeds(updateDoc(doc(await authDb(H_AD, 'h-ad@test.com'), 'users', H_OP), { formerUserIds: ['OLD-INVITE-ID'] }))
  await assertSucceeds(updateDoc(doc(await authDb(H_OP, 'h-op@test.com'), 'users', H_OP), { firstName: 'Opal', formerUserIds: ['OLD-INVITE-ID'] }))
})

test('1.12.0 B3: alias ids on another company\'s users document do not count here', async () => {
  await seed112()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    // H2's admin, also listed as a member of H, wrote H operative ids onto their own (H2) profile.
    await updateDoc(doc(db, 'organizations', ORG_H), { 'members.h2-admin': 'member' })
    await updateDoc(doc(db, 'users', 'h2-admin'), { formerUserIds: [H_OP2] })
  })
  await assertFails(getDoc(doc(await authDb('h2-admin', 'h2-admin@test.com'), 'organizations', ORG_H, 'bookings', 'h-bk-op2')))
})

test('1.12.0 B4: only the Super Admin changes isSuperAdmin or ownership; an admin cannot demote the founder', async () => {
  await seed112()
  const ad = await authDb(H_AD, 'h-ad@test.com')
  // Probe Q1: each step is refused.
  await assertFails(updateDoc(doc(ad, 'users', H_AD), { isSuperAdmin: true }))
  await assertFails(updateDoc(doc(ad, 'organizations', ORG_H), { creatorUserId: H_AD }))
  await assertFails(updateDoc(doc(ad, 'users', H_SA), { isSuperAdmin: false, adminAccess: false, role: 'operative', operativeMode: true }))
  await assertFails(updateDoc(doc(ad, 'users', H_SA), { isActive: false }))
  await assertFails(setDoc(doc(ad, 'users', H_AD, 'orgMemberships', ORG_H), { organizationId: ORG_H, role: 'admin', isSuperAdmin: true }))
  // Nor by deleting and re-creating their own profile (founder bootstrap path or returning member).
  // 1.31.1 (fourth review): nobody deletes their own users document; accounts are deleted through
  // /api/account/delete (service credentials). The document is removed with the rules off to test the re-create.
  await assertLogicalDeny(deleteDoc(doc(ad, 'users', H_AD)))
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'users', H_AD)) })
  await assertFails(setDoc(doc(ad, 'users', H_AD), {
    email: 'h-ad@test.com', organizationId: ORG_H, role: 'admin', adminAccess: true, isSuperAdmin: true,
    ageConfirmed: true, ageConfirmedYears: 30, ageConfirmedAt: Timestamp.now(),
  }))
  await assertSucceeds(setDoc(doc(ad, 'users', H_AD), {
    email: 'h-ad@test.com', organizationId: ORG_H, role: 'admin', adminAccess: true,
    ageConfirmed: true, ageConfirmedYears: 30, ageConfirmedAt: Timestamp.now(),
  }))
  // Admins still edit the founder's name, and other people's roles.
  await assertSucceeds(updateDoc(doc(ad, 'users', H_SA), { firstName: 'Founder' }))
  await assertSucceeds(updateDoc(doc(ad, 'users', H_MGR), { role: 'operative', operativeMode: true }))
  // The Super Admin hands ownership to another admin (iOS transferOrganizationOwnership, web userStore transfer).
  const sa = await authDb(H_SA, 'h-sa@test.com')
  await assertSucceeds(updateDoc(doc(sa, 'users', H_AD), { isSuperAdmin: true }))
  await assertSucceeds(updateDoc(doc(sa, 'organizations', ORG_H), { creatorUserId: H_AD }))
  await assertSucceeds(updateDoc(doc(sa, 'users', H_SA), { isSuperAdmin: false }))
})

test('1.12.0 H2: a deactivated person reads only their own profile; organisation data is closed', async () => {
  await seed112()
  const off = await authDb(H_INACTIVE, 'h-inactive@test.com')
  // Probe Q2.
  await assertFails(getDoc(doc(off, 'organizations', ORG_H, 'settings', `timesheet_${H_OP2}_1000`)))
  await assertFails(setDoc(doc(off, 'organizations', ORG_H, 'clients', 'h-c'), { name: 'x' }))
  await assertFails(getDocs(collection(off, 'organizations', ORG_H, 'operatives')))
  await assertFails(getDoc(doc(off, 'users', H_OP)))
  // Their own profile and memberships stay readable (the deactivated screen and Switch organisation).
  await assertSucceeds(getDoc(doc(off, 'users', H_INACTIVE)))
  await assertSucceeds(getDocs(collection(off, 'users', H_INACTIVE, 'orgMemberships')))
  // A member from another company whose membership here is deactivated: no role here either.
  const roam = await authDb(H_ROAM_OFF, 'h-roam@test.com')
  await assertFails(getDoc(doc(roam, 'organizations', ORG_H, 'operatives', 'h-row-op')))
  await assertFails(getDoc(doc(roam, 'organizations', ORG_H, 'projects', 'h-p1')))
  // Active people are unaffected.
  await assertSucceeds(getDoc(doc(await authDb(H_OP, 'h-op@test.com'), 'organizations', ORG_H, 'operatives', 'h-row-op')))
})

test('1.12.0 H3: roster row emails change only by admins (operatives rows: also operatives managers, not their own)', async () => {
  await seed112()
  const mgr = await authDb(H_MGR, 'h-mgr@test.com')
  // Probe P5: rewriting another manager's row email is refused, so the job stays theirs.
  await assertFails(updateDoc(doc(mgr, 'organizations', ORG_H, 'managers', 'h-row-mgr2'), { email: 'h-mgr@test.com' }))
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_H, 'bookings', 'h-new1'), { projectId: 'h-p1', operativeId: H_OP, date: '2026-11-04' }))
  // Probe P8 (roster part): operatives never add or repoint a row.
  const op2 = await authDb(H_OP2, 'h-op2@test.com')
  await assertFails(setDoc(doc(op2, 'organizations', ORG_H, 'operatives', 'h-orow'), { email: 'h-op2@test.com', name: 'x' }))
  await assertFails(updateDoc(doc(op2, 'organizations', ORG_H, 'operatives', 'h-row-op'), { email: 'h-op2@test.com' }))
  // An operative still saves their own row's qualification maps (iOS My Qualifications).
  await assertSucceeds(setDoc(doc(op2, 'organizations', ORG_H, 'operatives', 'h-row-op2'), {
    qualifications: [{ id: 'q1', name: 'CSCS' }], qualificationExpiryDates: {}, updatedAt: Timestamp.now(),
  }, { merge: true }))
  // A job form adds a managers row for the manager it names (web ProjectForm), name edits pass.
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_H, 'managers', 'h-row-new'), { email: 'h-mgr2@test.com', firstName: 'M', lastName: '2' }))
  await assertSucceeds(updateDoc(doc(mgr, 'organizations', ORG_H, 'managers', 'h-row-mgr2'), { name: 'M Two' }))
  // Admins change a managers row email (iOS updateManagerIdentityInPlace); operatives managers an operative's row.
  await assertSucceeds(updateDoc(doc(await authDb(H_AD, 'h-ad@test.com'), 'organizations', ORG_H, 'managers', 'h-row-mgr2'), { email: 'h-mgr2-new@test.com' }))
  const mops = await authDb(H_MGR_OPS, 'h-mgr-ops@test.com')
  await assertSucceeds(updateDoc(doc(mops, 'organizations', ORG_H, 'operatives', 'h-row-op'), { email: 'h-op-new@test.com' }))
  await assertFails(updateDoc(doc(mops, 'organizations', ORG_H, 'operatives', 'h-row-op2'), { email: 'h-mgr-ops@test.com' }))
  await assertFails(updateDoc(doc(mops, 'organizations', ORG_H, 'managers', 'h-row-new'), { email: 'h-mgr-ops@test.com' }))
})

test('1.12.0 H4: inbox rows go only to members of the organisation, never without a userId', async () => {
  await seed112()
  // Probe P6: a stranger's own company cannot address someone elsewhere.
  const x = await authDb('h-stranger', 'h-stranger@test.com')
  await assertSucceeds(setDoc(doc(x, 'organizations', 'h-evil-org'), { name: 'E', members: { 'h-stranger': 'admin' }, creatorUserId: 'h-stranger' }))
  await assertFails(setDoc(doc(x, 'organizations', 'h-evil-org', 'notifications', 'n1'), {
    userId: H_OP, type: 'push_test', title: 'Reset your password', message: 'go to evil.example', actorUserId: 'h-stranger',
  }))
  const mgr = await authDb(H_MGR, 'h-mgr@test.com')
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_H, 'notifications', 'n-out'), { userId: 'h2-admin', type: 'task_created', actorUserId: H_MGR }))
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_H, 'notifications', 'n-none'), { type: 'booking_created', actorUserId: H_MGR }))
  // Members are addressed as before: by members key, creator, or a users document of this company.
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_H, 'notifications', 'n-in'), { userId: H_OP, type: 'task_created', actorUserId: H_MGR, isRead: false }))
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_H, 'notifications', 'n-sa'), { userId: H_SA, type: 'client_created', actorUserId: H_MGR, isRead: false }))
  // 1.32.4: the founder's token carries the new company after the refresh the claims marker triggers (a fresh context).
  const founder = await authDb('h-stranger', 'h-stranger@test.com')
  await assertSucceeds(setDoc(doc(founder, 'organizations', 'h-evil-org', 'notifications', 'n-self'), { userId: 'h-stranger', type: 'push_test', actorUserId: 'h-stranger' }))
})

test('1.12.0 H5: account confirmations are never listed and are marked used only by the signed-in owner of the email', async () => {
  await seed112()
  // Probe P7.
  await assertFails(getDocs(collection(await authDb('h-s2', 'h-s2@test.com'), 'accountConfirmations')))
  // Get by id (the emailed token) still works signed out.
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'accountConfirmations', 'h-confirm')))
  const used = { isUsed: true, usedAt: Timestamp.now() }
  await assertFails(updateDoc(doc(env.unauthenticatedContext().firestore(), 'accountConfirmations', 'h-confirm'), used))
  await assertFails(updateDoc(doc(await authDb('h-s2', 'h-s2@test.com'), 'accountConfirmations', 'h-confirm'), used))
  await assertSucceeds(updateDoc(doc(await authDb('h-founder', 'H-Founder@test.com'), 'accountConfirmations', 'h-confirm'), used))
  // A confirmation is created by the founder for themselves only.
  await assertFails(setDoc(doc(await authDb('h-s2', 'h-s2@test.com'), 'accountConfirmations', 'h-forged'), { userId: 'h-founder', email: 'h-founder@test.com', isUsed: false }))
  await assertSucceeds(setDoc(doc(await authDb('h-s2', 'h-s2@test.com'), 'accountConfirmations', 'h-own'), { userId: 'h-s2', email: 'h-s2@test.com', isUsed: false }))
})

test('1.12.0 M3: the qualification and skills catalogues are staff only', async () => {
  await seed112()
  const op2 = await authDb(H_OP2, 'h-op2@test.com')
  // Probe P8 (catalogue part).
  await assertFails(setDoc(doc(op2, 'organizations', ORG_H, 'qualifications', 'q1'), { userId: H_OP2, expiryDate: '2099-01-01' }))
  await assertFails(setDoc(doc(op2, 'organizations', ORG_H, 'skills', 's1'), { name: 'x' }))
  await assertSucceeds(getDoc(doc(op2, 'organizations', ORG_H, 'qualifications', 'q1')))
  const mgr = await authDb(H_MGR, 'h-mgr@test.com')
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_H, 'qualifications', 'q1'), { name: 'CSCS' }))
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG_H, 'skills', 's1'), { name: 'Joiner' }))
})

test('1.12.0 platformConfig/app: anyone reads it (the forced-update gate runs before sign-in); only the verified owner writes', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'platformConfig', 'app'), { minimumIosBuild: 120 }, { merge: true })
    await setDoc(doc(db, 'platformConfig', 'toolboxLibrary'), { items: [] })
  })
  const signedOut = env.unauthenticatedContext().firestore()
  await assertSucceeds(getDoc(doc(signedOut, 'platformConfig', 'app')))
  await assertFails(getDoc(doc(signedOut, 'platformConfig', 'toolboxLibrary')))
  await assertSucceeds(getDoc(doc(await authDb(OP_A, 'op-a@test.com'), 'platformConfig', 'toolboxLibrary')))
  await assertFails(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'platformConfig', 'app'), { minimumIosBuild: 1 }))
  await assertFails(setDoc(doc(await verifiedDb('owner-unverified', OWNER_EMAIL, false), 'platformConfig', 'app'), { minimumIosBuild: 1 }))
  await assertSucceeds(setDoc(doc(await verifiedDb('owner-verified', OWNER_EMAIL, true), 'platformConfig', 'app'), { minimumIosBuild: 121 }, { merge: true }))
})

test('1.12.1 / 1.33.0 enforcedReads: absent or on, a manager without toggles reads every job and booking; operatives stay scoped', async () => {
  await seed112()
  const setSwitch = async (value: boolean | null) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      if (value == null) await deleteDoc(doc(db, 'platformConfig', 'app'))
      else await setDoc(doc(db, 'platformConfig', 'app'), { enforcedReads: value }, { merge: true })
    })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_H, 'smallWorks', 'h-sw1'), { name: 'SW1', managerUserIds: [H_MGR2] })
    await setDoc(doc(db, 'organizations', ORG_H, 'managerSiteBookings', 'h-msb1'), { userId: H_MGR2, locationType: 'office', date: '2026-11-03' })
    await setDoc(doc(db, 'organizations', ORG_H, 'subcontractorBookings', 'h-sub1'), { projectId: 'h-p1', date: '2026-11-03' })
  })
  // H_MGR manages nothing and has no Projects / Small works toggle.
  const mgr = await authDb(H_MGR, 'h-mgr@test.com')
  const reads = () => [
    getDoc(doc(mgr, 'organizations', ORG_H, 'projects', 'h-p1')),
    getDocs(collection(mgr, 'organizations', ORG_H, 'projects')),
    getDocs(collection(mgr, 'organizations', ORG_H, 'smallWorks')),
    getDoc(doc(mgr, 'organizations', ORG_H, 'bookings', 'h-bk-op2')),
    getDocs(collection(mgr, 'organizations', ORG_H, 'bookings')),
    getDocs(collection(mgr, 'organizations', ORG_H, 'managerSiteBookings')),
    getDocs(collection(mgr, 'organizations', ORG_H, 'subcontractorBookings')),
  ]
  try {
    for (const value of [null, false] as const) {
      await setSwitch(value)
      for (const read of reads()) await assertSucceeds(read)
      // Every 1.12.0 fix stays on: a deactivated person, another company and writes are unaffected by the switch.
      await assertFails(getDoc(doc(await authDb(H_INACTIVE, 'h-inactive@test.com'), 'organizations', ORG_H, 'bookings', 'h-bk-op2')))
      await assertFails(getDocs(collection(await authDb('h2-admin', 'h2-admin@test.com'), 'organizations', ORG_H, 'projects')))
      await assertFails(setDoc(doc(mgr, 'organizations', ORG_H, 'bookings', 'h-new-legacy'), { projectId: 'h-p1', operativeId: H_OP, date: '2026-11-04' }))
      await assertFails(updateDoc(doc(mgr, 'organizations', ORG_H, 'projects', 'h-p1'), { name: 'renamed' }))
    }
    await setSwitch(true)
    // 1.33.0 (owner decision 6 Nov): every manager reads every job and booking with the switch on too.
    for (const read of reads()) await assertSucceeds(read)
    await assertFails(getDocs(collection(await authDb(H_OP2, 'h-op2@test.com'), 'organizations', ORG_H, 'bookings')))
    await assertFails(getDocs(collection(await authDb(H_OP2, 'h-op2@test.com'), 'organizations', ORG_H, 'projects')))
    const mgr2 = await authDb(H_MGR2, 'h-mgr2@test.com')
    await assertSucceeds(getDoc(doc(mgr2, 'organizations', ORG_H, 'smallWorks', 'h-sw1')))
    await assertSucceeds(getDoc(doc(mgr2, 'organizations', ORG_H, 'projects', 'h-p1')))
  } finally {
    await setSwitch(true)
  }
})

// MARK: - Rulebook 1.13.0 (owner decisions round 4)

async function setPrivatePay(on: boolean) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platformConfig', 'app'), { privatePay: on }, { merge: true })
  })
}

test('1.13.0 Q1: payProfiles — the person, line managers, admins and operatives managers read; nobody else', async () => {
  await seedPayPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', PAY_OP), { userId: PAY_OP, dayRate: 200, payBasis: 'day' })
    await setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', PAY_MGR_OPS), { userId: PAY_MGR_OPS, dayRate: 300 })
    await setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', PAY_OP_ROW + '-solo'), { userId: PAY_OP_ROW + '-solo', dayRate: 150 })
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', PAY_OP_ROW + '-solo'), { email: 'solo@test.com', name: 'Solo', dayRate: 150 })
  })
  const ref = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'payProfiles', id)
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const colleague = await authDb(REPORT_A, 'report-a@test.com')
  const lm = await authDb(LM_A, 'lm-a@test.com')
  const mgrOps = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  const mgrOther = await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const outsider = await authDb(ADMIN_B, 'admin-b@test.com')

  await assertSucceeds(getDoc(ref(op, PAY_OP)))
  await assertFails(getDoc(ref(colleague, PAY_OP)))
  await assertSucceeds(getDoc(ref(lm, PAY_OP)))
  await assertSucceeds(getDoc(ref(mgrOps, PAY_OP)))
  await assertFails(getDoc(ref(mgrOps, LM_A)))
  await assertFails(getDoc(ref(mgrOther, PAY_OP)))
  await assertSucceeds(getDoc(ref(admin, PAY_MGR_OPS)))
  await assertFails(getDoc(ref(outsider, PAY_OP)))
  await assertFails(getDoc(ref(op, PAY_MGR_OPS)))
  // A catalogue operative's profile: admins and operatives managers.
  await assertSucceeds(getDoc(ref(mgrOps, PAY_OP_ROW + '-solo')))
  await assertFails(getDoc(ref(colleague, PAY_OP_ROW + '-solo')))
  // Whole collection: admins only.
  await assertSucceeds(getDocs(collection(admin, 'organizations', ORG_A, 'payProfiles')))
  await assertFails(getDocs(collection(lm, 'organizations', ORG_A, 'payProfiles')))

  // Writes: who may change pay (canChangePayOf); never the person; only pay keys.
  await assertFails(setDoc(ref(op, PAY_OP), { userId: PAY_OP, dayRate: 999 }, { merge: true }))
  await assertSucceeds(setDoc(ref(mgrOps, PAY_OP), { userId: PAY_OP, dayRate: 210, updatedAt: serverTimestamp(), updatedBy: PAY_MGR_OPS, updatedFrom: 'web' }, { merge: true }))
  await assertFails(setDoc(ref(mgrOps, PAY_MGR_OPS), { userId: PAY_MGR_OPS, dayRate: 999 }, { merge: true }))
  await assertSucceeds(setDoc(ref(admin, PAY_MGR_OPS), { userId: PAY_MGR_OPS, hourlyRate: 40, payBasis: 'hourly', dayRate: deleteField() }, { merge: true }))
  await assertFails(setDoc(ref(admin, PAY_MGR_OPS), { userId: PAY_MGR_OPS, firstName: 'x' }, { merge: true }))
  await assertFails(setDoc(ref(admin, PAY_OP), { userId: 'someone-else', dayRate: 1 }, { merge: true }))
})

test('1.13.0 Q1: privatePay — history, operativeProfiles and timesheets are read only by pay viewers; no pay goes back on users', async () => {
  await seedPayPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', 'h113'), { userId: PAY_OP, dayRate: 200, effectiveAt: Timestamp.now() })
    await setDoc(doc(db, 'organizations', ORG_A, 'settings', `timesheet_${PAY_OP}_1`), { userId: PAY_OP, weekStartKey: 'k113' })
  })
  const colleague = await authDb(REPORT_A, 'report-a@test.com')
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const lm = await authDb(LM_A, 'lm-a@test.com')
  const mgrOps = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const history = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', 'h113')
  const sheet = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'settings', `timesheet_${PAY_OP}_1`)
  const mirror = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'operativeProfiles', PAY_OP)

  // Off (the default until the release that reads per person): every member reads, as before.
  await setPrivatePay(false)
  await assertSucceeds(getDoc(history(colleague)))
  await assertSucceeds(getDoc(sheet(colleague)))
  await assertSucceeds(getDoc(mirror(colleague)))

  await setPrivatePay(true)
  try {
    for (const db of [colleague]) {
      await assertFails(getDoc(history(db)))
      await assertFails(getDoc(sheet(db)))
      await assertFails(getDoc(mirror(db)))
    }
    for (const db of [op, lm, mgrOps, admin]) {
      await assertSucceeds(getDoc(history(db)))
      await assertSucceeds(getDoc(sheet(db)))
      await assertSucceeds(getDoc(mirror(db)))
    }
    // Queries: one person's rows by id; the whole collection for admins only.
    await assertSucceeds(getDocs(query(collection(op, 'organizations', ORG_A, 'operativeDayRateHistory'), where('userId', '==', PAY_OP))))
    await assertSucceeds(getDocs(query(collection(lm, 'organizations', ORG_A, 'operativeDayRateHistory'), where('userId', '==', PAY_OP))))
    await assertFails(getDocs(collection(lm, 'organizations', ORG_A, 'operativeDayRateHistory')))
    await assertSucceeds(getDocs(collection(admin, 'organizations', ORG_A, 'operativeDayRateHistory')))
    // No pay value goes back onto a users document or roster row; removing one is fine.
    await assertFails(updateDoc(doc(admin, 'users', PAY_OP), { dayRate: 250 }))
    await assertSucceeds(updateDoc(doc(admin, 'users', PAY_OP), { dayRate: deleteField() }))
    await assertSucceeds(updateDoc(doc(admin, 'users', PAY_OP), { firstName: 'Pat' }))
    await assertFails(updateDoc(doc(admin, 'organizations', ORG_A, 'operatives', PAY_OP_ROW), { dayRate: 260 }))
    await assertSucceeds(updateDoc(doc(admin, 'organizations', ORG_A, 'operatives', PAY_OP_ROW), { dayRate: deleteField() }))
  } finally {
    await setPrivatePay(false)
  }
})

test('1.13.0 Q3: a lapsed subscription closes the organisation data; the org document, own profile and memberships stay', async () => {
  await seedPayPeople()
  const lapsedOrg = 'org-lapsed-113'
  const lapsedAdmin = 'admin-lapsed-113'
  const lapsedOp = 'op-lapsed-113'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', lapsedOrg), {
      name: 'Lapsed', members: { [lapsedAdmin]: 'admin', [lapsedOp]: 'member' }, creatorUserId: lapsedAdmin,
      billing: { status: 'canceled', accessOpen: false },
    })
    await setDoc(doc(db, 'users', lapsedAdmin), { email: 'lapsed-admin@test.com', organizationId: lapsedOrg, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'users', lapsedOp), { email: 'lapsed-op@test.com', organizationId: lapsedOrg, role: 'operative', operativeMode: true })
    await setDoc(doc(db, 'users', lapsedOp, 'orgMemberships', lapsedOrg), { organizationId: lapsedOrg, role: 'member' })
    await setDoc(doc(db, 'organizations', lapsedOrg, 'clients', 'c1'), { name: 'Client' })
    await setDoc(doc(db, 'organizations', lapsedOrg, 'holidayBookings', 'h1'), { userId: lapsedOp, status: 'pending' })
    await setDoc(doc(db, 'organizations', lapsedOrg, 'projects', 'p1'), { name: 'Job' })
  })
  const admin = await authDb(lapsedAdmin, 'lapsed-admin@test.com')
  const op = await authDb(lapsedOp, 'lapsed-op@test.com')
  const c1 = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', lapsedOrg, 'clients', 'c1')

  // Closed: reads and writes of organisation data, for admins too.
  await assertFails(getDoc(c1(admin)))
  await assertFails(getDoc(c1(op)))
  await assertFails(setDoc(doc(admin, 'organizations', lapsedOrg, 'clients', 'c2'), { name: 'New' }))
  await assertFails(getDoc(doc(op, 'organizations', lapsedOrg, 'holidayBookings', 'h1')))
  await assertFails(getDoc(doc(admin, 'organizations', lapsedOrg, 'projects', 'p1')))
  await assertFails(getDoc(doc(op, 'users', lapsedAdmin)))
  // Open: the organisation document (billing status), the caller's own users document and memberships.
  await assertSucceeds(getDoc(doc(admin, 'organizations', lapsedOrg)))
  await assertSucceeds(getDoc(doc(op, 'organizations', lapsedOrg)))
  await assertSucceeds(getDoc(doc(op, 'users', lapsedOp)))
  await assertSucceeds(getDoc(doc(op, 'users', lapsedOp, 'orgMemberships', lapsedOrg)))
  // Billing stays server-only.
  await assertFails(updateDoc(doc(admin, 'organizations', lapsedOrg), { 'billing.accessOpen': true }))

  // The grace end passes without a Stripe event: closed from accessClosesAt.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', lapsedOrg), {
      billing: { status: 'past_due', accessOpen: true, accessClosesAt: Timestamp.fromMillis(Date.now() - 60_000) },
    })
  })
  await assertFails(getDoc(c1(admin)))
  // Renewed (or missing access fields, or no billing): open again — nothing was deleted.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', lapsedOrg), { billing: { status: 'active', accessOpen: true, accessClosesAt: null } })
  })
  await assertSucceeds(getDoc(c1(admin)))
  await assertSucceeds(getDoc(c1(op)))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', lapsedOrg), { billing: { status: 'pending' } })
  })
  await assertSucceeds(getDoc(c1(op)))
})

test('1.13.0 §14: a person moves their own email claim only after Auth changed and verified their email', async () => {
  const uid = 'email-mover-113'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', uid), { email: 'old-113@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true })
    await setDoc(doc(db, 'organizations', ORG_A), { members: { [uid]: 'member' } }, { merge: true })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'old-113@test.com'), { userId: uid })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'other-113@test.com'), { userId: 'someone-else' })
  })
  const before = (await claimsContext(env, uid, { email: 'old-113@test.com', email_verified: true })).firestore()
  // Same email in the token: the claim is current, cannot be deleted by the person; nor can the users email change.
  await assertFails(deleteDoc(doc(before, 'organizations', ORG_A, 'userEmails', 'old-113@test.com')))
  await assertFails(updateDoc(doc(before, 'users', uid), { email: 'new-113@test.com' }))
  const unverified = (await claimsContext(env, uid, { email: 'new-113@test.com', email_verified: false })).firestore()
  await assertFails(deleteDoc(doc(unverified, 'organizations', ORG_A, 'userEmails', 'old-113@test.com')))
  // After Auth changed it (verified): the signInEmailSyncWrites writes pass.
  const after = (await claimsContext(env, uid, { email: 'new-113@test.com', email_verified: true })).firestore()
  await assertSucceeds(updateDoc(doc(after, 'users', uid), { email: 'new-113@test.com' }))
  await assertSucceeds(setDoc(doc(after, 'organizations', ORG_A, 'userEmails', 'new-113@test.com'), { userId: uid }))
  await assertSucceeds(deleteDoc(doc(after, 'organizations', ORG_A, 'userEmails', 'old-113@test.com')))
  // Never someone else's claim.
  await assertFails(deleteDoc(doc(after, 'organizations', ORG_A, 'userEmails', 'other-113@test.com')))
})

test('1.13.0 Q4: a person cannot change their own start date', async () => {
  await seedLeaveAndTimesheetPeople()
  const db = await authDb(REPORT_A, 'report-a@test.com')
  await assertFails(updateDoc(doc(db, 'users', REPORT_A), { employmentStartDate: '2026-07-01' }))
  await assertSucceeds(updateDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', REPORT_A), { employmentStartDate: '2026-07-01' }))
})

// ---------------------------------------------------------------------------
// Rulebook 1.12.2: change user type admin -> manager by the Super Admin failed with "Missing or insufficient
// permissions". Web: the type batch landed, then the profile save's same-email users query (email only) was refused.
// iOS: `writeOrgMembership` reads the person's membership first, and only the person could read it.
// ---------------------------------------------------------------------------

const ORG_T = 'org-t-1122'
const T_SA = 't-founder'
const T_AD = 't-admin'
const T_AD2 = 't-admin-2'
const T_MGR = 't-manager'
const T_ALL_ON = {
  adminAccess: true, manager: true, operatives: true, skills: false, qualifications: true, materials: true,
  projects: true, smallWorks: true, operativeMode: false, siteAudit: true, subContractors: true,
  wholesalersOrderHistory: true, annualLeaveSelfBook: false, weeklyReports: true, dailyOverview: true,
}
function tAdminDoc(email: string, extra: Record<string, unknown> = {}) {
  return {
    email, organizationId: ORG_T, role: 'admin', ...T_ALL_ON, permissions: { ...T_ALL_ON }, isActive: true,
    passwordSet: true, firstName: email.split('@')[0], surname: 'Test', ...extra,
  }
}
async function seed1122() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_T), {
      name: 'T Co', creatorUserId: T_SA, billing: { status: 'active' },
      members: { [T_SA]: 'admin', [T_AD]: 'admin', [T_AD2]: 'admin', [T_MGR]: 'manager' },
    })
    await setDoc(doc(db, 'users', T_SA), tAdminDoc('t-sa@test.com', { isSuperAdmin: true }))
    await setDoc(doc(db, 'users', T_AD), tAdminDoc('t-ad@test.com', { assignedManagerUserIds: [T_SA] }))
    await setDoc(doc(db, 'users', T_AD2), tAdminDoc('t-ad2@test.com'))
    await setDoc(doc(db, 'users', T_MGR), {
      email: 't-mgr@test.com', organizationId: ORG_T, role: 'manager', manager: true, operatives: true,
      permissions: { manager: true, operatives: true }, isActive: true, assignedManagerUserIds: [T_SA],
    })
    for (const [uid, role, superAdmin] of [[T_SA, 'admin', true], [T_AD, 'admin', false], [T_AD2, 'admin', false], [T_MGR, 'manager', false]] as const) {
      await setDoc(doc(db, 'users', uid, 'orgMemberships', ORG_T), {
        organizationId: ORG_T, role, isSuperAdmin: superAdmin, status: 'active', accountActive: true,
        permissions: role === 'admin' ? { ...T_ALL_ON } : { manager: true, operatives: true },
      })
    }
  })
}
async function tStored(uid: string) {
  let out: { user: Record<string, unknown>; member: unknown; membership: Record<string, unknown> } | null = null
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const user = (await getDoc(doc(db, 'users', uid))).data() ?? {}
    const org = (await getDoc(doc(db, 'organizations', ORG_T))).data() ?? {}
    const membership = (await getDoc(doc(db, 'users', uid, 'orgMemberships', ORG_T))).data() ?? {}
    out = { user, member: (org.members as Record<string, unknown>)[uid], membership }
  })
  return out!
}
/** Web `userStore.changeAccountType` (1.12.2): the whole plan as one batch, the membership as a merge-set. */
function webChangeType(db: Awaited<ReturnType<typeof authDb>>, actor: string, person: Record<string, unknown> & { id: string }, kind: 'admin' | 'manager' | 'operative') {
  const plan = accountTypeChangeWrites({ person, kind, organizationId: ORG_T, roster: [] })
  if (!plan.ok) throw new Error(plan.message)
  const batch = writeBatch(db)
  for (const write of plan.writes) {
    const ref = doc(db, write.path)
    if (write.kind === 'membership') {
      batch.set(ref, { organizationId: ORG_T, role: write.role, permissions: { ...write.permissions }, updatedAt: serverTimestamp() }, { merge: true })
    } else {
      batch.update(ref, write.kind === 'userProfile' ? { ...write.fields, ...writeMetadataFields(actor, 'web'), updatedAt: serverTimestamp() } : write.fields)
    }
  }
  return batch.commit()
}
/** Web `saveUser` follow-ups after a profile save (1.12.2): the same-email query names the organisation. */
async function webSaveFollowUps(db: Awaited<ReturnType<typeof authDb>>, email: string) {
  await getDocs(query(collection(db, 'users'), where('organizationId', '==', ORG_T), where('email', '==', email)))
  await setDoc(doc(db, 'organizations', ORG_T, 'userEmails', email), { userId: email === 't-ad@test.com' ? T_AD : T_AD2 })
}
/** iOS `changeAccountType` (main 30b4df4): users patch, members entry, then the membership read + write. */
async function iosChangeType(db: Awaited<ReturnType<typeof authDb>>, actor: string, uid: string, role: 'manager' | 'admin') {
  const patch: Record<string, unknown> = { role, updatedAt: Timestamp.now() }
  for (const key of ['adminAccess', 'projects', 'smallWorks', 'weeklyReports', 'wholesalersOrderHistory']) {
    patch[key] = role === 'admin'
    patch[`permissions.${key}`] = role === 'admin'
  }
  await updateDoc(doc(db, 'users', uid), patch)
  await updateDoc(doc(db, 'organizations', ORG_T), { [`members.${uid}`]: role, updatedAt: serverTimestamp(), updatedBy: actor, updatedFrom: 'ios' })
  const ref = doc(db, 'users', uid, 'orgMemberships', ORG_T)
  const snap = await getDoc(ref)
  const write = orgMembershipWriteFields({
    organizationId: ORG_T, stored: snap.exists() ? snap.data() : null, writer: 'admin', now: serverTimestamp(),
    next: { role, permissions: { adminAccess: role === 'admin', manager: true, operatives: true } },
  })
  if (!write) return
  if (write.mode === 'create') await setDoc(ref, write.fields)
  else await updateDoc(ref, { ...write.fields, ...Object.fromEntries(write.remove.map((key) => [key, deleteField()])) })
}

test('1.12.2: the Super Admin changes an admin to manager (web payload): every document lands, the save follow-ups pass', async () => {
  await seed1122()
  const sa = await authDb(T_SA, 't-sa@test.com')
  const before = await tStored(T_AD)
  await assertSucceeds(webChangeType(sa, T_SA, { ...before.user, id: T_AD }, 'manager'))
  const after = await tStored(T_AD)
  assert.equal(after.user.role, 'manager')
  assert.equal(after.user.adminAccess, false)
  assert.equal(after.member, 'manager')
  assert.equal(after.membership.role, 'manager')
  assert.equal((after.membership.permissions as Record<string, unknown>).adminAccess, false)
  assert.equal(after.membership.status, 'active')
  await assertSucceeds(webSaveFollowUps(sa, 't-ad@test.com'))
  // The pre-1.12.2 query (email only) is what the rules refused: it cannot be proven readable for every match.
  await assertFails(getDocs(query(collection(sa, 'users'), where('email', '==', 't-ad@test.com'), limit(10))))
  // Double save: pressing Save again sends the same plan from the new state; it passes and changes nothing.
  await assertSucceeds(webChangeType(sa, T_SA, { ...after.user, id: T_AD }, 'manager'))
  await assertSucceeds(webSaveFollowUps(sa, 't-ad@test.com'))
  assert.equal((await tStored(T_AD)).member, 'manager')
})

test('1.12.2: the Super Admin changes an admin to manager (iOS payload): the membership read is allowed', async () => {
  await seed1122()
  const sa = await authDb(T_SA, 't-sa@test.com')
  await assertSucceeds(iosChangeType(sa, T_SA, T_AD, 'manager'))
  const after = await tStored(T_AD)
  assert.equal(after.user.role, 'manager')
  assert.equal(after.member, 'manager')
  assert.equal(after.membership.role, 'manager')
  // Older iOS builds (before #151 / #152) wrote only the users document: it passes and leaves members.{uid} admin
  // (accountTypeSyncState finds it; the next web save repairs it).
  await seed1122()
  await assertSucceeds(updateDoc(doc(sa, 'users', T_AD2), { role: 'manager', adminAccess: false, 'permissions.adminAccess': false, updatedAt: Timestamp.now() }))
  assert.equal((await tStored(T_AD2)).member, 'admin')
  await assertSucceeds(webChangeType(sa, T_SA, { ...(await tStored(T_AD2)).user, id: T_AD2 }, 'manager'))
  assert.equal((await tStored(T_AD2)).member, 'manager')
})

test('1.12.2: an admin (not the Super Admin) demotes another admin and promotes a manager; never the founder or themself', async () => {
  await seed1122()
  const ad = await authDb(T_AD, 't-ad@test.com')
  await assertSucceeds(webChangeType(ad, T_AD, { ...(await tStored(T_AD2)).user, id: T_AD2 }, 'manager'))
  await assertSucceeds(iosChangeType(ad, T_AD, T_MGR, 'admin'))
  assert.equal((await tStored(T_MGR)).member, 'admin')
  await seed1122()
  await assertSucceeds(webChangeType(ad, T_AD, { ...(await tStored(T_MGR)).user, id: T_MGR }, 'admin'))
  assert.equal((await tStored(T_MGR)).user.role, 'admin')
  // The founder (creator and Super Admin): refused by the plan (super_admin) and by the rules for a raw write.
  const founderPlan = accountTypeChangeWrites({ person: { ...tAdminDoc('t-sa@test.com', { isSuperAdmin: true }), id: T_SA }, kind: 'manager', organizationId: ORG_T })
  assert.equal(founderPlan.ok ? null : founderPlan.reason, 'super_admin')
  await assertFails(updateDoc(doc(ad, 'users', T_SA), { role: 'manager', adminAccess: false, 'permissions.adminAccess': false }))
  await assertFails(updateDoc(doc(ad, 'users', T_SA), { isSuperAdmin: false }))
  await assertFails(setDoc(doc(ad, 'users', T_SA, 'orgMemberships', ORG_T), { isSuperAdmin: false }, { merge: true }))
  // Self-promotion stays refused: a manager cannot make themself admin on any of the three documents.
  await seed1122()
  const mgr = await authDb(T_MGR, 't-mgr@test.com')
  await assertFails(updateDoc(doc(mgr, 'users', T_MGR), { role: 'admin', adminAccess: true, 'permissions.adminAccess': true }))
  await assertFails(updateDoc(doc(mgr, 'organizations', ORG_T), { [`members.${T_MGR}`]: 'admin' }))
  await assertFails(setDoc(doc(mgr, 'users', T_MGR, 'orgMemberships', ORG_T), { role: 'admin', permissions: { adminAccess: true } }, { merge: true }))
  // An admin cannot make themself Super Admin.
  await assertFails(updateDoc(doc(ad, 'users', T_AD), { isSuperAdmin: true }))
})

test('1.12.2: a membership is read by the person and the admins of that organisation only', async () => {
  await seed1122()
  await assertSucceeds(getDoc(doc(await authDb(T_AD, 't-ad@test.com'), 'users', T_MGR, 'orgMemberships', ORG_T)))
  await assertSucceeds(getDoc(doc(await authDb(T_MGR, 't-mgr@test.com'), 'users', T_MGR, 'orgMemberships', ORG_T)))
  // Another member who is not an admin, and an admin of another company, cannot.
  await assertFails(getDoc(doc(await authDb(T_MGR, 't-mgr@test.com'), 'users', T_AD, 'orgMemberships', ORG_T)))
  await assertFails(getDoc(doc(await authDb(ADMIN_B, 'admin-b@test.com'), 'users', T_MGR, 'orgMemberships', ORG_T)))
  // Listing someone else's memberships stays closed.
  await assertFails(getDocs(collection(await authDb(T_AD, 't-ad@test.com'), 'users', T_MGR, 'orgMemberships')))
})

test('1.15.0 §20: a scheduled organisation is locked; the super admin restores it; deletion is server-only otherwise', async () => {
  const org = 'org-deleted-115'
  const sa = 'sa-deleted-115'
  const admin = 'admin-deleted-115'
  const op = 'op-deleted-115'
  const scheduled = (restoreBy: string) => ({
    status: 'scheduled',
    requestedAt: Timestamp.now(),
    requestedBy: sa,
    eraseAfter: Timestamp.fromMillis(Date.now() + 60 * 86400000),
    restoreBy,
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', org), {
      name: 'Deleted Co', members: { [sa]: 'admin', [admin]: 'admin', [op]: 'operative' }, creatorUserId: sa,
      deletion: scheduled('super_admin'),
    })
    await setDoc(doc(db, 'users', sa), { email: 'sa-del@test.com', organizationId: org, role: 'admin', adminAccess: true, isSuperAdmin: true })
    await setDoc(doc(db, 'users', admin), { email: 'admin-del@test.com', organizationId: org, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'users', op), { email: 'op-del@test.com', organizationId: org, role: 'operative', operativeMode: true })
    await setDoc(doc(db, 'users', op, 'orgMemberships', org), { organizationId: org, role: 'operative' })
    await setDoc(doc(db, 'organizations', org, 'clients', 'c1'), { name: 'Client' })
  })
  const saDb = await authDb(sa, 'sa-del@test.com')
  const adminDb = await authDb(admin, 'admin-del@test.com')
  const opDb = await authDb(op, 'op-del@test.com')
  // Locked for everyone, the super admin included.
  await assertFails(getDoc(doc(saDb, 'organizations', org, 'clients', 'c1')))
  await assertFails(getDoc(doc(opDb, 'organizations', org, 'clients', 'c1')))
  await assertFails(setDoc(doc(adminDb, 'organizations', org, 'clients', 'c2'), { name: 'New' }))
  await assertFails(getDoc(doc(opDb, 'users', sa)))
  // Open: the organisation document, own users document and membership.
  await assertSucceeds(getDoc(doc(opDb, 'organizations', org)))
  await assertSucceeds(getDoc(doc(opDb, 'users', op)))
  await assertSucceeds(getDoc(doc(opDb, 'users', op, 'orgMemberships', org)))
  // No other edit of the organisation document while scheduled; an admin who is not the super admin cannot restore.
  await assertFails(updateDoc(doc(saDb, 'organizations', org), { name: 'Renamed' }))
  await assertFails(updateDoc(doc(adminDb, 'organizations', org), { deletion: deleteField() }))
  await assertFails(updateDoc(doc(saDb, 'organizations', org), { deletion: deleteField(), name: 'Sneaky' }))
  // The super admin restores (removes `deletion` only).
  await assertSucceeds(updateDoc(doc(saDb, 'organizations', org), { deletion: deleteField(), updatedBy: sa }))
  await assertSucceeds(getDoc(doc(opDb, 'organizations', org, 'clients', 'c1')))
  // An app never schedules a deletion (server only), not even the super admin.
  await assertFails(updateDoc(doc(saDb, 'organizations', org), { deletion: scheduled('super_admin') }))
  // Deleted with the last member's account: only the platform owner restores.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', org), { deletion: scheduled('platform_owner') })
  })
  await assertFails(updateDoc(doc(saDb, 'organizations', org), { deletion: deleteField() }))
})

test('1.15.0 canSendMaterialOrders: only admins and managers write material send records', async () => {
  const record = (id: string) => ({ id, projectId: 'job-1', requestType: 'Order', sentAt: Timestamp.now(), sentBy: 'X', recipients: [], lines: [] })
  await assertSucceeds(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'materialSendRecords', 'SEND-115-A'), record('SEND-115-A')))
  await assertFails(setDoc(doc(await authDb(OP_A, 'op-a@test.com'), 'organizations', ORG_A, 'materialSendRecords', 'SEND-115-O'), record('SEND-115-O')))
  await assertFails(setDoc(doc(await authDb(ADMIN_B, 'admin-b@test.com'), 'organizations', ORG_A, 'materialSendRecords', 'SEND-115-B'), record('SEND-115-B')))
})

async function step<T>(label: string, run: Promise<T>): Promise<T> {
  try {
    return await run
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// MARK: - Rulebook 1.26.0: the security switches, per organisation (platformConfig/app lists)

async function setSwitchConfig(fields: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platformConfig', 'app'), fields)
  })
}

test('1.26.0 enforcedReads per organisation: on only for listed companies; operatives read only their own bookings and jobs by id', async () => {
  await seed112()
  const mgr = await authDb(H_MGR, 'h-mgr@test.com')
  const op2 = await authDb(H_OP2, 'h-op2@test.com')
  const col = (db: Awaited<ReturnType<typeof authDb>>, name: string) => collection(db, 'organizations', ORG_H, name)
  try {
    // Off for this company (another company listed): reads as before 1.10.0.
    await setSwitchConfig({ enforcedReads: false, enforcedReadsOrganizationIds: [ORG_H2] })
    await assertSucceeds(getDocs(col(mgr, 'projects')))
    await assertSucceeds(getDocs(col(mgr, 'bookings')))
    await assertSucceeds(getDocs(col(op2, 'bookings')))
    await assertSucceeds(getDocs(col(op2, 'projects')))

    // On for this company only. 1.33.0: a manager still reads every job and booking; operatives are scoped.
    await setSwitchConfig({ enforcedReads: false, enforcedReadsOrganizationIds: [ORG_H] })
    await assertSucceeds(getDocs(col(mgr, 'projects')))
    await assertSucceeds(getDocs(col(mgr, 'bookings')))
    // An operative: their own bookings by id, never the whole collection or another person's booking.
    await assertSucceeds(getDocs(query(col(op2, 'bookings'), where('operativeId', 'in', [H_OP2]))))
    await assertSucceeds(getDoc(doc(op2, 'organizations', ORG_H, 'bookings', 'h-bk-op2')))
    await assertFails(getDocs(col(op2, 'bookings')))
    await assertFails(getDocs(query(col(op2, 'bookings'), where('operativeId', 'in', [H_OP3]))))
    // Jobs: by id only, never a list.
    await assertSucceeds(getDoc(doc(op2, 'organizations', ORG_H, 'projects', 'h-p1')))
    await assertFails(getDocs(col(op2, 'projects')))
    // Admins are unaffected.
    await assertSucceeds(getDocs(col(await authDb(H_AD, 'h-ad@test.com'), 'bookings')))
    await assertSucceeds(getDocs(col(await authDb(H_AD, 'h-ad@test.com'), 'projects')))

    // A list that is not a list, or a mistyped id, switches nothing on (operatives read every booking again).
    await setSwitchConfig({ enforcedReadsOrganizationIds: ORG_H })
    await assertSucceeds(getDocs(col(op2, 'bookings')))
    await setSwitchConfig({ enforcedReadsOrganizationIds: [ORG_H.toUpperCase()] })
    await assertSucceeds(getDocs(col(op2, 'bookings')))
  } finally {
    await setSwitchConfig({ enforcedReads: true })
  }
})

test('1.26.0 privatePay per organisation: a person reads their own pay; a colleague never reads it; no pay goes back on users', async () => {
  await seedPayPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', PAY_OP), { userId: PAY_OP, dayRate: 200, payBasis: 'day' })
    await setDoc(doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', 'h126'), { userId: PAY_OP, dayRate: 200, effectiveAt: Timestamp.now() })
    await setDoc(doc(db, 'organizations', ORG_A, 'settings', `timesheet_${PAY_OP}_126`), { userId: PAY_OP, weekStartKey: 'k126' })
  })
  const op = await authDb(PAY_OP, 'pay-op@test.com')
  const colleague = await authDb(REPORT_A, 'report-a@test.com')
  const mgrOther = await authDb(MGR_OTHER_A, 'mgr-other-a@test.com')
  const lm = await authDb(LM_A, 'lm-a@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const history = (db: Awaited<ReturnType<typeof authDb>>) => collection(db, 'organizations', ORG_A, 'operativeDayRateHistory')
  const settings = (db: Awaited<ReturnType<typeof authDb>>) => collection(db, 'organizations', ORG_A, 'settings')
  const payProfile = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'payProfiles', PAY_OP)
  try {
    for (const on of [false, true]) {
      await setSwitchConfig({ enforcedReads: true, privatePayOrganizationIds: on ? [ORG_A] : [ORG_B] })
      // The person reads their own pay, whatever the switch.
      await step('assertSucceeds#1', assertSucceeds(getDoc(payProfile(op))))
      await step('assertSucceeds#2', assertSucceeds(getDocs(query(history(op), where('userId', '==', PAY_OP)))))
      await step('assertSucceeds#3', assertSucceeds(getDoc(doc(op, 'organizations', ORG_A, 'settings', `timesheet_${PAY_OP}_126`))))
      // A colleague and a manager who is not their line manager never read the private pay profile.
      await step('assertFails#5', assertFails(getDoc(payProfile(colleague))))
      await step('assertFails#6', assertFails(getDoc(payProfile(mgrOther))))
      // The line manager reads per person; the admin reads everything.
      await step('assertSucceeds#7', assertSucceeds(getDoc(payProfile(lm))))
      await step('assertSucceeds#8', assertSucceeds(getDocs(query(history(lm), where('userId', '==', PAY_OP)))))
      await step('assertSucceeds#9', assertSucceeds(getDoc(doc(lm, 'organizations', ORG_A, 'settings', `timesheet_${PAY_OP}_126`))))
      await step('assertSucceeds#10', assertSucceeds(getDocs(history(admin))))
      await step('assertSucceeds#11', assertSucceeds(getDocs(query(settings(admin), where('weekStartKey', '==', 'k126')))))
      if (on) {
        // Rate history, the mirror and timesheets are closed to colleagues; whole-collection reads to non-admins.
        await step('assertFails#12', assertFails(getDocs(query(history(colleague), where('userId', '==', PAY_OP)))))
        await step('assertFails#13', assertFails(getDoc(doc(colleague, 'organizations', ORG_A, 'operativeProfiles', PAY_OP))))
        await step('assertFails#14', assertFails(getDoc(doc(mgrOther, 'organizations', ORG_A, 'settings', `timesheet_${PAY_OP}_126`))))
        await step('assertFails#15', assertFails(getDocs(history(lm))))
        await step('assertFails#16', assertFails(getDocs(query(settings(lm), where('weekStartKey', '==', 'k126')))))
        // No pay value back on a shared document of this company; removing and other fields still pass.
        await step('assertFails#17', assertFails(updateDoc(doc(admin, 'users', PAY_OP), { dayRate: 260 })))
        await step('assertSucceeds#18', assertSucceeds(updateDoc(doc(admin, 'users', PAY_OP), { firstName: 'Pat' })))
        await step('assertFails#19', assertFails(updateDoc(doc(admin, 'organizations', ORG_A, 'operatives', PAY_OP_ROW), { dayRate: 260 })))
      } else {
        // Off for this company: reads and pay writes as before.
        await step('assertSucceeds#20', assertSucceeds(getDocs(query(history(colleague), where('userId', '==', PAY_OP)))))
        await step('assertSucceeds#21', assertSucceeds(getDocs(history(lm))))
        await step('assertSucceeds#22', assertSucceeds(updateDoc(doc(admin, 'users', PAY_OP), { dayRate: 205 })))
      }
    }
  } finally {
    await setSwitchConfig({ enforcedReads: true })
  }
})

// MARK: - Rulebook 1.27.0 (owner decisions 6 and 7)

test('1.27.0 (6) invite accept: with privatePay on the invitee creates their own pay profile only as a copy of their placeholder profile', async () => {
  const placeholderId = 'B1A2C3D4-0000-4000-8000-000000001270'
  const otherPlaceholder = 'B1A2C3D4-0000-4000-8000-000000009999'
  const authUid = 'invitee-127-uid'
  const email = 'invitee-127@test.com'
  const invited = { userId: placeholderId, payBasis: 'day', dayRate: 185, employmentType: 'self_employed' }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', placeholderId), {
      email, organizationId: ORG_A, firstName: 'Ivy', surname: 'New', passwordSet: false, isActive: true,
    })
    await setDoc(doc(db, 'users', otherPlaceholder), {
      email: 'someone-else-127@test.com', organizationId: ORG_A, firstName: 'Sam', passwordSet: false, isActive: true,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: placeholderId })
    await setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', placeholderId), invited)
    await setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', otherPlaceholder), { userId: otherPlaceholder, payBasis: 'day', dayRate: 400 })
    await setDoc(doc(db, 'users', authUid), {
      email, organizationId: ORG_A, firstName: 'Ivy', surname: 'New', passwordSet: true, isActive: true, formerUserIds: [placeholderId],
    })
  })
  const db = await authDb(authUid, email)
  const own = doc(db, 'organizations', ORG_A, 'payProfiles', authUid)
  const copy = { userId: authUid, payBasis: 'day', dayRate: 185, employmentType: 'self_employed' }
  try {
    // Switch off for this company: nothing changes — the person never writes their own pay profile.
    await setSwitchConfig({ enforcedReads: true, privatePayOrganizationIds: [ORG_B] })
    await step('off: refused', assertFails(setDoc(own, copy)))

    await setSwitchConfig({ enforcedReads: true, privatePayOrganizationIds: [ORG_A] })
    // The invitee reads their placeholder's profile (their own email) to copy it.
    await step('reads invited', assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'payProfiles', placeholderId))))
    // Anything but the exact invited values is refused: a higher rate, another basis, a missing field, extra keys.
    await step('raise', assertFails(setDoc(own, { ...copy, dayRate: 999 })))
    await step('basis', assertFails(setDoc(own, { userId: authUid, payBasis: 'hourly', hourlyRate: 185, employmentType: 'self_employed' })))
    await step('drop employment', assertFails(setDoc(own, { userId: authUid, payBasis: 'day', dayRate: 185 })))
    await step('extra key', assertFails(setDoc(own, { ...copy, firstName: 'Ivy' })))
    await step('other subject', assertFails(setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', 'someone-else'), { ...copy, userId: 'someone-else' })))
    // Someone else's invite profile cannot be copied (the claim names this email's placeholder only).
    await step('copy other invite', assertFails(setDoc(own, { userId: authUid, payBasis: 'day', dayRate: 400 })))
    // The exact copy, with write metadata, is allowed once.
    await step('exact copy', assertSucceeds(setDoc(own, { ...copy, updatedAt: serverTimestamp(), updatedBy: authUid, updatedFrom: 'web' })))
    // Never an update afterwards — the person still never changes their own pay.
    await step('no update', assertFails(setDoc(own, { ...copy, dayRate: 999 }, { merge: true })))
    await step('no same-value update', assertFails(updateDoc(own, { dayRate: 185 })))

    // Once the claim names the account (accept finished), the copy path is closed.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore()
      await deleteDoc(doc(admin, 'organizations', ORG_A, 'payProfiles', authUid))
      await setDoc(doc(admin, 'organizations', ORG_A, 'userEmails', email), { userId: authUid })
    })
    await step('claim moved', assertFails(setDoc(own, copy)))
    // A placeholder that already set a password (a live member), or one in another company, never qualifies.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore()
      await setDoc(doc(admin, 'organizations', ORG_A, 'userEmails', email), { userId: placeholderId })
      await updateDoc(doc(admin, 'users', placeholderId), { passwordSet: true })
    })
    await step('placeholder not pending', assertFails(setDoc(own, copy)))
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', placeholderId), { passwordSet: false, organizationId: ORG_B })
    })
    await step('placeholder other company', assertFails(setDoc(own, copy)))
    // A stranger signed in with another email cannot use this invite's profile.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', placeholderId), { organizationId: ORG_A })
    })
    const stranger = await authDb('stranger-127', 'stranger-127@test.com')
    await step('stranger', assertFails(setDoc(doc(stranger, 'organizations', ORG_A, 'payProfiles', 'stranger-127'), { ...copy, userId: 'stranger-127' })))
    // And it still works for the genuine invitee (sanity: the state above is valid again).
    await step('valid again', assertSucceeds(setDoc(own, copy)))
  } finally {
    await setSwitchConfig({ enforcedReads: true })
  }
})

test('1.27.0 (7) catalogue operatives: operatives managers read their pay profile and rate history while privatePay is on; never a row that belongs to an account', async () => {
  await seedPayPeople()
  const SOLO = 'pay-cat-solo-127'
  const LINKED = 'pay-cat-linked-127'
  const CLAIMED = 'pay-cat-claimed-127'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', SOLO), { email: 'solo-127@test.com', name: 'Solo' })
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', LINKED), { email: 'linked-127@test.com', name: 'Linked', linkedUserId: LM_A })
    // A row on the email of a manager of this company (an email claim exists): not a catalogue operative.
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', CLAIMED), { email: 'lm-a@test.com', name: 'Lena' })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'lm-a@test.com'), { userId: LM_A })
    for (const id of [SOLO, LINKED, CLAIMED]) {
      await setDoc(doc(db, 'organizations', ORG_A, 'payProfiles', id), { userId: id, dayRate: 150, payBasis: 'day' })
      await setDoc(doc(db, 'organizations', ORG_A, 'operativeDayRateHistory', `h127-${id}`), {
        userId: '', operativeId: id, dayRate: 150, payBasis: 'day', effectiveAt: Timestamp.now(),
      })
    }
  })
  const mgrOps = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  const lm = await authDb(LM_A, 'lm-a@test.com')
  const colleague = await authDb(REPORT_A, 'report-a@test.com')
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const profile = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'payProfiles', id)
  const historyQuery = (db: Awaited<ReturnType<typeof authDb>>, id: string) =>
    query(collection(db, 'organizations', ORG_A, 'operativeDayRateHistory'), where('operativeId', '==', id), where('userId', '==', ''))
  try {
    await setSwitchConfig({ enforcedReads: true, privatePayOrganizationIds: [ORG_A] })
    // A catalogue operative: the operatives manager reads the profile and the history (rateHistoryQueryPlan operativeIds).
    await step('mgr profile solo', assertSucceeds(getDoc(profile(mgrOps, SOLO))))
    await step('mgr history solo', assertSucceeds(getDocs(historyQuery(mgrOps, SOLO))))
    await step('mgr history row solo', assertSucceeds(getDoc(doc(mgrOps, 'organizations', ORG_A, 'operativeDayRateHistory', `h127-${SOLO}`))))
    // A manager without the Operatives toggle and an operative colleague do not.
    await step('lm profile solo', assertFails(getDoc(profile(lm, SOLO))))
    await step('lm history solo', assertFails(getDocs(historyQuery(lm, SOLO))))
    await step('colleague history solo', assertFails(getDocs(historyQuery(colleague, SOLO))))
    // Rows that belong to an account (linked id, or an email claim of this company): not through the row.
    await step('mgr profile linked', assertFails(getDoc(profile(mgrOps, LINKED))))
    await step('mgr profile claimed', assertFails(getDoc(profile(mgrOps, CLAIMED))))
    await step('mgr history linked', assertFails(getDocs(historyQuery(mgrOps, LINKED))))
    await step('mgr history claimed', assertFails(getDocs(historyQuery(mgrOps, CLAIMED))))
    // The person on the row's email still reads their own row; admins read everything.
    await step('lm own row', assertSucceeds(getDoc(profile(lm, CLAIMED))))
    await step('admin profile', assertSucceeds(getDoc(profile(admin, LINKED))))
    await step('admin history', assertSucceeds(getDocs(collection(admin, 'organizations', ORG_A, 'operativeDayRateHistory'))))
    // Off for this company: every member reads rate history, as before.
    await setSwitchConfig({ enforcedReads: true, privatePayOrganizationIds: [ORG_B] })
    await step('off colleague history', assertSucceeds(getDocs(historyQuery(colleague, SOLO))))
  } finally {
    await setSwitchConfig({ enforcedReads: true })
  }
})

// ---------------------------------------------------------------------------
// Rulebook 1.28.0 (review B1, B2): create paths never switch on one's own self-manage toggles; the creator's own
// document is exempt from the self-toggle lock.
// ---------------------------------------------------------------------------

test('1.28.0 B1: invite accept copies the self-manage toggles only as the admin set them on the placeholder', async () => {
  const email = 'invited-toggles@test.com'
  const placeholderId = 'C1C2D3E4-0000-4000-8000-TOGGLEINVITE'
  const authUid = 'invited-toggles-auth'
  const seed = async (toggles: Record<string, boolean>) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', placeholderId), {
        email, organizationId: ORG_A, firstName: 'Tia', role: 'admin', adminAccess: true,
        passwordSet: false, isActive: true, isSuperAdmin: false, ...toggles, permissions: { adminAccess: true, ...toggles },
      })
      await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: placeholderId })
    })
    await seedInvitation('invite-toggles', ORG_A, email, { role: 'admin' })
  }
  const profile = (extra: Record<string, unknown>) => ({
    email, organizationId: ORG_A, firstName: 'Tia', role: 'admin', adminAccess: true, passwordSet: true, isActive: true,
    isSuperAdmin: false, formerUserIds: [placeholderId], ...ageFields(), ...extra,
  })
  const db = await authDb(authUid, email)
  // Placeholder has both off: the invitee cannot switch them on (top level or permissions map).
  await seed({ annualLeaveSelfBook: false, timesheetSelfSign: false })
  await assertFails(acceptInviteBatch(db, authUid, profile({ annualLeaveSelfBook: true, timesheetSelfSign: true, hasNoLineManager: true }), 'invite-toggles'))
  await assertFails(acceptInviteBatch(db, authUid, profile({ permissions: { adminAccess: true, timesheetSelfSign: true } }), 'invite-toggles'))
  await assertFails(acceptInviteBatch(db, authUid, profile({ annualLeaveSelfBook: true }), 'invite-toggles'))
  // Legit: copying the placeholder as it is.
  await assertSucceeds(acceptInviteBatch(db, authUid, profile({
    annualLeaveSelfBook: false, timesheetSelfSign: false, permissions: { adminAccess: true, annualLeaveSelfBook: false, timesheetSelfSign: false },
  }), 'invite-toggles'))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'users', authUid))
  })
  // The admin turned both on at Add User: the invitee keeps them.
  await seed({ annualLeaveSelfBook: true, timesheetSelfSign: true })
  await assertSucceeds(acceptInviteBatch(db, authUid, profile({
    annualLeaveSelfBook: true, timesheetSelfSign: true, permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true },
  }), 'invite-toggles'))
})

test('1.28.0 B1: deleting and re-creating your own profile never switches on your self-manage toggles', async () => {
  const uid = 'returning-admin-toggles'
  const email = 'returning-admin-toggles@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${uid}`]: 'admin' })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: uid })
    await setDoc(doc(db, 'users', uid), { email, organizationId: ORG_A, role: 'admin', adminAccess: true })
  })
  const db = await authDb(uid, email)
  // 1.31.1 (fourth review): nobody deletes their own users document; accounts are deleted through
  // /api/account/delete (service credentials). The document is removed with the rules off to test the re-create.
  await assertLogicalDeny(deleteDoc(doc(db, 'users', uid)))
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'users', uid)) })
  const profile = { email, organizationId: ORG_A, firstName: 'Ray', role: 'admin', adminAccess: true, ...ageFields() }
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, annualLeaveSelfBook: true, timesheetSelfSign: true, hasNoLineManager: true }))
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, permissions: { adminAccess: true, annualLeaveSelfBook: true } }))
  await assertFails(setDoc(doc(db, 'users', uid), { ...profile, timesheetSelfSign: true }))
  // Legit: re-created with the toggles off.
  await assertSucceeds(setDoc(doc(db, 'users', uid), { ...profile, annualLeaveSelfBook: false, timesheetSelfSign: false }))
})

test('1.28.0 B1: the founder (organisation creator) may create their own profile with the toggles on', async () => {
  const uid = 'founder-toggles'
  const email = 'founder-toggles@test.com'
  const orgId = 'org-founder-toggles'
  const db = await authDb(uid, email)
  await assertSucceeds(setDoc(doc(db, 'organizations', orgId), { name: 'Toggle Co', members: { [uid]: 'admin' }, creatorUserId: uid }))
  await assertSucceeds(setDoc(doc(db, 'organizations', orgId, 'userEmails', email), { userId: uid }))
  await assertSucceeds(setDoc(doc(db, 'users', uid), {
    email, organizationId: orgId, firstName: 'Flo', role: 'admin', adminAccess: true, isSuperAdmin: true,
    annualLeaveSelfBook: true, timesheetSelfSign: true, ...ageFields(),
  }))
  // A second admin of that company re-creating their profile through the bootstrap path cannot.
  const other = 'second-admin-toggles'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', orgId), { [`members.${other}`]: 'admin' })
  })
  const odb = await authDb(other, 'second-admin-toggles@test.com')
  await assertFails(setDoc(doc(odb, 'users', other), {
    email: 'second-admin-toggles@test.com', organizationId: orgId, firstName: 'Sam', role: 'admin', adminAccess: true,
    annualLeaveSelfBook: true, timesheetSelfSign: true, ...ageFields(),
  }))
  await assertSucceeds(setDoc(doc(odb, 'users', other), {
    email: 'second-admin-toggles@test.com', organizationId: orgId, firstName: 'Sam', role: 'admin', adminAccess: true, ...ageFields(),
  }))
})

test('1.28.0 B2: the unflagged creator may change their own self-manage toggles; a non-creator admin may not', async () => {
  await seedRulebook1280People()
  // ADMIN_A is ORG_A's creator with no isSuperAdmin flag in the seed.
  const own = doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', ADMIN_A)
  await assertSucceeds(updateDoc(own, { timesheetSelfSign: true, annualLeaveSelfBook: true }))
  await assertSucceeds(updateDoc(own, { timesheetSelfSign: false, annualLeaveSelfBook: false }))
  await assertFails(updateDoc(doc(await authDb(ADMIN2_A, 'admin2-a@test.com'), 'users', ADMIN2_A), { timesheetSelfSign: true }))
})

// ── Rulebook 1.30.2: nobody reviews their own timesheet; self-manage toggles are read for THIS organisation ──
const ADM_BOTH_A = 'adm-both-a'
const ADM_LEAVE_A = 'adm-leave-only-a'
const ADM_TS_A = 'adm-ts-only-a'
const ADM_PAYE_A = 'adm-paye-a'
const DEMOTED_MGR_A = 'demoted-mgr-a'
const VISIT_ADMIN = 'visiting-admin'
const VISIT_MGR = 'visiting-mgr'

async function seedRulebook1302People() {
  await seedRulebook1280People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const admin = (email: string, extra: Record<string, unknown>) => ({
      email, organizationId: ORG_A, role: 'admin', adminAccess: true, isActive: true, ...extra,
    })
    await setDoc(doc(db, 'users', ADM_BOTH_A), admin('adm-both-a@test.com', {
      permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true },
    }))
    await setDoc(doc(db, 'users', ADM_LEAVE_A), admin('adm-leave-a@test.com', {
      assignedManagerUserIds: [LM_A], assignedManagerUserId: LM_A,
      permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: false },
    }))
    await setDoc(doc(db, 'users', ADM_TS_A), admin('adm-ts-a@test.com', {
      assignedManagerUserIds: [LM_A], assignedManagerUserId: LM_A,
      permissions: { adminAccess: true, annualLeaveSelfBook: false, timesheetSelfSign: true },
    }))
    await setDoc(doc(db, 'users', ADM_PAYE_A), admin('adm-paye-a@test.com', {
      employmentType: 'paye',
      permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: false },
    }))
    // A demoted admin: manager now, Timesheet self-sign kept underneath, Annual Leave Management off.
    await setDoc(doc(db, 'users', DEMOTED_MGR_A), {
      email: 'demoted-mgr-a@test.com', organizationId: ORG_A, role: 'manager', manager: true, isActive: true,
      assignedManagerUserIds: [LM_A], assignedManagerUserId: LM_A, timesheetSelfSign: true,
      permissions: { manager: true, adminAccess: false, annualLeaveSelfBook: false, timesheetSelfSign: true },
    })
    // Visitors: users document of company A, members of company B.
    await setDoc(doc(db, 'users', VISIT_ADMIN), {
      email: 'visiting-admin@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true, isActive: true,
      permissions: { operativeMode: true, annualLeaveSelfBook: false, timesheetSelfSign: false },
    })
    await setDoc(doc(db, 'users', VISIT_ADMIN, 'orgMemberships', ORG_B), {
      organizationId: ORG_B, role: 'admin', status: 'active', accountActive: true,
      permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true },
    })
    await setDoc(doc(db, 'users', VISIT_MGR), {
      email: 'visiting-mgr@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, isActive: true,
      annualLeaveSelfBook: true, timesheetSelfSign: true,
      permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true },
    })
    await setDoc(doc(db, 'users', VISIT_MGR, 'orgMemberships', ORG_B), {
      organizationId: ORG_B, role: 'manager', status: 'active', accountActive: true,
      permissions: { manager: true, adminAccess: false, annualLeaveSelfBook: false, timesheetSelfSign: false },
    })
    await updateDoc(doc(db, 'organizations', ORG_B), {
      [`members.${VISIT_ADMIN}`]: 'admin',
      [`members.${VISIT_MGR}`]: 'manager',
    })
  })
}

async function sheetRef(org: string, subject: string, uid: string, email: string, n = 1800000000) {
  return doc(await authDb(uid, email), 'organizations', org, 'settings', `timesheet_${subject}_${n}`)
}
const ownSign = (uid: string) => ({
  userId: uid, weekStartKey: '2026-11-01', weekEndKey: '2026-11-15',
  operativeSignedAt: Timestamp.now(), operativeSignedByName: 'Self',
})
const counterSign = (uid: string) => ({
  managerSignedAt: Timestamp.now(), managerSignedByName: 'Self', managerSignedByUserId: uid,
  approvedAt: Timestamp.now(), approvedByName: 'Self',
})
const snapshot = (uid: string) => ({
  weeklyReportOverride: { approvedByUserId: uid, selfSigned: true, lines: [], priceWork: [], expenses: [] },
})
const entryReview = (uid: string) => ({
  'extraEntryReviews.e1': { decision: 'approved', revisedAmount: null, reviewedAmount: 10, reviewedByUserId: uid, reviewedAtMs: 1 },
})
const approvedLeave = (uid: string) => leave(uid, 'approved', { approvedByUserId: uid, approvedAt: Timestamp.now() })

/** The owner signs; then counter-sign, snapshot and an entry review on their own sheet — allowed or refused together. */
async function ownSheetCell(org: string, uid: string, email: string, selfSigned: boolean, n: number) {
  const ref = await sheetRef(org, uid, uid, email, n)
  await assertSucceeds(setDoc(ref, ownSign(uid), { merge: true }))
  const check = selfSigned ? assertSucceeds : assertFails
  await check(setDoc(ref, snapshot(uid), { merge: true }))
  await check(updateDoc(ref, entryReview(uid)))
  await check(setDoc(ref, counterSign(uid), { merge: true }))
}

test('1.30.2 cells: own timesheet counter-sign, snapshot and reviews follow timesheetSelfSigned; own leave follows Annual Leave Management', async () => {
  await seedRulebook1302People()
  const hb = async (org: string, uid: string, email: string, id: string) =>
    doc(await authDb(uid, email), 'organizations', org, 'holidayBookings', id)
  // Super Admin (the creator): self-signed and self-books.
  await ownSheetCell(ORG_A, ADMIN_A, 'admin-a@test.com', true, 1800000001)
  await assertSucceeds(setDoc(await hb(ORG_A, ADMIN_A, 'admin-a@test.com', 'c1302-sa'), approvedLeave(ADMIN_A)))
  // Admin, both toggles, no line manager.
  await ownSheetCell(ORG_A, ADM_BOTH_A, 'adm-both-a@test.com', true, 1800000002)
  await assertSucceeds(setDoc(await hb(ORG_A, ADM_BOTH_A, 'adm-both-a@test.com', 'c1302-both'), approvedLeave(ADM_BOTH_A)))
  // Admin, leave only, with a line manager: leave approved; own sheet waits for the line manager.
  await ownSheetCell(ORG_A, ADM_LEAVE_A, 'adm-leave-a@test.com', false, 1800000003)
  await assertSucceeds(setDoc(await hb(ORG_A, ADM_LEAVE_A, 'adm-leave-a@test.com', 'c1302-leave'), approvedLeave(ADM_LEAVE_A)))
  await assertSucceeds(setDoc(await sheetRef(ORG_A, ADM_LEAVE_A, LM_A, 'lm-a@test.com', 1800000003), counterSign(LM_A), { merge: true }))
  // Admin, timesheet only, with a line manager: own sheet self-signed; leave is a request.
  await ownSheetCell(ORG_A, ADM_TS_A, 'adm-ts-a@test.com', true, 1800000004)
  await assertFails(setDoc(await hb(ORG_A, ADM_TS_A, 'adm-ts-a@test.com', 'c1302-ts'), approvedLeave(ADM_TS_A)))
  await assertSucceeds(setDoc(await hb(ORG_A, ADM_TS_A, 'adm-ts-a@test.com', 'c1302-ts'), leave(ADM_TS_A, 'pending')))
  // Admin, no toggles, no line manager: own counter-sign now DENIED (the audit's bug); another admin signs it.
  await ownSheetCell(ORG_A, ADMIN2_A, 'admin2-a@test.com', false, 1800000005)
  await assertFails(setDoc(await sheetRef(ORG_A, ADMIN2_A, ADMIN2_A, 'admin2-a@test.com', 1800000005), { exportedAt: Timestamp.now() }, { merge: true }))
  await assertFails(setDoc(await hb(ORG_A, ADMIN2_A, 'admin2-a@test.com', 'c1302-none'), approvedLeave(ADMIN2_A)))
  await assertSucceeds(setDoc(await sheetRef(ORG_A, ADMIN2_A, ADMIN_A, 'admin-a@test.com', 1800000005), counterSign(ADMIN_A), { merge: true }))
  // Signed by someone else: the owner (not self-signed) may not delete it.
  await assertFails(deleteDoc(await sheetRef(ORG_A, ADMIN2_A, ADMIN2_A, 'admin2-a@test.com', 1800000005)))
  // PAYE admin, Annual Leave Management on, Timesheet self-sign off: leave approved; never their own counter-sign.
  await ownSheetCell(ORG_A, ADM_PAYE_A, 'adm-paye-a@test.com', false, 1800000006)
  await assertSucceeds(setDoc(await hb(ORG_A, ADM_PAYE_A, 'adm-paye-a@test.com', 'c1302-paye'), approvedLeave(ADM_PAYE_A)))
  // Demoted manager with Timesheet self-sign kept underneath: never self-signed, leave is a request.
  await ownSheetCell(ORG_A, DEMOTED_MGR_A, 'demoted-mgr-a@test.com', false, 1800000007)
  await assertFails(setDoc(await hb(ORG_A, DEMOTED_MGR_A, 'demoted-mgr-a@test.com', 'c1302-dem'), approvedLeave(DEMOTED_MGR_A)))
})

test('1.30.2 cells: visitors — toggles come from the membership here, never the home company', async () => {
  await seedRulebook1302People()
  const hb = async (uid: string, email: string, id: string) =>
    doc(await authDb(uid, email), 'organizations', ORG_B, 'holidayBookings', id)
  // Visiting admin in B with the toggles only on the membership (home: operative, toggles off): allowed.
  await assertSucceeds(setDoc(await hb(VISIT_ADMIN, 'visiting-admin@test.com', 'c1302-va'), approvedLeave(VISIT_ADMIN)))
  await ownSheetCell(ORG_B, VISIT_ADMIN, 'visiting-admin@test.com', true, 1800000011)
  // Visiting manager in B with the flags on at home only: denied.
  await assertFails(setDoc(await hb(VISIT_MGR, 'visiting-mgr@test.com', 'c1302-vm'), approvedLeave(VISIT_MGR)))
  await assertSucceeds(setDoc(await hb(VISIT_MGR, 'visiting-mgr@test.com', 'c1302-vm'), leave(VISIT_MGR, 'pending')))
  await ownSheetCell(ORG_B, VISIT_MGR, 'visiting-mgr@test.com', false, 1800000012)
  // The membership's toggles are switched off: the visiting admin is refused too (no home fallback).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', VISIT_ADMIN, 'orgMemberships', ORG_B), {
      permissions: { adminAccess: true, annualLeaveSelfBook: false, timesheetSelfSign: false },
    }, { merge: true })
  })
  await assertFails(setDoc(await hb(VISIT_ADMIN, 'visiting-admin@test.com', 'c1302-va2'), approvedLeave(VISIT_ADMIN)))
  await ownSheetCell(ORG_B, VISIT_ADMIN, 'visiting-admin@test.com', false, 1800000013)
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', VISIT_ADMIN, 'orgMemberships', ORG_B), {
      permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true },
    }, { merge: true })
  })
  // Back on: allowed again (the flag is the membership's).
  await assertSucceeds(setDoc(await hb(VISIT_ADMIN, 'visiting-admin@test.com', 'c1302-va3'), approvedLeave(VISIT_ADMIN)))
  // Home company A still reads the home users document: the visiting manager is an admin with both toggles there.
  await assertSucceeds(setDoc(doc(await authDb(VISIT_MGR, 'visiting-mgr@test.com'), 'organizations', ORG_A, 'holidayBookings', 'c1302-vm-home'), approvedLeave(VISIT_MGR)))
  // An admin of B reviews the visitor's sheet; the visitor never reviews their own.
  await assertSucceeds(setDoc(await sheetRef(ORG_B, VISIT_MGR, ADMIN_B, 'admin-b@test.com', 1800000012), counterSign(ADMIN_B), { merge: true }))
})

test('1.30.2 review fix: the doc id prefix never borrows another person\'s self-signing; the owner never re-attributes a sheet', async () => {
  await seedRulebook1302People()
  const rep = await authDb(REPORT_A, 'report-a@test.com')
  const privileged = (subject: string) => ({
    userId: subject, operativeSignedAt: Timestamp.now(), operativeSignedByName: 'X',
    ...counterSign(REPORT_A), exportedAt: Timestamp.now(), ...snapshot(subject),
    extraEntryReviews: { e1: { decision: 'approved', reviewedAmount: 1, reviewedByUserId: REPORT_A, reviewedAtMs: 1 } },
  })
  // Create attack: own prefix, a self-signing admin's userId, every privileged field.
  const attack = doc(rep, 'organizations', ORG_A, 'settings', `timesheet_${REPORT_A}_100`)
  await assertFails(setDoc(attack, privileged(ADM_BOTH_A)))
  // Even without privileged fields the owner never files a sheet under someone else.
  await assertFails(setDoc(attack, { userId: ADM_BOTH_A, operativeSignedAt: Timestamp.now() }))
  // Update attack: an own sheet re-attributed (to the admin, or back) is refused.
  await assertSucceeds(setDoc(attack, ownSign(REPORT_A)))
  await assertFails(updateDoc(attack, { userId: ADM_BOTH_A, ...snapshot(ADM_BOTH_A) }))
  await assertFails(updateDoc(attack, { userId: ADM_BOTH_A }))
  // A sheet stored under the admin's id with the operative's prefix (seeded) cannot be taken over or rewritten.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'settings', `timesheet_${REPORT_A}_101`), { userId: ADM_BOTH_A })
  })
  const planted = doc(rep, 'organizations', ORG_A, 'settings', `timesheet_${REPORT_A}_101`)
  await assertFails(updateDoc(planted, { ...counterSign(REPORT_A), ...snapshot(ADM_BOTH_A) }))
  await assertFails(updateDoc(planted, { userId: REPORT_A }))
  await assertFails(deleteDoc(planted))
  // The self-signed admin's own sheet: full write, create and update, still allowed; their userId cannot move either.
  const own = await sheetRef(ORG_A, ADM_BOTH_A, ADM_BOTH_A, 'adm-both-a@test.com', 1800000021)
  await assertSucceeds(setDoc(own, { ...ownSign(ADM_BOTH_A), ...counterSign(ADM_BOTH_A), ...snapshot(ADM_BOTH_A) }))
  await assertSucceeds(updateDoc(own, entryReview(ADM_BOTH_A)))
  await assertFails(updateDoc(own, { userId: REPORT_A }))
  // A signed sheet is never deleted by its owner, self-signed or not (no app deletes one).
  await assertFails(deleteDoc(own))
})

test('1.30.2 review fix: a same-email id is the caller — an admin never counter-signs a sheet filed under it', async () => {
  await seedRulebook1302People()
  const ALIAS = 'admin2-a-alias'
  await setUserFields(ADMIN2_A, { sameEmailUserIds: [ALIAS] })
  try {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', ALIAS), { email: 'admin2-a@test.com', organizationId: ORG_A, role: 'operative' })
      await setDoc(doc(db, 'organizations', ORG_A, 'settings', `timesheet_${ALIAS}_1`), ownSign(ALIAS))
    })
    const aliasSheet = await sheetRef(ORG_A, ALIAS, ADMIN2_A, 'admin2-a@test.com', 1)
    await assertFails(setDoc(aliasSheet, counterSign(ADMIN2_A), { merge: true }))
    await assertFails(updateDoc(aliasSheet, entryReview(ADMIN2_A)))
    // Another admin reviews it.
    await assertSucceeds(setDoc(await sheetRef(ORG_A, ALIAS, ADMIN_A, 'admin-a@test.com', 1), counterSign(ADMIN_A), { merge: true }))
  } finally {
    await setUserFields(ADMIN2_A, { sameEmailUserIds: [] })
  }
})

// ---------------------------------------------------------------------------
// Rulebook 1.31.0: people and access.
// ---------------------------------------------------------------------------

const DEMOTED_A = 'demoted-lm-a'
const DEMOTED_REPORT_A = 'demoted-report-a'
const DEL_OP_A = 'del-op-a'

async function seed1310People() {
  await seedPayPeople()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    // A former manager now an operative; their old report still lists them.
    await setDoc(doc(db, 'users', DEMOTED_A), {
      email: 'demoted-a@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true, manager: false,
      permissions: { operativeMode: true, manager: false },
    })
    await setDoc(doc(db, 'users', DEMOTED_REPORT_A), {
      email: 'demoted-report-a@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true,
      assignedManagerUserIds: [DEMOTED_A, LM_A], dayRate: 150,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'holidayBookings', 'hb1310'), leave(DEMOTED_REPORT_A, 'pending'))
    // An operative an operatives manager deletes (with the documents userDeleteWrites removes in its first batch).
    await setDoc(doc(db, 'users', DEL_OP_A), {
      email: 'del-op-a@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true, firstName: 'Del',
    })
    await setDoc(doc(db, 'users', DEL_OP_A, 'private', 'taxIds'), { utrNumber: '1', vatNumber: '' })
    await setDoc(doc(db, 'users', DEL_OP_A, 'orgMemberships', ORG_A), { organizationId: ORG_A, role: 'operative' })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', 'del-op-a@test.com'), { userId: DEL_OP_A })
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${DEL_OP_A}`]: 'operative' })
    // Tomorrow (future) and today: an operatives manager deletes only the future one (1.31.0 owner decision).
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'del-op-booking'), {
      operativeId: DEL_OP_A, projectId: 'JOB-X', date: Timestamp.fromMillis(Date.now() + 36 * 3600 * 1000),
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'bookings', 'del-op-booking-today'), {
      operativeId: DEL_OP_A, projectId: 'JOB-X', date: Timestamp.fromMillis(Date.now() - 3600 * 1000),
    })
  })
}

test('1.31.0: a manager demoted to operative is nobody’s line manager — no leave decision, no pay read', async () => {
  await seed1310People()
  const demoted = await authDb(DEMOTED_A, 'demoted-a@test.com')
  const ref = doc(demoted, 'organizations', ORG_A, 'holidayBookings', 'hb1310')
  await assertFails(updateDoc(ref, { status: 'approved', approvedByUserId: DEMOTED_A, approvedAt: Timestamp.now() }))
  await assertFails(getDoc(doc(demoted, 'organizations', ORG_A, 'payProfiles', DEMOTED_REPORT_A)))
  // The current line manager still decides.
  await assertSucceeds(
    updateDoc(doc(await authDb(LM_A, 'lm-a@test.com'), 'organizations', ORG_A, 'holidayBookings', 'hb1310'), {
      status: 'approved', approvedByUserId: LM_A, approvedAt: Timestamp.now(),
    })
  )
})

test('1.31.0: one flag reader — a self-manage toggle off at the top level is off, whatever permissions.{key} says', async () => {
  await seedLeaveAndTimesheetPeople()
  const MIXED = 'mixed-flag-a'
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', MIXED), {
      email: 'mixed-a@test.com', organizationId: ORG_A, role: 'manager', manager: true, annualLeaveSelfBook: false,
      assignedManagerUserIds: [LM_A], permissions: { manager: true, annualLeaveSelfBook: true },
    })
  })
  const mixed = await authDb(MIXED, 'mixed-a@test.com')
  await assertFails(setDoc(doc(mixed, 'organizations', ORG_A, 'holidayBookings', 'hb-mixed'), leave(MIXED, 'approved')))
  await assertSucceeds(setDoc(doc(mixed, 'organizations', ORG_A, 'holidayBookings', 'hb-mixed'), leave(MIXED, 'pending')))
})

test('1.31.0 owner decision 7: operatives managers edit and delete operatives (never managers, admins or themselves)', async () => {
  await seed1310People()
  const mgr = await authDb(PAY_MGR_OPS, 'pay-mgr-ops@test.com')
  // Edit: names, active flag and the operative toggles; never a privilege or "No line manager".
  await assertSucceeds(updateDoc(doc(mgr, 'users', DEL_OP_A), { firstName: 'Delia', name: 'Delia', isActive: false, materials: true }))
  await assertFails(updateDoc(doc(mgr, 'users', DEL_OP_A), { adminAccess: true }))
  await assertFails(updateDoc(doc(mgr, 'users', DEL_OP_A), { manager: true, operativeMode: false, role: 'manager' }))
  await assertFails(updateDoc(doc(mgr, 'users', DEL_OP_A), { annualLeaveSelfBook: true }))
  await assertFails(updateDoc(doc(mgr, 'users', LM_A), { firstName: 'Nope' }))
  // A manager without the Operatives permission edits nobody.
  await assertFails(updateDoc(doc(await authDb(LM_A, 'lm-a@test.com'), 'users', DEL_OP_A), { firstName: 'No' }))
  // Delete: the userDeleteWrites first batch (users, tax ids, membership, email claim, members entry) in one go.
  await assertSucceeds(deleteDoc(doc(mgr, 'users', DEL_OP_A, 'private', 'taxIds')))
  await assertSucceeds(deleteDoc(doc(mgr, 'users', DEL_OP_A, 'orgMemberships', ORG_A)))
  await assertSucceeds(deleteDoc(doc(mgr, 'organizations', ORG_A, 'userEmails', 'del-op-a@test.com')))
  await assertSucceeds(deleteDoc(doc(mgr, 'users', DEL_OP_A)))
  await assertSucceeds(updateDoc(doc(mgr, 'organizations', ORG_A), { [`members.${DEL_OP_A}`]: deleteField() }))
  // Step 2: the deleted operative's booking and its tombstone.
  const bookings = writeBatch(mgr)
  bookings.delete(doc(mgr, 'organizations', ORG_A, 'bookings', 'del-op-booking'))
  bookings.set(doc(mgr, 'organizations', ORG_A, 'deletedBookings', 'del-op-booking'), {
    bookingId: 'del-op-booking', collection: 'bookings', deletedAt: serverTimestamp(), deletedBy: PAY_MGR_OPS, deletedFrom: 'web',
  })
  await assertSucceeds(bookings.commit())
  // Today's (and any past) booking of the deleted operative: never deleted by a manager, nor its tombstone written.
  await assertFails(deleteDoc(doc(mgr, 'organizations', ORG_A, 'bookings', 'del-op-booking-today')))
  await assertFails(setDoc(doc(mgr, 'organizations', ORG_A, 'deletedBookings', 'del-op-booking-today'), {
    bookingId: 'del-op-booking-today', collection: 'bookings', deletedAt: serverTimestamp(), deletedBy: PAY_MGR_OPS, deletedFrom: 'web',
  }))
  // Never a manager, an admin or themselves; never another members entry.
  await assertFails(deleteDoc(doc(mgr, 'users', LM_A)))
  await assertFails(deleteDoc(doc(mgr, 'users', ADMIN_A)))
  await assertFails(deleteDoc(doc(await authDb(LM_A, 'lm-a@test.com'), 'users', PAY_OP)))
  await assertFails(updateDoc(doc(mgr, 'organizations', ORG_A), { [`members.${ADMIN_A}`]: deleteField() }))
})

test('1.31.0: Change Super Admin is one batch; the outgoing Super Admin keeps self-approval', async () => {
  await seedLeaveAndTimesheetPeople()
  const NEW_SA = 'new-sa-a'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', NEW_SA), { email: 'new-sa@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true })
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${NEW_SA}`]: 'admin' })
  })
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const batch = writeBatch(admin)
  batch.update(doc(admin, 'organizations', ORG_A), { creatorUserId: NEW_SA, [`members.${NEW_SA}`]: 'admin' })
  batch.update(doc(admin, 'users', NEW_SA), { isSuperAdmin: true, adminAccess: true, role: 'admin', annualLeaveSelfBook: true, timesheetSelfSign: true })
  batch.update(doc(admin, 'users', ADMIN_A), { isSuperAdmin: false, adminAccess: true, role: 'admin', annualLeaveSelfBook: true, timesheetSelfSign: true })
  await assertSucceeds(batch.commit())
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await updateDoc(doc(db, 'organizations', ORG_A), { creatorUserId: ADMIN_A })
    await updateDoc(doc(db, 'users', ADMIN_A), { isSuperAdmin: deleteField(), annualLeaveSelfBook: deleteField(), timesheetSelfSign: deleteField() })
  })
})

// ---------------------------------------------------------------------------
// Rulebook 1.31.1: users/{uid} and materials updates decide by the rules' logic, never by the 1,000-expression limit.
// assertLogicalDeny fails a test whose denial came from the limit.
// ---------------------------------------------------------------------------

const OPS_MGR_1311 = 'ops-mgr-1311'
const OP_1311 = 'op-1311'
const OP2_1311 = 'op2-1311'
const MGR_1311 = 'mgr-plain-1311'
const ADMIN_1311 = 'admin-1311'

async function seed1311People() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', OPS_MGR_1311), {
      email: 'ops-mgr-1311@test.com', organizationId: ORG_A, role: 'manager', manager: true, operatives: true,
      permissions: { manager: true, operatives: true, operativeMode: false },
    })
    await setDoc(doc(db, 'users', MGR_1311), {
      email: 'mgr-plain-1311@test.com', organizationId: ORG_A, role: 'manager', manager: true,
      permissions: { manager: true, operativeMode: false },
    })
    await setDoc(doc(db, 'users', OP_1311), {
      email: 'op-1311@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true,
      firstName: 'Opal', surname: 'One', assignedManagerUserId: OPS_MGR_1311, dayRate: 150, payBasis: 'day',
      employmentType: 'self_employed', isActive: true,
      permissions: { operativeMode: true, materials: false, siteAudit: false },
    })
    await setDoc(doc(db, 'users', OP2_1311), {
      email: 'op2-1311@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true,
      firstName: 'Otto', lastName: 'Two',
    })
    await setDoc(doc(db, 'users', ADMIN_1311), {
      email: 'admin-1311@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true,
      annualLeaveSelfBook: true, timesheetSelfSign: true, assignedManagerUserId: ADMIN_A,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'materials', 'legacy-name-1311'), { addedBy: 'opal one', name: 'Sand' })
    await setDoc(doc(db, 'organizations', ORG_A, 'materials', 'legacy-last-1311'), { addedBy: 'Otto Two', name: 'Cement' })
    await setDoc(doc(db, 'organizations', ORG_A, 'materials', 'owned-1311'), { addedByUserId: OP_1311, addedBy: 'x', name: 'Lime' })
  })
}

test('1.31.1: an operatives manager edits an operative\'s users document (§11 owner decision 7)', async () => {
  await seed1311People()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const op = (data: Record<string, unknown>) => updateDoc(doc(mgr, 'users', OP_1311), data)
  await assertSucceedsWithinBudget(op({ mobileNumber: '07700 900000', phone: '07700 900000' }))
  await assertSucceedsWithinBudget(op({ dayRate: 180 }))
  await assertSucceedsWithinBudget(op({ payBasis: 'hourly', hourlyRate: 25, dayRate: deleteField() }))
  await assertSucceedsWithinBudget(op({ employmentType: 'paye', employmentTypeTransitionFrom: 'self_employed' }))
  await assertSucceedsWithinBudget(op({ assignedManagerUserIds: [OPS_MGR_1311, MGR_1311], assignedManagerUserId: OPS_MGR_1311 }))
  await assertSucceedsWithinBudget(op({ isActive: false }))
  await assertSucceedsWithinBudget(op({
    firstName: 'Opaline', surname: 'Uno', name: 'Opaline Uno', tradeTypePreset: 'Joiner', isActive: true, materials: true,
    timesheetsEnabled: true, annualLeaveDaysPerYear: 20, employmentStartDate: '2026-01-05',
    updatedBy: OPS_MGR_1311, updatedFrom: 'web',
  }))
})

test('1.31.1: an operatives manager never changes an operative\'s privileges, identity or company (logical deny)', async () => {
  await seed1311People()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const op = (data: Record<string, unknown>) => updateDoc(doc(mgr, 'users', OP_1311), data)
  await assertLogicalDeny(op({ role: 'admin' }))
  await assertLogicalDeny(op({ adminAccess: true }))
  await assertLogicalDeny(op({ isSuperAdmin: true }))
  await assertLogicalDeny(op({ organizationId: ORG_B }))
  await assertLogicalDeny(op({ manager: true }))
  await assertLogicalDeny(op({ operatives: true }))
  await assertLogicalDeny(op({ annualLeaveSelfBook: true }))
  await assertLogicalDeny(op({ timesheetSelfSign: true }))
  await assertLogicalDeny(op({ email: 'evil@test.com' }))
  await assertLogicalDeny(op({ hasNoLineManager: true }))
  await assertLogicalDeny(op({ formerUserIds: [ADMIN_A] }))
  await assertLogicalDeny(op({ sameEmailUserIds: [ADMIN_A] }))
  await assertLogicalDeny(op({ 'permissions.adminAccess': true }))
  await assertLogicalDeny(op({ firstName: 'Ok', dayRate: 200, role: 'manager' }))
  // Not theirs to edit: a manager without the Operatives permission, another manager, an admin, themselves as a privilege.
  await assertLogicalDeny(updateDoc(doc(await authDb(MGR_1311, 'mgr-plain-1311@test.com'), 'users', OP_1311), { mobileNumber: '1' }))
  await assertLogicalDeny(updateDoc(doc(mgr, 'users', MGR_1311), { mobileNumber: '1' }))
  await assertLogicalDeny(updateDoc(doc(mgr, 'users', ADMIN_A), { mobileNumber: '1' }))
  await assertLogicalDeny(updateDoc(doc(mgr, 'users', OPS_MGR_1311), { dayRate: 999 }))
  // Company B's admin never edits company A's operative.
  await assertLogicalDeny(updateDoc(doc(await authDb(ADMIN_B, 'admin-b@test.com'), 'users', OP_1311), { mobileNumber: '1' }))
})

test('1.31.1: an operative edits only their own users document, never another person\'s (logical deny)', async () => {
  await seed1311People()
  const op = await authDb(OP_1311, 'op-1311@test.com')
  await assertSucceedsWithinBudget(updateDoc(doc(op, 'users', OP_1311), { firstName: 'Me', mobileNumber: '1' }))
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP_1311), { adminAccess: true }))
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP_1311), { dayRate: 999 }))
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP_1311), { assignedManagerUserIds: [OP_1311] }))
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP_1311), { isActive: false, firstName: 'x', dayRate: 1, role: 'admin' }))
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP2_1311), { mobileNumber: '1' }))
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP2_1311), { firstName: 'x', dayRate: 1, isActive: false, manager: true }))
  // Nobody switches their own self-manage toggles, on or off (1.28.0; before 1.31.1 this was refused only by the
  // expression limit, and the rules' own logic let an admin switch theirs off).
  const self = await authDb(ADMIN_1311, 'admin-1311@test.com')
  await assertLogicalDeny(updateDoc(doc(self, 'users', ADMIN_1311), { timesheetSelfSign: false }))
  await assertLogicalDeny(updateDoc(doc(self, 'users', ADMIN_1311), { annualLeaveSelfBook: false, 'permissions.annualLeaveSelfBook': false }))
  await assertSucceedsWithinBudget(updateDoc(doc(self, 'users', ADMIN_1311), { mobileNumber: '07700 900001' }))
  // An admin edits anyone in their company; only the Super Admin changes another admin's Super Admin flag.
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertSucceedsWithinBudget(updateDoc(doc(admin, 'users', OP_1311), { firstName: 'Opal', dayRate: 160, role: 'manager', manager: true, operativeMode: false }))
})

test('1.31.1: legacy materials are claimed by name or email; owned materials are never reassigned (logical deny)', async () => {
  await seed1311People()
  const op = await authDb(OP_1311, 'op-1311@test.com')
  const op2 = await authDb(OP2_1311, 'op2-1311@test.com')
  const mat = (db: Awaited<ReturnType<typeof authDb>>, id: string) => doc(db, 'organizations', ORG_A, 'materials', id)
  // A legacy row whose addedBy is the caller's "first surname" / "first last": claim it (only addedByUserId changes).
  await assertSucceedsWithinBudget(updateDoc(mat(op, 'legacy-name-1311'), { addedByUserId: OP_1311 }))
  await assertSucceedsWithinBudget(updateDoc(mat(op2, 'legacy-last-1311'), { addedByUserId: OP2_1311 }))
  // Not their name, or more than the claim: refused.
  await assertLogicalDeny(updateDoc(mat(op2, 'owned-1311'), { addedByUserId: OP2_1311 }))
  await assertLogicalDeny(updateDoc(mat(op, 'owned-1311'), { addedByUserId: OP2_1311 }))
  await assertLogicalDeny(updateDoc(mat(op2, 'owned-1311'), { name: 'Mine now' }))
  // The owner edits their own row.
  await assertSucceedsWithinBudget(updateDoc(mat(op, 'owned-1311'), { name: 'Lime 2' }))
})

// Rulebook 1.31.1 (second review): a privilege flag counts when it is on in EITHER place (top level or
// permissions.{key}), as adminLikeUser reads it. An operative written by web (top-level flags false) must not gain one
// through the permissions map, dotted or whole.
const OPF_1311 = 'op-flags-1311'
const PRIVILEGE_KEYS_1311 = ['adminAccess', 'manager', 'operatives', 'isSuperAdmin', 'annualLeaveSelfBook', 'timesheetSelfSign']

async function seedFlagsOperative1311() {
  await seed1311People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', OPF_1311), {
      email: 'op-flags-1311@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true,
      adminAccess: false, isSuperAdmin: false, manager: false, operatives: false, annualLeaveSelfBook: false, timesheetSelfSign: false,
      firstName: 'Fay', surname: 'Flags', assignedManagerUserId: OPS_MGR_1311,
      permissions: { operativeMode: true, adminAccess: false, manager: false, operatives: false, materials: false },
    })
  })
}

test('1.31.1: an operatives manager never sets a privilege flag through permissions (dotted or whole map)', async () => {
  await seedFlagsOperative1311()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const ref = doc(mgr, 'users', OPF_1311)
  for (const key of PRIVILEGE_KEYS_1311) {
    await assertLogicalDeny(updateDoc(ref, { [`permissions.${key}`]: true }))
    await assertLogicalDeny(updateDoc(ref, { permissions: { operativeMode: true, materials: false, [key]: true } }))
  }
  // The operative toggles still change.
  await assertSucceedsWithinBudget(updateDoc(ref, { 'permissions.materials': true, materials: true }))
})

test('1.31.1: an operatives manager creates operatives only with no privilege flag in either place', async () => {
  await seed1311People()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const base = { organizationId: ORG_A, role: 'operative', operativeMode: true, firstName: 'New', surname: 'Op' }
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 'new-op-1311-a'), { ...base, email: 'n1@test.com', adminAccess: false, permissions: { operativeMode: true, adminAccess: true } }))
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 'new-op-1311-b'), { ...base, email: 'n2@test.com', manager: true, operatives: true }))
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 'new-op-1311-c'), { ...base, email: 'n3@test.com', permissions: { operativeMode: true, isSuperAdmin: true } }))
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 'new-op-1311-d'), { ...base, email: 'n4@test.com', annualLeaveSelfBook: true }))
  await assertSucceedsWithinBudget(setDoc(doc(mgr, 'users', 'new-op-1311-e'), { ...base, email: 'n5@test.com', permissions: { operativeMode: true, materials: true } }))
})

test('1.31.1: nobody adds their own alias ids or a privilege through permissions; an admin keeps their own identity links', async () => {
  await seedFlagsOperative1311()
  const self = await authDb(ADMIN_1311, 'admin-1311@test.com')
  await assertLogicalDeny(updateDoc(doc(self, 'users', ADMIN_1311), { formerUserIds: [OP_1311] }))
  await assertLogicalDeny(updateDoc(doc(self, 'users', ADMIN_1311), { sameEmailUserIds: [OP_1311] }))
  await assertLogicalDeny(updateDoc(doc(self, 'users', ADMIN_1311), { email: 'someone-else@test.com' }))
  const op = await authDb(OPF_1311, 'op-flags-1311@test.com')
  for (const key of PRIVILEGE_KEYS_1311) {
    await assertLogicalDeny(updateDoc(doc(op, 'users', OPF_1311), { [`permissions.${key}`]: true }))
  }
  // Another admin still sets alias ids on someone else.
  await assertSucceedsWithinBudget(updateDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', OP_1311), { formerUserIds: ['old-op-1311'] }))
})

// ---------------------------------------------------------------------------
// Rulebook 1.31.1, third review: B1, B2, S1, S3, S4.
// ---------------------------------------------------------------------------

test('1.31.1 B1: only the Super Admin creates a Super Admin (top level or permissions)', async () => {
  await seed1311People()
  const admin = await authDb(ADMIN_1311, 'admin-1311@test.com')
  const base = { organizationId: ORG_A, role: 'admin', adminAccess: true }
  await assertLogicalDeny(setDoc(doc(admin, 'users', 'alt-1311a'), { ...base, email: 'alt-1311a@test.com', isSuperAdmin: true }))
  await assertLogicalDeny(setDoc(doc(admin, 'users', 'alt-1311b'), { ...base, email: 'alt-1311b@test.com', permissions: { isSuperAdmin: true } }))
  // An admin still adds an admin; the Super Admin (the creator) may add a Super Admin.
  await assertSucceedsWithinBudget(setDoc(doc(admin, 'users', 'alt-1311c'), { ...base, email: 'alt-1311c@test.com' }))
  await assertSucceedsWithinBudget(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', 'alt-1311d'), { ...base, email: 'alt-1311d@test.com', isSuperAdmin: true }))
})

const ADMINOP_1311 = 'adminop-1311'
const MGROP_1311 = 'mgrop-1311'
const SUPEROP_1311 = 'superop-1311'

async function seed1311StaffInOperativeMode() {
  await seed1311People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ADMINOP_1311), { email: 'adminop-1311@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, operativeMode: true })
    await setDoc(doc(db, 'users', MGROP_1311), { email: 'mgrop-1311@test.com', organizationId: ORG_A, role: 'manager', manager: true, operativeMode: true })
    await setDoc(doc(db, 'users', SUPEROP_1311), { email: 'superop-1311@test.com', organizationId: ORG_A, isSuperAdmin: true, adminAccess: true, operativeMode: true })
    await setDoc(doc(db, 'users', ADMINOP_1311, 'orgMemberships', ORG_A), { organizationId: ORG_A, role: 'admin', status: 'active' })
  })
}

test('1.31.1 B2: an operatives manager never deletes or pays an admin, Super Admin or manager in operative mode', async () => {
  await seed1311StaffInOperativeMode()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const history = (id: string, userId: string) => setDoc(doc(mgr, 'organizations', ORG_A, 'operativeDayRateHistory', id), {
    userId, operativeId: '', dayRate: 999, payBasis: 'day', effectiveAt: Timestamp.now(), createdAt: Timestamp.now(),
  })
  for (const target of [ADMINOP_1311, MGROP_1311, SUPEROP_1311]) {
    await assertLogicalDeny(deleteDoc(doc(mgr, 'users', target)))
    await assertLogicalDeny(history(`h-${target}`, target))
    await assertLogicalDeny(setDoc(doc(mgr, 'organizations', ORG_A, 'payProfiles', target), { userId: target, dayRate: 1, payBasis: 'day' }))
    await assertLogicalDeny(setDoc(doc(mgr, 'organizations', ORG_A, 'operativeProfiles', target), { userId: target, dayRate: 1 }))
    await assertLogicalDeny(updateDoc(doc(mgr, 'users', target), { mobileNumber: '1' }))
  }
  await assertLogicalDeny(deleteDoc(doc(mgr, 'users', ADMINOP_1311, 'orgMemberships', ORG_A)))
  // A real operative is still theirs to manage.
  await assertSucceedsWithinBudget(history('h-op-1311', OP_1311))
  await assertSucceedsWithinBudget(deleteDoc(doc(mgr, 'users', OP2_1311)))
})

test('1.31.1 S1: re-creating your own profile never sets your own pay, line manager or level', async () => {
  const uid = 'recreate-1311'
  const email = 'recreate-1311@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: uid })
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${uid}`]: 'operative' })
  })
  const db = await authDb(uid, email)
  const base = { email, organizationId: ORG_A, firstName: 'Re', surname: 'Create', ...ageFields() }
  await assertLogicalDeny(setDoc(doc(db, 'users', uid), { ...base, role: 'operative', operativeMode: true, dayRate: 999, payBasis: 'day' }))
  await assertLogicalDeny(setDoc(doc(db, 'users', uid), { ...base, role: 'operative', operativeMode: true, hasNoLineManager: true }))
  await assertLogicalDeny(setDoc(doc(db, 'users', uid), { ...base, role: 'operative', operativeMode: true, assignedManagerUserIds: [uid] }))
  await assertLogicalDeny(setDoc(doc(db, 'users', uid), { ...base, employmentType: 'self_employed' }))
  // Listed as an operative: the profile stays an operative.
  await assertLogicalDeny(setDoc(doc(db, 'users', uid), { ...base }))
  await assertSucceedsWithinBudget(setDoc(doc(db, 'users', uid), { ...base, role: 'operative', operativeMode: true }))
})

test('1.31.1 S3: an operatives manager creates no alias ids, no "No line manager" and takes no one else\'s email claim', async () => {
  await seed1311People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'userEmails', 'admin-1311@test.com'), { userId: ADMIN_1311 })
  })
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const base = { organizationId: ORG_A, role: 'operative', operativeMode: true, firstName: 'N', surname: 'Op' }
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 's3-a'), { ...base, email: 's3-a@test.com', formerUserIds: [ADMIN_1311] }))
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 's3-b'), { ...base, email: 's3-b@test.com', sameEmailUserIds: [ADMIN_1311] }))
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 's3-c'), { ...base, email: 's3-c@test.com', hasNoLineManager: true }))
  await assertLogicalDeny(setDoc(doc(mgr, 'users', 's3-d'), { ...base, email: 'admin-1311@test.com' }))
  await assertLogicalDeny(setDoc(doc(mgr, 'organizations', ORG_A, 'userEmails', 'admin-1311@test.com'), { userId: OP_1311 }))
  // Their own new operative and its claim, in one batch, still work.
  const batch = writeBatch(mgr)
  batch.set(doc(mgr, 'users', 's3-e'), { ...base, email: 's3-e@test.com' })
  batch.set(doc(mgr, 'organizations', ORG_A, 'userEmails', 's3-e@test.com'), { userId: 's3-e' })
  await assertSucceedsWithinBudget(batch.commit())
})

test('1.31.1 S4: an operatives row\'s account link changes only by an admin or an operatives manager (to an operative)', async () => {
  await seed1311People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A, 'operatives', 'row-s4'), { firstName: 'Otto', surname: 'Two', email: 'op2-1311@test.com', userId: OP2_1311 })
    await setDoc(doc(db, 'organizations', ORG_A, 'managers', 'mrow-s4'), { firstName: 'M', surname: 'Plain', email: 'mgr-plain-1311@test.com', userId: MGR_1311 })
  })
  const op = await authDb(OP_1311, 'op-1311@test.com')
  await assertLogicalDeny(updateDoc(doc(op, 'organizations', ORG_A, 'operatives', 'row-s4'), { userId: OP_1311 }))
  await assertLogicalDeny(updateDoc(doc(op, 'organizations', ORG_A, 'managers', 'mrow-s4'), { userId: OP_1311 }))
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  await assertLogicalDeny(updateDoc(doc(mgr, 'organizations', ORG_A, 'operatives', 'row-s4'), { userId: ADMIN_1311 }))
  await assertSucceedsWithinBudget(updateDoc(doc(mgr, 'organizations', ORG_A, 'operatives', 'row-s4'), { userId: OP_1311 }))
  await assertSucceedsWithinBudget(updateDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'organizations', ORG_A, 'managers', 'mrow-s4'), { userId: OPS_MGR_1311 }))
})

// ── Rulebook 1.31.1 F5: accepting an invitation needs the emailed invitation, not only its email ──────────────────
// Before 1.31.1 anyone signed in with the invitee's email (an unverified sign-up is enough) could copy a pending
// placeholder to their own users document, take the email claim and act at the invited level (probe c3).

async function seedF5Invite(tag: string, level: 'admin' | 'manager' | 'operative') {
  const placeholderId = `F5-PLACEHOLDER-${tag}`
  const email = `f5-${tag.toLowerCase()}@test.com`
  const invitationId = `f5-invite-${tag.toLowerCase()}`
  const levelFields =
    level === 'admin'
      ? { role: 'admin', adminAccess: true, permissions: { adminAccess: true } }
      : level === 'manager'
        ? { role: 'manager', manager: true, adminAccess: false, permissions: { manager: true, adminAccess: false } }
        : { role: 'operative', operativeMode: true, adminAccess: false, permissions: { operativeMode: true, adminAccess: false } }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', placeholderId), {
      email, organizationId: ORG_A, firstName: 'Fin', surname: tag, isSuperAdmin: false, passwordSet: false, isActive: true, ...levelFields,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: placeholderId })
    await setDoc(doc(db, 'users', placeholderId, 'private', 'taxIds'), { utrNumber: '3333333333', vatNumber: '', updatedByUserId: ADMIN_A, updatedAt: Timestamp.now() })
    await setDoc(doc(db, 'invitations', invitationId), { organizationId: ORG_A, email, role: level, isUsed: false, permissions: levelFields.permissions })
  })
  const account = (authUid: string, extra: Record<string, unknown> = {}) => ({
    email, organizationId: ORG_A, firstName: 'Fin', surname: tag, isSuperAdmin: false, isActive: true, passwordSet: true,
    ...levelFields, formerUserIds: [placeholderId], ...ageFields(), ...extra,
  })
  return { placeholderId, email, invitationId, account }
}

for (const level of ['operative', 'admin'] as const) {
  test(`1.31.1 F5: a genuine ${level} invite accept still passes every step (batch create + used, tax ids, claim, placeholder)`, async () => {
    const { placeholderId, email, invitationId, account } = await seedF5Invite(`OK-${level.toUpperCase()}`, level)
    const authUid = `f5-ok-${level}-auth`
    const db = await authDb(authUid, email)
    await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A, 'userEmails', email)))
    await assertSucceeds(getDoc(doc(db, 'users', placeholderId)))
    await assertSucceedsWithinBudget(acceptInviteBatch(db, authUid, account(authUid), invitationId))
    const used = await assertSucceeds(getDoc(doc(db, 'invitations', invitationId)))
    assert.equal(used.data()?.isUsed, true)
    await assertSucceedsWithinBudget(getDoc(doc(db, 'users', placeholderId, 'private', 'taxIds')))
    await assertSucceedsWithinBudget(setDoc(doc(db, 'users', authUid, 'private', 'taxIds'), taxIds(authUid, { utrNumber: '3333333333', vatNumber: '' })))
    await assertSucceedsWithinBudget(deleteDoc(doc(db, 'users', placeholderId, 'private', 'taxIds')))
    await assertSucceedsWithinBudget(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: authUid }))
    await assertSucceedsWithinBudget(deleteDoc(doc(db, 'users', placeholderId)))
  })
}

test('1.31.1 F5 (c3): a sign-up on the invitee email without the invitation is refused at every step', async () => {
  const { placeholderId, email, invitationId, account } = await seedF5Invite('C3', 'admin')
  const evil = 'f5-evil'
  const db = await authDb(evil, email)
  // 1. The placeholder copy without proof, with proof but the invitation left unused, or with another invitation's id.
  await assertLogicalDeny(setDoc(doc(db, 'users', evil), account(evil)))
  await assertLogicalDeny(setDoc(doc(db, 'users', evil), account(evil, { invitationId })))
  await assertLogicalDeny(acceptInviteBatch(db, evil, account(evil), 'invite-a'))
  // 2. Taking the email claim, editing or deleting the pending placeholder by email, reading or removing its tax ids.
  await assertLogicalDeny(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: evil }))
  await assertLogicalDeny(updateDoc(doc(db, 'users', placeholderId), { passwordSet: true }))
  await assertLogicalDeny(updateDoc(doc(db, 'users', placeholderId), { firstName: 'Evil' }))
  await assertLogicalDeny(deleteDoc(doc(db, 'users', placeholderId)))
  await assertLogicalDeny(getDoc(doc(db, 'users', placeholderId, 'private', 'taxIds')))
  await assertLogicalDeny(deleteDoc(doc(db, 'users', placeholderId, 'private', 'taxIds')))
  // 3. Marking the invitation used on its own, then acting at the invited level.
  await assertLogicalDeny(updateDoc(doc(db, 'invitations', invitationId), { isUsed: true }))
  // An upsert (no exists precondition) is judged as create and update; both refuse logically.
  await assertLogicalDeny(setDoc(doc(db, 'invitations', invitationId), { isUsed: true }, { merge: true }))
  await assertLogicalDeny(setDoc(doc(db, 'invitations', 'f5-evil-new-invite'), { organizationId: ORG_A, email, isUsed: false }))
  await assertLogicalDeny(updateDoc(doc(db, 'organizations', ORG_A), { name: 'pwn' }))
  await assertLogicalDeny(updateDoc(doc(db, 'users', OP_A), { dayRate: 1 }))
  // An upsert (no exists precondition) is judged as create and update; the emulator once failed it with an internal error.
  await assertLogicalDeny(setDoc(doc(db, 'users', OP_A), { dayRate: 1 }, { merge: true }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    const raw = ctx.firestore()
    const left = await getDoc(doc(raw, 'organizations', ORG_A, 'userEmails', email))
    assert.equal(left.data()?.userId, placeholderId)
    assert.equal((await getDoc(doc(raw, 'invitations', invitationId))).data()?.isUsed, false)
    assert.equal((await getDoc(doc(raw, 'users', evil))).exists(), false)
  })
})

test('1.31.1 F5: an account of another company that lists the placeholder id cannot take the claim or the placeholder', async () => {
  const { placeholderId, email } = await seedF5Invite('ALIAS', 'operative')
  const evil = 'f5-alias-evil'
  const evilOrg = 'org-f5-alias'
  const db = await authDb(evil, email)
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', evil), {
      email, organizationId: evilOrg, role: 'admin', adminAccess: true, passwordSet: true, formerUserIds: [placeholderId],
    })
  })
  await assertLogicalDeny(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: evil }))
  await assertLogicalDeny(deleteDoc(doc(db, 'users', placeholderId)))
  await assertLogicalDeny(updateDoc(doc(db, 'users', placeholderId), { firstName: 'Evil' }))
  await assertLogicalDeny(getDoc(doc(db, 'users', placeholderId, 'private', 'taxIds')))
})

test('1.31.1 F5: a person\'s own save still syncs names to a same-email account, never to a pending placeholder', async () => {
  const me = 'f5-sync-me'
  const email = 'f5-sync@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', me), { email, organizationId: ORG_A, role: 'operative', operativeMode: true, passwordSet: true, firstName: 'Sy' })
    await setDoc(doc(db, 'users', 'f5-sync-copy'), { email, organizationId: ORG_A, role: 'operative', operativeMode: true, passwordSet: true, firstName: 'Sy' })
    await setDoc(doc(db, 'users', 'F5-SYNC-PENDING'), { email, organizationId: ORG_A, role: 'operative', operativeMode: true, passwordSet: false, firstName: 'Sy' })
  })
  const db = await authDb(me, email)
  await assertSucceedsWithinBudget(updateDoc(doc(db, 'users', 'f5-sync-copy'), { firstName: 'Syd' }))
  // Web saveUser leaves it out (sameEmailUserRefs includePending only for admins); the rules refuse it logically.
  await assertLogicalDeny(updateDoc(doc(db, 'users', 'F5-SYNC-PENDING'), { firstName: 'Syd' }))
})

test('1.31.1 S4: an operatives manager still creates an operatives row linked to an operative they manage (reviewer matrix)', async () => {
  await seed1311People()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  // The matrix payload: many link-like fields beside userId. It went over the expression limit after S4's link gate.
  const row = (uid: string) => ({
    userId: uid, operativeId: uid, personId: uid, ownerUserId: uid, addedByUserId: uid, createdBy: uid, createdByUserId: uid,
    status: 'pending', date: '2026-11-10', projectId: 'p1', organizationId: ORG_A, name: 'n', firstName: 'Otto',
  })
  await assertSucceedsWithinBudget(setDoc(doc(mgr, 'organizations', ORG_A, 'operatives', 'row-s4-create'), row(OP_1311)))
  await assertLogicalDeny(setDoc(doc(mgr, 'organizations', ORG_A, 'operatives', 'row-s4-create-admin'), row(ADMIN_1311)))
  await assertLogicalDeny(setDoc(doc(mgr, 'organizations', ORG_A, 'operatives', 'row-s4-create-self'), row(OPS_MGR_1311)))
})

// ── Rulebook 1.31.1, fourth review ────────────────────────────────────────────────────────────────────────────────
test('1.31.1 B-1: an operatives manager sees, deletes and creates only their own operative invitations', async () => {
  await seed1311People()
  const adminEmail = 'b1-admin-invitee@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'invitations', 'b1-admin-inv'), {
      organizationId: ORG_A, email: adminEmail, role: 'admin', permissions: { adminAccess: true }, isUsed: false, invitedBy: ADMIN_A,
    })
    await setDoc(doc(db, 'invitations', 'b1-own-inv'), {
      organizationId: ORG_A, email: 'b1-own@test.com', role: 'operative', permissions: { operativeMode: true }, isUsed: false, invitedBy: OPS_MGR_1311,
    })
    await setDoc(doc(db, 'users', 'B1-ADMIN-PLACEHOLDER'), {
      email: adminEmail, organizationId: ORG_A, role: 'admin', adminAccess: true, passwordSet: false, isActive: true,
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', adminEmail), { userId: 'B1-ADMIN-PLACEHOLDER' })
  })
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const invites = collection(mgr, 'invitations')
  // Listing the organisation's invitations would hand out an admin invitation's secret id.
  await assertLogicalDeny(getDocs(query(invites, where('organizationId', '==', ORG_A))))
  const own = await assertSucceeds(getDocs(query(invites, where('organizationId', '==', ORG_A), where('invitedBy', '==', OPS_MGR_1311))))
  assert.deepEqual(own.docs.map((d) => d.id), ['b1-own-inv'])
  // Web deleteUser's cleanup query for an operatives manager (organisation + email + invitedBy).
  await assertSucceeds(getDocs(query(invites, where('organizationId', '==', ORG_A), where('email', '==', 'b1-own@test.com'), where('invitedBy', '==', OPS_MGR_1311))))
  await assertLogicalDeny(deleteDoc(doc(mgr, 'invitations', 'b1-admin-inv')))
  await assertSucceeds(deleteDoc(doc(mgr, 'invitations', 'b1-own-inv')))
  const opInvite = (email: string, invitedBy: string) => ({
    organizationId: ORG_A, email, role: 'operative', permissions: { operativeMode: true }, isUsed: false, invitedBy,
  })
  // An operative invitation minted for the admin invitee's email, or in someone else's name, is refused.
  await assertLogicalDeny(setDoc(doc(mgr, 'invitations', 'b1-mint'), opInvite(adminEmail, OPS_MGR_1311)))
  await assertLogicalDeny(setDoc(doc(mgr, 'invitations', 'b1-other-name'), opInvite('b1-new@test.com', ADMIN_A)))
  await assertSucceedsWithinBudget(setDoc(doc(mgr, 'invitations', 'b1-new'), opInvite('b1-new@test.com', OPS_MGR_1311)))
  // iOS writes invitedBy as the sender's email: that is the caller too, for create and list.
  await assertSucceedsWithinBudget(setDoc(doc(mgr, 'invitations', 'b1-new-ios'), opInvite('b1-new-ios@test.com', 'ops-mgr-1311@test.com')))
  await assertSucceeds(getDocs(query(invites, where('organizationId', '==', ORG_A), where('invitedBy', '==', 'ops-mgr-1311@test.com'))))
  await assertLogicalDeny(getDocs(query(invites, where('organizationId', '==', ORG_A), where('invitedBy', '==', 'admin-a@test.com'))))
  // Admins still list every invitation of their organisation.
  await assertSucceeds(getDocs(query(collection(await authDb(ADMIN_A, 'admin-a@test.com'), 'invitations'), where('organizationId', '==', ORG_A))))
})

test('1.31.1 B-1: an operative invitation never copies an admin or manager placeholder; a membership takes the invitation role', async () => {
  const email = 'b1-level@test.com'
  const evil = 'b1-level-evil'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'B1-LEVEL-PH'), {
      email, organizationId: ORG_A, firstName: 'Lev', role: 'admin', adminAccess: true, isSuperAdmin: false, passwordSet: false, isActive: true,
      permissions: { adminAccess: true },
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: 'B1-LEVEL-PH' })
    await setDoc(doc(db, 'invitations', 'b1-level-op'), {
      organizationId: ORG_A, email, role: 'operative', permissions: { operativeMode: true }, isUsed: false, invitedBy: 'someone',
    })
  })
  const db = await authDb(evil, email)
  const copy = {
    email, organizationId: ORG_A, firstName: 'Lev', role: 'admin', adminAccess: true, isSuperAdmin: false, isActive: true,
    permissions: { adminAccess: true }, passwordSet: true, formerUserIds: ['B1-LEVEL-PH'], ...ageFields(),
  }
  await assertLogicalDeny(acceptInviteBatch(db, evil, copy, 'b1-level-op'))
  const managerCopy = { ...copy, role: 'manager', adminAccess: false, manager: true, permissions: { manager: true } }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'B1-LEVEL-PH'), { ...managerCopy, passwordSet: false, formerUserIds: [] })
  })
  await assertLogicalDeny(acceptInviteBatch(db, evil, managerCopy, 'b1-level-op'))
  // The membership route takes exactly the invitation's role.
  const membership = (role: string) => ({
    organizationId: ORG_A, role, status: 'active', isSuperAdmin: false, accountActive: true, permissions: { operativeMode: true },
    invitationId: 'b1-level-op', invitedBy: 'someone',
  })
  const batch = (role: string) => {
    const b = writeBatch(db)
    b.set(doc(db, 'users', evil, 'orgMemberships', ORG_A), membership(role))
    b.update(doc(db, 'invitations', 'b1-level-op'), { isUsed: true, usedAt: Timestamp.now() })
    return b.commit()
  }
  await assertLogicalDeny(batch('admin'))
  await assertLogicalDeny(batch('manager'))
  await assertSucceeds(batch('operative'))
})

for (const level of ['operative', 'manager'] as const) {
  test(`1.31.1 S-1: a ${level} invitee finishes setup with no refusal (membership in the accept batch)`, async () => {
    const { placeholderId, email, invitationId, account } = await seedF5Invite(`S1-${level.toUpperCase()}`, level)
    const authUid = `s1-${level}-auth`
    const db = await authDb(authUid, email)
    let invitation: Record<string, unknown> = {}
    await env.withSecurityRulesDisabled(async (ctx) => {
      invitation = (await getDoc(doc(ctx.firestore(), 'invitations', invitationId))).data() ?? {}
    })
    const write = inviteMembershipWrites({ invitation, invitationId, authUid, now: Timestamp.now() })
    assert.ok(write)
    const batch = writeBatch(db)
    batch.set(doc(db, 'users', authUid), { ...account(authUid), invitationId })
    batch.set(doc(db, 'users', authUid, 'orgMemberships', write.organizationId), write.membership)
    batch.update(doc(db, 'invitations', invitationId), { isUsed: true, usedAt: Timestamp.now() })
    await assertSucceedsWithinBudget(batch.commit())
    await assertSucceedsWithinBudget(getDoc(doc(db, 'users', placeholderId, 'private', 'taxIds')))
    await assertSucceedsWithinBudget(setDoc(doc(db, 'users', authUid, 'private', 'taxIds'), taxIds(authUid, { utrNumber: '3333333333', vatNumber: '' })))
    await assertSucceedsWithinBudget(deleteDoc(doc(db, 'users', placeholderId, 'private', 'taxIds')))
    await assertSucceedsWithinBudget(setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: authUid }))
    await assertSucceedsWithinBudget(deleteDoc(doc(db, 'users', placeholderId)))
    // ensurePrimaryOrgMembership finds the membership and writes nothing.
    const mine = await assertSucceeds(getDoc(doc(db, 'users', authUid, 'orgMemberships', ORG_A)))
    assert.equal(mine.data()?.role, level)
    await assertSucceeds(getDoc(doc(db, 'users', authUid)))
    await assertSucceeds(getDoc(doc(db, 'organizations', ORG_A)))
    // Before 1.31.1 S-1 the app wrote the membership afterwards, which a non-admin may not do.
    await assertFails(setDoc(doc(db, 'users', authUid, 'orgMemberships', 'org-s1-other'), { role: level, status: 'active' }))
  })
}

test('1.31.1 (fourth review): an operatives manager creates a linked operatives row with email and pay', async () => {
  await seed1311People()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const row = { name: 'Opal One', firstName: 'Opal', lastName: 'One', email: 'op-1311@test.com', userId: OP_1311, dayRate: 150, payBasis: 'day', isActive: true, organizationId: ORG_A }
  await assertSucceedsWithinBudget(setDoc(doc(mgr, 'organizations', ORG_A, 'operatives', 'row-r4-linked'), row))
  await assertLogicalDeny(setDoc(doc(mgr, 'organizations', ORG_A, 'operatives', 'row-r4-admin'), { ...row, email: 'admin-1311@test.com', userId: ADMIN_1311 }))
})

// ── Rulebook 1.31.1, fifth review (ROOT: privilege values are typed) ─────────────────────────────────────────────
const BAD_FLAG_VALUES: unknown[] = [1, 1.5, 'true', 2]
test('1.31.1 ROOT: an operatives manager writes no non-bool privilege value onto an operative', async () => {
  await seed1311People()
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  const op = doc(mgr, 'users', OP_1311)
  for (const v of BAD_FLAG_VALUES) {
    await assertLogicalDeny(updateDoc(op, { 'permissions.adminAccess': v }))
    await assertLogicalDeny(updateDoc(op, { adminAccess: v }))
    await assertLogicalDeny(updateDoc(op, { 'permissions.manager': v }))
    await assertLogicalDeny(updateDoc(op, { operativeMode: v }))
  }
  // 1.0 is sent as a double by the REST probes; the SDK sends 1.0 as the integer 1, covered above.
  await assertSucceedsWithinBudget(updateDoc(op, { firstName: 'Opal' }))
  await assertSucceedsWithinBudget(updateDoc(op, { 'permissions.materials': true }))
})

test('1.31.1 ROOT: a person writes no non-bool admin or Super Admin value onto themself', async () => {
  await seed1311People()
  const me = doc(await authDb(OP_1311, 'op-1311@test.com'), 'users', OP_1311)
  for (const v of BAD_FLAG_VALUES) {
    await assertLogicalDeny(updateDoc(me, { adminAccess: v }))
    await assertLogicalDeny(updateDoc(me, { 'permissions.adminAccess': v }))
    await assertLogicalDeny(updateDoc(me, { isSuperAdmin: v }))
  }
  await assertSucceeds(updateDoc(me, { firstName: 'Opal' }))
})

test('1.31.1 ROOT: invitations, memberships, members entries and roster rows take only bool flags and known roles', async () => {
  await seed1311People()
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  const inv = (extra: Record<string, unknown>) => ({ organizationId: ORG_A, email: 'root-inv@test.com', isUsed: false, invitedBy: ADMIN_A, ...extra })
  for (const v of BAD_FLAG_VALUES) {
    await assertLogicalDeny(setDoc(doc(admin, 'invitations', 'root-bad'), inv({ role: 'operative', permissions: { operativeMode: true, adminAccess: v } })))
  }
  for (const role of ['Admin', 'super_admin', 'owner']) {
    await assertLogicalDeny(setDoc(doc(admin, 'invitations', 'root-role'), inv({ role, permissions: { adminAccess: true } })))
  }
  await assertSucceeds(setDoc(doc(admin, 'invitations', 'root-ok'), inv({ role: 'admin', permissions: { adminAccess: true } })))
  // Memberships written by an admin.
  const m = doc(admin, 'users', OP_1311, 'orgMemberships', ORG_A)
  await assertLogicalDeny(setDoc(m, { organizationId: ORG_A, role: 'Admin', status: 'active' }))
  await assertLogicalDeny(setDoc(m, { organizationId: ORG_A, role: 'operative', status: 'active', permissions: { adminAccess: 'true' } }))
  await assertSucceeds(setDoc(m, { organizationId: ORG_A, role: 'operative', status: 'active', permissions: { operativeMode: true } }))
  // members map values.
  await assertLogicalDeny(updateDoc(doc(admin, 'organizations', ORG_A), { [`members.${OP_1311}`]: 'super_admin' }))
  await assertLogicalDeny(updateDoc(doc(admin, 'organizations', ORG_A), { [`members.${OP_1311}`]: 'Admin' }))
  await assertSucceeds(updateDoc(doc(admin, 'organizations', ORG_A), { [`members.${OP_1311}`]: 'operative' }))
  // Roster rows.
  await assertLogicalDeny(setDoc(doc(admin, 'organizations', ORG_A, 'operatives', 'root-row'), { name: 'R', adminAccess: 'true' }))
  await assertLogicalDeny(setDoc(doc(admin, 'organizations', ORG_A, 'managers', 'root-mrow'), { name: 'M', manager: 2 }))
  await assertSucceeds(setDoc(doc(admin, 'organizations', ORG_A, 'operatives', 'root-row'), { name: 'R', role: 'Engineer' }))
  // A users document created by an admin.
  await assertLogicalDeny(setDoc(doc(admin, 'users', 'root-new-user'), { organizationId: ORG_A, email: 'root-new@test.com', role: 'Admin' }))
  await assertLogicalDeny(setDoc(doc(admin, 'users', 'root-new-user'), { organizationId: ORG_A, email: 'root-new@test.com', role: 'operative', operativeMode: 'true' }))
})

test('1.31.1 S-B: an invitee copies the placeholder pay, line manager and toggles exactly (or leaves pay out)', async () => {
  const { placeholderId, email, invitationId, account } = await seedF5Invite('SB', 'operative')
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', placeholderId), {
      dayRate: 150, payBasis: 'day', employmentType: 'self_employed', assignedManagerUserId: ADMIN_A, assignedManagerUserIds: [ADMIN_A],
    })
  })
  const authUid = 'sb-auth'
  const db = await authDb(authUid, email)
  const placed = { dayRate: 150, payBasis: 'day', employmentType: 'self_employed', assignedManagerUserId: ADMIN_A, assignedManagerUserIds: [ADMIN_A] }
  for (const change of [
    { dayRate: 999 }, { payBasis: 'hourly', hourlyRate: 50 }, { employmentType: 'paye' }, { employmentTypeEffectiveAt: '2026-11-01' },
    { assignedManagerUserId: authUid, assignedManagerUserIds: [authUid] }, { hasNoLineManager: true },
    { annualLeaveSelfBook: true }, { timesheetSelfSign: true }, { permissions: { operativeMode: true, adminAccess: false, annualLeaveSelfBook: true } },
    { adminAccess: 1.5 }, { permissions: { operativeMode: true, adminAccess: 'true' } },
  ]) {
    await assertLogicalDeny(acceptInviteBatch(db, authUid, { ...account(authUid), ...placed, ...change }, invitationId))
  }
  // Pay may be left out only while private pay is on for the organisation (the app strips it then; F2).
  const { dayRate: _d, payBasis: _p, employmentType: _e, ...withoutPay } = { ...account(authUid), ...placed }
  void _d; void _p; void _e
  await assertLogicalDeny(acceptInviteBatch(db, authUid, withoutPay, invitationId))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platformConfig', 'app'), { privatePayOrganizationIds: [ORG_A] }, { merge: true })
  })
  await assertSucceedsWithinBudget(acceptInviteBatch(db, authUid, withoutPay, invitationId))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platformConfig', 'app'), { privatePayOrganizationIds: [] }, { merge: true })
  })
})

test('1.31.1 S-A: a signed-up operative, manager or admin cannot delete their own users document by its email', async () => {
  const people = [
    { id: 'sa-op', email: 'sa-op@test.com', role: 'operative', operativeMode: true },
    { id: 'sa-mgr', email: 'sa-mgr@test.com', role: 'manager', manager: true },
    { id: 'sa-admin', email: 'sa-admin@test.com', role: 'admin', adminAccess: true },
  ]
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const { id, ...rest } of people) {
      await setDoc(doc(db, 'users', id), { ...rest, organizationId: ORG_A, passwordSet: true, isActive: true })
    }
  })
  for (const p of people) {
    await assertLogicalDeny(deleteDoc(doc(await authDb(p.id, p.email), 'users', p.id)))
  }
})

test('1.31.1 S-D, NIT-1, NIT-2: invitedBy matches the sender email in any case; operative-only deletes; invitation identity is fixed', async () => {
  await seed1311People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'invitations', 'sd-mixed'), {
      organizationId: ORG_A, email: 'sd-mixed@test.com', role: 'operative', permissions: { operativeMode: true }, isUsed: false,
      invitedBy: 'Ops-Mgr-1311@Test.com',
    })
    await setDoc(doc(db, 'invitations', 'n1-manager'), {
      organizationId: ORG_A, email: 'n1-mgr@test.com', role: 'manager', permissions: { manager: true }, isUsed: false, invitedBy: OPS_MGR_1311,
    })
    await setDoc(doc(db, 'invitations', 'n2-used'), {
      organizationId: ORG_A, email: 'n2@test.com', role: 'operative', permissions: { operativeMode: true }, isUsed: true, invitedBy: OPS_MGR_1311,
    })
  })
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  // S-D: iOS stores the sender's email as typed; the match ignores case.
  // S-E: web deleteUser's clean-up query in the iOS shape (invitedBy = the sender's email as stored).
  await assertSucceeds(getDocs(query(collection(mgr, 'invitations'), where('organizationId', '==', ORG_A), where('email', '==', 'sd-mixed@test.com'), where('invitedBy', '==', 'Ops-Mgr-1311@Test.com'))))
  await assertSucceeds(updateDoc(doc(mgr, 'invitations', 'sd-mixed'), { firstName: 'Sid' }))
  // NIT-1: an operatives manager deletes only operative invitations, even their own.
  await assertLogicalDeny(deleteDoc(doc(mgr, 'invitations', 'n1-manager')))
  // NIT-2: organisation, email and role are fixed; a used invitation is never reopened.
  await assertLogicalDeny(updateDoc(doc(mgr, 'invitations', 'n2-used'), { isUsed: false }))
  await assertLogicalDeny(updateDoc(doc(mgr, 'invitations', 'sd-mixed'), { email: 'other@test.com' }))
  const admin = await authDb(ADMIN_A, 'admin-a@test.com')
  await assertLogicalDeny(updateDoc(doc(admin, 'invitations', 'sd-mixed'), { organizationId: ORG_B }))
  await assertLogicalDeny(updateDoc(doc(admin, 'invitations', 'sd-mixed'), { role: 'admin', permissions: { adminAccess: true } }))
  await assertLogicalDeny(updateDoc(doc(admin, 'invitations', 'n2-used'), { isUsed: false }))
  await assertSucceeds(updateDoc(doc(admin, 'invitations', 'sd-mixed'), { isUsed: true }))
  await assertSucceeds(deleteDoc(doc(mgr, 'invitations', 'sd-mixed')))
})

// ── Rulebook 1.31.1, sixth review ─────────────────────────────────────────────────────────────────────────────────
test('1.31.1 F1: an operative invitee cannot drop their operative level, line manager or toggles on accept', async () => {
  const { placeholderId, email, invitationId, account } = await seedF5Invite('F1', 'operative')
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', placeholderId), { assignedManagerUserId: ADMIN_A, assignedManagerUserIds: [ADMIN_A], annualLeaveSelfBook: false })
  })
  const authUid = 'f1-auth'
  const db = await authDb(authUid, email)
  const full = { ...account(authUid), assignedManagerUserId: ADMIN_A, assignedManagerUserIds: [ADMIN_A], annualLeaveSelfBook: false }
  const without = (...keys: string[]) => Object.fromEntries(Object.entries(full).filter(([k]) => !keys.includes(k)))
  await assertLogicalDeny(acceptInviteBatch(db, authUid, without('role', 'operativeMode', 'permissions'), invitationId))
  await assertLogicalDeny(acceptInviteBatch(db, authUid, without('role', 'operativeMode'), invitationId))
  await assertLogicalDeny(acceptInviteBatch(db, authUid, { ...without('role', 'operativeMode'), permissions: { adminAccess: false } }, invitationId))
  await assertLogicalDeny(acceptInviteBatch(db, authUid, without('assignedManagerUserId', 'assignedManagerUserIds'), invitationId))
  await assertLogicalDeny(acceptInviteBatch(db, authUid, without('annualLeaveSelfBook'), invitationId))
  await assertSucceedsWithinBudget(acceptInviteBatch(db, authUid, full, invitationId))
})

test('1.31.1 F9: an operatives manager marks their iOS-shaped invitation used within the budget', async () => {
  await seed1311People()
  const perms = {
    adminAccess: false, manager: false, operatives: false, skills: false, qualifications: false, materials: true, projects: true,
    smallWorks: true, operativeMode: true, annualLeaveSelfBook: false, weeklyReports: false, dailyOverview: true, subContractors: false,
    siteAudit: true, wholesalersOrderHistory: true,
  }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'invitations', 'f9-ios'), { organizationId: ORG_A, email: 'f9-ios@test.com', permissions: perms, isUsed: false, invitedBy: OPS_MGR_1311, firstName: 'I' })
    await setDoc(doc(db, 'invitations', 'f9-ios-email'), { organizationId: ORG_A, email: 'f9-ios2@test.com', permissions: perms, isUsed: false, invitedBy: 'Ops-Mgr-1311@Test.com' })
  })
  const mgr = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  await assertSucceedsWithinBudget(updateDoc(doc(mgr, 'invitations', 'f9-ios'), { isUsed: true, usedAt: Timestamp.now() }))
  await assertSucceedsWithinBudget(updateDoc(doc(mgr, 'invitations', 'f9-ios-email'), { isUsed: true }))
  await assertLogicalDeny(updateDoc(doc(mgr, 'invitations', 'f9-ios'), { isUsed: false }))
  // Re-pointing invitedBy to the caller's other identity (users id -> email) stays within budget; to someone else is refused.
  await assertSucceedsWithinBudget(updateDoc(doc(mgr, 'invitations', 'f9-ios'), { invitedBy: 'ops-mgr-1311@test.com' }))
  await assertLogicalDeny(updateDoc(doc(mgr, 'invitations', 'f9-ios'), { invitedBy: ADMIN_A }))
})

test('1.31.1 F11/F12: removing or nulling a top-level flag never unmasks a permissions copy on a self update', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'f11-mgr'), {
      email: 'f11-mgr@test.com', organizationId: ORG_A, role: 'manager', manager: true, isActive: true, passwordSet: true,
      annualLeaveSelfBook: false, timesheetSelfSign: false,
      permissions: { manager: true, annualLeaveSelfBook: true, timesheetSelfSign: true },
    })
    await setDoc(doc(db, 'users', 'f12-admin'), {
      email: 'f12-admin@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, isActive: true, passwordSet: true,
      isSuperAdmin: false, permissions: { adminAccess: true, isSuperAdmin: true },
    })
  })
  const mgr = doc(await authDb('f11-mgr', 'f11-mgr@test.com'), 'users', 'f11-mgr')
  await assertLogicalDeny(updateDoc(mgr, { annualLeaveSelfBook: deleteField() }))
  await assertLogicalDeny(updateDoc(mgr, { annualLeaveSelfBook: null }))
  await assertLogicalDeny(updateDoc(mgr, { timesheetSelfSign: deleteField() }))
  await assertSucceeds(updateDoc(mgr, { firstName: 'Mo' }))
  const admin = doc(await authDb('f12-admin', 'f12-admin@test.com'), 'users', 'f12-admin')
  await assertLogicalDeny(updateDoc(admin, { isSuperAdmin: deleteField() }))
  await assertLogicalDeny(updateDoc(admin, { isSuperAdmin: null }))
  await assertSucceeds(updateDoc(admin, { firstName: 'Ada' }))
  // An admin (not the Super Admin) cannot unmask their own self-manage toggle either.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'f11-admin'), {
      email: 'f11-admin@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true, isActive: true, passwordSet: true,
      annualLeaveSelfBook: false, permissions: { adminAccess: true, annualLeaveSelfBook: true },
    })
  })
  const admin2 = doc(await authDb('f11-admin', 'f11-admin@test.com'), 'users', 'f11-admin')
  await assertLogicalDeny(updateDoc(admin2, { annualLeaveSelfBook: deleteField() }))
  await assertLogicalDeny(updateDoc(admin2, { annualLeaveSelfBook: null }))
})

test('1.31.1 F2: a person never deletes their own employment type (self update, or accept without private pay)', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'f2-paye'), {
      email: 'f2-paye@test.com', organizationId: ORG_A, role: 'operative', operativeMode: true, employmentType: 'paye', isActive: true, passwordSet: true,
    })
  })
  const me = doc(await authDb('f2-paye', 'f2-paye@test.com'), 'users', 'f2-paye')
  await assertLogicalDeny(updateDoc(me, { employmentType: deleteField() }))
  await assertLogicalDeny(updateDoc(me, { employmentType: null }))
  await assertSucceeds(updateDoc(me, { firstName: 'Pat' }))
  // Accept: the copy keeps the placeholder's employment type unless private pay strips it.
  const { placeholderId, email, invitationId, account } = await seedF5Invite('F2', 'operative')
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', placeholderId), { employmentType: 'paye' })
  })
  const db = await authDb('f2-auth', email)
  await assertLogicalDeny(acceptInviteBatch(db, 'f2-auth', account('f2-auth'), invitationId))
  await assertSucceedsWithinBudget(acceptInviteBatch(db, 'f2-auth', { ...account('f2-auth'), employmentType: 'paye' }, invitationId))
})

test('1.31.1: a returning member who adds an invitation id still gets the typed-value check', async () => {
  const uid = 'typed-returning'
  const email = 'typed-returning@test.com'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await updateDoc(doc(db, 'organizations', ORG_A), { [`members.${uid}`]: 'operative' })
    await setDoc(doc(db, 'organizations', ORG_A, 'userEmails', email), { userId: uid })
  })
  const db = await authDb(uid, email)
  const base = { email, organizationId: ORG_A, role: 'operative', operativeMode: true, ...ageFields() }
  await assertLogicalDeny(setDoc(doc(db, 'users', uid), { ...base, invitationId: 'whatever', manager: 'true' }))
  await assertLogicalDeny(setDoc(doc(db, 'users', uid), { ...base, invitationId: 'whatever', role: 'Admin' }))
  await assertSucceeds(setDoc(doc(db, 'users', uid), { ...base, invitationId: 'whatever' }))
})

test('1.31.1 F4: a person cannot delete their own role to drop their operative level', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'f4-op'), {
      email: 'f4-op@test.com', organizationId: ORG_A, role: 'operative', isActive: true, passwordSet: true, permissions: { operativeMode: true },
    })
  })
  const me = doc(await authDb('f4-op', 'f4-op@test.com'), 'users', 'f4-op')
  await assertLogicalDeny(updateDoc(me, { role: deleteField() }))
  await assertLogicalDeny(updateDoc(me, { role: null }))
  await assertSucceeds(updateDoc(me, { firstName: 'Fay', role: 'operative' }))
})

// MARK: - Rulebook 1.33.0: line manager locked once set; My Projects picks; materials catalogue admins only

test('1.33.0 line manager locked: an Operatives manager sets it only on a placeholder (not yet accepted); admins any time', async () => {
  await seed112()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', H_OP), { passwordSet: true })
  })
  const mops = await authDb(H_MGR_OPS, 'h-mgr-ops@test.com')
  // Accepted (passwordSet true): the line manager is locked for them…
  await assertFails(updateDoc(doc(mops, 'users', H_OP), { assignedManagerUserIds: [H_MGR2] }))
  await assertFails(updateDoc(doc(mops, 'users', H_OP), { assignedManagerUserId: H_MGR2 }))
  await assertFails(updateDoc(doc(mops, 'users', H_OP), { assignedManagerUserIds: [] }))
  // …but resending the same value and editing other fields still work.
  await assertSucceeds(updateDoc(doc(mops, 'users', H_OP), { assignedManagerUserIds: [H_MGR_OPS], firstName: 'Olly' }))
  await assertSucceeds(updateDoc(doc(mops, 'users', H_OP), { hasNoLineManager: false }))
  // A placeholder (invite not accepted yet): they may still set it.
  await assertSucceeds(updateDoc(doc(mops, 'users', H_OP2), { assignedManagerUserIds: [H_MGR2] }))
  // Admins change anyone's line manager at any time.
  await assertSucceeds(updateDoc(doc(await authDb(H_AD, 'h-ad@test.com'), 'users', H_OP), { assignedManagerUserIds: [H_MGR2] }))
})

test('1.33.0 line manager locked: an Operatives manager changes it only on their own unused invitation', async () => {
  await seed112()
  const mops = await authDb(H_MGR_OPS, 'h-mgr-ops@test.com')
  const inv = doc(mops, 'invitations', 'h-op-invite')
  await assertSucceeds(updateDoc(inv, { assignedManagerUserIds: [H_MGR2] }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'invitations', 'h-op-invite'), { isUsed: true })
  })
  await assertFails(updateDoc(inv, { assignedManagerUserIds: [H_MGR_OPS] }))
  await assertFails(updateDoc(inv, { hasNoLineManager: true }))
})

test('1.33.0 My Projects / My Small works picks: each person reads and writes only their own list', async () => {
  await seed112()
  const mgr = await authDb(H_MGR, 'h-mgr@test.com')
  const mine = doc(mgr, 'organizations', ORG_H, 'worksListPicks', H_MGR)
  await assertSucceeds(setDoc(mine, { projects: ['h-p1'], updatedAt: serverTimestamp() }, { merge: true }))
  await assertSucceeds(setDoc(mine, { smallWorks: ['h-sw1'], updatedAt: serverTimestamp() }, { merge: true }))
  await assertSucceeds(getDoc(mine))
  await assertFails(setDoc(mine, { projects: ['h-p1'], updatedAt: serverTimestamp(), extra: true }, { merge: true }))
  await assertFails(setDoc(mine, { projects: 'h-p1', updatedAt: serverTimestamp() }, { merge: true }))
  await assertFails(setDoc(mine, { projects: Array.from({ length: 501 }, (_, i) => `j${i}`), updatedAt: serverTimestamp() }, { merge: true }))
  await assertFails(setDoc(mine, { projects: ['h-p1'], updatedAt: Timestamp.fromMillis(0) }, { merge: true }))
  // Someone else's list: never read or written, not even by an admin.
  await assertFails(getDoc(doc(await authDb(H_MGR2, 'h-mgr2@test.com'), 'organizations', ORG_H, 'worksListPicks', H_MGR)))
  await assertFails(getDoc(doc(await authDb(H_AD, 'h-ad@test.com'), 'organizations', ORG_H, 'worksListPicks', H_MGR)))
  await assertFails(setDoc(doc(await authDb(H_MGR2, 'h-mgr2@test.com'), 'organizations', ORG_H, 'worksListPicks', H_MGR), { projects: [], updatedAt: serverTimestamp() }))
  // Another company's member: nothing here.
  await assertFails(setDoc(doc(await authDb('h2-admin', 'h2-admin@test.com'), 'organizations', ORG_H, 'worksListPicks', 'h2-admin'), { projects: [], updatedAt: serverTimestamp() }))
  await assertSucceeds(deleteDoc(mine))
})

test('1.33.0 materials catalogue: admins only write it; managers and operatives read it', async () => {
  await seed112()
  const item = { name: 'Cement', unit: 'bag' }
  await assertFails(setDoc(doc(await authDb(H_MGR, 'h-mgr@test.com'), 'organizations', ORG_H, 'materialCatalogue', 'c1'), item))
  await assertFails(setDoc(doc(await authDb(H_MGR_OPS, 'h-mgr-ops@test.com'), 'organizations', ORG_H, 'materialCatalogue', 'c1'), item))
  await assertSucceeds(setDoc(doc(await authDb(H_AD, 'h-ad@test.com'), 'organizations', ORG_H, 'materialCatalogue', 'c1'), item))
  await assertSucceeds(getDoc(doc(await authDb(H_MGR, 'h-mgr@test.com'), 'organizations', ORG_H, 'materialCatalogue', 'c1')))
  await assertFails(updateDoc(doc(await authDb(H_MGR, 'h-mgr@test.com'), 'organizations', ORG_H, 'materialCatalogue', 'c1'), { unit: 'kg' }))
  await assertFails(deleteDoc(doc(await authDb(H_MGR, 'h-mgr@test.com'), 'organizations', ORG_H, 'materialCatalogue', 'c1')))
})

// ── Rulebook 1.32.4 §16: the rules read the caller's role from the auth claims (`pp`, authClaimsForPerson) ─────────
test('1.32.4 claims: a token without claims, with another company\'s claims, or with stale claims of a deactivated person is refused', async () => {
  const STALE = 'claims-1324-stale'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', STALE), { email: 'stale-1324@test.com', organizationId: ORG_A, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'organizations', ORG_A), { members: { [STALE]: 'admin' } }, { merge: true })
    await setDoc(doc(db, 'organizations', ORG_A, 'clients', 'c-1324'), { name: 'Client' })
  })
  const client = (db: Awaited<ReturnType<typeof authDb>>) => doc(db, 'organizations', ORG_A, 'clients', 'c-1324')
  // With the claims of its data: an admin of A reads and edits A's data.
  const fresh = await authDb(STALE, 'stale-1324@test.com')
  await assertSucceeds(getDoc(client(fresh)))
  await assertSucceeds(updateDoc(client(fresh), { name: 'Client Ltd' }))
  // No claims at all (before the backfill, or a token issued before the function ran): refused, although the users
  // document and the members map still say admin.
  const none = env.authenticatedContext(STALE, { email: 'stale-1324@test.com' }).firestore()
  await assertLogicalDeny(getDoc(client(none)))
  await assertLogicalDeny(updateDoc(client(none), { name: 'No claims' }))
  await assertLogicalDeny(deleteDoc(client(none)))
  // Claims for another organisation only: refused here.
  const otherOrg = env.authenticatedContext(STALE, {
    email: 'stale-1324@test.com',
    pp: { v: 1, s: 1, h: ORG_B, u: ['a', 'x'], o: { [ORG_B]: ['admin', 'admin', 'c', 'h', 'E', 'H'] } },
  }).firestore()
  await assertLogicalDeny(getDoc(client(otherOrg)))
  await assertLogicalDeny(updateDoc(client(otherOrg), { name: 'Wrong org' }))
  // Deactivated: the claims the function sets after the change refuse everything role-decided at once.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', STALE), { isActive: false })
  })
  const deactivated = await authDb(STALE, 'stale-1324@test.com')
  await assertLogicalDeny(getDoc(client(deactivated)))
  await assertLogicalDeny(updateDoc(client(deactivated), { name: 'Deactivated' }))
  await assertLogicalDeny(deleteDoc(client(deactivated)))
  // Bounded staleness (rulebook §16): a token issued before the deactivation still carries the old claims until it is
  // refreshed (at most an hour; refresh tokens are revoked). This pins that documented behaviour.
  await assertSucceeds(getDoc(client(fresh)))
  // Their own users document stays readable (the deactivated screen), with or without claims.
  await assertSucceeds(getDoc(doc(deactivated, 'users', STALE)))
  await assertSucceeds(getDoc(doc(none, 'users', STALE)))
  // The marker is the person's own to read; nobody writes it from an app.
  await assertSucceeds(getDoc(doc(deactivated, 'users', STALE, 'private', 'authClaims')))
  await assertLogicalDeny(getDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', STALE, 'private', 'authClaims')))
  await assertLogicalDeny(setDoc(doc(fresh, 'users', STALE, 'private', 'authClaims'), { v: 99 }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', STALE), { isActive: true })
  })
})

test('1.32.4 claims: a forged claim value cannot widen access (the rules read only the documented shape)', async () => {
  // A malformed `pp` (not the function's shape) is refused, not an error that grants.
  const forged = env.authenticatedContext('claims-1324-forged', { email: 'forged-1324@test.com', pp: { o: 'org-a' } }).firestore()
  await assertFails(getDoc(doc(forged, 'organizations', ORG_A, 'clients', 'c-1324')))
})

// ---------------------------------------------------------------------------
// Rulebook 1.34.0 §11: ghost operatives (bookable, no app login). More in tests/ghosts.rules.test.ts.
// ---------------------------------------------------------------------------

function ghost134(id: string, actor: string, lineManager = ADMIN_1311) {
  const plan = ghostCreateWrites({
    organizationId: ORG_A,
    ghostId: id,
    draft: { firstName: 'Gus', surname: 'Ghost', payBasis: 'day', dayRate: 150, lineManagerIds: [lineManager] },
    actorUserId: actor,
    platform: 'web',
  })
  if (!plan) throw new Error('no ghost plan')
  return { ...plan.user.fields, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
}

test('1.34.0: an Operatives manager creates a ghost; a manager without the toggle cannot', async () => {
  await seed1311People()
  await assertSucceedsWithinBudget(setDoc(doc(await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com'), 'users', 'ghost-134-a'), ghost134('ghost-134-a', OPS_MGR_1311)))
  await assertSucceedsWithinBudget(setDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', 'ghost-134-b'), ghost134('ghost-134-b', ADMIN_A)))
  await assertFails(setDoc(doc(await authDb(MGR_1311, 'mgr-plain-1311@test.com'), 'users', 'ghost-134-c'), ghost134('ghost-134-c', MGR_1311)))
  const ops = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  await assertLogicalDeny(setDoc(doc(ops, 'users', 'ghost-134-d'), { ...ghost134('ghost-134-d', OPS_MGR_1311), hasNoLineManager: true }))
  await assertLogicalDeny(setDoc(doc(ops, 'users', 'ghost-134-e'), { ...ghost134('ghost-134-e', OPS_MGR_1311), formerUserIds: [OP_1311] }))
})

test('1.34.0 R1: an Operatives manager never changes a ghost\'s line manager; an admin does; other fields stay theirs', async () => {
  await seed1311People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'ghost-134-r1'), ghost134('ghost-134-r1', ADMIN_A))
  })
  const ops = await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com')
  await assertLogicalDeny(updateDoc(doc(ops, 'users', 'ghost-134-r1'), { assignedManagerUserIds: [OPS_MGR_1311], assignedManagerUserId: OPS_MGR_1311 }))
  await assertFails(updateDoc(doc(ops, 'users', 'ghost-134-r1'), { ghost: false }))
  await assertSucceedsWithinBudget(updateDoc(doc(ops, 'users', 'ghost-134-r1'), { firstName: 'Gussie', dayRate: 160 }))
  await assertSucceedsWithinBudget(updateDoc(doc(await authDb(ADMIN_A, 'admin-a@test.com'), 'users', 'ghost-134-r1'), { assignedManagerUserIds: [MGR_1311], assignedManagerUserId: MGR_1311 }))
})

test('1.34.0: an Operatives manager deletes a ghost; a plain manager cannot', async () => {
  await seed1311People()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'ghost-134-del'), ghost134('ghost-134-del', ADMIN_A))
  })
  await assertFails(deleteDoc(doc(await authDb(MGR_1311, 'mgr-plain-1311@test.com'), 'users', 'ghost-134-del')))
  await assertSucceedsWithinBudget(deleteDoc(doc(await authDb(OPS_MGR_1311, 'ops-mgr-1311@test.com'), 'users', 'ghost-134-del')))
})
