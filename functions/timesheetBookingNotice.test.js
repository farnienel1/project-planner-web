'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const canonical = require('./loadCanonical')
const { createTimesheetBookingNotice } = require('./timesheetBookingNotice')

const ORG = 'org-1'
const PERSON = 'person-1'
const LM = 'lm-1'

function day(key) {
  return new Date(`${key}T00:00:00Z`)
}

function storeWith({ sheets, users = {}, operatives = {}, tombstones = {} }) {
  const created = new Map()
  const reads = { count: 0, queries: [] }
  const read = (value) => {
    reads.count += 1
    return value
  }
  return {
    created,
    reads,
    organization: async () => read({ countryCode: 'GB' }),
    user: async (uid) => read(users[uid] ?? null),
    operative: async (_org, id) => read(operatives[id] ?? null),
    userEmailClaim: async () => read(null),
    usersListingFormerId: async () => read([]),
    operativesByEmail: async () => read([]),
    // Only the sheets whose pay run can hold the day (weekEnd on or after it), as the indexed query returns them.
    timesheetsCovering: async (_org, uids, fromMs) => {
      reads.queries.push({ uids, fromMs })
      return read(uids.includes(PERSON) ? sheets.filter((row) => !row.data.weekEnd || row.data.weekEnd.getTime() >= fromMs).slice(0, 4) : [])
    },
    tombstone: async (_org, id) => read(tombstones[id] ?? null),
    createNotification: async (_org, id, fields) => {
      if (created.has(id)) return 'exists'
      created.set(id, fields)
      return 'created'
    },
  }
}

const FP_B1 = canonical.overtimeBookingFingerprint({
  id: 'B1',
  personId: '',
  dayKey: '2026-11-10',
  timeSlot: 'CUSTOM_HOURS',
  workStartTime: '07:00',
  workEndTime: '16:00',
  isBreakRemoved: false,
  otMultiplierOverride: null,
  status: 'Confirmed',
})
const signedAt = Date.parse('2026-11-12T10:00:00Z')
const signedSheet = (extra = {}) => ({
  id: `timesheet_${PERSON}_1762300800`,
  data: {
    userId: PERSON,
    weekStartKey: '2026-11-01',
    weekEndKey: '2026-11-15',
    weekStart: day('2026-11-01'),
    weekEnd: day('2026-11-15'),
    operativeSignedAt: new Date(signedAt),
    managerSignedAt: new Date(signedAt + 3600_000),
    operativeSignedBookings: [{ bookingId: 'B1', collection: 'bookings', fingerprint: FP_B1, personId: PERSON, place: 'job|j1' }],
    operativeSignedBookingsSignedAt: new Date(signedAt),
    weeklyReportOverride: { lines: [{ id: 'op-B1-normal', bookingId: 'B1', bookingCollection: 'bookings' }] },
    ...extra,
  },
})

const booking = (extra = {}) => ({
  operativeId: PERSON,
  projectId: 'j1',
  date: day('2026-11-10'),
  timeSlot: 'CUSTOM_HOURS',
  workStartTime: '07:00',
  workEndTime: '16:00',
  status: 'Confirmed',
  updatedBy: LM,
  ...extra,
})

const users = { [PERSON]: { organizationId: ORG, email: 'p@example.test', employmentType: 'self_employed', isActive: true } }

test('1.54.0: a signed booking whose times change tells the person once per signature', async () => {
  const store = storeWith({ sheets: [signedSheet()], users })
  const notice = createTimesheetBookingNotice({ store, canonical, logger: { info() {}, error() {} } })
  const result = await notice.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ workEndTime: '18:00' }) })
  assert.equal(result.written, 1)
  const [row] = [...store.created.values()]
  assert.equal(row.type, 'timesheet_bookings_changed')
  assert.equal(row.userId, PERSON)
  assert.equal(row.actorUserId, LM)
  assert.equal(row.dayKey, '2026-11-01')
  assert.equal(row.deepLinkUserId, PERSON)
  // A second change before the person signs again: no second row.
  const again = await notice.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking({ workEndTime: '18:00' }), after: booking({ workEndTime: '19:00' }) })
  assert.equal(again.written, 0)
})

test('1.55.0: an exported sheet whose booking changes makes a revision due — one "update" row per exported version', async () => {
  const exportedAt = new Date(signedAt + 7200_000)
  const exported = storeWith({ sheets: [signedSheet({ exportedAt })], users })
  const n1 = createTimesheetBookingNotice({ store: exported, canonical, logger: { info() {}, error() {} } })
  assert.equal((await n1.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ workEndTime: '18:00' }) })).written, 1)
  const [row] = [...exported.created.values()]
  assert.equal(row.type, 'timesheet_revision_to_sign')
  assert.equal(row.title, canonical.TIMESHEET_REVISION_DUE_NOTICE_TITLE)
  assert.equal(row.userId, PERSON)
  assert.equal((await n1.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking({ workEndTime: '18:00' }), after: booking({ workEndTime: '19:00' }) })).written, 0, 'once per exported version')
  // The person's own change: nothing.
  const own = storeWith({ sheets: [signedSheet({ exportedAt })], users })
  const n3 = createTimesheetBookingNotice({ store: own, canonical, logger: { info() {}, error() {} } })
  assert.equal((await n3.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ workEndTime: '18:00', updatedBy: PERSON }) })).written, 0)
})

test('1.55.0: only the latest version of a pay run is judged — an open revision follows the 1.47.0 rule, the exported original is ignored', async () => {
  const exportedAt = new Date(signedAt + 7200_000)
  const original = signedSheet({ exportedAt })
  // REV 1, signed by the person, not exported.
  const rev = { id: `${original.id}_rev1`, data: { ...signedSheet().data, managerSignedAt: null, revisionOf: original.id, revision: 1 } }
  const store = storeWith({ sheets: [original, rev], users })
  const notice = createTimesheetBookingNotice({ store, canonical, logger: { info() {}, error() {} } })
  assert.equal((await notice.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ workEndTime: '18:00' }) })).written, 1)
  const [row] = [...store.created.values()]
  assert.equal(row.type, 'timesheet_bookings_changed', 'the open revision reopens; no "update to an exported sheet"')
})

test('1.54.0: no notice for a write that changes nothing the rule reads, or the person\'s own change', async () => {

  const plain = storeWith({ sheets: [signedSheet()], users })
  const n2 = createTimesheetBookingNotice({ store: plain, canonical, logger: { info() {}, error() {} } })
  assert.equal((await n2.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ notes: 'x', status: 'Tentative' }) })).written, 0)
  assert.equal((await n2.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ workEndTime: '18:00', updatedBy: PERSON }) })).written, 0)
})

test('1.54.0: a new booking in the period is an addition; a deleted signed booking is a change (actor from the tombstone)', async () => {
  const store = storeWith({ sheets: [signedSheet()], users, tombstones: { B1: { deletedBy: LM } } })
  const notice = createTimesheetBookingNotice({ store, canonical, logger: { info() {}, error() {} } })
  assert.equal((await notice.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: null })).written, 1)
  const store2 = storeWith({ sheets: [signedSheet()], users })
  const notice2 = createTimesheetBookingNotice({ store: store2, canonical, logger: { info() {}, error() {} } })
  assert.equal((await notice2.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B9', before: null, after: booking() })).written, 1)
  // Outside the pay run: nothing.
  const store3 = storeWith({ sheets: [signedSheet()], users })
  const notice3 = createTimesheetBookingNotice({ store: store3, canonical, logger: { info() {}, error() {} } })
  assert.equal((await notice3.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B9', before: null, after: booking({ date: day('2026-11-20') }) })).written, 0)
})

test('1.54.0 review of #337 (4): reads per write — none for a write the rule ignores, three for a usual change', async () => {
  const store = storeWith({ sheets: [signedSheet()], users })
  const notice = createTimesheetBookingNotice({ store, canonical, logger: { info() {}, error() {} } })
  await notice.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ updatedAt: new Date(), notes: 'x' }) })
  assert.equal(store.reads.count, 0)
  await notice.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ workEndTime: '18:00' }) })
  // Organisation, the person's users document, one sheets query.
  assert.equal(store.reads.count, 3)
  assert.equal(store.reads.queries.length, 1)
  assert.deepEqual(store.reads.queries[0].uids, [PERSON])
  // The query asks only for sheets whose pay run can still hold the booking day.
  assert.ok(store.reads.queries[0].fromMs <= day('2026-11-10').getTime())
  assert.ok(store.reads.queries[0].fromMs >= day('2026-11-07').getTime())
})
