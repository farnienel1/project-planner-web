import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import { emptyTimesheetDraft } from './timesheetDraft.ts'
import {
  draftFromFirestoreMap,
  resolveTimesheetExportedAt,
} from './timesheetStorage.ts'
import { isTimesheetFullyApproved } from './timesheetApprovalPolicy.ts'

function stamp(iso: string) {
  const date = new Date(iso)
  return { toDate: () => date }
}

function admin(): User {
  return {
    id: 'admin',
    email: 'admin@test.com',
    firstName: 'Ada',
    surname: 'Admin',
    organizationId: 'org',
    role: 'admin',
    passwordSet: true,
    policyAccepted: true,
    permissions: {
      adminAccess: true,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: false,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User
}

test('invoiceGeneratedAt is not treated as exported — iOS only reads exportedAt', () => {
  const generated = new Date('2026-09-21T10:00:00Z')
  assert.equal(
    resolveTimesheetExportedAt({
      invoiceGeneratedAt: stamp(generated.toISOString()),
    }),
    null
  )
  const draft = draftFromFirestoreMap({
    operativeSignedAt: stamp('2026-09-21T09:00:00Z'),
    invoiceGeneratedAt: stamp(generated.toISOString()),
  })
  assert.equal(draft.exportedAt, null)
  assert.equal(isTimesheetFullyApproved(draft, admin()), true)
})

test('leftover exportedAt that matches invoiceGeneratedAt is ignored', () => {
  const generated = new Date('2026-09-21T10:00:00.000Z')
  assert.equal(
    resolveTimesheetExportedAt({
      exportedAt: stamp(generated.toISOString()),
      invoiceGeneratedAt: stamp(generated.toISOString()),
    }),
    null
  )
  const almost = new Date('2026-09-21T10:00:45.000Z')
  assert.equal(
    resolveTimesheetExportedAt({
      exportedAt: stamp(almost.toISOString()),
      invoiceGeneratedAt: stamp(generated.toISOString()),
    }),
    null
  )
})

test('list mapping can omit signature payloads', () => {
  const draft = draftFromFirestoreMap(
    {
      operativeSignedAt: stamp('2026-09-21T09:00:00Z'),
      operativeSignatureImageBase64: 'iVBORw0KGgoAAAANSUhEUg==',
    },
    { includeSignatures: false }
  )
  assert.equal(draft.operativeSignatureImageBase64, null)
  assert.ok(draft.operativeSignedAt)
})

test('manager Email and export exportedAt stays exported even if an old invoice stamp exists', () => {
  const generated = new Date('2026-09-21T10:00:00Z')
  const emailed = new Date('2026-09-21T12:00:00Z')
  const resolved = resolveTimesheetExportedAt({
    invoiceGeneratedAt: stamp(generated.toISOString()),
    exportedAt: stamp(emailed.toISOString()),
  })
  assert.ok(resolved)
  assert.equal(resolved?.toISOString(), emailed.toISOString())
})

test('true exportedAt without invoiceGeneratedAt still counts as exported', () => {
  const emailed = new Date('2026-09-21T12:00:00Z')
  const draft = draftFromFirestoreMap({
    operativeSignedAt: stamp('2026-09-21T09:00:00Z'),
    exportedAt: stamp(emailed.toISOString()),
  })
  assert.equal(draft.exportedAt?.toISOString(), emailed.toISOString())
})

test('draftFromFirestoreMap keeps signatures when export stamps are absent', () => {
  const signedAt = new Date('2026-09-21T09:00:00Z')
  const draft = draftFromFirestoreMap({
    operativeSignedAt: stamp(signedAt.toISOString()),
    operativeSignedByName: 'Ada Admin',
    managerNote: '',
  })
  assert.equal(draft.operativeSignedAt?.toISOString(), signedAt.toISOString())
  assert.equal(draft.operativeSignedByName, 'Ada Admin')
  assert.equal(draft.exportedAt, null)
  assert.deepEqual(draft.expenseEntries, emptyTimesheetDraft().expenseEntries)
})
