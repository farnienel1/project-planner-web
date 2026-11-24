'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const canonical = require('./loadCanonical')
const { createTimesheetSignOffReminders } = require('./timesheetSignOffReminder')

// Rulebook 1.78.0 §8 / §13: the scheduled sign-off reminder writer (reads and writes only; the rule is the rulebook's).

const ORG = 'org-1'
const INVOICING = {
  paymentRunMode: 'date_ranges',
  paymentRunDateRanges: [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 },
  ],
  paymentDates: [20, 5],
}
// Thu 3 Dec 2026 08:00 London (GMT) — the reminder for 16–30 Nov, paid Sat 5 Dec.
const DUE_NOW = Date.parse('2026-12-03T08:00:00Z')
const SIGNED = new Date('2026-11-27T10:00:00Z')

function storeWith({ orgs, users, sheets }) {
  const created = new Map()
  const calls = { users: 0, sheets: 0 }
  return {
    created,
    calls,
    organizations: async () => orgs,
    users: async () => {
      calls.users += 1
      return users
    },
    sheetsForRun: async (_org, startDayKey) => {
      calls.sheets += 1
      return sheets.filter((row) => row.data.weekStartKey === startDayKey)
    },
    createNotification: async (_org, id, fields) => {
      if (created.has(id)) return 'exists'
      created.set(id, fields)
      return 'created'
    },
  }
}

const users = [
  { id: 'ADMIN', data: { organizationId: ORG, firstName: 'Ann', surname: 'Admin', adminAccess: true, passwordSet: true } },
  { id: 'MGR', data: { organizationId: ORG, firstName: 'Mo', surname: 'Manager', manager: true, passwordSet: true, assignedManagerUserIds: ['ADMIN'] } },
  { id: 'OP1', data: { organizationId: ORG, firstName: 'Olly', surname: 'One', role: 'operative', operativeMode: true, passwordSet: true, assignedManagerUserIds: ['MGR'] } },
  { id: 'OP2', data: { organizationId: ORG, firstName: 'Pat', surname: 'Two', role: 'operative', operativeMode: true, passwordSet: true, assignedManagerUserIds: ['MGR'] } },
]
const sheet = (userId, extra = {}) => ({
  id: `timesheet_${userId}_x`,
  data: { userId, weekStartKey: '2026-11-16', weekEndKey: '2026-11-30', ...extra },
})

test('1.78.0 sign-off reminders: one row per reviewer per pay run; a second run adds nothing', async () => {
  const store = storeWith({
    orgs: [{ id: ORG, data: { countryCode: 'GB', invoicing: INVOICING, creatorUserId: 'ADMIN' } }],
    users,
    sheets: [sheet('OP1', { operativeSignedAt: SIGNED, operativeSignedByName: 'Signed' }), sheet('OP2', { operativeSignedAt: SIGNED, operativeSignedByName: 'Signed' }), sheet('MGR')],
  })
  const reminders = createTimesheetSignOffReminders({ store, canonical, logger: { info() {}, error() {} }, now: () => DUE_NOW, serverTimestamp: () => 'SERVER_TIME' })
  const first = await reminders.run()
  assert.equal(first[0].written, 1)
  assert.equal(store.created.size, 1)
  const [[id, row]] = [...store.created.entries()]
  assert.equal(
    id,
    canonical.timesheetSignOffReminderNoticeId({ organizationId: ORG, recipientId: 'MGR', startDayKey: '2026-11-16', endDayKey: '2026-11-30', paymentDayKey: '2026-12-05' })
  )
  assert.equal(row.type, 'timesheet_signoff_reminder')
  assert.equal(row.userId, 'MGR')
  assert.equal(row.title, 'Timesheets waiting for your sign-off')
  assert.equal(row.message, '2 timesheets are waiting for you to sign off before payday Sat 5 Dec.')
  assert.equal(row.detail, 'Olly One, Pat Two')
  assert.equal(row.relatedId, '2026-12-05')
  assert.equal(row.dayKey, '2026-11-16')
  assert.equal(row.createdAt, 'SERVER_TIME')
  assert.equal(row.isRead, false)
  assert.ok(!('actorUserId' in row), 'nobody caused it')
  const second = await reminders.run()
  assert.equal(second[0].written, 0)
  assert.equal(second[0].existing, 1)
  assert.equal(store.created.size, 1)
})

test('1.78.0 sign-off reminders: no reads beyond the organisation list when nothing is due; deleted and lapsed organisations skipped', async () => {
  const store = storeWith({
    orgs: [
      { id: ORG, data: { countryCode: 'GB', invoicing: INVOICING } },
      { id: 'org-gone', data: { countryCode: 'GB', invoicing: INVOICING, deletion: { status: 'scheduled', eraseAfter: DUE_NOW + 1e9 } } },
      { id: 'org-lapsed', data: { countryCode: 'GB', invoicing: INVOICING, billing: { status: 'canceled' } } },
      { id: 'org-none', data: { countryCode: 'GB' } },
    ],
    users,
    sheets: [],
  })
  const reminders = createTimesheetSignOffReminders({ store, canonical, logger: { info() {}, error() {} }, now: () => Date.parse('2026-11-10T12:00:00Z') })
  const report = await reminders.run()
  assert.equal(store.calls.users, 0)
  assert.equal(store.calls.sheets, 0)
  assert.deepEqual(report.map((row) => row.skipped || row.due), [0, 'scheduled for deletion', 'subscription lapsed', 0])
})

test('1.78.0 sign-off reminders: one organisation failing never stops the others', async () => {
  const store = storeWith({
    orgs: [
      { id: 'bad', data: { countryCode: 'GB', invoicing: INVOICING } },
      { id: ORG, data: { countryCode: 'GB', invoicing: INVOICING } },
    ],
    users,
    sheets: [sheet('OP1', { operativeSignedAt: SIGNED, operativeSignedByName: 'Signed' })],
  })
  const realUsers = store.users
  store.users = async (orgId) => {
    if (orgId === 'bad') throw new Error('boom')
    return realUsers(orgId)
  }
  const reminders = createTimesheetSignOffReminders({ store, canonical, logger: { info() {}, error() {} }, now: () => DUE_NOW })
  const report = await reminders.run()
  assert.equal(report[0].error, 'boom')
  assert.equal(report[1].written, 1)
})

test('1.78.0 escalation: the day before payday every admin gets one row per pay run, beside the line-manager reminder', async () => {
  const store = storeWith({
    orgs: [{ id: ORG, data: { countryCode: 'GB', invoicing: { ...INVOICING, lineManagerReminderDaysBeforePayday: 1 }, creatorUserId: 'ADMIN' } }],
    users,
    sheets: [sheet('OP1', { operativeSignedAt: SIGNED, operativeSignedByName: 'Signed' })],
  })
  // Fri 4 Dec 2026 08:00 London: 1-day reminder and escalation both due for 16–30 Nov (paid Sat 5 Dec).
  const reminders = createTimesheetSignOffReminders({ store, canonical, logger: { info() {}, error() {} }, now: () => Date.parse('2026-12-04T08:00:00Z') })
  const report = await reminders.run()
  assert.equal(report[0].written, 2)
  const rows = [...store.created.values()].map((row) => [row.userId, row.message]).sort()
  assert.deepEqual(rows, [
    ['ADMIN', '1 timesheet is still not signed off, payday is tomorrow Sat 5 Dec.'],
    ['MGR', '1 timesheet is waiting for you to sign off before payday Sat 5 Dec.'],
  ])
  assert.equal(store.calls.sheets, 1, 'one sheets read per pay run for both passes')
  assert.equal((await reminders.run())[0].written, 0)
})

test('1.78.0 sign-off reminders: a sheet a booking change sent back to the person is not counted (bookings read)', async () => {
  const booking = { operativeId: 'OP1', projectId: 'J1', date: new Date('2026-11-17T00:00:00Z'), timeSlot: 'CUSTOM', workStartTime: '07:00', workEndTime: '16:00', createdAt: new Date('2026-11-10T09:00:00Z'), updatedAt: new Date('2026-11-10T09:00:00Z') }
  const record = [{ bookingId: 'B1', collection: 'bookings', fingerprint: canonical.timesheetLiveLinesFromBookings({ bookings: [{ bookingId: 'B1', collection: 'bookings', dayKey: '2026-11-17', timeSlot: 'CUSTOM', workStartTime: '07:00', workEndTime: '16:00', personId: 'OP1' }], personIds: ['OP1'], periodStartDayKey: '2026-11-16', periodEndDayKey: '2026-11-30' })[0].bookingFingerprint, personId: 'OP1', place: 'job|j1' }]
  const signed = { operativeSignedAt: SIGNED, operativeSignedByName: 'Signed', operativeSignedBookings: record, operativeSignedBookingsSignedAt: SIGNED, operativeSignedBookingsAt: SIGNED }
  const runWith = async (bookingRows, complete = true) => {
    const store = storeWith({ orgs: [{ id: ORG, data: { countryCode: 'GB', invoicing: INVOICING, creatorUserId: 'ADMIN' } }], users, sheets: [sheet('OP1', signed)] })
    store.bookingsForRun = async () => ({ rows: bookingRows.map((data, i) => ({ collection: 'bookings', id: `B${i + 1}`, data })), complete })
    store.operatives = async () => []
    const reminders = createTimesheetSignOffReminders({ store, canonical, logger: { info() {}, error() {} }, now: () => DUE_NOW })
    await reminders.run()
    return [...store.created.values()].map((row) => row.userId)
  }
  assert.deepEqual(await runWith([booking]), ['MGR'], 'unchanged: still waiting for the line manager')
  assert.deepEqual(await runWith([{ ...booking, workEndTime: '18:00', updatedAt: new Date('2026-11-28T09:00:00Z') }]), [], 'changed: back with the person')
  assert.deepEqual(await runWith([]), [], 'deleted: back with the person')
  assert.deepEqual(await runWith([], false), ['MGR'], 'bookings limit reached: stored signatures only')
})

test('1.78.0 sign-off reminders: a line manager who belongs through the members map is reminded with their level here', async () => {
  const store = storeWith({
    orgs: [{ id: ORG, data: { countryCode: 'GB', invoicing: INVOICING, creatorUserId: 'ADMIN', members: { VIS: 'manager' } } }],
    users: [...users, { id: 'OPV', data: { organizationId: ORG, firstName: 'Op', surname: 'Visited', role: 'operative', operativeMode: true, passwordSet: true, assignedManagerUserIds: ['VIS'] } }],
    sheets: [sheet('OPV', { operativeSignedAt: SIGNED, operativeSignedByName: 'Signed' })],
  })
  const asked = []
  store.usersByIds = async (ids) => {
    asked.push(...ids)
    return ids.includes('VIS') ? [{ id: 'VIS', data: { organizationId: 'other-org', firstName: 'Vi', surname: 'Sitor', adminAccess: true, passwordSet: true } }] : []
  }
  store.memberships = async () => ({})
  const reminders = createTimesheetSignOffReminders({ store, canonical, logger: { info() {}, error() {} }, now: () => DUE_NOW })
  await reminders.run()
  assert.deepEqual(asked, ['VIS'], 'only anchored ids not already read')
  assert.deepEqual([...store.created.values()].map((row) => [row.userId, row.detail]), [['VIS', 'Op Visited']])
})
