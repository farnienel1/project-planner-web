import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPANY_LOGO_MAX_BYTES,
  PROFILE_PHOTO_MAX_BYTES,
  QUALIFICATION_CERT_MAX_BYTES,
  VARIATION_EVIDENCE_MAX_BYTES,
  WORK_FILE_MAX_BYTES,
  generatedStorageFileName,
  uploadLimitError,
} from './uploadLimits.ts'

const MB = 1024 * 1024

test('generated object names keep only the extension', () => {
  assert.equal(generatedStorageFileName('Invoice (final)!!!.pdf', 'uid1', 1700000000000), 'uid1_1700000000000.pdf')
  assert.equal(generatedStorageFileName('site plan.PNG', 'u-2', 1).includes('site'), false)
  assert.equal(generatedStorageFileName('noext', 'web', 2), 'web_2')
})

test('caps match storage.rules (rulebook 1.50.0 UPLOAD_ALLOWED_TYPES)', () => {
  assert.equal(PROFILE_PHOTO_MAX_BYTES, 2 * MB)
  assert.equal(COMPANY_LOGO_MAX_BYTES, 5 * MB)
  assert.equal(WORK_FILE_MAX_BYTES, 10 * MB)
  assert.equal(QUALIFICATION_CERT_MAX_BYTES, 10 * MB)
  assert.equal(VARIATION_EVIDENCE_MAX_BYTES, 10 * MB)
})

test('profile and logo', () => {
  assert.equal(uploadLimitError({ name: 'me.jpg', type: 'image/jpeg', size: PROFILE_PHOTO_MAX_BYTES }, 'profile'), null)
  assert.match(uploadLimitError({ name: 'me.jpg', type: 'image/jpeg', size: PROFILE_PHOTO_MAX_BYTES + 1 }, 'profile') ?? '', /too large/)
  assert.match(uploadLimitError({ name: 'me.pdf', type: 'application/pdf', size: 1024 }, 'profile') ?? '', /cannot be uploaded/)
  assert.equal(uploadLimitError({ name: 'mark.png', type: 'image/png', size: COMPANY_LOGO_MAX_BYTES }, 'logo'), null)
  assert.equal(uploadLimitError({ name: 'mark.pdf', type: 'application/pdf', size: 1024 }, 'logo'), null)
  assert.match(uploadLimitError({ name: 'mark.svg', type: 'image/svg+xml', size: 1024 }, 'logo') ?? '', /cannot be uploaded/)
})

test('certificates take photos and PDFs at 10MB', () => {
  assert.equal(uploadLimitError({ name: 'card.pdf', type: 'application/pdf', size: QUALIFICATION_CERT_MAX_BYTES }, 'certificate'), null)
  assert.equal(uploadLimitError({ name: 'card.png', type: 'image/png', size: 1024 }, 'certificate'), null)
  assert.match(uploadLimitError({ name: 'card.docx', type: '', size: 1024 }, 'certificate') ?? '', /cannot be uploaded/)
})

test('work files: photos and PDFs only — no Office, macro, ZIP or SVG', () => {
  assert.equal(uploadLimitError({ name: 'rams.pdf', type: 'application/pdf', size: WORK_FILE_MAX_BYTES }, 'work'), null)
  for (const name of ['talk.xlsx', 'talk.xlsm', 'notes.docx', 'pack.zip', 'list.csv', 'logo.svg', 'anim.gif']) {
    assert.equal(
      uploadLimitError({ name, type: '', size: 1024 }, 'work'),
      'This type of file cannot be uploaded. Use a photo (JPEG, PNG, HEIC or WebP) or a PDF, up to 10 MB.',
      name
    )
  }
  assert.match(uploadLimitError({ name: 'rams.pdf', type: '', size: WORK_FILE_MAX_BYTES + 1 }, 'work') ?? '', /too large/)
})

test('variation evidence and claims cap at 10MB', () => {
  assert.equal(uploadLimitError({ name: 'shot.jpg', type: 'image/jpeg', size: VARIATION_EVIDENCE_MAX_BYTES }, 'variation'), null)
  assert.match(uploadLimitError({ name: 'shot.jpg', type: 'image/jpeg', size: VARIATION_EVIDENCE_MAX_BYTES + 1 }, 'variation') ?? '', /too large/)
  assert.equal(uploadLimitError({ name: 'receipt.heic', type: '', size: 1024 }, 'claim'), null)
})

test('site audits refuse documents', () => {
  assert.equal(uploadLimitError({ name: 'photo.png', type: 'image/png', size: 1024 }, 'siteAudit'), null)
  assert.equal(
    uploadLimitError({ name: 'doc.pdf', type: 'application/pdf', size: 1024 }, 'siteAudit'),
    'This type of file cannot be uploaded. Use a photo (JPEG, PNG, HEIC or WebP), up to 10 MB.'
  )
})

test('uploadPickError leaves a large photo to the redraw, never a large PDF', async () => {
  const { uploadPickError } = await import('./uploadLimits.ts')
  assert.equal(uploadPickError({ name: 'big.jpg', type: 'image/jpeg', size: 30 * MB }, 'siteAudit'), null)
  assert.match(uploadPickError({ name: 'big.pdf', type: 'application/pdf', size: 30 * MB }, 'work') ?? '', /too large/)
  // Review L4: a photo over 40 MB is refused before it is redrawn.
  assert.match(uploadPickError({ name: 'huge.jpg', type: 'image/jpeg', size: 41 * MB }, 'siteAudit') ?? '', /over 40 MB/)
  assert.match(uploadPickError({ name: 'big.svg', type: 'image/svg+xml', size: 1 }, 'work') ?? '', /cannot be uploaded/)
})
