import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  QUALIFICATION_CERT_HINT,
  QUALIFICATION_CERT_MAX_BYTES,
  dateFromLocalInputValue,
  formatCertificateSaveError,
  localDateInputValue,
  canonicalCertificateUrls,
  certificateUrlForQualification,
  mergeCertificateUrls,
  persistQualificationsThenCertificates,
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

test('persistQualificationsThenCertificates writes the assignment before a certificate upload', async () => {
  const order: string[] = []
  const result = await persistQualificationsThenCertificates({
    pending: { q2: file({ name: 'first-aid.jpg' }) },
    existingUrls: { q1: 'https://example.com/old.pdf' },
    saveAssignment: async () => {
      order.push('assignment')
    },
    uploadOne: async (id, picked) => {
      order.push(`upload:${id}`)
      return `https://cdn.example/${id}/${picked.name}`
    },
    saveCertificateUrls: async () => {
      order.push('urls')
    },
  })
  assert.deepEqual(order, ['assignment', 'upload:q2', 'urls'])
  assert.deepEqual(result.certificateUrls, {
    q1: 'https://example.com/old.pdf',
    q2: 'https://cdn.example/q2/first-aid.jpg',
  })
})

test('persistQualificationsThenCertificates keeps the assignment when upload throws', async () => {
  const order: string[] = []
  await assert.rejects(
    () =>
      persistQualificationsThenCertificates({
        pending: { q2: file({ name: 'first-aid.jpg' }) },
        existingUrls: { q1: 'https://example.com/old.pdf' },
        saveAssignment: async () => {
          order.push('assignment')
        },
        uploadOne: async () => {
          order.push('upload')
          throw new Error('storage/unauthorized')
        },
        saveCertificateUrls: async () => {
          order.push('urls')
        },
      }),
    /storage\/unauthorized/
  )
  assert.deepEqual(order, ['assignment', 'upload'])
})

test('persistQualificationsThenCertificates does not upload when nothing is pending', async () => {
  const order: string[] = []
  const result = await persistQualificationsThenCertificates({
    pending: {},
    existingUrls: { q1: 'https://example.com/old.pdf' },
    saveAssignment: async () => {
      order.push('assignment')
    },
    uploadOne: async () => {
      order.push('upload')
      return 'https://example.com/should-not-save'
    },
    saveCertificateUrls: async () => {
      order.push('urls')
    },
  })
  assert.deepEqual(order, ['assignment'])
  assert.deepEqual(result.certificateUrls, { q1: 'https://example.com/old.pdf' })
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

test('certificate lookup matches the qualification id ignoring case', () => {
  const urls = { 'ABC-1': 'https://files.example/old.pdf' }
  assert.equal(certificateUrlForQualification(urls, 'abc-1'), 'https://files.example/old.pdf')
  assert.equal(certificateUrlForQualification(urls, 'missing'), undefined)
})

test('canonical certificate urls keep the qualification id iOS stores', () => {
  const urls = canonicalCertificateUrls([{ id: 'ABC-1' }], { 'abc-1': 'https://files.example/new.pdf', OTHER: 'https://files.example/keep.pdf' })
  assert.equal(urls['ABC-1'], 'https://files.example/new.pdf')
  assert.equal(urls.OTHER, 'https://files.example/keep.pdf')
  assert.equal(urls['abc-1'], undefined)
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
