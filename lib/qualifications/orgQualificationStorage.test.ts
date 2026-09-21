import { test } from 'node:test'
import assert from 'node:assert/strict'
import { qualificationNameTaken } from './orgQualificationStorage.ts'
import type { Qualification } from '../../types/index.ts'

const sample: Qualification[] = [
  { id: 'A', name: 'CSCS', hasEndDate: false, createdAt: new Date(), updatedAt: new Date() },
]

test('qualificationNameTaken is case-insensitive and ignores the row being edited', () => {
  assert.equal(qualificationNameTaken('cscs', sample), true)
  assert.equal(qualificationNameTaken('First aid', sample), false)
  assert.equal(qualificationNameTaken('CSCS', sample, 'A'), false)
})
