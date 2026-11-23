/**
 * Rulebook 1.72.0 §8, §16 (owner decisions 23 Nov, A and B): the line manager's ⚙ and ✕ on a timesheet line under
 * review change the BOOKING. ⚙ writes the booking's times, slot, unpaid-break toggle and overtime rate (the 1.29.0
 * line-manager update, now with `isBreakRemoved`); ✕ deletes the booking with its tombstone in the same batch. These
 * tests prove the person's line manager may do both — written exactly as the rulebook builds them
 * (`timesheetReviewBookingEditWrites`, `timesheetReviewBookingDelete`) — and that nobody else may, never on their own
 * booking, a ghost's, another company's person's, and never without the tombstone. Emulator only (own project id).
 *
 *   RULES_PORT=8080 npx tsx --test tests/timesheetReviewBooking.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { deleteField, doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { timesheetReviewBookingDelete, timesheetReviewBookingEditWrites } from '../lib/canonical/timesheetReviewBookingWrites.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-trb'
const ORG2 = 'org-trb2'
const ADMIN = 'trb-admin'
const LM = 'trb-lm'
const OTHER = 'trb-other'
const OP = 'trb-op'
const MGR2 = 'trb-mgr2'
const GHOST = 'trb-ghost'
const AWAY = 'trb-away'
const DAY = Timestamp.fromMillis(Date.parse('2026-11-16T00:00:00Z'))

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function labour(id: string, operativeId: string) {
  return {
    id, operativeId, projectId: 'job1', jobCollection: 'projects', date: DAY,
    timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '16:00', isBreakRemoved: false,
    status: 'Confirmed', bookedBy: 'Ada', organizationId: ORG, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  }
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Review Co',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [OTHER]: 'manager', [OP]: 'operative', [MGR2]: 'manager', [GHOST]: 'operative' },
    })
    await setDoc(doc(d, 'organizations', ORG2), { name: 'Away Co', creatorUserId: AWAY, members: { [AWAY]: 'admin' } })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(LM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OTHER, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [LM] })
    await user(MGR2, { role: 'manager', manager: true, assignedManagerUserIds: [LM] })
    await user(GHOST, { role: 'operative', operativeMode: true, ghost: true, email: '', passwordSet: false, assignedManagerUserIds: [LM] })
    // A person of another company who happens to list LM: never LM's report here.
    await user(AWAY, { role: 'operative', operativeMode: true, organizationId: ORG2, assignedManagerUserIds: [LM] })
    // job1 is managed by the admin only: LM is not the job's manager.
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job1'), { name: 'Riverside', managerUserIds: [ADMIN], managerIds: [ADMIN] })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'), labour('B1', OP))
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'OWN'), labour('OWN', LM))
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'G1'), labour('G1', GHOST))
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'A1'), labour('A1', AWAY))
    await setDoc(doc(d, 'organizations', ORG, 'managerSiteBookings', 'MS1'), {
      id: 'MS1', userId: MGR2, date: DAY, timeSlot: 'FULL DAY', locationType: 'office', isBreakRemoved: false, organizationId: ORG,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-ts-review-booking',
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

function editPayload(uid: string, collection: 'bookings' | 'managerSiteBookings', booking: Record<string, unknown>, change: {
  start: string; end: string; isBreakRemoved: boolean; rate?: number | null
}) {
  const edit = timesheetReviewBookingEditWrites({
    booking: { ...booking, collection } as never,
    startTime: change.start,
    endTime: change.end,
    isBreakRemoved: change.isBreakRemoved,
    otMultiplierOverride: change.rate,
    slotWindow: { start: '07:00', end: '16:00' },
  })
  assert.ok(edit.ok && edit.changed, 'the rulebook builds a change')
  const fields: Record<string, unknown> = { ...edit.set, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' }
  for (const key of edit.remove) fields[key] = deleteField()
  return fields
}

function deleteBatch(d: Firestore, uid: string, collection: 'bookings' | 'managerSiteBookings', bookingId: string, opts: {
  tombstone?: boolean; deletedBy?: string; deleteBooking?: boolean
} = {}) {
  const plan = timesheetReviewBookingDelete({ booking: { id: bookingId, collection }, deletedBy: opts.deletedBy ?? uid, platform: 'web' })
  assert.ok(plan)
  const batch = writeBatch(d)
  if (opts.deleteBooking !== false) batch.delete(doc(d, 'organizations', ORG, collection, bookingId))
  if (opts.tombstone !== false) {
    batch.set(doc(d, 'organizations', ORG, 'deletedBookings', bookingId), { ...plan.tombstone, deletedAt: serverTimestamp() })
  }
  return batch
}

// MARK: - ⚙ changes the booking (1.72.0: the break toggle too)

test("the line manager changes their report's booking times and break toggle", async () => {
  const d = await db(LM)
  await assertSucceeds(updateDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'),
    editPayload(LM, 'bookings', labour('B1', OP), { start: '07:00', end: '19:00', isBreakRemoved: true, rate: 2 })))
})

test("the line manager changes their report's manager site booking (a Full day becomes custom hours)", async () => {
  const d = await db(LM)
  await assertSucceeds(updateDoc(doc(d, 'organizations', ORG, 'managerSiteBookings', 'MS1'),
    editPayload(LM, 'managerSiteBookings', { id: 'MS1', timeSlot: 'FULL DAY', isBreakRemoved: false }, { start: '07:00', end: '18:00', isBreakRemoved: false })))
})

test('isBreakRemoved must be true or false', async () => {
  const d = await db(LM)
  await assertFails(updateDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'), { isBreakRemoved: 'yes', updatedBy: LM, updatedFrom: 'web' }))
})

test('a manager who is neither the line manager nor the job manager cannot change the booking', async () => {
  const d = await db(OTHER)
  await assertFails(updateDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'),
    editPayload(OTHER, 'bookings', labour('B1', OP), { start: '07:00', end: '19:00', isBreakRemoved: true })))
})

test('the line manager may still change no other booking field', async () => {
  const d = await db(LM)
  await assertFails(updateDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'), { projectId: 'job2', updatedBy: LM, updatedFrom: 'web' }))
})

// MARK: - ✕ deletes the booking with its tombstone

test("the line manager deletes their report's booking with its tombstone in one batch", async () => {
  const d = await db(LM)
  await assertSucceeds(deleteBatch(d, LM, 'bookings', 'B1').commit())
})

test("the line manager deletes their report's manager site booking with its tombstone", async () => {
  const d = await db(LM)
  await assertSucceeds(deleteBatch(d, LM, 'managerSiteBookings', 'MS1').commit())
})

test('a delete without its tombstone is refused', async () => {
  const d = await db(LM)
  await assertFails(deleteBatch(d, LM, 'bookings', 'B1', { tombstone: false }).commit())
})

test('a tombstone without the delete is refused', async () => {
  const d = await db(LM)
  await assertFails(deleteBatch(d, LM, 'bookings', 'B1', { deleteBooking: false }).commit())
})

test('a tombstone that names someone else as the deleter is refused', async () => {
  const d = await db(LM)
  await assertFails(deleteBatch(d, LM, 'bookings', 'B1', { deletedBy: ADMIN }).commit())
})

test('a manager who is not the line manager cannot delete the booking', async () => {
  const d = await db(OTHER)
  await assertFails(deleteBatch(d, OTHER, 'bookings', 'B1').commit())
  await assertFails(deleteBatch(d, OTHER, 'managerSiteBookings', 'MS1').commit())
})

test('the line manager never deletes their own booking this way', async () => {
  const d = await db(LM)
  await assertFails(deleteBatch(d, LM, 'bookings', 'OWN').commit())
})

test("the line manager never deletes a ghost's booking this way (R2)", async () => {
  const d = await db(LM)
  await assertFails(deleteBatch(d, LM, 'bookings', 'G1').commit())
})

test("a person of another company who lists the line manager is not their report here", async () => {
  const d = await db(LM)
  await assertFails(deleteBatch(d, LM, 'bookings', 'A1').commit())
})

test('an operative cannot delete their own booking', async () => {
  const d = await db(OP)
  await assertFails(deleteBatch(d, OP, 'bookings', 'B1').commit())
})

test("the job's manager (admin) still deletes as before", async () => {
  const d = await db(ADMIN)
  await assertSucceeds(deleteBatch(d, ADMIN, 'bookings', 'B1').commit())
})
