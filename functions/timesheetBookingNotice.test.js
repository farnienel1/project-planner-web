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
  return {
    created,
    organization: async () => ({ countryCode: 'GB' }),
    user: async (uid) => users[uid] ?? null,
    operative: async (_org, id) => operatives[id] ?? null,
    userEmailClaim: async () => null,
    usersListingId: async () => [],
    operativesByEmail: async () => [],
    timesheets: async (_org, uid) => (uid === PERSON ? sheets : []),
    tombstone: async (_org, id) => tombstones[id] ?? null,
    createNotification: async (_org, id, fields) => {
      if (created.has(id)) return 'exists'
      created.set(id, fields)
      return 'created'
    },
  }
}

const signedAt = Date.parse('2026-11-12T10:00:00Z')
const signedSheet = (extra = {}) => ({
  id: `timesheet_${PERSON}_1762300800`,
  data: {
    userId: PERSON,
    weekStartKey: '2026-11-01',
    weekEndKey: '2026-11-15',
    weekStart: day('2026-11-01'),
    operativeSignedAt: new Date(signedAt),
    managerSignedAt: new Date(signedAt + 3600_000),
    operativeSignedBookings: [{ bookingId: 'B1', collection: 'bookings', fingerprint: '', personId: PERSON, place: 'job|j1' }],
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

test('1.54.0: no notice for an exported sheet, a write that changes nothing the rule reads, or the person\'s own change', async () => {
  const exported = storeWith({ sheets: [signedSheet({ exportedAt: new Date(signedAt + 7200_000) })], users })
  const n1 = createTimesheetBookingNotice({ store: exported, canonical, logger: { info() {}, error() {} } })
  assert.equal((await n1.handle({ orgId: ORG, collection: 'bookings', bookingId: 'B1', before: booking(), after: booking({ workEndTime: '18:00' }) })).written, 0)

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
