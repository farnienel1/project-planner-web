import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storageFilePathAllowed, storageObjectPathFromDownloadUrl } from '@/lib/firebase/storageFilePath'
import { siteAuditPdfPhotosNotice } from '@/lib/siteAudit/siteAuditPdfNotice'

const BUCKET = 'project-planner-f986c.firebasestorage.app'
const url = (path: string, bucket = BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=abc`

test('a download URL of this bucket names its object path', () => {
  assert.equal(
    storageObjectPathFromDownloadUrl(url('organizations/o1/siteAudits/a1/images/u_1.jpg'), BUCKET),
    'organizations/o1/siteAudits/a1/images/u_1.jpg'
  )
})

test('another bucket, host, scheme or shape is never read through the route', () => {
  const path = 'organizations/o1/x.jpg'
  assert.equal(storageObjectPathFromDownloadUrl(url(path, 'other-bucket'), BUCKET), null)
  assert.equal(storageObjectPathFromDownloadUrl(url(path).replace('firebasestorage.googleapis.com', 'evil.example'), BUCKET), null)
  assert.equal(storageObjectPathFromDownloadUrl(url(path).replace('https:', 'http:'), BUCKET), null)
  assert.equal(storageObjectPathFromDownloadUrl('gs://bucket/organizations/o1/x.jpg', BUCKET), null)
  assert.equal(storageObjectPathFromDownloadUrl(url(path), ''), null)
  assert.equal(storageObjectPathFromDownloadUrl('not a url', BUCKET), null)
})

test('only organisation paths without traversal or control characters are allowed', () => {
  assert.equal(storageFilePathAllowed('organizations/o1/a.jpg'), true)
  assert.equal(storageFilePathAllowed('users/u1/a.jpg'), false)
  assert.equal(storageFilePathAllowed('organizations/o1/../../x'), false)
  assert.equal(storageFilePathAllowed('organizations//a.jpg'), false)
  assert.equal(storageFilePathAllowed('organizations/o1/a\n.jpg'), false)
  assert.equal(storageFilePathAllowed(`organizations/${'a'.repeat(1100)}`), false)
  assert.equal(storageObjectPathFromDownloadUrl(url('organizations/o1/../../secret'), BUCKET), null)
})

test('the PDF says when photos are not drawn', () => {
  assert.equal(siteAuditPdfPhotosNotice({ photos: 3, photosNotDrawn: 0 }), null)
  assert.match(siteAuditPdfPhotosNotice({ photos: 6, photosNotDrawn: 6 }) ?? '', /All 6 photos could not be loaded and are shown as grey boxes/)
  assert.match(siteAuditPdfPhotosNotice({ photos: 3, photosNotDrawn: 1 }) ?? '', /1 of 3 photos could not be loaded and is shown/)
})
