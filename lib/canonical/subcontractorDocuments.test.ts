import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SUBCONTRACTOR_DOCUMENTS_MAX_PER_KIND,
  canManageSubcontractors,
  parseSubcontractorDocuments,
  subcontractorDocumentAddWriteFields,
  subcontractorDocumentExpiryError,
  subcontractorDocumentExpiryState,
  subcontractorDocumentExpiryWriteFields,
  subcontractorDocumentPathBelongsTo,
  subcontractorDocumentRemoveWriteFields,
  subcontractorDocumentStoragePath,
} from './subcontractorDocuments'
import { fileDeletePermission, storedFileKind } from './storedFiles'
import { UPLOAD_ALLOWED_TYPES, uploadAllowed, uploadKindForStoragePath } from './uploadPolicy'

const ORG = 'org-1'
const SUB = 'SUB-1'
const path = (name: string) => `organizations/${ORG}/subcontractors/${SUB}/documents/${name}`

test('1.80.0 storage path, kind and upload policy', () => {
  const p = subcontractorDocumentStoragePath({ organizationId: ORG, subcontractorId: SUB, uid: 'u1', unixMs: 1700, extension: '.PDF' })
  assert.equal(p, path('u1_1700.pdf'))
  assert.equal(storedFileKind(p)?.kind, 'subcontractor_document')
  assert.equal(uploadKindForStoragePath(p), 'subcontractor_document')
  assert.equal(UPLOAD_ALLOWED_TYPES.subcontractor_document.maxBytes, 10 * 1024 * 1024)
  assert.equal(subcontractorDocumentStoragePath({ organizationId: ORG, subcontractorId: 'a/b', uid: 'u1', unixMs: 1 }), null)
  assert.equal(subcontractorDocumentStoragePath({ organizationId: ORG, subcontractorId: SUB, uid: 'bad uid', unixMs: 1 }), null)
  // An SVG renamed .pdf is refused like every other kind.
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
  assert.equal(uploadAllowed({ kind: 'subcontractor_document', fileName: 'x.pdf', contentType: 'application/pdf', sizeBytes: 50, headBytes: svg }).allowed, false)
  const pdf = new TextEncoder().encode('%PDF-1.7\n')
  assert.equal(uploadAllowed({ kind: 'subcontractor_document', fileName: 'cert.pdf', contentType: 'application/pdf', sizeBytes: 50, headBytes: pdf }).allowed, true)
})

test('1.80.0 delete: the uploader in the undo window, or an admin; managers otherwise keep the file', () => {
  const file = path('mgr_1000.pdf')
  const role = { isAdmin: false, isManager: true, isSuperAdmin: false, isOperativeMode: false }
  assert.equal(fileDeletePermission({ storagePath: file, organizationId: ORG, viewerUserId: 'mgr', viewerRole: role, nowMs: 1000 + 60_000 }).allowed, true)
  assert.equal(fileDeletePermission({ storagePath: file, organizationId: ORG, viewerUserId: 'mgr', viewerRole: role, nowMs: 1000 + 16 * 60_000 }).allowed, false)
  assert.equal(fileDeletePermission({ storagePath: file, organizationId: ORG, viewerUserId: 'admin', viewerRole: { ...role, isAdmin: true }, nowMs: 9e12 }).allowed, true)
})

test('1.80.0 path belongs only to this firm and organisation', () => {
  assert.equal(subcontractorDocumentPathBelongsTo(path('u_1.pdf'), ORG, 'sub-1'), true)
  assert.equal(subcontractorDocumentPathBelongsTo(path('u_1.pdf'), ORG, 'SUB-2'), false)
  assert.equal(subcontractorDocumentPathBelongsTo(path('u_1.pdf'), 'org-2', SUB), false)
  assert.equal(subcontractorDocumentPathBelongsTo('https://example.test/x.pdf', ORG, SUB), false)
  assert.equal(subcontractorDocumentPathBelongsTo(`organizations/${ORG}/subcontractors/${SUB}/documents/a/b.pdf`, ORG, SUB), false)
})

test('1.80.0 reader: old documents read empty; junk dropped; derived ids stable; bad expiry reads as none', () => {
  assert.deepEqual(parseSubcontractorDocuments(SUB, { name: 'Pipes', subcontractorType: 'Plumbing' }), { insurance: [], rams: [] })
  const data = {
    organizationId: ORG,
    documents: {
      insurance: [
        { path: path('u_1.pdf'), name: 'PL insurance.pdf', contentType: 'application/pdf', sizeBytes: 100, uploadedAtMs: 5, uploadedBy: 'u', expiresOn: '2027-03-01' },
        { path: 'https://evil.test/x.pdf', name: 'link' },
        { path: `organizations/${ORG}/subcontractors/OTHER/documents/u_1.pdf` },
        'junk',
        { path: path('u_1.pdf'), name: 'dupe' },
      ],
      rams: [{ id: 'R-1', path: path('u_2.jpg'), expiresOn: 'tomorrow' }],
    },
  }
  const a = parseSubcontractorDocuments(SUB, data)
  const b = parseSubcontractorDocuments(SUB, data)
  assert.equal(a.insurance.length, 1)
  assert.equal(a.insurance[0].expiresOn, '2027-03-01')
  assert.equal(a.insurance[0].id, b.insurance[0].id)
  assert.ok(a.insurance[0].id)
  assert.equal(a.rams[0].id, 'R-1')
  assert.equal(a.rams[0].expiresOn, null)
  assert.equal(a.rams[0].name, 'u_2.jpg')
})

test('1.80.0 add / remove / expiry writes are one field-path list built from the stored copy', () => {
  const stored = { documents: { insurance: [{ id: 'keep', path: path('other_1.pdf'), name: 'Theirs' }] } }
  const add = subcontractorDocumentAddWriteFields(stored, {
    kind: 'insurance',
    subcontractorId: SUB,
    organizationId: ORG,
    entry: { path: path('u_9.pdf'), name: 'New.pdf', contentType: 'application/pdf', sizeBytes: 9, uploadedAtMs: 9, uploadedBy: 'u', expiresOn: '' },
  })
  assert.equal(add.outcome, 'added')
  assert.equal(add.set?.fieldPath, 'documents.insurance')
  assert.equal(add.set?.value.length, 2)
  assert.deepEqual(add.set?.value[0], stored.documents.insurance[0])
  assert.equal((add.set?.value[1] as { expiresOn: unknown }).expiresOn, null)
  const again = subcontractorDocumentAddWriteFields({ documents: { insurance: add.set!.value } }, {
    kind: 'insurance', subcontractorId: SUB, organizationId: ORG,
    entry: { path: path('u_9.pdf'), name: 'New.pdf', uploadedAtMs: 9, uploadedBy: 'u' },
  })
  assert.equal(again.outcome, 'alreadyLinked')
  assert.equal(again.set, null)
  for (const bad of [
    { path: 'https://x.test/a.pdf', name: 'a', uploadedAtMs: 1, uploadedBy: 'u' },
    { path: path('u_1.pdf'), name: 'a', uploadedAtMs: 1, uploadedBy: 'u', expiresOn: '31/02/2027' },
    { path: path('u_1.pdf'), name: 'a', uploadedAtMs: 1, uploadedBy: '' },
  ]) {
    assert.equal(subcontractorDocumentAddWriteFields(stored, { kind: 'rams', subcontractorId: SUB, organizationId: ORG, entry: bad }).outcome, 'invalid')
  }
  const full = { documents: { rams: Array.from({ length: SUBCONTRACTOR_DOCUMENTS_MAX_PER_KIND }, (_, i) => ({ path: path(`u_${i}.pdf`) })) } }
  assert.equal(subcontractorDocumentAddWriteFields(full, { kind: 'rams', subcontractorId: SUB, organizationId: ORG, entry: { path: path('u_99.pdf'), name: 'x', uploadedAtMs: 1, uploadedBy: 'u' } }).outcome, 'refused')

  const parsed = parseSubcontractorDocuments(SUB, { organizationId: ORG, documents: { insurance: add.set!.value } })
  const removed = subcontractorDocumentRemoveWriteFields({ documents: { insurance: add.set!.value } }, { kind: 'insurance', subcontractorId: SUB, entryId: parsed.insurance[1].id })
  assert.equal(removed.removedPath, path('u_9.pdf'))
  assert.deepEqual(removed.set?.value, [stored.documents.insurance[0]])
  assert.equal(subcontractorDocumentRemoveWriteFields(stored, { kind: 'insurance', subcontractorId: SUB, entryId: 'gone' }).set, null)

  const exp = subcontractorDocumentExpiryWriteFields(stored, { kind: 'insurance', subcontractorId: SUB, entryId: 'KEEP', expiresOn: '2027-01-31' })
  assert.equal(exp.outcome, 'changed')
  assert.equal((exp.set?.value[0] as { expiresOn: unknown }).expiresOn, '2027-01-31')
  assert.equal((exp.set?.value[0] as { name: unknown }).name, 'Theirs')
  assert.equal(subcontractorDocumentExpiryWriteFields(stored, { kind: 'insurance', subcontractorId: SUB, entryId: 'keep', expiresOn: null }).outcome, 'unchanged')
  assert.equal(subcontractorDocumentExpiryWriteFields(stored, { kind: 'insurance', subcontractorId: SUB, entryId: 'keep', expiresOn: 'x' }).outcome, 'invalid')
  assert.equal(subcontractorDocumentExpiryError('2027-02-30'), 'Enter the expiry date as a date, or leave it empty.')
  assert.equal(subcontractorDocumentExpiryError(''), null)
})

test('1.80.0 expiry state on the organisation day', () => {
  // 23:30 UTC on 24 Nov is 25 Nov in Auckland.
  const now = Date.UTC(2026, 10, 24, 23, 30)
  assert.equal(subcontractorDocumentExpiryState(null, now, 'Europe/London').label, 'No expiry')
  assert.equal(subcontractorDocumentExpiryState('2026-11-23', now, 'Europe/London').state, 'expired')
  assert.equal(subcontractorDocumentExpiryState('2026-11-24', now, 'Europe/London').label, 'Expires today')
  assert.equal(subcontractorDocumentExpiryState('2026-11-24', now, 'Pacific/Auckland').label, 'Expired')
  assert.equal(subcontractorDocumentExpiryState('2026-11-25', now, 'Europe/London').label, 'Expires in 1 day')
  assert.equal(subcontractorDocumentExpiryState('2026-12-24', now, 'Europe/London').label, 'Expires in 30 days')
  const later = subcontractorDocumentExpiryState('2027-03-01', now, 'Europe/London')
  assert.equal(later.state, 'valid')
  assert.equal(later.label, 'Expires 1 Mar 2027')
})

test('1.80.0 canManageSubcontractors matches the existing permission', () => {
  assert.equal(canManageSubcontractors(null), false)
  assert.equal(canManageSubcontractors({ isSuperAdmin: true }), true)
  assert.equal(canManageSubcontractors({ adminAccess: true }), true)
  assert.equal(canManageSubcontractors({ manager: true, subContractors: true }), true)
  assert.equal(canManageSubcontractors({ manager: true, subContractors: false }), false)
  assert.equal(canManageSubcontractors({ operativeMode: true, subContractors: true }), false)
})
