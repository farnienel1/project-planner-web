import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mfaShowsCodeForm, mfaStepAfterStart, mfaStepAfterStatus } from './mfaScreenPhase.ts'

test('mfa screen: a passkey sign-in (already verified) never shows the code form, not even while it checks', () => {
  // The bug (owner 24 Nov): the code screen rendered at once and flashed for about a second before the status read
  // came back verified. The screen now starts in the checking step, which never shows the form.
  assert.equal(mfaShowsCodeForm({ step: 'checking', hasError: false, waitedTooLong: false }), false)
  const step = mfaStepAfterStatus({ verified: true })
  assert.equal(step, 'goToApp')
  assert.equal(mfaShowsCodeForm({ step, hasError: false, waitedTooLong: false }), false)
})

test('mfa screen: a password sign-in still has to enter the emailed code', () => {
  assert.equal(mfaStepAfterStatus({ verified: false, pending: false }), 'sendCode')
  assert.equal(mfaShowsCodeForm({ step: 'sendCode', hasError: false, waitedTooLong: false }), false, 'neutral while the code is sent')
  const afterStart = mfaStepAfterStart({ skipped: false })
  assert.equal(afterStart, 'enterCode')
  assert.equal(mfaShowsCodeForm({ step: afterStart, hasError: false, waitedTooLong: false }), true)
  assert.equal(mfaStepAfterStatus({ verified: false, pending: true }), 'enterCode', 'a code already sent')
  assert.equal(mfaStepAfterStatus({}), 'sendCode', 'unknown status never counts as verified')
})

test('mfa screen: errors and a long wait show the full screen', () => {
  assert.equal(mfaShowsCodeForm({ step: 'checking', hasError: true, waitedTooLong: false }), true)
  assert.equal(mfaShowsCodeForm({ step: 'goToApp', hasError: false, waitedTooLong: true }), true)
  assert.equal(mfaStepAfterStart({ skipped: true }), 'goToApp')
})
