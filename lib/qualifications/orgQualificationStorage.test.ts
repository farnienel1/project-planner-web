import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignedQualificationTemplates, mergeQualificationTemplates, qualificationNameTaken } from './orgQualificationStorage.ts'
import type { Operative, Qualification } from '../../types/index.ts'

const sample: Qualification[] = [
  { id: 'A', name: 'CSCS', hasEndDate: false, createdAt: new Date(), updatedAt: new Date() },
]

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
