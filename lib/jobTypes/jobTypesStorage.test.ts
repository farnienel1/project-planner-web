import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalJobTypeName,
  coerceJobTypeList,
  collectionJobTypeForName,
  jobTypeFieldsFromRecord,
  jobTypesFromWorkRecords,
  mergeJobTypeCatalogues,
  validateJobTypeName,
} from './jobTypesStorage.ts'

test('validateJobTypeName matches iOS empty and exact-duplicate rules', () => {
  assert.equal(validateJobTypeName('  ', []), 'Job type name cannot be empty')
  assert.equal(validateJobTypeName('CAT A', ['CAT A']), 'This job type already exists')
  assert.equal(validateJobTypeName('cat a', ['CAT A']), null)
  assert.equal(validateJobTypeName('CAT B', ['CAT A']), null)
})

test('canonicalJobTypeName maps iOS enum aliases', () => {
  assert.equal(canonicalJobTypeName('catA'), 'CAT A')
  assert.equal(canonicalJobTypeName('CAT-A'), 'CAT A')
  assert.equal(canonicalJobTypeName('small_works'), 'Small Works')
  assert.equal(canonicalJobTypeName('Decarbonisation'), 'Decarbonisation')
  assert.equal(canonicalJobTypeName('Decarbonization'), 'Decarbonisation')
})

test('coerceJobTypeList accepts arrays, maps, and comma strings', () => {
  assert.deepEqual(coerceJobTypeList(['catA', 'Decarbonisation']), ['CAT A', 'Decarbonisation'])
  assert.deepEqual(coerceJobTypeList({ 0: 'CAT B', 1: 'Maintenance' }), ['CAT B', 'Maintenance'])
  assert.deepEqual(coerceJobTypeList('CAT A, Decarbonisation'), ['CAT A', 'Decarbonisation'])
})

test('jobTypesFromWorkRecords recovers names still stored on projects and small works', () => {
  assert.deepEqual(
    jobTypesFromWorkRecords([
      { jobType: 'catA', customJobType: 'Fit-out' },
      { jobType: 'Small Works' },
      { customJobType: 'Decarbonisation' },
    ]),
    ['CAT A', 'Decarbonisation', 'Fit-out', 'Small Works']
  )
})

test('jobTypeFieldsFromRecord reads custom names from older worksType fields', () => {
  assert.deepEqual(
    jobTypeFieldsFromRecord({ worksType: 'Decarbonisation', jobType: { rawValue: 'CAT A' } }),
    { jobType: 'CAT A', customJobType: 'Decarbonisation' }
  )
})

test('mergeJobTypeCatalogues restores CAT A and custom types such as Decarbonisation', () => {
  const merged = mergeJobTypeCatalogues(
    ['Small Works'],
    jobTypesFromWorkRecords([
      { jobType: 'CAT A' },
      { customJobType: 'Decarbonisation' },
      { jobType: 'Small Works' },
    ])
  )
  assert.ok(merged.includes('CAT A'))
  assert.ok(merged.includes('CAT B'))
  assert.ok(merged.includes('Small Works'))
  assert.ok(merged.includes('Maintenance'))
  assert.ok(merged.includes('Decarbonisation'))
})

test('mergeJobTypeCatalogues always re-seeds CAT A even when stored and recovered lists are empty', () => {
  const merged = mergeJobTypeCatalogues([], [])
  assert.deepEqual(merged, ['CAT A', 'CAT B', 'Decarbonisation', 'Maintenance', 'Small Works'])
})

test('collectionJobTypeForName keeps iOS enum for projects vs small works', () => {
  assert.equal(collectionJobTypeForName('Decarbonisation', 'projects'), 'CAT A')
  assert.equal(collectionJobTypeForName('CAT B', 'projects'), 'CAT B')
  assert.equal(collectionJobTypeForName('Small Works', 'projects'), 'CAT A')
  assert.equal(collectionJobTypeForName('Decarbonisation', 'smallWorks'), 'Small Works')
})
