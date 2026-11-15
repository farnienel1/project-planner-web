import { test } from 'node:test'
import assert from 'node:assert/strict'
import { variationEditWriteFields, variationFromFirestore, variationLogEntry, variationToFirestore } from './variationCodec.ts'
import { variationWriteFields } from '../canonical/index.ts'

const STORED = {
  id: 'V1',
  orgId: 'O',
  parentId: 'J1',
  parentType: 'project',
  parentName: 'J1 · Site',
  origin: 'app',
  voNumber: 'VO-003',
  sequence: 3,
  voNumberLocked: false,
  numberHistory: [],
  heading: 'Extra sockets',
  description: 'Four more',
  status: 'open',
  labour: [{ id: 'L1', trade: 'Electrician', hours: 8 }],
  materials: [{ id: 'M1', name: 'Socket', quantity: '4' }],
  evidence: [],
  totalLabourHours: 8,
  materialLineCount: 1,
  evidenceCount: 0,
  createdByUid: 'u1',
  createdByName: 'Sam',
  createdAt: new Date('2026-11-10T10:00:00Z'),
  updatedAt: new Date('2026-11-10T10:00:00Z'),
  statusHistory: [{ status: 'open', byUid: 'u1', byName: 'Sam', at: new Date('2026-11-10T10:00:00Z') }],
  isDeleted: false,
}

/** Apply a partial write to a stored map (what Firestore does with the update). */
function apply(stored: Record<string, unknown>, write: { set: Record<string, unknown>; remove: string[] }) {
  const out = { ...stored, ...write.set }
  for (const key of write.remove) delete out[key]
  return out
}

test('review HIGH 2: a renumber while the edit sheet is open is not undone by the save', () => {
  const opened = variationFromFirestore('V1', STORED)
  // The tracker renumbers VO-003 → VO-001 on the server after the sheet opened.
  const server = { ...variationToFirestore(opened), voNumber: 'VO-001', sequence: 1, numberHistory: [{ from: 'VO-003', to: 'VO-001', at: new Date(), byUid: 'u2' }] }
  // The user changes only the heading on the stale copy.
  const edited = { ...opened, heading: 'Extra sockets and spurs' }
  const write = variationEditWriteFields(opened, edited)
  assert.deepEqual(Object.keys(write.set), ['heading'])
  const after = apply(server, write)
  assert.equal(after.voNumber, 'VO-001')
  assert.equal(after.sequence, 1)
  assert.equal((after.numberHistory as unknown[]).length, 1)
  assert.equal(after.heading, 'Extra sockets and spurs')
  // Before the fix (diffed against the server copy) the stale number was written back.
  const old = variationWriteFields(server, (({ updatedAt: _u, ...rest }) => rest)(variationToFirestore(edited)))
  assert.equal(old.set.voNumber, 'VO-003')
})

test('review HIGH 2: a second save before the background evidence link finishes keeps the evidence and the status', () => {
  const opened = variationFromFirestore('V1', STORED)
  const linkedEvidence = [{ id: 'E1', fileName: 'a.jpg', storagePath: 'organizations/O/healthSafety/J1/variations/u1_1.jpg', downloadURL: 'https://x', contentType: 'image/jpeg', sizeBytes: 10 }]
  const server = { ...variationToFirestore(opened), evidence: linkedEvidence, evidenceCount: 1, status: 'submitted', voNumberLocked: true }
  const edited = { ...opened, materials: [...opened.materials, { id: 'M2', name: 'Back box', quantity: '4', quantityValue: 4, unit: 'no' }] }
  const write = variationEditWriteFields(opened, edited)
  assert.equal('evidence' in write.set, false)
  assert.equal('evidenceCount' in write.set, false)
  assert.equal('status' in write.set, false)
  const after = apply(server, write)
  assert.equal((after.evidence as unknown[]).length, 1)
  assert.equal(after.status, 'submitted')
  assert.equal((after.materials as unknown[]).length, 2)
  // The settings-log entry carries only the changed fields too.
  const entry = variationLogEntry(opened, edited)
  assert.deepEqual(Object.keys(entry).sort(), ['id', 'materialLineCount', 'materials'])
})

test('an untouched legacy line is written back exactly as stored', () => {
  const opened = variationFromFirestore('V1', STORED)
  const map = variationToFirestore(opened)
  assert.deepEqual(map.labour, [{ id: 'L1', trade: 'Electrician', hours: 8 }])
  assert.deepEqual(map.materials, [{ id: 'M1', name: 'Socket', quantity: '4' }])
  assert.deepEqual(variationEditWriteFields(opened, { ...opened }).set, {})
})
