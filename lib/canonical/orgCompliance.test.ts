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

import {
  orgComplianceFileName,
  orgCompliancePathLinked,
  orgComplianceReminder,
  orgComplianceZipEntryNames,
  orgComplianceZipFileName,
  orgComplianceShareSelection,
  orgComplianceShareLinkCreateFields,
  orgComplianceShareLinkState,
  parseOrgComplianceShareLink,
  orgCompliancePublicDocuments,
  orgComplianceSharedEntry,
  orgComplianceShareOpen,
  parseOrgComplianceDocumentRef,
  ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS,
  ORG_COMPLIANCE_SHARE_MESSAGES,
  orgComplianceOrganizationId,
  orgComplianceFolder,
  orgCompliancePathBelongsTo,
  orgComplianceShareCreatorActive,
  ORG_COMPLIANCE_ZIP_MAX_BYTES,
} from './orgCompliance'

test('review of #441: one stored file name on both apps', () => {
  assert.equal(orgComplianceFileName('Site.heic', 'organizations/o/compliance/u_1.jpg'), 'Site.jpg')
  assert.equal(orgComplianceFileName('PL.JPEG', 'organizations/o/compliance/u_1.jpg'), 'PL.JPEG')
  assert.equal(orgComplianceFileName('dir/PL.pdf', 'organizations/o/compliance/u_1.pdf'), 'PL.pdf')
  assert.equal(orgComplianceFileName('', 'organizations/o/compliance/u_1.pdf'), 'u_1.pdf')
  assert.equal(orgComplianceFileName('NoExt', 'organizations/o/compliance/u_1.png'), 'NoExt.png')
})

test('review of #441: a file is linked when any stored entry names it (§22 alreadyLinked)', () => {
  const stored = { documents: { trade: [{ path: 'organizations/o/compliance/u_1.pdf' }], insurance: 'junk' } }
  assert.equal(orgCompliancePathLinked(stored, 'organizations/o/compliance/u_1.pdf'), true)
  assert.equal(orgCompliancePathLinked(stored, 'organizations/o/compliance/u_2.pdf'), false)
  assert.equal(orgCompliancePathLinked(null, 'organizations/o/compliance/u_1.pdf'), false)
})

test('1.83.0 Home reminder from the one status rule', () => {
  assert.equal(orgComplianceReminder({ total: 3, expiringSoon: 0, expired: 0, attention: 0 }), null)
  assert.deepEqual(orgComplianceReminder({ total: 3, expiringSoon: 1, expired: 1, attention: 2 }), {
    count: 2, expired: 1, expiringSoon: 1,
    title: '2 insurance or accreditation certificates need attention',
    detail: '1 expired · 1 expiring within 30 days',
  })
  assert.equal(orgComplianceReminder({ total: 1, expiringSoon: 1, expired: 0, attention: 1 })?.title, '1 insurance or accreditation certificate needs attention')
})

test('1.83.0 zip names are unique and safe', () => {
  assert.deepEqual(orgComplianceZipEntryNames([{ fileName: 'PL.pdf' }, { fileName: 'pl.pdf' }, { fileName: '../x/y:z.pdf' }, { fileName: '', title: 'ISO' }]), [
    'PL.pdf', 'pl (2).pdf', '__x_y_z.pdf', 'ISO',
  ])
  assert.equal(orgComplianceZipFileName('2026-11-24'), 'Insurance-and-accreditations-2026-11-24.zip')
})

test('1.83.0 share links: selection, state, public fields only, the shared entry', () => {
  const data = {
    documents: {
      insurance: [{ id: 'A', path: `organizations/${ORG}/compliance/u1_1.pdf`, title: 'PL', docType: 'public_liability', issuer: 'Aviva', coverAmount: 5000000, expiresOn: '2026-12-01', uploadedBy: 'secret-uid' }],
      trade: [{ id: 'B', path: `organizations/${ORG}/compliance/u1_2.pdf`, title: 'Gas', docType: 'gas_safe' }],
    },
  }
  const docs = parseOrgComplianceDocuments(data, { organizationId: ORG })
  assert.deepEqual(orgComplianceShareSelection(docs, ['insurance:a', 'insurance:A', 'trade:B', 'trade:gone', 'bad']), {
    refs: [{ section: 'insurance', id: 'A' }, { section: 'trade', id: 'B' }], error: null,
  })
  assert.equal(orgComplianceShareSelection(docs, []).error, ORG_COMPLIANCE_SHARE_MESSAGES.none)
  assert.equal(orgComplianceShareSelection(docs, Array.from({ length: ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS + 1 }, () => 'trade:B')).error, ORG_COMPLIANCE_SHARE_MESSAGES.tooMany)
  assert.equal(parseOrgComplianceDocumentRef('quality:a/b'), null)
  const fields = orgComplianceShareLinkCreateFields({ organizationId: ORG, documents: [{ section: 'insurance', id: 'A' }], createdBy: 'admin', nowMs: 1000 })
  assert.equal(fields.expiresAtMs, 1000 + 7 * 24 * 3600 * 1000)
  const link = parseOrgComplianceShareLink('h', fields)!
  assert.equal(orgComplianceShareLinkState(link, 2000), 'active')
  assert.equal(orgComplianceShareLinkState(link, Number(fields.expiresAtMs)), 'expired')
  assert.equal(orgComplianceShareLinkState({ ...link, revokedAtMs: 1500 }, 2000), 'revoked')
  const shown = orgCompliancePublicDocuments(docs, link.documents, TODAY, 'GBP')
  assert.equal(shown.length, 1)
  assert.equal(shown[0].cover, '£5,000,000')
  assert.equal(shown[0].statusLabel, '7 days left · 1 Dec 2026')
  assert.ok(!JSON.stringify(shown).includes('secret-uid'))
  assert.ok(!JSON.stringify(shown).includes('compliance/u1_1'))
  assert.equal(orgComplianceSharedEntry(docs, link, 'insurance:A')?.path, `organizations/${ORG}/compliance/u1_1.pdf`)
  assert.equal(orgComplianceSharedEntry(docs, link, 'trade:B'), null) // not shared by this link
})

test('1.83.0 a lapsed or scheduled-for-deletion company shares nothing', () => {
  assert.equal(orgComplianceShareOpen({ name: 'Co' }, 1000), true)
  assert.equal(orgComplianceShareOpen({ deletion: { status: 'scheduled', eraseAfter: 99999999999 } }, 1000), false)
  assert.equal(orgComplianceShareOpen({ billing: { accessOpen: false } }, 1000), false)
  assert.equal(orgComplianceShareOpen({ billing: { status: 'canceled' } }, 1000), false)
  assert.equal(orgComplianceShareOpen(null, 1000), false)
})

test('security review of #441: organisation ids are checked before any path is built', () => {
  assert.equal(orgComplianceOrganizationId('Org_1-A'), 'Org_1-A')
  for (const bad of ['', 'a/b', '..', 'a%2Fb', 'a?x', 'a b', 'x'.repeat(129), null, 7]) {
    assert.equal(orgComplianceOrganizationId(bad), null, String(bad))
    assert.equal(orgComplianceDocumentPath(bad), null)
    assert.equal(orgComplianceFolder(bad), null)
  }
  assert.equal(orgCompliancePathBelongsTo('organizations/a%2Fb/compliance/u_1.pdf', ''), false)
  assert.equal(ORG_COMPLIANCE_ZIP_MAX_BYTES, 200 * 1024 * 1024)
})

test('security review of #441: a link stops when its creator is no longer an active admin', () => {
  const organization = { members: { a1: 'admin', m1: 'manager', x1: 'admin' }, creatorUserId: 'c1' }
  const base = { organizationId: 'org', organization }
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'a1', user: { organizationId: 'org', adminAccess: true } }), true)
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'a1', user: { organizationId: 'org', manager: true } }), false)
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'a1', user: { organizationId: 'org', adminAccess: true, isActive: false } }), false)
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'c1', user: null }), true)
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'x1', user: { organizationId: 'other' }, membership: { role: 'admin', accountActive: false } }), false)
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'x1', user: { organizationId: 'other' }, membership: null }), true)
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'm1', user: null }), false)
  assert.equal(orgComplianceShareCreatorActive({ ...base, createdBy: 'gone', user: null }), false)
  assert.equal(orgComplianceShareCreatorActive({ organizationId: 'org', createdBy: 'a1', organization: null }), false)
})
