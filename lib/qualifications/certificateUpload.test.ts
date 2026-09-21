import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  QUALIFICATION_CERT_HINT,
  QUALIFICATION_CERT_MAX_BYTES,
  dateFromLocalInputValue,
  formatCertificateSaveError,
  localDateInputValue,
  mergeCertificateUrls,
  qualificationCertificateContentType,
  qualificationCertificateFileError,
  uploadPendingCertificates,
} from './certificateUpload.ts'

function file(partial: { name: string; type?: string; size?: number }) {
  return { name: partial.name, type: partial.type || '', size: partial.size ?? 1024 }
}

test('accepts PDF and JPEG even when the picker leaves type empty or uses aliases', () => {
  assert.equal(qualificationCertificateFileError(file({ name: 'cscs.pdf', type: 'application/pdf' })), null)
  assert.equal(qualificationCertificateFileError(file({ name: 'card.PDF' })), null)
  assert.equal(qualificationCertificateFileError(file({ name: 'photo.jpg', type: 'image/jpeg' })), null)
  assert.equal(qualificationCertificateFileError(file({ name: 'photo.JPG', type: 'image/jpg' })), null)
  assert.equal(qualificationCertificateFileError(file({ name: 'scan.jpeg' })), null)
  assert.equal(qualificationCertificateFileError(file({ name: 'scan.jpeg', type: 'image/pjpeg' })), null)
})

test('rejects png, heic and oversized files with the iOS size/type copy', () => {
  assert.equal(qualificationCertificateFileError(file({ name: 'shot.png', type: 'image/png' })), QUALIFICATION_CERT_HINT)
  assert.equal(qualificationCertificateFileError(file({ name: 'shot.heic', type: 'image/heic' })), QUALIFICATION_CERT_HINT)
  assert.equal(
    qualificationCertificateFileError(file({ name: 'big.pdf', type: 'application/pdf', size: QUALIFICATION_CERT_MAX_BYTES + 1 })),
    QUALIFICATION_CERT_HINT
  )
})

test('content type used for Storage is PDF or JPEG', () => {
  assert.equal(qualificationCertificateContentType(file({ name: 'a.pdf' })), 'application/pdf')
  assert.equal(qualificationCertificateContentType(file({ name: 'a.jpg' })), 'image/jpeg')
})

test('uploadPendingCertificates merges new URLs and does not call upload when nothing is pending', async () => {
  const calls: string[] = []
  const merged = await uploadPendingCertificates({
    pending: {},
    existingUrls: { q1: 'https://example.com/old.pdf' },
    uploadOne: async (id) => {
      calls.push(id)
      return 'https://example.com/new.pdf'
    },
  })
  assert.deepEqual(merged, { q1: 'https://example.com/old.pdf' })
  assert.deepEqual(calls, [])
})

test('uploadPendingCertificates uploads each picked file then merges onto existing URLs', async () => {
  const merged = await uploadPendingCertificates({
    pending: { q2: file({ name: 'first-aid.jpg' }) },
    existingUrls: { q1: 'https://example.com/old.pdf' },
    uploadOne: async (id, picked) => `https://cdn.example/${id}/${picked.name}`,
  })
  assert.deepEqual(merged, {
    q1: 'https://example.com/old.pdf',
    q2: 'https://cdn.example/q2/first-aid.jpg',
  })
})

test('uploadPendingCertificates does not mark a URL when the file is invalid', async () => {
  await assert.rejects(
    () =>
      uploadPendingCertificates({
        pending: { q1: file({ name: 'notes.png', type: 'image/png' }) },
        uploadOne: async () => 'https://example.com/should-not-save',
      }),
    /PDF or JPEG only/
  )
})

test('mergeCertificateUrls keeps prior certificates', () => {
  assert.deepEqual(mergeCertificateUrls({ q1: 'a' }, { q2: 'b' }), { q1: 'a', q2: 'b' })
})

test('local date helpers round-trip without UTC day shift', () => {
  const date = new Date(2026, 8, 21)
  assert.equal(localDateInputValue(date), '2026-09-21')
  const parsed = dateFromLocalInputValue('2026-09-21')
  assert.ok(parsed)
  assert.equal(parsed.getFullYear(), 2026)
  assert.equal(parsed.getMonth(), 8)
  assert.equal(parsed.getDate(), 21)
})

test('formatCertificateSaveError explains Storage permission failures', () => {
  const err = Object.assign(new Error('Unauthorized'), { code: 'storage/unauthorized' })
  assert.match(formatCertificateSaveError(err), /Storage permissions/)
  assert.equal(formatCertificateSaveError(new Error('You must be signed in to upload files.')), 'You must be signed in to upload files.')
})
