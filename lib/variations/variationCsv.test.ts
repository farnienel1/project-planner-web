import { test } from 'node:test'
import assert from 'node:assert/strict'
import { variationsToCsv } from './variationCsv.ts'
import type { Variation } from './variationModel.ts'

function row(): Variation {
  return {
    id: 'var-1',
    orgId: 'org',
    parentType: 'project',
    parentId: 'p1',
    parentName: 'C1042 · 12 High Street',
    origin: 'app',
    voNumber: 'VO-004',
    sequence: 4,
    voNumberLocked: false,
    numberHistory: [],
    heading: 'Extra containment',
    description: 'Plant room',
    status: 'open',
    labour: [{ id: 'l1', trade: 'Electrician', hours: 4 }],
    materials: [{ id: 'm1', name: 'Tray', quantity: '9m' }],
    evidence: [],
    totalLabourHours: 4,
    materialLineCount: 1,
    evidenceCount: 0,
    createdByUid: 'u1',
    createdByName: 'Ada',
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    updatedByUid: 'u1',
    updatedAt: new Date('2026-09-01T09:00:00.000Z'),
    statusHistory: [],
    isDeleted: false,
  }
}

test('csv has one row per labour line and per material line', () => {
  const csv = variationsToCsv([row()])
  const lines = csv.split('\n')
  assert.equal(lines.length, 3)
  assert.match(lines[0], /^parentName,voNumber,heading,status,lineType/)
  assert.match(lines[1], /labour,Electrician,4,,Ada/)
  assert.match(lines[2], /material,Tray,,9m,Ada/)
  assert.match(lines[1], /C1042 · 12 High Street/)
})
