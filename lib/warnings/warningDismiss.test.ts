import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  materialCutOffWarningRows,
  resolvedWarningKeys,
  warningResolutionRecords,
} from '../canonical/index.ts'
import { warningDismissDocument } from './warningDismiss.ts'

const TZ = 'Europe/London'

/** One open material cut-off row for job C646, as the Warnings page builds it (`materialCutOffWarningRows`). */
function materialRow() {
  const rows = materialCutOffWarningRows({
    scope: null,
    now: '2026-11-17T17:00:00.000Z',
    timeZone: TZ,
    cutOff: { materialOrderCutOff: true, materialCutOffHour: 16, materialCutOffMinute: 0 },
    projects: [{ id: 'Job-C646', jobNumber: 'C646', siteName: 'Site' }],
    bookings: [{ projectId: 'Job-C646', status: 'Confirmed', dateIso: '2026-11-18T00:00:00.000Z' }],
    materials: [],
    sendRecords: [],
  })
  assert.equal(rows.length, 1, 'tomorrow has a booking and no material lines')
  return rows[0]
}

test('owner bug 17 Nov: web Dismiss writes the same warningResolutions document iOS writes', () => {
  const row = materialRow()
  assert.equal(row.id, 'materials-Job-C646-2026-11-18')
  const write = warningDismissDocument({ resolutionKey: row.id, dismissedByUserId: 'user-1' })
  assert.ok(write)
  assert.equal(write.documentId, 'materials-Job-C646-2026-11-18', 'document id is the resolution key, stored case kept')
  assert.deepEqual(write.fields, {
    resolutionKey: 'materials-Job-C646-2026-11-18',
    status: 'dismissed',
    resolvedByUserId: 'user-1',
    updatedBy: 'user-1',
    updatedFrom: 'web',
  })
  // Only the keys the warningResolutions rule allows (resolvedAt / updatedAt are added as server times).
  const allowed = ['resolutionKey', 'status', 'resolvedByUserId', 'resolvedAt', 'updatedBy', 'updatedFrom', 'updatedAt']
  for (const key of Object.keys(write.fields)) assert.ok(allowed.includes(key), `${key} is allowed by the rules`)
})

test('owner bug 17 Nov: the dismissal hides the row and drops the count once read back', async () => {
  const { activeOrgWarnings } = await import('./generateOrgWarnings.ts')
  const row = materialRow()
  const write = warningDismissDocument({ resolutionKey: row.id, dismissedByUserId: 'user-1' })
  assert.ok(write)
  const resolvedKeys = resolvedWarningKeys(warningResolutionRecords([{ id: write.documentId, data: write.fields }], TZ))
  const base = {
    clashWarnings: [],
    managerClashWarnings: [],
    unbookedWarnings: [],
    leaveWarnings: [],
    materialWarnings: [{ id: row.id }],
    qualificationWarnings: [],
    unverifiedWarnings: [],
    coreCount: 1,
    highCount: 0,
    mediumCount: 0,
    lowCount: 1,
  }
  const decisions = { acceptedClashes: [], dismissedQualificationKeys: new Set<string>() }
  const before = activeOrgWarnings(base as never, { ...decisions, resolvedKeys: [] })
  assert.equal(before.coreCount, 1)
  const after = activeOrgWarnings(base as never, { ...decisions, resolvedKeys })
  assert.equal(after.materialWarnings.length, 0, 'the dismissed card is gone after a refresh')
  assert.equal(after.coreCount, 0, 'the Warnings count and Home badge drop')
  assert.equal(after.lowCount, 0)
})

test('an iOS dismissal of the same row (other letter case) also hides it on web', async () => {
  const { activeOrgWarnings } = await import('./generateOrgWarnings.ts')
  const row = materialRow()
  const iosKey = row.id.toUpperCase()
  const resolvedKeys = resolvedWarningKeys(
    warningResolutionRecords([{ id: iosKey, data: { resolutionKey: iosKey, status: 'dismissed', resolvedByUserId: 'u' } }], TZ)
  )
  const after = activeOrgWarnings(
    { clashWarnings: [], managerClashWarnings: [], unbookedWarnings: [], leaveWarnings: [], materialWarnings: [{ id: row.id }], qualificationWarnings: [], unverifiedWarnings: [] } as never,
    { resolvedKeys, acceptedClashes: [], dismissedQualificationKeys: new Set() }
  )
  assert.equal(after.materialWarnings.length, 0)
})

test('warningDismissDocument writes nothing without a key or a user', () => {
  assert.equal(warningDismissDocument({ resolutionKey: '', dismissedByUserId: 'u' }), null)
  const someKey = ['materials', 'job1', '2026-11-18'].join('-')
  assert.equal(warningDismissDocument({ resolutionKey: someKey, dismissedByUserId: '' }), null)
})
