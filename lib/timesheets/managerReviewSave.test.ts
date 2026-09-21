import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extraReviewAfterSave, payrollReviewAfterSave } from './managerReviewSave.ts'

test('payroll review save: decline then edit becomes approved', () => {
  assert.deepEqual(payrollReviewAfterSave('declined', 200, 180), {
    decision: 'approved',
    revisedAmount: 180,
  })
})

test('payroll review save: unchanged amount clears the edit', () => {
  assert.deepEqual(payrollReviewAfterSave('edited', 200, 200), {
    decision: 'approved',
    revisedAmount: null,
  })
})

test('payroll review save: a new amount is marked edited', () => {
  assert.deepEqual(payrollReviewAfterSave('approved', 200, 150), {
    decision: 'edited',
    revisedAmount: 150,
  })
})

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
