import assert from 'node:assert/strict'
import test from 'node:test'
import { REPORT_COLUMNS, csvCell, reportCsv, reportLines, reportRows } from './plan.mjs'

const finding = {
  leaveId: 'L1',
  personId: 'UID-OP',
  personEmail: 'op@x.com',
  storedUserId: null,
  storedOperativeId: 'op-row',
  readerUserId: 'UID-OP',
  readerOperativeId: 'op-row',
  reason: 'legacyKey',
  otherPersonIds: [],
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

test('1.56.0 leave legacy-key report: formula-looking cells are neutralised', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell('+44'), "'+44")
  assert.equal(csvCell('-1'), "'-1")
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(csvCell('UID-1'), 'UID-1')
  const rows = reportRows('ORG', [{ ...finding, storedUserId: '=cmd()' }])
  assert.match(reportCsv(rows), /,'=cmd\(\),/)
})

test('1.56.0 leave legacy-key report: a conflict names every claimant on one line', () => {
  const rows = reportRows('ORG', [{ ...finding, reason: 'conflict', otherPersonIds: ['UID-2', 'UID-3'] }])
  assert.equal(rows[0].otherPersonIds, 'UID-2;UID-3')
  assert.match(reportLines('ORG', rows)[1], /also UID-2, UID-3.*decide whose it is/)
})
