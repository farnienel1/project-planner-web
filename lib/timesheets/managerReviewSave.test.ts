import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extraReviewAfterSave } from './managerReviewSave.ts'

test('extra review save: decline or original amount becomes approved', () => {
  assert.deepEqual(extraReviewAfterSave('declined', 40, 40), {
    managerDecision: 'approved',
    managerRevisedAmount: null,
  })
  assert.deepEqual(extraReviewAfterSave('declined', 40, 25), {
    managerDecision: 'approved',
    managerRevisedAmount: 25,
  })
  assert.deepEqual(extraReviewAfterSave('edited', 40, 40), {
    managerDecision: 'approved',
    managerRevisedAmount: null,
  })
})

test('extra review save: a changed amount is marked edited', () => {
  assert.deepEqual(extraReviewAfterSave('approved', 40, 25), {
    managerDecision: 'edited',
    managerRevisedAmount: 25,
  })
})
