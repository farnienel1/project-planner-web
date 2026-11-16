/**
 * Owner console PR 1 (spec §1.1, §4.13, §6.3.2): the owner-only collections.
 * - `adminAuditLog`: created only by the verified owner, only in the PLAN A4 shape with `actorUid` = the caller;
 *   never updated or deleted, by anyone (the owner included).
 * - `ownerNotes`: the owner's own notes — owner read and write only.
 * - `erasedOrganizations`: the eraser's audit rows (§20) — owner read only, nobody writes from a client.
 * - The directory routes read `organizations`, `users` and `invitations` with the owner's token: the owner may list
 *   them; nobody else may list them whole.
 * Every case is refused for an organisation Super Admin, an Admin, a Manager, an Operative, signed out and the owner
 * email unverified.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { PLATFORM_OWNER_EMAIL } from '../lib/canonical/passwordPolicy.ts'
import { ownerAuditDocumentFields } from '../lib/owner/ownerAudit.ts'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, Timestamp } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(process.env.RULES_PATH || path.join(root, 'firestore.rules'), 'utf8')

const OWNER = 'oc-owner'
const ORG = 'oc-org'
const PEOPLE = {
  superAdmin: { uid: 'oc-sa', email: 'oc-sa@test.com', data: { role: 'admin', adminAccess: true, isSuperAdmin: true } },
  admin: { uid: 'oc-ad', email: 'oc-ad@test.com', data: { role: 'admin', adminAccess: true } },
  manager: { uid: 'oc-mgr', email: 'oc-mgr@test.com', data: { role: 'manager', manager: true } },
  operative: { uid: 'oc-op', email: 'oc-op@test.com', data: { role: 'operative', operativeMode: true } },
} as const

let env: RulesTestEnvironment

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-owner-console-rules',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG), {
      name: 'Owner console rules',
      creatorUserId: PEOPLE.superAdmin.uid,
      members: Object.fromEntries(Object.values(PEOPLE).map((p) => [p.uid, p.data.role])),
    })
    for (const person of Object.values(PEOPLE)) {
      await setDoc(doc(db, 'users', person.uid), { email: person.email, organizationId: ORG, isActive: true, passwordSet: true, ...person.data })
    }
    await setDoc(doc(db, 'users', OWNER), { email: PLATFORM_OWNER_EMAIL, organizationId: 'platform-owner' })
    await setDoc(doc(db, 'invitations', 'oc-inv'), { organizationId: ORG, email: 'new@test.com', isUsed: false })
    await setDoc(doc(db, 'adminAuditLog', 'existing'), { requestId: 'r0', action: 'ownerMarkInternal', phase: 'completed', actorUid: OWNER, at: Timestamp.now() })
    await setDoc(doc(db, 'ownerNotes', 'note-1'), { targetOrgId: ORG, text: 'Called them', status: 'new' })
    for (const name of ['analyticsDaily', 'analyticsMonthly', 'analyticsTotals', 'ownerAlerts', 'deletedOrganisations']) {
      await setDoc(doc(db, name, 'old'), { value: 1 })
    }
    await setDoc(doc(db, 'erasedOrganizations', 'gone'), { erasedAt: Timestamp.now(), name: 'Gone Ltd', status: 'erased' })
  })
})

test.after(async () => {
  await env.cleanup()
})

const owner = async (verified = true) =>
  (await claimsContext(env, OWNER, { email: PLATFORM_OWNER_EMAIL, email_verified: verified })).firestore()

type Db = Awaited<ReturnType<typeof owner>>
/** `uid` is the caller's own uid, so a create is refused by `isPlatformOwner()`, never by the actor check (review of #350). */
const OTHERS: { name: string; uid: string; db: () => Promise<Db> }[] = [
  ...Object.entries(PEOPLE).map(([name, person]) => ({
    name,
    uid: person.uid,
    db: async () => (await claimsContext(env, person.uid, { email: person.email, email_verified: true })).firestore() as Db,
  })),
  { name: 'signed out', uid: OWNER, db: async () => env.unauthenticatedContext().firestore() as Db },
  { name: 'owner email unverified', uid: OWNER, db: async () => owner(false) },
]

/** The REST body `ownerAuditDocumentFields` builds, read back as SDK values. */
function fromRestFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    const v = value as { stringValue?: string; timestampValue?: string }
    if (v.timestampValue !== undefined) out[key] = Timestamp.fromDate(new Date(v.timestampValue))
    else if (v.stringValue !== undefined) out[key] = v.stringValue
    else throw new Error(`unexpected REST value for ${key}`)
  }
  return out
}

const RETIRED = ['analyticsDaily', 'analyticsMonthly', 'analyticsTotals', 'ownerAlerts', 'deletedOrganisations'] as const

function audit(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'req-1',
    action: 'ownerMarkInternal',
    phase: 'requested',
    actorUid: OWNER,
    targetOrgId: ORG,
    reason: 'mark the demo company',
    before: '{"isInternal":false}',
    after: '{"isInternal":true}',
    ip: '203.0.113.9',
    userAgent: 'Playwright',
    at: serverTimestamp(),
    ...overrides,
  }
}

test('adminAuditLog: the owner creates an A4-shaped entry and reads the log', async () => {
  const db = await owner()
  await assertSucceeds(addDoc(collection(db, 'adminAuditLog'), audit()))
  await assertSucceeds(addDoc(collection(db, 'adminAuditLog'), { requestId: 'r', action: 'x', phase: 'completed', actorUid: OWNER, at: Timestamp.now() }))
  await assertSucceeds(getDocs(collection(db, 'adminAuditLog')))
})

test('adminAuditLog: an entry built by ownerAuditDocumentFields itself (REST before/after strings) is accepted', async () => {
  const fields = ownerAuditDocumentFields({
    requestId: 'req-rest-1',
    action: 'ownerChangeEmail',
    phase: 'completed',
    actorUid: OWNER,
    targetOrgId: ORG,
    targetUserId: PEOPLE.operative.uid,
    reason: 'typo in oc-op@test.com',
    before: { email: 'oc-op@test.com', dayRate: 250 },
    after: { email: 'op@test.com' },
    ip: '203.0.113.9',
    userAgent: 'Playwright',
    atIso: new Date().toISOString(),
  })
  const data = fromRestFields(fields)
  if (typeof data.before !== 'string' || typeof data.after !== 'string') throw new Error('before/after must be REST strings')
  await assertSucceeds(addDoc(collection(await owner(), 'adminAuditLog'), data))
})

test('adminAuditLog: the owner cannot write another actor, an unknown phase, an extra field, a bad type or no time', async () => {
  const db = await owner()
  await assertFails(addDoc(collection(db, 'adminAuditLog'), audit({ actorUid: 'someone-else' })))
  await assertFails(addDoc(collection(db, 'adminAuditLog'), audit({ phase: 'approved' })))
  await assertFails(addDoc(collection(db, 'adminAuditLog'), audit({ dayRate: 250 })))
  const noTime: Record<string, unknown> = audit()
  delete noTime.at
  await assertFails(addDoc(collection(db, 'adminAuditLog'), noTime))
  await assertFails(addDoc(collection(db, 'adminAuditLog'), audit({ action: '' })))
  await assertFails(addDoc(collection(db, 'adminAuditLog'), audit({ requestId: 7 })))
  await assertFails(addDoc(collection(db, 'adminAuditLog'), audit({ at: 'yesterday' })))
})

test('adminAuditLog: nobody edits or deletes an entry, the owner included', async () => {
  const db = await owner()
  await assertFails(updateDoc(doc(db, 'adminAuditLog', 'existing'), { action: 'tampered' }))
  await assertFails(setDoc(doc(db, 'adminAuditLog', 'existing'), audit()))
  await assertFails(deleteDoc(doc(db, 'adminAuditLog', 'existing')))
  for (const who of OTHERS) {
    const other = await who.db()
    await assertFails(updateDoc(doc(other, 'adminAuditLog', 'existing'), { action: 'tampered' }))
    await assertFails(deleteDoc(doc(other, 'adminAuditLog', 'existing')))
  }
})

test('ownerNotes: the owner reads and writes; erasedOrganizations: the owner reads, never writes', async () => {
  const db = await owner()
  await assertSucceeds(getDoc(doc(db, 'ownerNotes', 'note-1')))
  await assertSucceeds(setDoc(doc(db, 'ownerNotes', 'note-2'), { targetUserId: PEOPLE.operative.uid, text: 'Asked for a reset', status: 'done' }))
  await assertSucceeds(updateDoc(doc(db, 'ownerNotes', 'note-2'), { status: 'in_progress' }))
  await assertSucceeds(getDocs(collection(db, 'erasedOrganizations')))
  await assertFails(setDoc(doc(db, 'erasedOrganizations', 'forged'), { name: 'x' }))
  await assertFails(deleteDoc(doc(db, 'erasedOrganizations', 'gone')))
})

test('the retired collections are refused for the owner too (read, list and write)', async () => {
  const db = await owner()
  for (const name of RETIRED) {
    await assertFails(getDoc(doc(db, name, 'old')))
    await assertFails(getDocs(collection(db, name)))
    await assertFails(setDoc(doc(db, name, 'new'), { value: 2 }))
  }
})

test('the owner lists organisations and users (the directory and counts routes)', async () => {
  const db = await owner()
  await assertSucceeds(getDocs(collection(db, 'organizations')))
  await assertSucceeds(getDocs(collection(db, 'users')))
})

for (const who of OTHERS) {
  test(`${who.name}: refused on every owner-only collection and on the whole-collection lists`, async () => {
    const db = await who.db()
    await assertFails(getDocs(collection(db, 'adminAuditLog')))
    await assertFails(getDoc(doc(db, 'adminAuditLog', 'existing')))
    await assertFails(addDoc(collection(db, 'adminAuditLog'), audit({ actorUid: who.uid })))
    await assertFails(getDoc(doc(db, 'ownerNotes', 'note-1')))
    await assertFails(setDoc(doc(db, 'ownerNotes', 'note-x'), { text: 'x' }))
    await assertFails(updateDoc(doc(db, 'ownerNotes', 'note-1'), { status: 'done' }))
    await assertFails(deleteDoc(doc(db, 'ownerNotes', 'note-1')))
    for (const name of RETIRED) await assertFails(getDoc(doc(db, name, 'old')))
    await assertFails(getDocs(collection(db, 'ownerNotes')))
    await assertFails(getDoc(doc(db, 'erasedOrganizations', 'gone')))
    await assertFails(getDocs(collection(db, 'erasedOrganizations')))
    await assertFails(getDocs(collection(db, 'organizations')))
    await assertFails(getDocs(collection(db, 'users')))
    await assertFails(getDocs(collection(db, 'invitations')))
  })
}
