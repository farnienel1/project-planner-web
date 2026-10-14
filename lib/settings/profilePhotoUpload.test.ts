import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROFILE_PHOTO_HINT,
  PROFILE_PHOTO_MAX_BYTES,
  validateProfilePhotoFile,
} from './profilePhotoUpload.ts'

test('profile photo cap matches storage.rules 2MB image write', () => {
  assert.equal(PROFILE_PHOTO_MAX_BYTES, 2 * 1024 * 1024)
  assert.equal(validateProfilePhotoFile({ name: 'me.jpg', type: 'image/jpeg', size: 1024 }), null)
  assert.equal(
    validateProfilePhotoFile({ name: 'me.jpg', type: 'image/jpeg', size: PROFILE_PHOTO_MAX_BYTES }),
    null
  )
  assert.equal(
    validateProfilePhotoFile({ name: 'me.jpg', type: 'image/jpeg', size: PROFILE_PHOTO_MAX_BYTES + 1 }),
    PROFILE_PHOTO_HINT
  )
  assert.equal(
    validateProfilePhotoFile({ name: 'me.pdf', type: 'application/pdf', size: 1024 }),
    PROFILE_PHOTO_HINT
  )
})
