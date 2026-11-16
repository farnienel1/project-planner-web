import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restFieldsToPlain } from './firestoreRest.ts'

test('review #340: a referenceValue reads as the referenced document id, never as missing', () => {
  const plain = restFieldsToPlain({
    organizationId: { referenceValue: 'projects/p/databases/(default)/documents/organizations/org-1' },
    name: { stringValue: 'x' },
  })
  assert.equal(plain.organizationId, 'org-1')
  assert.equal('organizationId' in plain, true)
})
