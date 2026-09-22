import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeHealthSafetyPayload, parseHealthSafetyPayload } from './parseHealthSafety.ts'

test('merge keeps iOS signatures when the nested web doc is empty', () => {
  const ios = parseHealthSafetyPayload(
    {
      talks: [{ id: 't1', title: 'Working at height', purpose: 'Stay clipped on', keyPoints: ['Harness'] }],
      issues: [
        {
          id: 'i1',
          talkId: 't1',
          projectId: 'p1',
          issuedAt: new Date('2026-09-01'),
          weekCommencing: new Date('2026-09-01'),
          issuedByUserId: 'u1',
          recipientUserIds: ['u2'],
          status: 'awaiting',
        },
      ],
      signatures: [{ id: 's1', issueId: 'i1', userId: 'u2', status: 'pending' }],
    },
    'p1'
  )
  const web = parseHealthSafetyPayload({ talks: [], issues: [], signatures: [] }, 'p1')
  const merged = mergeHealthSafetyPayload(web, ios)
  assert.equal(merged.talks[0].title, 'Working at height')
  assert.equal(merged.issues.length, 1)
  assert.equal(merged.signatures[0].userId, 'u2')
})

test('merge prefers a signed overlay over a pending copy of the same signature', () => {
  const pending = parseHealthSafetyPayload(
    { signatures: [{ id: 's1', issueId: 'i1', userId: 'u2', status: 'pending' }] },
    'p1'
  )
  const signed = parseHealthSafetyPayload(
    {
      signatures: [
        {
          id: 's1-ios',
          issueId: 'i1',
          userId: 'u2',
          status: 'Signed',
          signatureImageBase64: 'abc',
          signedAt: new Date('2026-09-02'),
        },
      ],
    },
    'p1'
  )
  const merged = mergeHealthSafetyPayload(pending, signed)
  assert.equal(merged.signatures.length, 1)
  assert.equal(merged.signatures[0].status, 'signed')
  assert.equal(merged.signatures[0].signatureImageBase64, 'abc')
})
