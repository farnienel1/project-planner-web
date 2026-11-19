import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadRulebook } from '../data-cleanup/checks.mjs'
import { RULEBOOK_FUNCTIONS, formatReport, timesheetHistoryReport } from './plan.mjs'

const rulebook = loadRulebook()
const ts = (iso) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })
const users = [
  { id: 'admin1', data: { email: 'a@x.com', firstName: 'Ann', surname: 'Admin', isSuperAdmin: true, adminAccess: true, role: 'admin' } },
  {
    id: 'op1',
    data: { email: 'o@x.com', firstName: 'Op', surname: 'One', role: 'operative', operativeMode: true, formerUserIds: ['OLDINVITE'], assignedManagerUserIds: ['admin1'] },
  },
]
const signed = {
  operativeSignedAt: ts('2026-10-10T10:00:00Z'),
  operativeSignedByName: 'Op',
  managerSignedAt: ts('2026-10-11T10:00:00Z'),
  managerSignedByName: 'Ann',
}
const sheet = (id, extra) => ({ id, data: { weekStart: ts('2026-10-01T00:00:00Z'), ...signed, ...extra } })

test('every rulebook function the report calls is in the packed script', () => {
  assert.deepEqual(RULEBOOK_FUNCTIONS.filter((name) => typeof rulebook[name] !== 'function'), [])
})

test('counts stored sheets, markers, and what each app lists, with reasons', () => {
  const settings = [
    sheet('timesheet_op1_1', { userId: 'op1', exportedAt: ts('2026-10-20T10:00:00Z') }),
    sheet('timesheet_OLDINVITE_2', { userId: 'OLDINVITE', weekStart: ts('2026-10-15T00:00:00Z'), exportedAt: ts('2026-10-20T10:00:00Z') }),
    sheet('timesheet_op1_3', { weekStart: ts('2026-10-21T00:00:00Z'), exportedAt: ts('2026-10-25T10:00:00Z') }),
    sheet('timesheet_gone_4', { userId: 'gone', weekStart: ts('2026-10-21T00:00:00Z'), exportedAt: ts('2026-10-25T10:00:00Z') }),
    sheet('timesheet_op1_5', { userId: 'op1', weekStart: ts('2026-11-01T00:00:00Z') }),
    sheet('timesheet_op1_6', {
      userId: 'op1',
      weekStart: ts('2026-11-16T00:00:00Z'),
      exportedAt: ts('2026-11-17T10:00:00Z'),
      invoiceGeneratedAt: ts('2026-11-17T10:00:20Z'),
    }),
    { id: 'jobTypes', data: { jobTypes: [] } },
  ]
  const report = timesheetHistoryReport(rulebook, { settings, users, viewerId: 'admin1' })
  assert.equal(report.totals.timesheetDocs, 6)
  assert.equal(report.totals.noUserId, 1)
  assert.equal(report.totals.marker_exportedAt_present, 5)
  assert.equal(report.totals.marker_exportedAt_real, 4)
  assert.equal(report.totals.marker_exportedAt_ignoredAsInvoiceLeftover, 1)
  assert.equal(report.totals.signedOffNotExported, 2)
  // Web (admin): the former-id sheet and the no-userId sheet reach the person; the deleted person's is "Unknown person".
  assert.equal(report.web.listedRows, 4)
  assert.equal(report.web.listedAsUnknownPerson, 1)
  // iPhone asks `userId ==` the person's own id: the former-id sheet and the deleted person's sheet drop.
  assert.equal(report.ios.listedRows, 2)
  assert.equal(report.ios.dropped['filed under a former or second id of the person'], 1)
  assert.equal(report.ios.dropped['person deleted / not in the roster'], 1)
  assert.match(formatReport('org1', 'Test', report), /Web Exported list would show: 4 row/)
})

test('a revision and its original are one row on the list', () => {
  const settings = [
    sheet('timesheet_op1_1', { userId: 'op1', exportedAt: ts('2026-10-20T10:00:00Z') }),
    sheet('timesheet_op1_1_rev1', { userId: 'op1', exportedAt: ts('2026-10-22T10:00:00Z') }),
  ]
  const report = timesheetHistoryReport(rulebook, { settings, users, viewerId: 'admin1' })
  assert.equal(report.totals.revisions, 1)
  assert.equal(report.web.listed, 2)
  assert.equal(report.web.listedRows, 1)
})
