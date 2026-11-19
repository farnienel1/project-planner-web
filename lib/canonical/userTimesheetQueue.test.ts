import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { timesheetSheetHasActivity, userTimesheetQueue, userTimesheetQueueCounts } from './userTimesheetQueue'
import { ADMIN_ROLE, MANAGER_ROLE, OPERATIVE_ROLE, awaiting, awaitingQueueScenario } from './userTimesheetQueue.scenario'

test('1.66.0 userTimesheetQueue: every waiting sheet, however old, once per person and pay run', () => {
  const rows = userTimesheetQueue(awaitingQueueScenario())
  const awaitingRows = rows.filter((row) => row.bucket === 'awaiting').map((row) => `${row.personId}|${row.startDayKey}|${row.documentId}`)
  assert.deepEqual(awaitingRows, [
    'op-3|2026-11-01|timesheet_op-3_1793491200',
    'op-3|2026-10-16|timesheet_op-3_1792105200',
    'OP-1|2026-07-01|timesheet_OP-1_1782860400',
    'OP-1|2026-06-16|timesheet_OP-1_1781564400',
    'OP-1|2026-05-01|timesheet_OP-1_1777590000_rev1',
    'OP-1|2026-02-01|timesheet_old-invite-1_1769904000',
    'OP-1|2026-01-01|timesheet_OP-1_1767225600',
  ])
  assert.deepEqual(
    rows.filter((row) => row.bucket === 'signed').map((row) => `${row.personId}|${row.startDayKey}`),
    ['OP-1|2026-03-01']
  )
  // The sheet filed under the alias id and stored without userId: listed under the person, its own stored id kept.
  const june = rows.find((row) => row.startDayKey === '2026-06-16')
  assert.equal(june?.bucket, 'awaiting')
  assert.equal(june?.personId, 'OP-1')
  assert.equal(june?.sheetUserId, 'OP-1')
  assert.deepEqual(userTimesheetQueueCounts(awaitingQueueScenario()), { awaiting: 7, signed: 1 })
})

test('1.66.0 userTimesheetQueue: PAYE runs, inactive people and the viewer own sheet never appear', () => {
  const rows = userTimesheetQueue(awaitingQueueScenario())
  assert.ok(!rows.some((row) => row.personId === 'paye-1'))
  assert.ok(!rows.some((row) => row.personId === 'gone'))
  assert.ok(!rows.some((row) => row.personId === 'admin'))
  assert.ok(!rows.some((row) => row.personId === 'op-3' && row.startDayKey === '2026-09-01'))
})

test('1.66.0 userTimesheetQueue: a run whose bookings are not loaded reads as not changed', () => {
  const input = awaitingQueueScenario()
  const sheets = input.sheets.map((sheet) => ({ ...sheet, bookingsChange: null }))
  const rows = userTimesheetQueue({ ...input, sheets })
  assert.deepEqual(
    rows.filter((row) => row.startDayKey === '2026-11-01').map((row) => `${row.personId}|${row.bucket}`),
    ['OP-1|signed', 'op-3|signed']
  )
})

test('1.66.0 userTimesheetQueue: a manager sees only their reports; an operative sees nothing', () => {
  const input = awaitingQueueScenario()
  const members = input.members.map((member) =>
    member.id === 'op-3' ? { ...member, role: MANAGER_ROLE, assignedManagerUserIds: ['admin'] } : { ...member, assignedManagerUserIds: member.id === 'paye-1' ? [] : ['op-3'] }
  )
  const manager = userTimesheetQueue({ ...input, members, viewer: { id: 'op-3', formerIds: [], aliasIds: [], role: MANAGER_ROLE } })
  assert.ok(manager.length > 0)
  assert.ok(manager.every((row) => row.personId === 'OP-1' || row.personId === 'op-1b'))
  assert.deepEqual(userTimesheetQueue({ ...input, viewer: { id: 'OP-1', role: OPERATIVE_ROLE } }), [])
})

test('1.66.0 userTimesheetQueue: a self-signed admin subject is never awaiting a counter-signature', () => {
  const input = awaitingQueueScenario()
  const members = [
    ...input.members,
    { id: 'admin-2', email: 'a2@example.com', isActive: true, role: ADMIN_ROLE, employmentType: 'self_employed', timesheetSelfSigned: true },
  ]
  const sheets = [{ userId: 'admin-2', startDayKey: '2026-10-16', endDayKey: '2026-10-31', data: awaiting, documentId: 'timesheet_admin-2_1792105200' }]
  const rows = userTimesheetQueue({ ...input, members, sheets })
  assert.deepEqual(rows.map((row) => row.bucket), ['signed'])
})

test('1.66.0 the shared fixture carries the awaiting-queue scenario for both apps', () => {
  const fixture = JSON.parse(readFileSync(new URL('./parity-fixture.json', import.meta.url), 'utf8'))
  const names = (fixture.cases as Array<{ function: string }>).map((entry) => entry.function)
  assert.ok(names.includes('userTimesheetQueue'))
  assert.ok(names.includes('userTimesheetQueueCounts'))
})

test('1.66.0 userTimesheetQueue: an old run with a late extra waiting is Awaiting even with no bookings loaded', () => {
  const input = awaitingQueueScenario()
  const sheets = input.sheets.map((sheet) => ({ ...sheet, bookingsChange: null }))
  const july = userTimesheetQueue({ ...input, sheets }).find((row) => row.startDayKey === '2026-07-01')
  assert.equal(july?.bucket, 'awaiting')
  // Exported: frozen, never waiting.
  const exportedSheets = sheets.map((sheet) =>
    sheet.startDayKey === '2026-07-01' ? { ...sheet, data: { ...(sheet.data ?? {}), exportedAt: Date.parse('2026-10-25T10:00:00Z') } } : sheet
  )
  assert.equal(userTimesheetQueue({ ...input, sheets: exportedSheets }).find((row) => row.startDayKey === '2026-07-01')?.bucket, 'exported')
})

test('1.66.0 timesheetSheetHasActivity: signatures, entries, late extras, a signed snapshot or a note', () => {
  assert.equal(timesheetSheetHasActivity({}), false)
  assert.equal(timesheetSheetHasActivity(null), false)
  assert.equal(timesheetSheetHasActivity({ managerNote: '   ', expenseEntries: [], lateExtras: [] }), false)
  assert.equal(timesheetSheetHasActivity({ lateExtras: [{ id: 'a' }] }), true)
  assert.equal(timesheetSheetHasActivity({ weeklyReportOverride: { lines: [] } }), true)
  assert.equal(timesheetSheetHasActivity({ managerNote: 'Check Friday' }), true)
  assert.equal(timesheetSheetHasActivity({ operativeSignedAt: Date.parse('2026-10-20T10:00:00Z') }), true)
  // No flag passed: the sheet with activity is picked over the empty copy of the same run stored first.
  const rows = userTimesheetQueue(awaitingQueueScenario())
  assert.equal(rows.find((row) => row.startDayKey === '2026-08-01')?.documentId, 'timesheet_OP-1_1785538800')
})
