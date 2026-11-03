import { test } from 'node:test'
import assert from 'node:assert/strict'
import { healthSafetyDocumentWriteFields } from '../canonical/index.ts'
import { hasOpenableStoredFile, storedFileDirectHref, storedFileTarget } from './storedFile.ts'
import { mergeHealthSafetyPayload, parseHealthSafetyPayload } from './parseHealthSafety.ts'
import { serializeHealthSafetyPayload } from './serializeHealthSafety.ts'

const TOKEN_URL =
  'https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/organizations%2Forg1%2FhealthSafety%2FJOB1%2Frams%2Fa.pdf?alt=media&token=abc'

test('a download URL with its token opens as is', () => {
  assert.deepEqual(storedFileTarget(TOKEN_URL), { kind: 'url', url: TOKEN_URL })
  assert.equal(storedFileDirectHref(`  ${TOKEN_URL}  `), TOKEN_URL)
})

test('a gs:// URL (iOS fallback when downloadURL fails) resolves through Storage', () => {
  assert.deepEqual(storedFileTarget('gs://demo.appspot.com/organizations/org1/healthSafety/JOB1/rams/a.pdf'), {
    kind: 'storage',
    path: 'organizations/org1/healthSafety/JOB1/rams/a.pdf',
  })
  assert.equal(storedFileDirectHref('gs://demo.appspot.com/organizations/org1/healthSafety/JOB1/rams/a.pdf'), null)
})

test('a bare Storage path resolves through Storage', () => {
  assert.deepEqual(storedFileTarget('organizations/org1/healthSafety/JOB1/other/b.pdf'), {
    kind: 'storage',
    path: 'organizations/org1/healthSafety/JOB1/other/b.pdf',
  })
})

test('a Firebase URL without a token gets a fresh one from Storage', () => {
  assert.deepEqual(
    storedFileTarget('https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/organizations%2Forg1%2Fx.pdf?alt=media'),
    { kind: 'storage', path: 'organizations/org1/x.pdf' }
  )
})

test('other https links open as is', () => {
  assert.deepEqual(storedFileTarget('https://example.test/rams.pdf'), { kind: 'url', url: 'https://example.test/rams.pdf' })
})

test('blank, device-local and unknown references cannot be opened', () => {
  for (const value of [undefined, null, '', '   ', 'file:///var/mobile/a.pdf', '/private/var/a.pdf', 'ftp://x/y']) {
    assert.equal(storedFileTarget(value), null, String(value))
    assert.equal(hasOpenableStoredFile(value), false)
  }
})

test('merging copies keeps the file link when the newer copy lost it', () => {
  const withLink = parseHealthSafetyPayload(
    { ramsDocuments: [{ id: 'R1', title: 'RAMS', uploadedAt: new Date('2026-10-01'), fileURL: TOKEN_URL, fileName: 'a.pdf' }] },
    'JOB1'
  )
  const withoutLink = parseHealthSafetyPayload(
    { ramsDocuments: [{ id: 'R1', title: 'RAMS', uploadedAt: new Date('2026-10-01'), fileURL: '' }] },
    'JOB1'
  )
  const merged = mergeHealthSafetyPayload(withoutLink, withLink)
  assert.equal(merged.ramsDocuments[0].fileURL, TOKEN_URL)
  assert.equal(merged.ramsDocuments[0].fileName, 'a.pdf')
  assert.equal(mergeHealthSafetyPayload(withLink, withoutLink).ramsDocuments[0].fileURL, TOKEN_URL)
})

test('a web save of a row without a link never blanks the stored link', () => {
  const stored = {
    otherDocuments: [{ id: 'O1', title: 'COSHH', category: 'trade', uploadedAt: new Date('2026-10-01'), fileURL: TOKEN_URL }],
  }
  const data = parseHealthSafetyPayload(
    { otherDocuments: [{ id: 'O1', title: 'COSHH renamed', category: 'trade', uploadedAt: new Date('2026-10-01') }] },
    'JOB1'
  )
  const payload = serializeHealthSafetyPayload(data)
  const write = healthSafetyDocumentWriteFields(stored, { otherDocuments: payload.otherDocuments as Record<string, unknown>[] })
  const rows = write.set.otherDocuments as Record<string, unknown>[]
  assert.equal(rows[0].fileURL, TOKEN_URL)
  assert.equal(rows[0].title, 'COSHH renamed')
})
