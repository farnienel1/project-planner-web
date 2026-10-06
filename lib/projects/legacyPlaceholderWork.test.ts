import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectFirestorePayload } from '../firebase/projectPayload.ts'
import {
  isLegacyPlaceholderDocumentId,
  LEGACY_PLACEHOLDER_DOCUMENT_ID,
  withoutLegacyPlaceholderDocuments,
} from './legacyPlaceholderWork.ts'
import {
  countFilledProjectCreateFields,
  emptyProjectCreateIdentity,
  PROJECT_CREATE_REQUIRED_FIELD_COUNT,
} from './projectCreateRules.ts'

test('the early starter project id is hidden and a real job id is kept', () => {
  assert.equal(isLegacyPlaceholderDocumentId(LEGACY_PLACEHOLDER_DOCUMENT_ID), true)
  assert.equal(isLegacyPlaceholderDocumentId(' initial-placeholder '), true)
  assert.equal(isLegacyPlaceholderDocumentId('729A298E-0957-4BF3-8F6E-594EB7ABC3FC'), false)
  assert.equal(isLegacyPlaceholderDocumentId('C983'), false)

  const rows = withoutLegacyPlaceholderDocuments([
    { id: 'INITIAL-PLACEHOLDER', siteName: 'Initial Project Placeholder' },
    { id: '81645D30-9883-491F-B782-E7997F7C89DB', siteName: 'Lancelot Place' },
    { id: '06C604FB-A426-49B2-B0E0-A2667962638E', siteName: '6 Lowndes Square' },
  ])
  assert.deepEqual(
    rows.map((row) => row.siteName),
    ['Lancelot Place', '6 Lowndes Square']
  )
})

test('creating a project or small work starts blank and needs the seven real fields', () => {
  const blank = emptyProjectCreateIdentity()
  assert.deepEqual(blank, { jobNumber: '', siteName: '' })
  assert.equal(blank.siteName.includes('Placeholder'), false)
  assert.equal(blank.jobNumber === 'INITIAL', false)

  const emptyCount = countFilledProjectCreateFields({
    ...blank,
    addressLine1: '',
    townCity: '',
    postcode: '',
    clientId: '',
    managerIds: [],
    useMapPin: false,
    latitude: '',
    longitude: '',
  })
  assert.equal(emptyCount, 0)
  assert.equal(emptyCount < PROJECT_CREATE_REQUIRED_FIELD_COUNT, true)

  const ready = countFilledProjectCreateFields({
    jobNumber: 'C646',
    siteName: 'Lancelot Place',
    addressLine1: '1 Example Street',
    townCity: 'London',
    postcode: 'SW1A 1AA',
    clientId: 'client-1',
    managerIds: ['manager-1'],
    useMapPin: false,
    latitude: '',
    longitude: '',
  })
  assert.equal(ready, PROJECT_CREATE_REQUIRED_FIELD_COUNT)
})

test('a saved project keeps the typed job number and site name', () => {
  const payload = buildProjectFirestorePayload({
    id: '81645D30-9883-491F-B782-E7997F7C89DB',
    organizationId: 'org-1',
    jobNumber: ' C646 ',
    siteName: ' Lancelot Place ',
    addressLine1: '1 Example Street',
    townCity: 'London',
    postcode: 'SW1A 1AA',
    client: { id: 'client-1', name: 'Shaftesbury', createdAt: new Date(), updatedAt: new Date() },
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-07-01T00:00:00.000Z'),
    jobType: 'CAT A',
    isLive: true,
  })
  assert.equal(payload.jobNumber, 'C646')
  assert.equal(payload.siteName, 'Lancelot Place')
  assert.equal(String(payload.siteName).toLowerCase().includes('placeholder'), false)
  assert.equal(String(payload.jobNumber).toUpperCase() === 'INITIAL', false)
  assert.equal(isLegacyPlaceholderDocumentId('81645D30-9883-491F-B782-E7997F7C89DB'), false)
})
