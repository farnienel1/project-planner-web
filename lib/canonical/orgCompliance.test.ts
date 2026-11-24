import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canManageOrganizationCompliance,
  orgComplianceAddWriteFields,
  orgComplianceCounts,
  orgComplianceDetailsError,
  orgComplianceDocumentPath,
  orgComplianceExpiryStatus,
  orgComplianceHubSubtitle,
  orgComplianceMergePayload,
  orgComplianceRemoveWriteFields,
  orgComplianceReplaceWriteFields,
  orgComplianceSortedEntries,
  orgComplianceStoragePath,
  orgComplianceTodayKey,
  orgComplianceUpdateWriteFields,
  orgComplianceCoverText,
  parseOrgComplianceDocuments,
  ORG_COMPLIANCE_MAX_PER_SECTION,
  ORG_COMPLIANCE_MESSAGES,
} from './orgCompliance'
import { storedFileKind, fileDeletePermission } from './storedFiles'
import { uploadAllowed } from './uploadPolicy'

const ORG = 'org1'
const TODAY = '2026-11-24'
const file = (ms: number) => ({ path: `organizations/${ORG}/compliance/u1_${ms}.pdf`, fileName: 'pl.pdf', contentType: 'application/pdf', sizeBytes: 100, uploadedAtMs: ms, uploadedBy: 'u1' })
const details = { docType: 'public_liability', title: 'Public liability 2026–27', issuer: 'Aviva', reference: 'P-1', coverAmount: '10,000,000', expiresOn: '2027-03-31' }

test('1.83.0 paths and the file kind', () => {
  assert.equal(orgComplianceDocumentPath(ORG), 'organizations/org1/orgCompliance/documents')
  assert.equal(orgComplianceDocumentPath('a/b'), null)
  const path = orgComplianceStoragePath({ organizationId: ORG, uid: 'u1', unixMs: 5, extension: 'PDF' })
  assert.equal(path, 'organizations/org1/compliance/u1_5.pdf')
  assert.equal(storedFileKind(path)?.kind, 'org_compliance_document')
  assert.equal(uploadAllowed({ kind: 'org_compliance_document', fileName: 'a.svg', contentType: 'image/svg+xml', sizeBytes: 10 }).allowed, false)
  assert.equal(uploadAllowed({ kind: 'org_compliance_document', fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 11 * 1024 * 1024 }).allowed, false)
  // Admins delete (kept 30 days by the bucket's soft delete); nobody else, not even the uploader.
  assert.equal(fileDeletePermission({ storagePath: path, organizationId: ORG, viewerUserId: 'u2', viewerRole: { isAdmin: true }, nowMs: 6 }).allowed, true)
  assert.equal(fileDeletePermission({ storagePath: path, organizationId: ORG, viewerUserId: 'u1', viewerRole: { isManager: true }, nowMs: 6 }).reason, 'admin_only')
})

test('1.83.0 only admins manage compliance documents', () => {
  assert.equal(canManageOrganizationCompliance({ adminAccess: true }), true)
  assert.equal(canManageOrganizationCompliance({ isSuperAdmin: true }), true)
  assert.equal(canManageOrganizationCompliance({ manager: true, role: 'manager' }), false)
  assert.equal(canManageOrganizationCompliance({ operativeMode: true, role: 'operative' }), false)
  assert.equal(canManageOrganizationCompliance(null), false)
})

test('1.83.0 expiry status, ordering, counts and hub subtitle', () => {
  assert.equal(orgComplianceExpiryStatus(null, TODAY).label, 'No expiry date')
  assert.deepEqual(orgComplianceExpiryStatus('2026-10-03', TODAY), { status: 'expired', tone: 'red', daysToExpiry: -52, label: 'Expired 3 Oct 2026' })
  assert.equal(orgComplianceExpiryStatus('2026-11-24', TODAY).label, 'Expires today')
  assert.equal(orgComplianceExpiryStatus('2026-11-25', TODAY).label, '1 day left · 25 Nov 2026')
  assert.equal(orgComplianceExpiryStatus('2026-12-14', TODAY).label, '20 days left · 14 Dec 2026')
  assert.equal(orgComplianceExpiryStatus('2026-12-24', TODAY).status, 'expiring_soon')
  assert.equal(orgComplianceExpiryStatus('2026-12-25', TODAY).label, 'Valid to 25 Dec 2026')
  assert.equal(orgComplianceTodayKey(Date.UTC(2026, 10, 23, 23, 30), 'Pacific/Auckland'), '2026-11-24')
  const data = {
    documents: {
      insurance: [
        { id: 'a', path: `organizations/${ORG}/compliance/u1_1.pdf`, title: 'Zeta', docType: 'public_liability', expiresOn: null },
        { id: 'b', path: `organizations/${ORG}/compliance/u1_2.pdf`, title: 'Beta', docType: 'public_liability', expiresOn: '2027-06-01' },
        { id: 'c', path: `organizations/${ORG}/compliance/u1_3.pdf`, title: 'Gamma', docType: 'nope', expiresOn: '2026-01-01' },
        { id: 'd', path: 'https://evil.example/x.pdf', title: 'Dropped' },
        { id: 'e', path: `organizations/other/compliance/u1_4.pdf`, title: 'Other org' },
      ],
      trade: [{ path: `organizations/${ORG}/compliance/u1_5.pdf`, docType: 'gas_safe', expiresOn: '2026-12-01' }],
    },
  }
  const docs = parseOrgComplianceDocuments(data, { organizationId: ORG })
  assert.equal(docs.insurance.length, 3)
  assert.equal(docs.insurance[2].docType, 'nope') // unknown type kept, never dropped
  assert.equal(docs.trade[0].title, 'Gas Safe registration')
  assert.ok(docs.trade[0].id)
  assert.deepEqual(orgComplianceSortedEntries(docs.insurance, TODAY).map((e) => e.id), ['c', 'b', 'a'])
  const counts = orgComplianceCounts(docs, TODAY)
  assert.deepEqual(counts, { total: 4, expiringSoon: 1, expired: 1, attention: 2 })
  assert.equal(orgComplianceHubSubtitle(counts), '4 documents · 2 need attention')
  assert.equal(orgComplianceHubSubtitle({ total: 1, expiringSoon: 0, expired: 0, attention: 0 }), '1 document')
  assert.equal(orgComplianceHubSubtitle(null), 'PI, PL, trade and ISO certificates')
  assert.deepEqual(parseOrgComplianceDocuments(null), { insurance: [], trade: [], quality: [] })
})

test('1.83.0 details checks', () => {
  assert.equal(orgComplianceDetailsError('insurance', details, TODAY), null)
  assert.equal(orgComplianceDetailsError('trade', details, TODAY), ORG_COMPLIANCE_MESSAGES.docType)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, title: ' ' }, TODAY), ORG_COMPLIANCE_MESSAGES.title)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, title: 'x'.repeat(121) }, TODAY), ORG_COMPLIANCE_MESSAGES.titleLong)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, reference: 'x'.repeat(61) }, TODAY), ORG_COMPLIANCE_MESSAGES.referenceLong)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, coverAmount: '1.5' }, TODAY), ORG_COMPLIANCE_MESSAGES.cover)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, expiresOn: '2026-02-30' }, TODAY), ORG_COMPLIANCE_MESSAGES.expiry)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, expiresOn: '2036-11-24' }, TODAY), null)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, expiresOn: '2036-11-25' }, TODAY), ORG_COMPLIANCE_MESSAGES.expiryFar)
  assert.equal(orgComplianceDetailsError('insurance', { ...details, expiresOn: '2020-01-01' }, TODAY), null) // past allowed
  assert.equal(orgComplianceCoverText(10_000_000, 'GBP'), '£10,000,000')
})

test('1.83.0 add, edit, replace and remove build from the stored document', () => {
  const added = orgComplianceAddWriteFields(null, { section: 'insurance', organizationId: ORG, todayKey: TODAY, details, file: file(10) })
  assert.equal(added.outcome, 'added')
  const entry = added.set!.value[0]
  assert.equal(entry.coverAmount, 10_000_000)
  assert.equal(entry.path, `organizations/${ORG}/compliance/u1_10.pdf`)
  const stored = orgComplianceMergePayload(added.set!)
  assert.deepEqual(Object.keys(stored.documents as object), ['insurance'])
  assert.equal(orgComplianceAddWriteFields(stored, { section: 'insurance', organizationId: ORG, todayKey: TODAY, details, file: file(10) }).outcome, 'alreadyLinked')
  assert.equal(orgComplianceAddWriteFields(stored, { section: 'insurance', organizationId: ORG, todayKey: TODAY, details, file: { ...file(11), path: 'organizations/x/compliance/u1_11.pdf' } }).outcome, 'invalid')
  const full = { documents: { insurance: Array.from({ length: ORG_COMPLIANCE_MAX_PER_SECTION }, (_, i) => ({ id: `x${i}`, path: `organizations/${ORG}/compliance/u1_${i}.pdf` })) } }
  assert.equal(orgComplianceAddWriteFields(full, { section: 'insurance', organizationId: ORG, todayKey: TODAY, details, file: file(999) }).outcome, 'refused')
  // Trade never stores a cover.
  const trade = orgComplianceAddWriteFields(stored, { section: 'trade', organizationId: ORG, todayKey: TODAY, details: { ...details, docType: 'niceic' }, file: file(12) })
  assert.equal(trade.set!.value[0].coverAmount, null)

  const id = String(entry.id)
  assert.equal(orgComplianceUpdateWriteFields(stored, { section: 'insurance', organizationId: ORG, entryId: id, todayKey: TODAY, details, updatedAtMs: 20, updatedBy: 'u2' }).outcome, 'unchanged')
  const edited = orgComplianceUpdateWriteFields(stored, { section: 'insurance', organizationId: ORG, entryId: id.toUpperCase(), todayKey: TODAY, details: { ...details, expiresOn: '' }, updatedAtMs: 20, updatedBy: 'u2' })
  assert.equal(edited.outcome, 'changed')
  assert.equal(edited.set!.value[0].expiresOn, null)
  assert.equal(edited.set!.value[0].path, entry.path)
  assert.equal(orgComplianceUpdateWriteFields(stored, { section: 'insurance', organizationId: ORG, entryId: 'gone', todayKey: TODAY, details, updatedAtMs: 20, updatedBy: 'u2' }).outcome, 'missing')

  const replaced = orgComplianceReplaceWriteFields(stored, { section: 'insurance', organizationId: ORG, entryId: id, todayKey: TODAY, details: { ...details, expiresOn: '2028-03-31' }, file: file(30) })
  assert.equal(replaced.outcome, 'replaced')
  assert.equal(replaced.replacedPath, entry.path)
  assert.equal(replaced.set!.value[0].id, id)
  assert.equal(replaced.set!.value[0].path, `organizations/${ORG}/compliance/u1_30.pdf`)

  const removed = orgComplianceRemoveWriteFields(stored, { section: 'insurance', organizationId: ORG, entryId: id })
  assert.equal(removed.removedPath, entry.path)
  assert.deepEqual(removed.set!.value, [])
  assert.equal(orgComplianceRemoveWriteFields(stored, { section: 'insurance', organizationId: ORG, entryId: 'gone' }).set, null)
})
