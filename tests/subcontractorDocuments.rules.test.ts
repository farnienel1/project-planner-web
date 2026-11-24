/**
 * Rulebook 1.82.0 §16 (owner answer 24 Nov, item 2): the 1.80.0 `documents` lists on
 * `organizations/{orgId}/subcontractors/{id}` are changed only by admins of the organisation and managers with the
 * Sub Contractors permission there (`canManageSubcontractors`), one list and one entry at a time, each new or changed
 * entry in the 1.80.0 write shape (`subcontractorDocumentAddWriteFields`) with its path in this organisation's
 * folder for this firm. A firm save that leaves `documents` alone is unchanged (any member). Emulator only.
 *
 *   RULES_PORT=8080 npx tsx --test tests/subcontractorDocuments.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import {
  subcontractorDocumentAddWriteFields,
  subcontractorDocumentExpiryWriteFields,
  subcontractorDocumentRemoveWriteFields,
  subcontractorDocumentStoragePath,
} from '../lib/canonical/subcontractorDocuments.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-sd'
const HOME = 'org-sd-home'
const SUB = 'sub-1'
const ADMIN = 'sd-admin'
const SUBMGR = 'sd-submgr' // manager with Sub Contractors
const MGR = 'sd-mgr' // manager without Sub Contractors
const OP = 'sd-op'
const VISITOR = 'sd-visitor' // home company HOME; a manager here through the members map, Sub Contractors on the membership
const STRANGER = 'sd-stranger' // admin of HOME only

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

const firm = (d: Firestore) => doc(d, 'organizations', ORG, 'subcontractors', SUB)

async function stored(): Promise<Record<string, unknown>> {
  let out: Record<string, unknown> = {}
  await env.withSecurityRulesDisabled(async (ctx) => {
    out = ((await getDoc(firm(ctx.firestore()))).data() ?? {}) as Record<string, unknown>
  })
  return out
}

function entryFor(uid: string, ms: number, extra: Record<string, unknown> = {}) {
  return {
    path: subcontractorDocumentStoragePath({ organizationId: ORG, subcontractorId: SUB, uid, unixMs: ms, extension: 'pdf' })!,
    name: 'Insurance.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1000,
    uploadedAtMs: ms,
    uploadedBy: uid,
    expiresOn: '2027-03-31',
    ...extra,
  }
}

/** The app's own add write (the 1.80.0 rule), as web `writeList` sends it. */
async function addAs(uid: string, ms = 1000, extra: Record<string, unknown> = {}) {
  const plan = subcontractorDocumentAddWriteFields(await stored(), {
    kind: 'insurance',
    subcontractorId: SUB,
    organizationId: ORG,
    entry: entryFor(uid, ms, extra) as never,
  })
  if (!plan.set) throw new Error(`no write: ${plan.outcome}`)
  return updateDoc(firm(await db(uid)), { [plan.set.fieldPath]: plan.set.value, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })
}

/** A raw add (not through the 1.80.0 writer, which refuses these entries itself): what an older or hostile client could send. */
async function rawAdd(uid: string, extra: Record<string, unknown>) {
  const list = (((await stored()).documents as { insurance?: unknown[] } | undefined)?.insurance ?? []) as unknown[]
  return updateDoc(firm(await db(uid)), { 'documents.insurance': [...list, { id: 'raw', ...entryFor(uid, 9000), ...extra }] })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-sub-docs',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.after(async () => {
  await env?.cleanup()
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Subs Co', creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [SUBMGR]: 'manager', [MGR]: 'manager', [OP]: 'operative', [VISITOR]: 'manager' },
    })
    await setDoc(doc(d, 'organizations', HOME), { name: 'Home Co', creatorUserId: STRANGER, members: { [STRANGER]: 'admin', [VISITOR]: 'manager' } })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, firstName: 'F', surname: id, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(SUBMGR, { role: 'manager', manager: true, subContractors: true })
    await user(MGR, { role: 'manager', manager: true, subContractors: false })
    await user(OP, { role: 'operative', operativeMode: true, subContractors: true })
    await user(VISITOR, { role: 'manager', manager: true, subContractors: false, organizationId: HOME })
    await user(STRANGER, { role: 'admin', adminAccess: true, isSuperAdmin: true, organizationId: HOME })
    await setDoc(doc(d, 'users', VISITOR, 'orgMemberships', ORG), {
      organizationId: ORG, role: 'manager', status: 'active', accountActive: true, permissions: { manager: true, subContractors: true },
    })
    await setDoc(firm(d), { name: 'Sparks Ltd', subcontractorType: 'Electrical', organizationId: ORG })
  })
})

test('a firm save that leaves documents alone is unchanged (any member, operatives included)', async () => {
  await assertSucceeds(updateDoc(firm(await db(OP)), { name: 'Sparks Ltd (renamed)' }))
  await assertSucceeds(updateDoc(firm(await db(MGR)), { phone: '0123' }))
  await assertSucceeds(setDoc(doc(await db(MGR), 'organizations', ORG, 'subcontractors', 'sub-new'), { name: 'New', subcontractorType: 'X' }))
})

test('admins, Sub Contractors managers and a visiting manager with the permission here add a document', async () => {
  await assertSucceeds(addAs(ADMIN, 1000))
  await assertSucceeds(addAs(SUBMGR, 2000))
  await assertSucceeds(addAs(VISITOR, 3000))
  const docs = (await stored()).documents as { insurance: unknown[] }
  if (docs.insurance.length !== 3) throw new Error('expected three entries')
})

test('a manager without the permission, an operative and another company cannot change the documents', async () => {
  await assertFails(addAs(MGR))
  await assertFails(addAs(OP))
  await assertFails(addAs(STRANGER))
})

test('remove one entry and change one expiry (the 1.80.0 writes)', async () => {
  await addAs(ADMIN, 1000)
  await addAs(ADMIN, 2000)
  const s = await stored()
  const id = ((s.documents as { insurance: Array<{ id: string }> }).insurance[0]).id
  const expiry = subcontractorDocumentExpiryWriteFields(s, { kind: 'insurance', subcontractorId: SUB, entryId: id, expiresOn: '2028-01-01' })
  await assertSucceeds(updateDoc(firm(await db(SUBMGR)), { [expiry.set!.fieldPath]: expiry.set!.value }))
  const removed = subcontractorDocumentRemoveWriteFields(await stored(), { kind: 'insurance', subcontractorId: SUB, entryId: id })
  await assertSucceeds(updateDoc(firm(await db(SUBMGR)), { [removed.set!.fieldPath]: removed.set!.value }))
  // A manager without the permission can neither change an expiry nor remove.
  const left = await stored()
  const leftId = ((left.documents as { insurance: Array<{ id: string }> }).insurance[0]).id
  const again = subcontractorDocumentRemoveWriteFields(left, { kind: 'insurance', subcontractorId: SUB, entryId: leftId })
  await assertFails(updateDoc(firm(await db(MGR)), { [again.set!.fieldPath]: again.set!.value }))
})

test('entries outside the 1.80.0 shape or folder are refused', async () => {
  // Another firm's folder, another organisation's folder, a URL.
  await assertFails(rawAdd(ADMIN, { path: `organizations/${ORG}/subcontractors/other/documents/${ADMIN}_1.pdf` }))
  await assertFails(rawAdd(ADMIN, { path: `organizations/${HOME}/subcontractors/${SUB}/documents/${ADMIN}_1.pdf` }))
  await assertFails(rawAdd(ADMIN, { path: 'https://example.com/x.pdf' }))
  await assertFails(rawAdd(ADMIN, { path: `organizations/${ORG}/subcontractors/${SUB}/documents/nested/x.pdf` }))
  // Someone else named as the uploader, an extra key, a bad expiry, a blank name.
  await assertFails(rawAdd(ADMIN, { uploadedBy: SUBMGR }))
  await assertFails(rawAdd(ADMIN, { url: 'https://example.com' }))
  await assertFails(rawAdd(ADMIN, { expiresOn: 'next March' }))
  await assertFails(rawAdd(ADMIN, { name: '' }))
  // A path in another letter case of this firm's folder is accepted (the reader compares ids without case).
  await assertSucceeds(rawAdd(ADMIN, { path: `organizations/${ORG.toUpperCase()}/subcontractors/${SUB.toUpperCase()}/documents/${ADMIN}_1.pdf` }))
})

test('one list, one entry per write; the other list and a stored entry are never rewritten', async () => {
  await addAs(ADMIN, 1000)
  const d = await db(ADMIN)
  const s = await stored()
  const insurance = (s.documents as { insurance: Record<string, unknown>[] }).insurance
  const extra = entryFor(ADMIN, 5000, { id: 'x5' })
  // Two entries added at once.
  await assertFails(updateDoc(firm(d), { 'documents.insurance': [...insurance, extra, entryFor(ADMIN, 6000, { id: 'x6' })] }))
  // Both lists changed at once.
  await assertFails(updateDoc(firm(d), { 'documents.insurance': [...insurance, extra], 'documents.rams': [entryFor(ADMIN, 7000, { id: 'x7' })] }))
  // An existing entry rewritten to another path.
  await assertFails(updateDoc(firm(d), { 'documents.insurance': [{ ...insurance[0], path: `organizations/${ORG}/subcontractors/${SUB}/documents/other.pdf` }] }))
  // A third key under documents.
  await assertFails(updateDoc(firm(d), { 'documents.photos': [extra] }))
  // A RAMS list may be added on its own.
  await assertSucceeds(updateDoc(firm(d), { 'documents.rams': [entryFor(ADMIN, 8000, { id: 'r8' })] }))
})

test('a create carrying documents follows the same rule', async () => {
  const entry = entryFor(ADMIN, 1000, { id: 'c1' })
  const ref = (d: Firestore) => doc(d, 'organizations', ORG, 'subcontractors', SUB.replace('1', '2'))
  const good = { name: 'B', documents: { insurance: [{ ...entry, path: entry.path.replace(`/${SUB}/`, `/${SUB.replace('1', '2')}/`) }] } }
  await assertFails(setDoc(ref(await db(MGR)), good))
  await assertSucceeds(setDoc(ref(await db(ADMIN)), good))
})

test('review of #442: an expiry change may change only expiresOn on that entry', async () => {
  await addAs(ADMIN, 1000)
  const d = await db(ADMIN)
  const insurance = ((await stored()).documents as { insurance: Record<string, unknown>[] }).insurance
  const one = insurance[0]
  await assertSucceeds(updateDoc(firm(d), { 'documents.insurance': [{ ...one, expiresOn: '2029-01-01' }] }))
  await assertFails(updateDoc(firm(d), { 'documents.insurance': [{ ...one, name: 'Renamed.pdf' }] }))
  await assertFails(updateDoc(firm(d), { 'documents.insurance': [{ ...one, uploadedBy: SUBMGR, expiresOn: '2030-01-01' }] }))
  await assertFails(updateDoc(firm(d), { 'documents.insurance': [{ ...one, sizeBytes: 5, expiresOn: '2030-01-01' }] }))
})

test('review of #442: stored documents null reads as no documents', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(firm(ctx.firestore()), { documents: null }) })
  // A firm save that leaves the null alone, by any member.
  await assertSucceeds(updateDoc(firm(await db(OP)), { name: 'Sparks 2' }))
  // The first document onto a null list.
  await assertSucceeds(addAs(ADMIN, 2000))
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(firm(ctx.firestore()), { documents: null }) })
  await assertFails(addAs(MGR, 3000))
})
