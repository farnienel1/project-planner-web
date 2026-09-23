import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findTalkForIssue, pendingSignatureForUser, signedPercent, talkDownloadName, trackingAwaitingCount } from './hsTracking.ts'
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

test('findTalkForIssue matches library reference codes used as talkId', () => {
  const talk = {
    id: 'uuid-1',
    referenceCode: 'TBT-ELE-004',
    title: 'Electrical isolation',
    category: 'electrical',
    isGeneral: false,
    trades: ['Electrician'],
    purpose: '',
    keyPoints: [],
    source: 'library',
    status: 'approved',
    version: 1,
    updatedAt: new Date(),
  }
  const found = findTalkForIssue({ talkId: 'TBT-ELE-004' }, [talk], [])
  assert.equal(found?.title, 'Electrical isolation')
})

test('findTalkForIssue skips a stored TBT placeholder and uses the real library talk', () => {
  const library = {
    id: 'TBT-GEN-001',
    referenceCode: 'TBT-GEN-001',
    title: 'Working at Height',
    category: 'General',
    isGeneral: true,
    trades: [],
    purpose: 'Falls',
    keyPoints: ['Guardrails'],
    source: 'library',
    status: 'approved',
    version: 1,
    updatedAt: new Date(),
  }
  const placeholder = {
    ...library,
    id: 'stored-placeholder',
    title: 'TBT',
    purpose: '',
    keyPoints: [],
  }
  const found = findTalkForIssue({ talkId: 'stored-placeholder' }, [library], [placeholder])
  assert.equal(found?.title, 'Working at Height')
  assert.equal(found?.id, 'TBT-GEN-001')
})

test('tracking awaiting count is pending signatures on issued talks only', () => {
  const issues = [
    {
      id: 'i1',
      projectId: 'p1',
      talkId: 't1',
      weekCommencing: new Date(),
      issuedByUserId: 'u1',
      issuedAt: new Date(),
      recipientUserIds: ['a', 'b'],
      status: 'awaiting',
    },
    {
      id: 'i2',
      projectId: 'p1',
      talkId: 't2',
      weekCommencing: new Date(),
      issuedByUserId: 'u1',
      issuedAt: new Date(),
      publishAt: new Date(Date.now() + 86_400_000),
      recipientUserIds: ['c'],
      status: 'scheduled',
    },
  ]
  const signatures = [
    sig({ id: 's1', issueId: 'i1', userId: 'a', status: 'signed' }),
    sig({ id: 's2', issueId: 'i1', userId: 'b', status: 'pending' }),
    sig({ id: 's3', issueId: 'i2', userId: 'c', status: 'pending' }),
  ]
  assert.equal(trackingAwaitingCount(issues, signatures), 1)
})
