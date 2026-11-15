import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timesheetClaimRows } from '../canonical/index.ts'
import { timesheetClaimSheetsFromDocs } from './timesheetClaimSheets.ts'

const EVIDENCE = [{ path: 'organizations/org1/payeClaims/NEWUID/NEWUID_1700000000000.jpg', name: 'receipt.jpg', kind: 'photo' }]

function sheet(userId: string, id: string) {
  return {
    id,
    data: {
      userId,
      expenseEntries: [{ id: `E-${userId}`, title: 'Parking', amount: 12, date: '2026-11-10T10:00:00.000Z', evidence: EVIDENCE }],
    },
  }
}

test('1.45.0 Users\' rows read every id of the person; evidence on a sheet filed under a former id shows', () => {
  const docs = [
    sheet('NEWUID', 'timesheet_NEWUID_1762732800'),
    sheet('OLD-ID', 'timesheet_OLD-ID_1761523200'),
    // The same sheet returned by two reads is listed once; a non-timesheet document is skipped.
    sheet('OLD-ID', 'timesheet_OLD-ID_1761523200'),
    { id: 'variations_J1', data: { userId: 'OLD-ID' } },
  ]
  const sheets = timesheetClaimSheetsFromDocs(docs, ['NEWUID', 'OLD-ID'], 'Europe/London')
  assert.deepEqual(sheets.map((row) => row.id), ['timesheet_NEWUID_1762732800', 'timesheet_OLD-ID_1761523200'])
  for (const row of sheets) assert.equal(row.entries.expenseEntries[0]?.evidence.length, 1)
  const rows = timesheetClaimRows(sheets, 'expense', { start: '2026-11-01', end: '2026-11-30' })
  assert.equal(rows.length, 2)
  assert.ok(rows.every((row) => row.evidence[0]?.path === EVIDENCE[0].path))
  // Given only the old id (the pre-fix behaviour), the file uploaded under the current id is dropped.
  const narrow = timesheetClaimSheetsFromDocs([sheet('OLD-ID', 'timesheet_OLD-ID_1761523200')], ['OLD-ID'], 'Europe/London')
  assert.equal(narrow[0]?.entries.expenseEntries[0]?.evidence.length, 0)
})
