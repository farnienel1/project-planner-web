import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTimesheetDraft } from './timesheetDraft.ts'
import { mergeListedTimesheetDrafts } from './timesheetStorage.ts'

test('a later timesheet scan adds rows and does not drop ones already listed', () => {
  const signed = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: new Date('2026-10-01T09:00:00Z'),
    operativeSignedByName: 'Ada',
  }
  const current = new Map([['ada', signed]])
  const extra = new Map([
    ['ada', emptyTimesheetDraft()],
    [
      'bo',
      {
        ...emptyTimesheetDraft(),
        operativeSignedAt: new Date('2026-10-02T09:00:00Z'),
        operativeSignedByName: 'Bo',
      },
    ],
  ])
  const merged = mergeListedTimesheetDrafts(current, extra)
  assert.equal(merged.get('ada')?.operativeSignedByName, 'Ada')
  assert.equal(merged.get('bo')?.operativeSignedByName, 'Bo')
})
