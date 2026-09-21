import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jobTypesFromWorkRecords, validateJobTypeName } from './jobTypesStorage.ts'
import { unionUniqueStrings } from '../catalogues/catalogueWriteGuard.ts'

test('validateJobTypeName matches iOS empty and exact-duplicate rules', () => {
  assert.equal(validateJobTypeName('  ', []), 'Job type name cannot be empty')
  assert.equal(validateJobTypeName('CAT A', ['CAT A']), 'This job type already exists')
  assert.equal(validateJobTypeName('cat a', ['CAT A']), null)
  assert.equal(validateJobTypeName('CAT B', ['CAT A']), null)
})

test('jobTypesFromWorkRecords recovers names still stored on projects and small works', () => {
  assert.deepEqual(
    jobTypesFromWorkRecords([
      { jobType: 'CAT A', customJobType: 'Fit-out' },
      { jobType: 'Small Works' },
      { customJobType: 'Fit-out' },
    ]),
    ['CAT A', 'Fit-out', 'Small Works']
  )
})

test('union of a partial stored catalogue with live work restores missing names', () => {
  const stored = ['Small Works']
  const recovered = jobTypesFromWorkRecords([
    { jobType: 'CAT A' },
    { customJobType: 'Decarbonisation' },
    { jobType: 'Small Works' },
  ])
  assert.deepEqual(unionUniqueStrings(stored, recovered), ['CAT A', 'Decarbonisation', 'Small Works'])
})
