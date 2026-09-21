import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refuseEmptyOverwrite, unionUniqueStrings } from './catalogueWriteGuard.ts'

test('refuseEmptyOverwrite keeps existing catalogue data', () => {
  assert.throws(() => refuseEmptyOverwrite(['CAT A'], [], 'job types'), /empty list/)
  assert.deepEqual(refuseEmptyOverwrite(['CAT A'], ['CAT B'], 'job types'), ['CAT B'])
})

test('unionUniqueStrings merges stored names with names still used on live records', () => {
  assert.deepEqual(unionUniqueStrings(['CAT A'], ['  CAT A  ', 'Small Works']), ['CAT A', 'Small Works'])
})
