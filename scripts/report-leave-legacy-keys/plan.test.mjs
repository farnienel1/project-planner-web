import assert from 'node:assert/strict'
import test from 'node:test'
import { REPORT_COLUMNS, reportCsv, reportLines, reportRows } from './plan.mjs'

const finding = {
  leaveId: 'L1',
  personId: 'UID-OP',
  personEmail: 'op@x.com',
  storedUserId: null,
  storedOperativeId: 'op-row',
  readerUserId: 'UID-OP',
  readerOperativeId: 'op-row',
  reason: 'legacyKey',
  fix: 'Set userId to "UID-OP" on organizations/{orgId}/holidayBookings/L1 (keep every other field).',
}

test('1.56.0 leave legacy-key report: rows name the organisation in the fix and keep every column', () => {
  const rows = reportRows('ORG', [finding])
  assert.equal(rows[0].fix, 'Set userId to "UID-OP" on organizations/ORG/holidayBookings/L1 (keep every other field).')
  assert.equal(rows[0].storedUserId, '')
  assert.deepEqual(Object.keys(rows[0]), REPORT_COLUMNS)
  const csv = reportCsv(rows)
  assert.equal(csv.split('\n')[0], REPORT_COLUMNS.join(','))
  assert.match(csv, /"Set userId to ""UID-OP"" on organizations\/ORG\/holidayBookings\/L1 \(keep every other field\)\."/)
})

test('1.56.0 leave legacy-key report: no findings → no lines', () => {
  assert.deepEqual(reportLines('ORG', []), [])
  assert.equal(reportLines('ORG', reportRows('ORG', [finding])).length, 3)
})
