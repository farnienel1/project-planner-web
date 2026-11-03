import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Project } from '../../types/index.ts'
import { splitBookingMoveCatalogues } from './bookingMoveCatalogues.ts'

function job(id: string, jobType = 'CAT A'): Project {
  return {
    id,
    jobNumber: id,
    siteName: id,
    jobType,
    isLive: true,
  } as Project
}

test('projects tab does not include small works that use another job type', () => {
  const split = splitBookingMoveCatalogues(
    [job('P1', 'CAT A')],
    [job('S1', 'CAT A'), job('S2', 'Maintenance')]
  )
  assert.deepEqual(split.projects.map((row) => row.id), ['P1'])
  assert.deepEqual(split.smallWorks.map((row) => row.id), ['S1', 'S2'])
})

test('1.11.0 jobKind: a project and a small works job sharing one id are both kept, each in its own list', () => {
  const split = splitBookingMoveCatalogues(
    [job('S1', 'Small Works'), job('S1', 'Small Works')],
    [job('S1', 'Small Works'), job('S1', 'CAT A')]
  )
  assert.deepEqual(split.projects.map((row) => row.id), ['S1'])
  assert.deepEqual(split.smallWorks.map((row) => row.id), ['S1'])
})

test('1.11.0 jobKind: a projects document with a small-works job type stays a project', () => {
  const split = splitBookingMoveCatalogues([job('S9', 'smallWork'), job('S9', 'Small Works')], [])
  assert.deepEqual(split.projects.map((row) => row.id), ['S9'])
  assert.deepEqual(split.smallWorks.map((row) => row.id), [])
})
