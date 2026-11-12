/**
 * Rulebook 1.41.0 §5 (owner decision 11 Nov): "Replace existing booking" — the new booking (a create or the edit being
 * saved) and, for each replaced booking, its delete and its tombstone in ONE batch (`bookingReplaceWrites`). These
 * tests show the live rules accept that batch as it is for the people `canDeleteBooking` allows, refuse it whole for
 * anyone else (nothing half applied), and stay inside the lookup budget with several replaced bookings. Emulator only
 * (own project id). No rules change in 1.41.0.
 *
 *   RULES_PORT=8080 npx tsx --test tests/bookingReplace.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { bookingReplaceWrites } from '../lib/canonical/bookingReplace.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-rp'
const ADMIN = 'rp-admin'
const MGR = 'rp-mgr'
const OTHER = 'rp-other'
const OP = 'rp-op'
const DAY = Timestamp.fromMillis(Date.parse('2026-11-16T00:00:00Z'))

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function labour(id: string, job: string, extra: Record<string, unknown> = {}) {
  return {
    id, operativeId: OP, projectId: job, jobCollection: 'projects', date: DAY,
    timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '16:00', isBreakRemoved: false,
    status: 'Confirmed', bookedBy: 'Ada', notes: '', organizationId: ORG,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    ...extra,
  }
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Replace Co',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [MGR]: 'manager', [OTHER]: 'manager', [OP]: 'operative' },
    })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(MGR, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OTHER, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR] })
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job1'), { name: 'Riverside', managerUserIds: [MGR], managerIds: [MGR] })
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job2'), { name: 'Hilltop', managerUserIds: [OTHER], managerIds: [OTHER] })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'OLD1'), labour('OLD1', 'job1'))
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'OLD2'), labour('OLD2', 'job1', { workStartTime: '12:00', workEndTime: '18:00' }))
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'OLD3'), labour('OLD3', 'job1', { workStartTime: '06:00', workEndTime: '09:00' }))
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'ON2'), labour('ON2', 'job2'))
    await setDoc(doc(d, 'organizations', ORG, 'managerSiteBookings', 'MS1'), {
      id: 'MS1', userId: MGR, date: DAY, timeSlot: 'FULL DAY', locationType: 'office', isBreakRemoved: false, organizationId: ORG,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-replace',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await seed()
})

test.after(async () => {
  await env?.cleanup()
})

/** The Replace batch as web writes it: the create (with write metadata) and `bookingReplaceWrites`' deletes. */
function replaceBatch(
  d: Firestore,
  uid: string,
  booking: { collection: 'bookings' | 'managerSiteBookings'; bookingId: string; data?: Record<string, unknown>; update?: Record<string, unknown> },
  replaced: Array<{ collection: 'bookings' | 'managerSiteBookings'; bookingId: string }>
) {
  const plan = bookingReplaceWrites({ organizationId: ORG, booking, replaced, deletedBy: uid, deletedFrom: 'web' })
  assert.ok(plan, 'the rulebook builds a plan')
  const batch = writeBatch(d)
  const ref = doc(d, plan.bookingPath)
  if (booking.update) batch.update(ref, { ...booking.update, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })
  else batch.set(ref, { ...booking.data, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })
  for (const row of plan.deletes) {
    batch.delete(doc(d, row.path))
    batch.set(doc(d, row.tombstonePath), { ...row.tombstone, deletedAt: serverTimestamp() })
  }
  return batch
}

async function exists(p: string): Promise<boolean> {
  let out = false
  await env.withSecurityRulesDisabled(async (ctx) => {
    out = (await getDoc(doc(ctx.firestore(), p))).exists()
  })
  return out
}

test('the job\'s manager replaces a booking on their job: create + delete + tombstone in one batch', async () => {
  const d = await db(MGR)
  await assertSucceeds(replaceBatch(d, MGR, { collection: 'bookings', bookingId: 'NEW1', data: labour('NEW1', 'job1') }, [{ collection: 'bookings', bookingId: 'OLD1' }]).commit())
  assert.equal(await exists(`organizations/${ORG}/bookings/NEW1`), true)
  assert.equal(await exists(`organizations/${ORG}/bookings/OLD1`), false)
  assert.equal(await exists(`organizations/${ORG}/deletedBookings/OLD1`), true)
  // The replaced booking cannot come back (tombstone), even for the admin.
  await assertFails(setDoc(doc(await db(ADMIN), 'organizations', ORG, 'bookings', 'OLD1'), labour('OLD1', 'job1')))
})

test('three replaced bookings in one batch stay inside the lookup budget', async () => {
  const d = await db(MGR)
  await assertSucceeds(
    replaceBatch(d, MGR, { collection: 'bookings', bookingId: 'NEW3', data: labour('NEW3', 'job1', { workStartTime: '06:00', workEndTime: '18:00' }) }, [
      { collection: 'bookings', bookingId: 'OLD1' },
      { collection: 'bookings', bookingId: 'OLD2' },
      { collection: 'bookings', bookingId: 'OLD3' },
    ]).commit()
  )
})

test('a manager cannot replace a booking on a job they do not manage: refused whole, nothing changes', async () => {
  const d = await db(MGR)
  await assertFails(replaceBatch(d, MGR, { collection: 'bookings', bookingId: 'NEW2', data: labour('NEW2', 'job1') }, [{ collection: 'bookings', bookingId: 'ON2' }]).commit())
  assert.equal(await exists(`organizations/${ORG}/bookings/NEW2`), false, 'the new booking is not half saved')
  assert.equal(await exists(`organizations/${ORG}/bookings/ON2`), true)
  assert.equal(await exists(`organizations/${ORG}/deletedBookings/ON2`), false)
  // Another manager cannot replace on MGR's job either; an operative never.
  await assertFails(replaceBatch(await db(OTHER), OTHER, { collection: 'bookings', bookingId: 'NEW4', data: labour('NEW4', 'job2') }, [{ collection: 'bookings', bookingId: 'OLD1' }]).commit())
  await assertFails(replaceBatch(await db(OP), OP, { collection: 'bookings', bookingId: 'NEW5', data: labour('NEW5', 'job1') }, [{ collection: 'bookings', bookingId: 'OLD1' }]).commit())
})

test('an admin replaces across collections: a labour booking replaces a manager schedule booking', async () => {
  const d = await db(ADMIN)
  await assertSucceeds(
    replaceBatch(d, ADMIN, { collection: 'bookings', bookingId: 'NEW6', data: labour('NEW6', 'job2') }, [
      { collection: 'managerSiteBookings', bookingId: 'MS1' },
      { collection: 'bookings', bookingId: 'ON2' },
    ]).commit()
  )
  assert.equal(await exists(`organizations/${ORG}/managerSiteBookings/MS1`), false)
  assert.equal(await exists(`organizations/${ORG}/deletedBookings/MS1`), true)
})

test('a manager replaces their own office booking with a booking on their job', async () => {
  const d = await db(MGR)
  await assertSucceeds(
    replaceBatch(
      d,
      MGR,
      {
        collection: 'managerSiteBookings',
        bookingId: 'NEWM',
        data: {
          id: 'NEWM', userId: MGR, date: DAY, timeSlot: 'FULL DAY', locationType: 'project', locationId: 'job1', jobCollection: 'projects',
          isBreakRemoved: false, organizationId: ORG, createdAt: Timestamp.now(),
        },
      },
      [{ collection: 'managerSiteBookings', bookingId: 'MS1' }]
    ).commit()
  )
})

test('an edit with Replace: the edit and the replaced delete + tombstone in one batch', async () => {
  const d = await db(MGR)
  await assertSucceeds(
    replaceBatch(d, MGR, { collection: 'bookings', bookingId: 'OLD3', update: { workStartTime: '06:00', workEndTime: '13:00' } }, [
      { collection: 'bookings', bookingId: 'OLD1' },
    ]).commit()
  )
  assert.equal(await exists(`organizations/${ORG}/bookings/OLD1`), false)
})

/** The Replace as both apps write it from 1.41 review: a transaction that reads each replaced booking and its (missing)
 * tombstone first, then writes the create and each delete + tombstone. */
async function replaceTransaction(
  d: Firestore,
  uid: string,
  booking: { collection: 'bookings' | 'managerSiteBookings'; bookingId: string; data: Record<string, unknown> },
  replaced: Array<{ collection: 'bookings' | 'managerSiteBookings'; bookingId: string }>
) {
  const plan = bookingReplaceWrites({ organizationId: ORG, booking, replaced, deletedBy: uid, deletedFrom: 'web' })
  assert.ok(plan, 'the rulebook builds a plan')
  await runTransaction(d, async (tx) => {
    for (const row of plan.deletes) {
      const live = await tx.get(doc(d, row.path))
      const tombstone = await tx.get(doc(d, row.tombstonePath))
      assert.equal(live.exists(), true, 'the replaced booking is read live')
      assert.equal(tombstone.exists(), false, 'its tombstone is read and is missing')
    }
    tx.set(doc(d, plan.bookingPath), { ...booking.data, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })
    for (const row of plan.deletes) {
      tx.delete(doc(d, row.path))
      tx.set(doc(d, row.tombstonePath), { ...row.tombstone, deletedAt: serverTimestamp() })
    }
  })
}

test('transaction shape: the job\'s manager reads the live booking and its missing tombstone, then replaces it', async () => {
  const d = await db(MGR)
  await assertSucceeds(replaceTransaction(d, MGR, { collection: 'bookings', bookingId: 'NEWT', data: labour('NEWT', 'job1') }, [{ collection: 'bookings', bookingId: 'OLD1' }]))
  assert.equal(await exists(`organizations/${ORG}/bookings/NEWT`), true)
  assert.equal(await exists(`organizations/${ORG}/bookings/OLD1`), false)
  assert.equal(await exists(`organizations/${ORG}/deletedBookings/OLD1`), true)
})

test('transaction shape: a manager who may not delete the booking is refused whole, nothing changes', async () => {
  const d = await db(MGR)
  await assertFails(replaceTransaction(d, MGR, { collection: 'bookings', bookingId: 'NEWT2', data: labour('NEWT2', 'job1') }, [{ collection: 'bookings', bookingId: 'ON2' }]))
  assert.equal(await exists(`organizations/${ORG}/bookings/NEWT2`), false)
  assert.equal(await exists(`organizations/${ORG}/bookings/ON2`), true)
  assert.equal(await exists(`organizations/${ORG}/deletedBookings/ON2`), false)
})
