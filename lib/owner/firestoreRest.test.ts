import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restCommitBody, restFieldsToPlain } from './firestoreRest.ts'

test('review #340: a referenceValue reads as the referenced document id, never as missing', () => {
  const plain = restFieldsToPlain({
    organizationId: { referenceValue: 'projects/p/databases/(default)/documents/organizations/org-1' },
    name: { stringValue: 'x' },
  })
  assert.equal(plain.organizationId, 'org-1')
  assert.equal('organizationId' in plain, true)
})

test('1.81.0 an upsert has no precondition and a delete is a plain delete', () => {
  const base = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents'
  const body = restCommitBody(base, [
    { path: 'organizations/B/memberNames/u1', set: { firstName: 'Farns', surname: 'Nel' }, kind: 'upsert' },
    { path: 'organizations/C/memberNames/u1', set: {}, kind: 'delete' },
    { path: 'users/u1', set: { firstName: 'Farns' } },
  ], 'owner') as { writes: Array<Record<string, unknown>> }
  assert.equal('currentDocument' in body.writes[0], false)
  assert.deepEqual(body.writes[1], { delete: 'projects/p/databases/(default)/documents/organizations/C/memberNames/u1' })
  assert.deepEqual(body.writes[2].currentDocument, { exists: true })
})
