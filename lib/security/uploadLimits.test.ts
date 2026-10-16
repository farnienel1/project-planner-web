import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPANY_LOGO_MAX_BYTES,
  PROFILE_PHOTO_MAX_BYTES,
  QUALIFICATION_CERT_MAX_BYTES,
  VARIATION_EVIDENCE_MAX_BYTES,
  WORK_FILE_MAX_BYTES,
  generatedStorageFileName,
  isWorkFileType,
  uploadLimitError,
} from './uploadLimits.ts'

test('generated object names keep only the extension', () => {
  assert.equal(generatedStorageFileName('Invoice (final)!!!.pdf', 'uid1', 1700000000000), 'uid1_1700000000000.pdf')
  assert.equal(generatedStorageFileName('site plan.PNG', 'u-2', 1).includes('site'), false)
  assert.equal(generatedStorageFileName('noext', 'web', 2), 'web_2')
})

test('profile and logo caps match storage.rules', () => {
  assert.equal(uploadLimitError({ name: 'me.jpg', type: 'image/jpeg', size: PROFILE_PHOTO_MAX_BYTES }, 'profile'), null)
  assert.equal(uploadLimitError({ name: 'me.jpg', type: 'image/jpeg', size: PROFILE_PHOTO_MAX_BYTES + 1 }, 'profile'), 'Image only · max 2MB')
  assert.equal(uploadLimitError({ name: 'me.pdf', type: 'application/pdf', size: 1024 }, 'profile'), 'Image only · max 2MB')
  assert.equal(uploadLimitError({ name: 'mark.png', type: 'image/png', size: COMPANY_LOGO_MAX_BYTES }, 'logo'), null)
  assert.equal(uploadLimitError({ name: 'mark.pdf', type: 'application/pdf', size: 1024 }, 'logo'), null)
  assert.equal(
    uploadLimitError({ name: 'notes.txt', type: 'text/plain', size: 1024 }, 'logo'),
    'Logo must be a JPEG, PNG or PDF file.'
  )
})

test('certificates stay PDF or JPEG at 10MB', () => {
  assert.equal(uploadLimitError({ name: 'card.pdf', type: 'application/pdf', size: QUALIFICATION_CERT_MAX_BYTES }, 'certificate'), null)
  assert.equal(uploadLimitError({ name: 'card.png', type: 'image/png', size: 1024 }, 'certificate'), 'PDF or JPEG only · max 10MB')
})

test('work files match storage.rules types including Excel', () => {
  assert.equal(isWorkFileType({ name: 'talk.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), true)
  assert.equal(isWorkFileType({ name: 'talk.xlsx', type: 'application/octet-stream' }), true)
  assert.equal(isWorkFileType({ name: 'notes.txt', type: 'text/plain' }), false)
  assert.equal(isWorkFileType({ name: 'notes.txt', type: 'application/octet-stream' }), false)
  assert.equal(uploadLimitError({ name: 'talk.xlsx', type: '', size: WORK_FILE_MAX_BYTES }, 'work'), null)
  assert.equal(
    uploadLimitError({ name: 'talk.xlsx', type: '', size: WORK_FILE_MAX_BYTES + 1 }, 'work'),
    'Use an image, PDF, Word, Excel, CSV or ZIP file up to 10MB.'
  )
})

test('variation evidence uses the 20MB work-file cap', () => {
  assert.equal(uploadLimitError({ name: 'shot.jpg', type: 'image/jpeg', size: VARIATION_EVIDENCE_MAX_BYTES }, 'variation'), null)
  assert.equal(
    uploadLimitError({ name: 'shot.jpg', type: 'image/jpeg', size: VARIATION_EVIDENCE_MAX_BYTES + 1 }, 'variation'),
    'Use an image, PDF, Word, Excel, CSV or ZIP file up to 20MB.'
  )
})

test('site audits refuse documents', () => {
  assert.equal(uploadLimitError({ name: 'photo.png', type: 'image/png', size: 1024 }, 'siteAudit'), null)
  assert.equal(uploadLimitError({ name: 'doc.pdf', type: 'application/pdf', size: 1024 }, 'siteAudit'), 'Photos only · max 10MB')
})
