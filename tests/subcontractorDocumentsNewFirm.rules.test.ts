/**
 * Owner report 25 Nov: "added a new subcontractor, then uploaded a PDF to its RAMS / insurance — it kept saying
 * uploading, and backing out showed an upload error." This replays exactly what the web app sends, in one session:
 * the firm create (`savePartialDocument` → `setDoc` of `subcontractorWriteFields(null, payload)`), the PDF upload to
 * the firm's documents folder (`subcontractorDocumentStoragePath`, resumable, `application/pdf`), the download URL,
 * and the link write (`runTransaction` → `transaction.update` of `documents.<kind>`), as an admin and as a manager
 * with the Sub Contractors permission. Firestore + Storage emulators:
 *
 *   firebase emulators:exec --only firestore,storage --project demo-project-planner-rules \
 *     "tsx --test tests/subcontractorDocumentsNewFirm.rules.test.ts"
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { claimsContext } from './authClaimsContext.ts'
import { subcontractorWriteFields } from '../lib/canonical/peopleDocuments.ts'
import {
  parseSubcontractorDocuments,
  subcontractorDocumentAddWriteFields,
  subcontractorDocumentStoragePath,
} from '../lib/canonical/subcontractorDocuments.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORG = 'org-newfirm'
const ADMIN = 'nf-admin'
const SUBMGR = 'nf-submgr'

let env: RulesTestEnvironment

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-rules',
    firestore: { rules: readFileSync(path.join(root, 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync(path.join(root, 'storage.rules'), 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})

test.after(async () => {
  await env?.cleanup()
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), { name: 'New Firm Co', creatorUserId: ADMIN, members: { [ADMIN]: 'admin', [SUBMGR]: 'manager' } })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, firstName: 'F', surname: id, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(SUBMGR, { role: 'manager', manager: true, subContractors: true })
  })
})

/** A small real PDF (the bytes `uploadAllowed` checks start `%PDF-`). */
function pdfBytes(size: number): Uint8Array {
  const out = new Uint8Array(size)
  out.set(new TextEncoder().encode('%PDF-1.7\n'))
  return out
}

async function createThenUpload(uid: string, firmId: string) {
  const ctx = await claimsContext(env, uid, { email: `${uid}@test.com` })
  const db = ctx.firestore()
  const firmRef = doc(db, 'organizations', ORG, 'subcontractors', firmId)
  // 1. The firm create, as `useSubcontractorStore.saveSubcontractor` → `savePartialDocument` (missing: 'create').
  const now = new Date()
  const payload = {
    id: firmId,
    name: 'Brand New Ltd',
    subcontractorType: 'Electrical',
    website: null,
    address: null,
    contacts: [],
    createdAt: Timestamp.fromDate(now),
  }
  assert.equal((await getDoc(firmRef)).exists(), false)
  const create = subcontractorWriteFields(null, payload)
  await setDoc(firmRef, { ...create.set, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })
  // 2. The PDF upload into the new firm's folder (resumable, as `startTrackedUpload`).
  const ms = Date.now()
  const objectPath = subcontractorDocumentStoragePath({ organizationId: ORG, subcontractorId: firmId, uid, unixMs: ms, extension: 'pdf' })!
  const storage = ctx.storage()
  const task = uploadBytesResumable(ref(storage, objectPath), pdfBytes(2 * 1024 * 1024), { contentType: 'application/pdf' })
  await new Promise<void>((resolve, reject) => task.on('state_changed', undefined, reject, () => resolve()))
  await getDownloadURL(ref(storage, objectPath))
  // 3. The link write, as `writeList` (one transaction, one field-path update).
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(firmRef)
    assert.equal(snap.exists(), true)
    const plan = subcontractorDocumentAddWriteFields(snap.data() as Record<string, unknown>, {
      kind: 'rams',
      subcontractorId: firmId,
      organizationId: ORG,
      entry: { path: objectPath, name: 'RAMS.pdf', contentType: 'application/pdf', sizeBytes: 2 * 1024 * 1024, uploadedAtMs: ms, uploadedBy: uid, expiresOn: null },
    })
    assert.ok(plan.set, plan.outcome)
    transaction.update(firmRef, { [plan.set.fieldPath]: plan.set.value, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })
  })
  const stored = (await getDoc(firmRef)).data() as Record<string, unknown>
  const lists = parseSubcontractorDocuments(firmId, stored, { organizationId: ORG })
  assert.equal(lists.rams.length, 1)
  assert.equal(lists.rams[0].path, objectPath)
}

test('admin: create a firm, then upload and link a PDF RAMS in the same session', async () => {
  await createThenUpload(ADMIN, 'C0FFEE00-1111-4222-8333-444455556666')
})

test('Sub Contractors manager: create a firm, then upload and link a PDF RAMS in the same session', async () => {
  await createThenUpload(SUBMGR, 'c0ffee00-1111-4222-8333-444455557777')
})
