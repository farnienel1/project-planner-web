/**
 * Rulebook 1.84.0 §32 (owner decision D7): `clientErrors/{id}` — pseudonymous error reports with no message text. Create only, by a signed-in
 * account, in the exact shape (`clientErrorCreateFields`), with the document id the rules recompute from the caller's
 * uid and the day (`clientErrorDocId`: at most 20 a person a day); read only by the platform owner; never updated or
 * deleted by anyone.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'
import { clientErrorCreateFields, clientErrorDocId, clientErrorHashInput } from '../lib/canonical/clientErrors.ts'
import { PLATFORM_OWNER_EMAIL } from '../lib/canonical/passwordPolicy.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')
const ORG = 'org-ce'
const OTHER = 'org-ce-other'
const MEMBER = 'ce-member'
const OWNER = 'ce-owner'

let env: RulesTestEnvironment

async function db(uid: string, email = `${uid}@test.com`, verified = false): Promise<Firestore> {
  return (await claimsContext(env, uid, { email, email_verified: verified })).firestore()
}

function hexFor(uid: string, day = Math.floor(Date.now() / 86_400_000)): string {
  return createHash('sha256').update(clientErrorHashInput(uid, day)).digest('hex')
}

function idFor(uid: string, slot: number, nowMs = Date.now()): string {
  return clientErrorDocId(hexFor(uid, Math.floor(nowMs / 86_400_000)), slot)!
}

function report(overrides: Record<string, unknown> = {}, nowMs = Date.now()) {
  const f = clientErrorCreateFields({
    platform: 'web', source: 'window', name: 'TypeError', message: 'x is undefined',
    messageHash: createHash('sha256').update('x is undefined').digest('hex'),
    stack: '    at save (https://x/_next/static/chunks/page-1a.js:1:2)', route: '/dashboard', build: '1.84.0', organizationId: ORG, nowMs,
  })!
  const { expireAtMs, ...rest } = f
  return { ...rest, createdAt: serverTimestamp(), expireAt: Timestamp.fromMillis(expireAtMs), ...overrides }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-client-errors',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.after(async () => {
  await env?.cleanup()
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), { name: 'CE', creatorUserId: 'ce-admin', members: { 'ce-admin': 'admin', [MEMBER]: 'operative' } })
    await setDoc(doc(fs, 'organizations', OTHER), { name: 'Other', creatorUserId: 'x', members: { x: 'admin' } })
    await setDoc(doc(fs, 'users', MEMBER), { organizationId: ORG, role: 'operative', operativeMode: true, email: `${MEMBER}@test.com` })
    await setDoc(doc(fs, 'users', OWNER), { organizationId: 'platform', email: PLATFORM_OWNER_EMAIL })
  })
})

test('1.84.0 a signed-in member creates a report in the exact shape under their own hashed id', async () => {
  const fs = await db(MEMBER)
  await assertSucceeds(setDoc(doc(fs, 'clientErrors', idFor(MEMBER, 0)), report()))
  await assertSucceeds(setDoc(doc(fs, 'clientErrors', idFor(MEMBER, 19)), report({ organizationId: '' })))
})

test('1.84.0 the id must be the caller\'s own hash and a slot below 20 (at most 20 a day)', async () => {
  const fs = await db(MEMBER)
  await assertFails(setDoc(doc(fs, 'clientErrors', idFor('someone-else', 0)), report()))
  const hex = hexFor(MEMBER)
  for (const suffix of ['_20', '_01', '_-1', '_1a', '_', '_0_0', '']) {
    await assertFails(setDoc(doc(fs, 'clientErrors', `${hex}${suffix}`), report()))
  }
  await assertFails(setDoc(doc(fs, 'clientErrors', `${hex.toUpperCase()}_0`), report()))
  await assertFails(setDoc(doc(fs, 'clientErrors', 'random-id'), report()))
})

test('1.84.0 yesterday\'s day index (a report made just before midnight UTC) is accepted under yesterday\'s hash; older days are not', async () => {
  const fs = await db(MEMBER)
  const today = Math.floor(Date.now() / 86_400_000)
  await assertSucceeds(setDoc(doc(fs, 'clientErrors', `${hexFor(MEMBER, today - 1)}_0`), report({ dayIndex: today - 1 })))
  await assertFails(setDoc(doc(fs, 'clientErrors', `${hexFor(MEMBER, today - 2)}_0`), report({ dayIndex: today - 2 })))
  // The day in the hash must be the stored day.
  await assertFails(setDoc(doc(fs, 'clientErrors', `${hexFor(MEMBER, today)}_5`), report({ dayIndex: today - 1 })))
})

test('1.84.0 a slot already used cannot be written again (create only, never update or delete)', async () => {
  const fs = await db(MEMBER)
  const id = idFor(MEMBER, 3)
  await assertSucceeds(setDoc(doc(fs, 'clientErrors', id), report()))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ message: 'again' })))
  await assertFails(updateDoc(doc(fs, 'clientErrors', id), { message: 'changed' }))
  await assertFails(deleteDoc(doc(fs, 'clientErrors', id)))
})

test('1.84.0 the shape is exact: no message text, no extra key, typed and capped fields, server time, 30-day expiry', async () => {
  const fs = await db(MEMBER)
  const id = idFor(MEMBER, 1)
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ userId: MEMBER })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ message: 'Order is locked by Jane Smith' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ kind: 'Locked by Jane, a@b.co' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ where: 'page.js:12 save(Jane)' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ route: '/x?token=1' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ route: '/users/Jane' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ messageKey: 'Jane Smith' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ messageHash: 'abc' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ kind: 'x'.repeat(81) })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ platform: 'android' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ source: 'other' })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ createdAt: Timestamp.fromMillis(Date.now() - 60_000) })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ expireAt: Timestamp.fromMillis(Date.now() + 400 * 86_400_000) })))
  await assertFails(setDoc(doc(fs, 'clientErrors', id), report({ dayIndex: Math.floor(Date.now() / 86_400_000) + 5 })))
})

test('1.84.0 the organisation is one the caller belongs to, or none', async () => {
  const fs = await db(MEMBER)
  await assertFails(setDoc(doc(fs, 'clientErrors', idFor(MEMBER, 2)), report({ organizationId: OTHER })))
})

test('1.84.0 signed out: no report; only the platform owner reads reports', async () => {
  const anon = env.unauthenticatedContext().firestore()
  await assertFails(setDoc(doc(anon, 'clientErrors', idFor('nobody', 0)), report()))
  const member = await db(MEMBER)
  const id = idFor(MEMBER, 4)
  await assertSucceeds(setDoc(doc(member, 'clientErrors', id), report()))
  await assertFails(getDoc(doc(member, 'clientErrors', id)))
  await assertFails(getDocs(collection(member, 'clientErrors')))
  const owner = await db(OWNER, PLATFORM_OWNER_EMAIL, true)
  await assertSucceeds(getDoc(doc(owner, 'clientErrors', id)))
  await assertSucceeds(getDocs(collection(owner, 'clientErrors')))
  await assertFails(deleteDoc(doc(owner, 'clientErrors', id)))
})
