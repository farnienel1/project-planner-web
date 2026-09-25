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

test('the same small work is listed once, on small works, when it is in both collections', () => {
  const split = splitBookingMoveCatalogues(
    [job('S1', 'Small Works'), job('S1', 'Small Works')],
    [job('S1', 'Small Works'), job('S1', 'CAT A')]
  )
  assert.deepEqual(split.projects.map((row) => row.id), [])
  assert.deepEqual(split.smallWorks.map((row) => row.id), ['S1'])
})

test('a small-works job type that only exists on the projects collection moves to small works once', () => {
  const split = splitBookingMoveCatalogues([job('S9', 'smallWork'), job('S9', 'Small Works')], [])
  assert.deepEqual(split.projects.map((row) => row.id), [])
  assert.deepEqual(split.smallWorks.map((row) => row.id), ['S9'])
})
