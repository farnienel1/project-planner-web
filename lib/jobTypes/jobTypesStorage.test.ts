import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateJobTypeName } from './jobTypesStorage.ts'

test('validateJobTypeName matches iOS empty and exact-duplicate rules', () => {
  assert.equal(validateJobTypeName('  ', []), 'Job type name cannot be empty')
  assert.equal(validateJobTypeName('CAT A', ['CAT A']), 'This job type already exists')
  assert.equal(validateJobTypeName('cat a', ['CAT A']), null)
  assert.equal(validateJobTypeName('CAT B', ['CAT A']), null)
})
