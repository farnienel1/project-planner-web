import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTENT_REPORT_DETAILS_MAX,
  CONTENT_REPORT_LINK_LABEL,
  CONTENT_REPORT_REASONS,
  CONTENT_REPORTS_COLLECTION,
  contentReportFirestoreFields,
  contentReportMessage,
  isReportableFileRef,
  parseContentReportInput,
  parseContentReportRow,
  parseStoragePathFromUrl,
} from './contentReport.ts'

const reporter = { uid: 'user-1', email: 'sam@site.test' }

test('report collection, reasons and link wording are fixed', () => {
  assert.equal(CONTENT_REPORTS_COLLECTION, 'contentReports')
  assert.deepEqual([...CONTENT_REPORT_REASONS], ['copyright', 'personal_data', 'offensive', 'other'])
  assert.equal(CONTENT_REPORT_LINK_LABEL, 'Report a problem with this file')
})

test('parseStoragePathFromUrl reads Firebase, GCS, gs:// and bare paths', () => {
  assert.equal(
    parseStoragePathFromUrl(
      'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/organizations%2Forg-a%2FhealthSafety%2Ffile.pdf?alt=media&token=abc'
    ),
    'organizations/org-a/healthSafety/file.pdf'
  )
  assert.equal(
    parseStoragePathFromUrl('https://storage.googleapis.com/bucket.appspot.com/organizations/org-a/userProfiles/u1/profile.jpg'),
    'organizations/org-a/userProfiles/u1/profile.jpg'
  )
  assert.equal(
    parseStoragePathFromUrl('gs://bucket.appspot.com/organizations/org-a/tasks/t1/photo.jpg'),
    'organizations/org-a/tasks/t1/photo.jpg'
  )
  assert.equal(
    parseStoragePathFromUrl('organizations/org-a/healthSafety/doc.pdf'),
    'organizations/org-a/healthSafety/doc.pdf'
  )
  assert.equal(parseStoragePathFromUrl('blob:http://localhost:3000/abc'), '')
  assert.equal(parseStoragePathFromUrl('data:image/png;base64,xxxx'), '')
  assert.equal(parseStoragePathFromUrl('https://example.com/not-storage.pdf'), '')
})

test('blob and data URLs are not reportable', () => {
  assert.equal(isReportableFileRef('blob:http://localhost/1'), false)
  assert.equal(isReportableFileRef('data:image/png;base64,x'), false)
  assert.equal(isReportableFileRef('https://firebasestorage.googleapis.com/v0/b/b/o/a.pdf'), true)
})

test('payload requires a signed-in reporter, org, reason and file', () => {
  assert.equal(parseContentReportInput({}, reporter).ok, false)
  assert.equal(parseContentReportInput({ orgId: 'org-a', reason: 'copyright' }, { uid: '' }).ok, false)
  assert.equal(
    parseContentReportInput({ orgId: 'org-a', reason: 'nope', fileUrl: 'https://files.example/a.pdf' }, reporter).ok,
    false
  )
  const missingFile = parseContentReportInput({ orgId: 'org-a', reason: 'copyright' }, reporter)
  assert.equal(missingFile.ok, false)
})

test('other requires details; named reasons do not', () => {
  const other = parseContentReportInput(
    { orgId: 'org-a', reason: 'other', fileUrl: 'https://files.example/a.pdf' },
    reporter
  )
  assert.equal(other.ok, false)
  if (other.ok) throw new Error('expected failure')
  assert.match(other.error, /Describe the problem/)

  const named = parseContentReportInput(
    { orgId: 'org-a', reason: 'copyright', fileUrl: 'https://files.example/a.pdf' },
    reporter
  )
  assert.equal(named.ok, true)
})

test('payload caps details, stamps reporter uid and open status, and parses a storage path', () => {
  const parsed = parseContentReportInput(
    {
      orgId: 'org-a',
      orgName: 'North Site',
      reason: 'personal_data',
      details: `${'x'.repeat(CONTENT_REPORT_DETAILS_MAX)}extra`,
      fileUrl:
        'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/organizations%2Forg-a%2Ffile.pdf?alt=media',
      fileName: 'file.pdf',
      source: 'health_safety',
    },
    reporter
  )
  assert.equal(parsed.ok, true)
  if (!parsed.ok) throw new Error('expected payload')
  assert.equal(parsed.value.details.length, CONTENT_REPORT_DETAILS_MAX)
  assert.equal(parsed.value.reportedByUid, 'user-1')
  assert.equal(parsed.value.reporterEmail, 'sam@site.test')
  assert.equal(parsed.value.status, 'open')
  assert.equal(parsed.value.storagePath, 'organizations/org-a/file.pdf')
  assert.equal(parsed.value.source, 'health_safety')
  const fields = contentReportFirestoreFields(parsed.value)
  assert.equal(fields.reportedByUid, 'user-1')
  assert.equal(fields.status, 'open')
})

test('blob file URLs are rejected even when a reason is chosen', () => {
  const parsed = parseContentReportInput(
    { orgId: 'org-a', reason: 'offensive', fileUrl: 'blob:http://localhost/1' },
    reporter
  )
  assert.equal(parsed.ok, false)
})

test('file-report email names org, reason, path and reporter', () => {
  const parsed = parseContentReportInput(
    {
      orgId: 'ORG-1',
      orgName: 'North Site Ltd',
      reason: 'copyright',
      fileUrl: 'https://files.example/a.pdf',
      storagePath: 'organizations/org-1/a.pdf',
      details: '<b>copy</b>',
    },
    reporter
  )
  assert.equal(parsed.ok, true)
  if (!parsed.ok) throw new Error('expected payload')
  const message = contentReportMessage(parsed.value)
  assert.equal(message.subject, 'File report — Copyright — North Site Ltd')
  assert.match(message.html, /North Site Ltd \(ORG-1\)/)
  assert.match(message.html, /organizations\/org-1\/a\.pdf/)
  assert.match(message.html, /sam@site\.test \(user-1\)/)
  assert.match(message.html, /&lt;b&gt;copy&lt;\/b&gt;/)
  assert.equal(message.subject.includes('\n'), false)
})

test('parseContentReportRow maps owner-console fields', () => {
  const row = parseContentReportRow('r1', {
    orgId: 'org-a',
    orgName: 'North',
    reason: 'offensive',
    storagePath: 'organizations/org-a/x.jpg',
    reportedByUid: 'user-1',
    reporterEmail: 'sam@site.test',
    status: 'open',
  })
  assert.equal(row.id, 'r1')
  assert.equal(row.orgId, 'org-a')
  assert.equal(row.reason, 'offensive')
  assert.equal(row.storagePath, 'organizations/org-a/x.jpg')
  assert.equal(row.reportedByUid, 'user-1')
})
