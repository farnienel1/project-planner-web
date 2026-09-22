import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pendingSignatureForUser, signedPercent, talkDownloadName } from './hsTracking.ts'
import type { HSToolboxSignature } from '../../types/index.ts'

function sig(partial: Partial<HSToolboxSignature> & { id: string; userId: string; status: string }): HSToolboxSignature {
  return {
    issueId: 'issue-1',
    readConfirmed: partial.status === 'signed',
    ...partial,
  }
}

test('signed percent uses signature rows and falls back to recipient count', () => {
  const signatures = [
    sig({ id: 'a', userId: 'u1', status: 'signed' }),
    sig({ id: 'b', userId: 'u2', status: 'pending' }),
  ]
  assert.deepEqual(signedPercent(signatures), { signed: 1, total: 2, percent: 50 })
  assert.deepEqual(signedPercent(signatures, 4), { signed: 1, total: 4, percent: 25 })
  assert.deepEqual(signedPercent([], 0), { signed: 0, total: 0, percent: 0 })
})

test('pending signature is only returned for the current user', () => {
  const signatures = [
    sig({ id: 'a', userId: 'u1', status: 'signed' }),
    sig({ id: 'b', userId: 'u2', status: 'pending' }),
  ]
  assert.equal(pendingSignatureForUser(signatures, 'u2')?.id, 'b')
  assert.equal(pendingSignatureForUser(signatures, 'u1'), undefined)
  assert.equal(pendingSignatureForUser(signatures, undefined), undefined)
})

test('talk download name prefers the library reference code', () => {
  assert.equal(talkDownloadName({ id: 'x', referenceCode: 'TBT-ELE-004', title: 'Electrical isolation' }), 'ToolboxTalk-TBT-ELE-004')
  assert.equal(talkDownloadName({ id: 'x', title: 'Site housekeeping' }), 'ToolboxTalk-Site-housekeeping')
})
