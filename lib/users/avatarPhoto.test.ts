import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AVATAR_RETRY_DELAYS_MS,
  avatarAttemptKey,
  avatarRefreshPath,
  avatarRetryDelayMs,
  storagePathFromDownloadUrl,
  storagePathFromPhotoUrl,
} from './avatarPhoto.ts'

const URL_A =
  'https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/organizations%2Forg-a%2FuserProfiles%2Fu1%2Fprofile.jpg?alt=media&token=aaa'
const URL_B = URL_A.replace('token=aaa', 'token=bbb')

test('a new upload time starts a new attempt even when the URL is the same', () => {
  const before = avatarAttemptKey(URL_A, new Date(1_000))
  const after = avatarAttemptKey(URL_A, new Date(2_000))
  assert.notEqual(before, after)
})

test('a new download token starts a new attempt', () => {
  assert.notEqual(avatarAttemptKey(URL_A, 1_000), avatarAttemptKey(URL_B, 1_000))
})

test('each retry round is its own attempt, so a remembered failure never blocks the retry', () => {
  assert.notEqual(avatarAttemptKey(URL_A, 1_000, 0), avatarAttemptKey(URL_A, 1_000, 1))
})

test('no stored photo has no attempt; blank and spaces are no photo', () => {
  assert.equal(avatarAttemptKey('', 1_000), '')
  assert.equal(avatarAttemptKey('   ', null), '')
  assert.equal(avatarAttemptKey(undefined, undefined), '')
})

test('a missing or invalid upload time reads as none, and the same instant gives the same key', () => {
  assert.equal(avatarAttemptKey(URL_A, null), avatarAttemptKey(URL_A, undefined))
  assert.equal(avatarAttemptKey(URL_A, new Date(Number.NaN)), avatarAttemptKey(URL_A, null))
  assert.equal(avatarAttemptKey(URL_A, new Date(5_000)), avatarAttemptKey(URL_A, 5_000))
})

test('the refresh path comes from the URL that failed, else the stored value', () => {
  assert.equal(avatarRefreshPath(URL_A, ''), 'organizations/org-a/userProfiles/u1/profile.jpg')
  assert.equal(avatarRefreshPath('https://example.com/p.jpg', URL_B), 'organizations/org-a/userProfiles/u1/profile.jpg')
  assert.equal(avatarRefreshPath(null, 'gs://bucket/organizations/o/userProfiles/u/profile.jpg'), 'organizations/o/userProfiles/u/profile.jpg')
  assert.equal(avatarRefreshPath('https://example.com/p.jpg', 'https://example.com/p.jpg'), null)
})

test('storage paths from download URLs and stored values', () => {
  assert.equal(storagePathFromDownloadUrl(URL_A), 'organizations/org-a/userProfiles/u1/profile.jpg')
  assert.equal(storagePathFromDownloadUrl('https://example.com/x'), null)
  assert.equal(storagePathFromPhotoUrl('/organizations/o/userProfiles/u/profile.jpg'), 'organizations/o/userProfiles/u/profile.jpg')
  assert.equal(storagePathFromPhotoUrl(URL_A), null)
})

test('automatic retries back off and then stop; online / tab shown / a new photo still retry', () => {
  assert.equal(avatarRetryDelayMs(0), null)
  assert.equal(avatarRetryDelayMs(1), AVATAR_RETRY_DELAYS_MS[0])
  assert.equal(avatarRetryDelayMs(AVATAR_RETRY_DELAYS_MS.length), AVATAR_RETRY_DELAYS_MS[AVATAR_RETRY_DELAYS_MS.length - 1])
  assert.equal(avatarRetryDelayMs(AVATAR_RETRY_DELAYS_MS.length + 1), null)
})
