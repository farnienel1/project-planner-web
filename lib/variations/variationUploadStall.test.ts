import assert from 'node:assert/strict'
import test from 'node:test'
import {
  VARIATION_UPLOAD_NEVER_STARTED_MESSAGE,
  VARIATION_UPLOAD_NO_ANSWER_MESSAGE,
  VARIATION_UPLOAD_REFUSED_MESSAGE,
  VARIATION_UPLOAD_SLOW_MESSAGE,
  variationUploadErrorText,
  variationUploadStallReason,
} from './variationUploadStall'

const fail = (code: string) => () => Promise.reject(Object.assign(new Error(code), { code }))

test('a stall says whether Storage refused, never answered, or stopped mid-file', async () => {
  assert.equal(await variationUploadStallReason({ sentBytes: 0 }, fail('storage/unauthorized')), VARIATION_UPLOAD_REFUSED_MESSAGE)
  assert.equal(await variationUploadStallReason({ sentBytes: 0 }, () => Promise.reject(new Error('no-answer'))), VARIATION_UPLOAD_NO_ANSWER_MESSAGE)
  assert.equal(await variationUploadStallReason({ sentBytes: 0 }, fail('storage/object-not-found')), VARIATION_UPLOAD_NEVER_STARTED_MESSAGE)
  assert.equal(await variationUploadStallReason({ sentBytes: 4096 }, fail('storage/object-not-found')), VARIATION_UPLOAD_SLOW_MESSAGE)
})

test('a refusal that comes back from Storage is shown at once with the real reason, never as a stall', () => {
  assert.equal(variationUploadErrorText(Object.assign(new Error('x'), { code: 'storage/unauthorized' })), VARIATION_UPLOAD_REFUSED_MESSAGE)
  assert.equal(variationUploadErrorText(Object.assign(new Error('x'), { code: 'storage/retry-limit-exceeded' })), VARIATION_UPLOAD_NO_ANSWER_MESSAGE)
  assert.match(variationUploadErrorText(new Error('This type of file cannot be uploaded.')), /cannot be uploaded/)
})
