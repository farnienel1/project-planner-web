import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assignedQualificationTemplates,
  mergeQualificationTemplates,
  qualificationEditCanSave,
  qualificationNameTaken,
  qualificationTemplateFirestoreFields,
} from './orgQualificationStorage.ts'
import type { Operative, Qualification } from '../../types/index.ts'

const sample: Qualification[] = [
  { id: 'A', name: 'CSCS', hasEndDate: false, createdAt: new Date(), updatedAt: new Date() },
]

test('a qualification template write includes the fields iOS requires', () => {
  const createdAt = new Date('2026-03-01T00:00:00.000Z')
  const fields = qualificationTemplateFirestoreFields({
    name: ' CSCS ',
    hasEndDate: true,
    createdAt,
    updatedAt: createdAt,
  })
  assert.equal(fields.name, 'CSCS')
  assert.equal(fields.hasEndDate, true)
  assert.ok(fields.createdAt)
  assert.ok(fields.updatedAt)
  assert.equal('endDate' in fields, false)
})

test('a library template write keeps iOS fields and adds the starter metadata', () => {
  const createdAt = new Date('2026-03-01T00:00:00.000Z')
  const fields = qualificationTemplateFirestoreFields({
    name: 'CCN1 Core Domestic Gas Safety (includes CPA1)',
    hasEndDate: false,
    createdAt,
    updatedAt: createdAt,
    code: 'GAS-CCN1',
    section: 'Gas',
    subsection: 'ACS Domestic Natural Gas',
    awardingBody: 'ACS',
    renewYears: 5,
    renewalType: 'Required',
    status: 'Current',
    notes: 'Requires CCN1',
  })
  assert.equal(fields.hasEndDate, false)
  assert.equal(fields.code, 'GAS-CCN1')
  assert.equal(fields.section, 'Gas')
  assert.equal(fields.renewYears, 5)
  assert.ok(fields.createdAt)
  assert.ok(fields.updatedAt)
})

test('editing a qualification cannot save until the name actually changes', () => {
  assert.equal(qualificationEditCanSave('NVQ Level 7', 'NVQ Level 7'), false)
  assert.equal(qualificationEditCanSave('  NVQ Level 7  ', 'NVQ Level 7'), false)
  assert.equal(qualificationEditCanSave('nvq level 7', 'NVQ Level 7'), true)
  assert.equal(qualificationEditCanSave('SMSTS', 'NVQ Level 7'), true)
  assert.equal(qualificationEditCanSave('SMSTS', 'NVQ Level 7', true), false)
  assert.equal(qualificationEditCanSave('   ', 'NVQ Level 7'), false)
})

test('qualificationNameTaken is case-insensitive and ignores the row being edited', () => {
  assert.equal(qualificationNameTaken('cscs', sample), true)
  assert.equal(qualificationNameTaken('First aid', sample), false)
  assert.equal(qualificationNameTaken('CSCS', sample, 'A'), false)
})

test('assignedQualificationTemplates recovers unique names still on staff profiles', () => {
  const operatives = [
    {
      qualifications: [
        { id: 'q1', name: 'CSCS', hasEndDate: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 'q2', name: 'First aid', hasEndDate: true, createdAt: new Date(), updatedAt: new Date() },
      ],
    },
    {
      qualifications: [{ id: 'q3', name: 'cscs', hasEndDate: false, createdAt: new Date(), updatedAt: new Date() }],
    },
  ] as Operative[]
  const recovered = assignedQualificationTemplates(operatives)
  assert.deepEqual(
    recovered.map((row) => row.name).sort(),
    ['CSCS', 'First aid']
  )
})

test('mergeQualificationTemplates keeps org templates and adds missing assigned names', () => {
  const merged = mergeQualificationTemplates(sample, [
    { id: 'B', name: 'First aid', hasEndDate: false, createdAt: new Date(), updatedAt: new Date() },
  ] satisfies Qualification[])
  assert.deepEqual(
    merged.map((row) => row.name).sort(),
    ['CSCS', 'First aid']
  )
})
