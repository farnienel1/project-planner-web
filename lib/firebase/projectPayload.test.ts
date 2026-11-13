import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Project } from '../../types/index.ts'
import { buildProjectFirestorePayload, projectToSaveInput, type ProjectSaveInput } from './projectPayload.ts'
import { jobWriteFields } from '../canonical/workDocumentReaders.ts'
import { plainWritePayload } from './partialWrite.ts'

const at = new Date('2026-11-04T00:00:00Z')

function stored(partial: Partial<Project> = {}): Project {
  return {
    id: 'J1',
    jobNumber: 'J-1',
    siteName: 'Site',
    addressLine1: '1 Road',
    townCity: 'Town',
    postcode: 'AB1 2CD',
    client: { id: 'C1', name: 'Client', createdAt: at, updatedAt: at },
    startDate: at,
    endDate: at,
    jobType: 'CAT A',
    manager: { name: 'Mo', email: '' },
    managerId: 'M1',
    managerIds: ['M1', 'M2'],
    managerUserIds: ['M1', 'M2'],
    isLive: true,
    organizationId: 'ORG',
    createdAt: at,
    updatedAt: at,
    ...partial,
  } as Project
}

function diff(before: Project, next: ProjectSaveInput) {
  const base = plainWritePayload(buildProjectFirestorePayload(projectToSaveInput(before, 'ORG')))
  const write = jobWriteFields(base, plainWritePayload(buildProjectFirestorePayload(next)))
  delete write.set.updatedAt
  return write
}

test('1.31.0 a description-only edit never rewrites the manager group', () => {
  const job = stored()
  const write = diff(job, { ...projectToSaveInput(job, 'ORG'), description: 'New text' })
  assert.deepEqual(Object.keys(write.set), ['description'])
  assert.deepEqual(write.remove, [])
})

test('1.31.0 clearing the managers removes managerIds, managerId and managerUserIds together', () => {
  const job = stored()
  const write = diff(job, { ...projectToSaveInput(job, 'ORG'), managerId: undefined, managerIds: [], managerUserIds: [] })
  assert.deepEqual([...write.remove].sort(), ['managerId', 'managerIds', 'managerUserIds'])
})

test('1.31.0 switching a custom job type back to CAT A removes customJobType', () => {
  const job = stored({ customJobType: 'Fit-out' })
  const write = diff(job, { ...projectToSaveInput(job, 'ORG'), customJobType: undefined })
  assert.deepEqual(write.remove, ['customJobType'])
})

test('1.31.0 switching from a map pin to an address removes the coordinates', () => {
  const job = stored({ latitude: 51.5, longitude: -0.1, usesMapPinForLocation: true })
  const write = diff(job, { ...projectToSaveInput(job, 'ORG'), latitude: undefined, longitude: undefined, usesMapPinForLocation: false })
  assert.deepEqual([...write.remove].sort(), ['latitude', 'longitude'])
  assert.equal(write.set.usesMapPinForLocation, false)
})

test('1.31.0 a new job never stores null fields', () => {
  const payload = buildProjectFirestorePayload({ ...projectToSaveInput(stored(), 'ORG'), customJobType: undefined })
  const create = jobWriteFields(null, plainWritePayload(payload))
  assert.equal(Object.values(create.set).includes(null), false)
})

test('1.42.0 a new job with two managers stores both, the first as managerId', () => {
  const input = { ...projectToSaveInput(stored(), 'ORG'), managerId: 'M1', managerIds: ['M1', 'M2'], managerUserIds: ['U1', 'U2'] }
  const create = jobWriteFields(null, plainWritePayload(buildProjectFirestorePayload(input)))
  assert.deepEqual(create.set.managerIds, ['M1', 'M2'])
  assert.equal(create.set.managerId, 'M1')
  assert.deepEqual(create.set.managerUserIds, ['U1', 'U2'])
})

test('1.42.0 adding a third manager and removing one writes the manager group, nothing else', () => {
  const job = stored()
  const added = diff(job, { ...projectToSaveInput(job, 'ORG'), managerIds: ['M1', 'M2', 'M3'], managerUserIds: ['M1', 'M2', 'M3'] })
  assert.deepEqual(added.set.managerIds, ['M1', 'M2', 'M3'])
  assert.deepEqual(added.set.managerUserIds, ['M1', 'M2', 'M3'])
  assert.deepEqual(Object.keys(added.set).filter((key) => !key.startsWith('manager')), [])
  const removed = diff(job, { ...projectToSaveInput(job, 'ORG'), managerId: 'M2', managerIds: ['M2'], managerUserIds: ['M2'] })
  assert.deepEqual(removed.set.managerIds, ['M2'])
  assert.equal(removed.set.managerId, 'M2')
  assert.deepEqual(removed.remove, [])
})
