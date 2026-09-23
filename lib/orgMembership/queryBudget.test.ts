import { test } from 'node:test'
import assert from 'node:assert/strict'
import { queryWithin } from './queryBudget.ts'

test('queryWithin returns the value when it finishes in time', async () => {
  const value = await queryWithin(Promise.resolve(7), 50)
  assert.equal(value, 7)
})

test('queryWithin returns null when the query is too slow', async () => {
  const value = await queryWithin(new Promise((resolve) => setTimeout(() => resolve(1), 80)), 10)
  assert.equal(value, null)
})
