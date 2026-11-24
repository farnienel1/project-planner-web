import assert from 'node:assert/strict'
import test from 'node:test'
import { URL_DOCUMENT_ID_MAX_LENGTH, urlDocumentId } from './urlDocumentId.ts'

test('a URL-taken document id is refused when empty, a path, or too long', () => {
  assert.equal(urlDocumentId(' JOB-1 '), 'JOB-1')
  assert.equal(urlDocumentId(''), null)
  assert.equal(urlDocumentId('   '), null)
  assert.equal(urlDocumentId(null), null)
  assert.equal(urlDocumentId('JOB-1/tasks/x'), null)
  assert.equal(urlDocumentId('../projects'), null)
  assert.equal(urlDocumentId('a'.repeat(URL_DOCUMENT_ID_MAX_LENGTH)), 'a'.repeat(URL_DOCUMENT_ID_MAX_LENGTH))
  assert.equal(urlDocumentId('a'.repeat(URL_DOCUMENT_ID_MAX_LENGTH + 1)), null)
})
