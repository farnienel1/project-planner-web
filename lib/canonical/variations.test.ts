import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VARIATION_RENUMBER_STALE_MESSAGE,
  canRenumberVariations,
  canSeeVariationCosts,
  parseVariationDocument,
  parseVariationMaterialQuantity,
  variationCustomLineError,
  variationDateText,
  variationEvidenceAddWriteFields,
  variationExportFileName,
  variationExportRows,
  variationIsPinned,
  variationLabourCrew,
  variationLabourLineFields,
  variationListTotals,
  variationMaterialLineFields,
  variationMaterialQuantity,
  variationMaterialQuantityError,
  variationRenumberConflict,
  variationRenumberPlan,
  variationSubcontractorLineError,
  variationTotals,
  variationWriteFields,
} from './index'

test('labour keeps the crew: 2 × 4h is stored with hours 8 and read back as 2 × 4', () => {
  const row = variationLabourLineFields({ id: 'l1', trade: 'Electrician', operatives: 2, hoursEach: 4 })
  assert.deepEqual(row, { id: 'l1', trade: 'Electrician', hours: 8, operatives: 2, hoursEach: 4 })
  assert.deepEqual(variationLabourCrew(row), { hours: 8, operatives: 2, hoursEach: 4 })
  // An older build kept only hours, or changed hours without the crew: one operative × hours.
  assert.deepEqual(variationLabourCrew({ hours: 8 }), { hours: 8, operatives: 1, hoursEach: 8 })
  assert.deepEqual(variationLabourCrew({ hours: 10, operatives: 2, hoursEach: 4 }), { hours: 10, operatives: 1, hoursEach: 10 })
})

test('material quantity is a number with a unit; legacy text still reads', () => {
  const row = variationMaterialLineFields({ id: 'm1', name: 'Flex', quantity: '100', unit: 'm' })
  assert.deepEqual(row, { id: 'm1', name: 'Flex', quantity: '100m', quantityValue: 100, unit: 'm' })
  assert.deepEqual(variationMaterialQuantity(row), { quantity: '100m', quantityValue: 100, unit: 'm' })
  // Older builds: text only.
  assert.deepEqual(variationMaterialQuantity({ quantity: '100m' }), { quantity: '100m', quantityValue: 100, unit: 'm' })
  assert.deepEqual(variationMaterialQuantity({ quantity: '2,5 kg' }), { quantity: '2,5 kg', quantityValue: 2.5, unit: 'kg' })
  assert.deepEqual(variationMaterialQuantity({ quantity: 4 }), { quantity: '4', quantityValue: 4, unit: 'no' })
  // Not a quantity: kept as stored, no number.
  assert.deepEqual(variationMaterialQuantity({ quantity: '1-' }), { quantity: '1-', quantityValue: null, unit: '' })
  // An older build rewrote the text: the text wins over a stale number.
  assert.deepEqual(variationMaterialQuantity({ quantity: '50m', quantityValue: 100, unit: 'm' }), { quantity: '50m', quantityValue: 50, unit: 'm' })
  assert.equal(parseVariationMaterialQuantity('abc'), null)
  assert.equal(variationMaterialQuantityError('1-'), 'Enter the quantity as a number above 0.')
  assert.equal(variationMaterialQuantityError('0'), 'Enter the quantity as a number above 0.')
  assert.equal(variationMaterialQuantityError('2.5'), null)
})

const stored = {
  voNumber: 'VO-002',
  heading: 'Extra sockets',
  description: 'Client asked for four more',
  status: 'open',
  createdByName: 'Sam Smith',
  createdAt: Date.UTC(2026, 10, 14, 23, 30),
  labour: [{ id: 'l1', trade: 'Electrician', hours: 8, operatives: 2, hoursEach: 4 }],
  materials: [{ id: 'm1', name: 'Socket', quantity: '4' }, { name: 'Odd', quantity: '1-' }],
  customLines: [{ id: 'c1', name: 'Skip hire', description: '6 yard', quantity: 2, cost: 150.5 }],
  subcontractorLines: [{ name: 'Acme Scaffolding', quoteNumber: 'Q-77', quantity: 1, cost: 1200 }],
  evidence: [{ id: 'e1', storagePath: 'organizations/o/healthSafety/p/variations/u_1.jpg', downloadURL: 'https://x' }, { id: 'e2', fileName: 'gone' }],
  numberHistory: [{ from: 'VO-005', to: 'VO-002' }],
}

test('reader: new line lists, crew and quantity; derived ids are stable', () => {
  const doc = parseVariationDocument('v1', stored)!
  assert.equal(doc.customLines.length, 1)
  assert.equal(doc.customLines[0].lineTotal, 301)
  assert.equal(doc.subcontractorLines[0].quoteNumber, 'Q-77')
  assert.equal(doc.subcontractorLines[0].idStored, false)
  assert.equal(doc.subcontractorLines[0].id, parseVariationDocument('v1', stored)!.subcontractorLines[0].id)
  assert.equal(doc.labour[0].operatives, 2)
  assert.equal(doc.materials[1].quantityValue, null)
  assert.equal(doc.materials[1].quantity, '1-')
  // A document from an older build has no new lists.
  const old = parseVariationDocument('v2', { voNumber: 'VO-001', labour: [{ trade: 'X', hours: 3 }] })!
  assert.deepEqual(old.customLines, [])
  assert.deepEqual(old.subcontractorLines, [])
})

test('totals: hours, counts, costs and the reader evidence count', () => {
  const t = variationTotals(parseVariationDocument('v1', stored)!)
  assert.deepEqual(t, {
    labourHours: 8,
    materialsCount: 2,
    customCount: 1,
    subcontractorCount: 1,
    customTotal: 301,
    subcontractorTotal: 1200,
    costTotal: 1501,
    evidenceCount: 1,
  })
  const list = variationListTotals([parseVariationDocument('v1', stored)!, { ...parseVariationDocument('v3', stored)!, isDeleted: true }])
  assert.equal(list.count, 1)
  assert.equal(list.costTotal, 1501)
})

test('a partial update leaves the new lists alone unless they changed, and writes them whole', () => {
  const next = { ...stored, heading: 'New heading' }
  const write = variationWriteFields(stored, next)
  assert.deepEqual(Object.keys(write.set), ['heading'])
  // An older build that does not know the new lists never removes them.
  const older = { voNumber: 'VO-002', heading: 'Older' }
  assert.equal('customLines' in variationWriteFields(stored, older).set, false)
  assert.deepEqual(variationWriteFields(stored, older).remove, [])
  const added = variationWriteFields(stored, { ...stored, customLines: [...stored.customLines, { id: 'c2', name: 'Paint', quantity: 1, cost: 20 }] })
  assert.deepEqual(Object.keys(added.set), ['customLines'])
})

test('custom and subcontractor line checks', () => {
  assert.equal(variationCustomLineError({ name: '', quantity: 1, cost: 1 }), 'Add a name for this line.')
  assert.equal(variationCustomLineError({ name: 'Skip', quantity: 1, cost: -1 }), 'Enter the cost as a number of 0 or more.')
  assert.equal(variationCustomLineError({ name: 'Skip', quantity: 2, cost: '150.5' }), null)
  assert.equal(variationSubcontractorLineError({ name: '', quantity: 1, cost: 1 }), 'Pick a subcontractor or type its name.')
})

test('costs are for admins and managers only', () => {
  assert.equal(canSeeVariationCosts({ isAdmin: true, isSuperAdmin: false, isManager: false, isOperativeMode: false }), true)
  assert.equal(canSeeVariationCosts({ isAdmin: false, isSuperAdmin: false, isManager: true, isOperativeMode: false }), true)
  assert.equal(canSeeVariationCosts({ isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: true }), false)
})

test('export rows: every variation (no lines too), organisation-zone dates, numbers with units apart', () => {
  const empty = { voNumber: 'VO-001', heading: 'Nothing yet', status: 'submitted', createdAt: Date.UTC(2026, 10, 1, 12) }
  const removed = { voNumber: 'VO-003', heading: 'Gone', isDeleted: true }
  const rows = variationExportRows(
    [parseVariationDocument('v1', stored)!, parseVariationDocument('v0', empty)!, parseVariationDocument('vx', removed)!].map((doc) => ({ ...doc })),
    { timeZone: 'Europe/London', currency: 'GBP' }
  )
  assert.deepEqual(rows.summaryRows.map((row) => row.voNumber), ['VO-001', 'VO-002'])
  assert.equal(rows.summaryRows[0].status, 'Submitted')
  assert.equal(rows.summaryRows[0].labourHours, 0)
  assert.equal(rows.summaryRows[1].raisedOn, '14 Nov 2026')
  assert.equal(rows.summaryRows[1].previousNumbers, 'VO-005')
  assert.equal(rows.summaryRows[1].totalCost, 1501)
  assert.equal(rows.summaryTotals.totalCost, 1501)
  assert.equal(rows.summaryTotals.count, 2)
  const material = rows.lineRows.find((row) => row.type === 'Material' && row.description === 'Socket')!
  assert.equal(material.quantity, 4)
  assert.equal(material.unit, 'no')
  assert.equal(rows.lineRows.find((row) => row.description === 'Odd')!.quantity, '1-')
  const labour = rows.lineRows.find((row) => row.type === 'Labour')!
  assert.deepEqual([labour.quantity, labour.hours], [2, 8])
  const sub = rows.lineRows.find((row) => row.type === 'Subcontractor')!
  assert.deepEqual([sub.quoteNumber, sub.subcontractor, sub.lineTotal], ['Q-77', 'Acme Scaffolding', 1200])
  // Organisation zone: 23:30 UTC on 14 Nov is 15 Nov in Auckland.
  assert.equal(variationDateText(Date.UTC(2026, 10, 14, 23, 30), 'Pacific/Auckland'), '15 Nov 2026')
  const hidden = variationExportRows([parseVariationDocument('v1', stored)!], { includeCost: false })
  assert.equal(hidden.summaryRows[0].totalCost, null)
  assert.equal(hidden.lineRows.find((row) => row.type === 'Custom')!.lineTotal, null)
  assert.equal(variationExportFileName('J 1042/A'), 'J-1042-A-variations.xlsx')
})

test('evidence add keeps stored files, skips duplicates and the 11th file', () => {
  const storedDoc = { evidence: [{ id: 'a', storagePath: 'p/a.jpg', downloadURL: 'u' }] }
  const write = variationEvidenceAddWriteFields(storedDoc, [
    { id: 'b', storagePath: 'p/b.jpg', downloadURL: 'u2' },
    { id: 'a2', storagePath: 'p/a.jpg', downloadURL: 'u' },
  ])!
  assert.equal(write.set.evidenceCount, 2)
  assert.deepEqual(write.added, ['p/b.jpg'])
  assert.deepEqual(write.skipped, ['p/a.jpg'])
  const full = { evidence: Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, storagePath: `p/${i}` })) }
  assert.equal(variationEvidenceAddWriteFields(full, [{ id: 'y', storagePath: 'p/y' }]), null)
  assert.equal(variationEvidenceAddWriteFields(storedDoc, []), null)
})

test('renumber plan: pinned keep their numbers, open share their own numbers, deleted numbers never reused', () => {
  const rows = [
    { id: 'a', voNumber: 'VO-001', status: 'open', sequence: 1 },
    { id: 'b', voNumber: 'VO-002', status: 'submitted', sequence: 2, voNumberLocked: true },
    { id: 'c', voNumber: 'VO-003', status: 'open', sequence: 3 },
    { id: 'd', voNumber: 'VO-004', status: 'open', isDeleted: true, sequence: 4 },
    { id: 'e', voNumber: 'VO-005', status: 'open', sequence: 5 },
  ]
  const plan = variationRenumberPlan({ rows, order: ['e', 'b', 'a', 'c'] })
  assert.deepEqual(
    plan.rows.map((row) => [row.id, row.to, row.pinned, row.sequence]),
    [
      ['e', 'VO-001', false, 1],
      ['b', 'VO-002', true, 2],
      ['a', 'VO-003', false, 3],
      ['c', 'VO-005', false, 4],
    ]
  )
  assert.equal(plan.rows.some((row) => row.to === 'VO-004'), false)
  // Two open rows sharing a number (older web numbering): the duplicate gets a new number above everything issued.
  const dup = variationRenumberPlan({
    rows: [
      { id: 'a', voNumber: 'VO-001', status: 'open' },
      { id: 'b', voNumber: 'VO-001', status: 'open' },
      { id: 'z', voNumber: 'VO-002', status: 'closed', numberHistory: [{ from: 'VO-009', to: 'VO-002' }] },
    ],
    order: ['a', 'b', 'z'],
  })
  assert.deepEqual(dup.rows.map((row) => row.to), ['VO-001', 'VO-010', 'VO-002'])
  // An open row holding the same number as a deleted one never keeps it.
  const clash = variationRenumberPlan({ rows: [{ id: 'a', voNumber: 'VO-003', status: 'open' }, { id: 'x', voNumber: 'VO-003', isDeleted: true }], order: ['a'] })
  assert.equal(clash.rows[0].to, 'VO-004')
  assert.equal(variationIsPinned({ status: 'closed' }), true)
  assert.equal(variationIsPinned({ status: 'open' }), false)
})

test('renumber conflict and who renumbers', () => {
  const base = [{ id: 'a', voNumber: 'VO-001', status: 'open', sequence: 1 }]
  assert.equal(variationRenumberConflict(base, [{ ...base[0] }]), false)
  assert.equal(variationRenumberConflict(base, [{ ...base[0], status: 'submitted' }]), true)
  assert.equal(variationRenumberConflict(base, [...base, { id: 'b', voNumber: 'VO-002' }]), true)
  assert.equal(VARIATION_RENUMBER_STALE_MESSAGE, 'Someone else changed the variations — reload')
  const manager = { isAdmin: false, isSuperAdmin: false, isManager: true, isOperativeMode: false }
  assert.equal(canRenumberVariations(manager, { managesJob: true }), true)
  assert.equal(canRenumberVariations(manager, { managesJob: false }), false)
  assert.equal(canRenumberVariations({ isAdmin: true, isSuperAdmin: false, isManager: false, isOperativeMode: false }), true)
  assert.equal(canRenumberVariations({ isAdmin: true, isSuperAdmin: false, isManager: false, isOperativeMode: true }), false)
})
