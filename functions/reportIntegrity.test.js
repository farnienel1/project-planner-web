'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const canonical = require('./loadCanonical')
const { createReportIntegrityCheck } = require('./reportIntegrity')

const ORG = 'org1'

function fakeStore(docs) {
  const written = {}
  return {
    written,
    async getDoc(path) {
      return docs[path] ?? null
    },
    async query(collectionPath, field, value) {
      return Object.entries(docs)
        .filter(([path, data]) => path.startsWith(`${collectionPath}/`) && path.split('/').length === collectionPath.split('/').length + 1 && data[field] === value)
        .map(([path, data]) => ({ id: path.split('/').pop(), data }))
    },
    async setDoc(path, data) {
      written[path] = data
    },
  }
}

const logger = { warn() {}, error() {}, info() {} }

test('a claims report with an inflated item is flagged for admins; the report itself is never written', async () => {
  const report = {
    userId: 'sam', kind: 'expense', currency: 'GBP', rangeStart: '2026-11-01', rangeEnd: '2026-11-30',
    items: [{ id: 'E1', title: 'Fuel', amount: 400, startDate: '2026-11-05' }],
    totals: { amount: 400, itemCount: 1 },
  }
  const store = fakeStore({
    [`organizations/${ORG}`]: { countryCode: 'GB' },
    [`organizations/${ORG}/expenseItems/E1`]: { userId: 'sam', title: 'Fuel', amount: 40, currency: 'GBP', date: '2026-11-05', evidence: [] },
    'users/sam': {},
  })
  const check = createReportIntegrityCheck({ store, canonical, logger, serverTimestamp: () => 'SERVER_TIME' })
  const result = await check.handle({ orgId: ORG, collection: 'payeClaimReports', reportId: 'P1', report })
  assert.equal(result.ok, false)
  assert.deepEqual(Object.keys(store.written), [`organizations/${ORG}/reportChecks/P1`])
  const written = store.written[`organizations/${ORG}/reportChecks/P1`]
  assert.equal(written.ok, false)
  assert.equal(written.checkedAt, 'SERVER_TIME')
  assert.equal(written.recomputedTotal, 40)
  assert.deepEqual(written.problems.map((p) => p.code), ['amount_differs'])
})

test('an overtime report with no stored review for a line is flagged; bad ids are ignored and nothing throws', async () => {
  const report = {
    userId: 'sam', kind: 'overtime',
    lines: [{ bookingId: 'B1', dayKey: '2026-11-05', clockHours: 2, multiplier: 1.5, overtimeHours: 3 }, { bookingId: '../x', overtimeHours: 0 }],
    totals: { overtimeHours: 3, lineCount: 2 },
  }
  const store = fakeStore({ [`organizations/${ORG}`]: { countryCode: 'GB' } })
  const check = createReportIntegrityCheck({ store, canonical, logger, serverTimestamp: () => 'T' })
  const result = await check.handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R1', report })
  assert.equal(result.ok, false)
  assert.ok(result.problems.some((p) => p.code === 'not_reviewed' && p.recordId === 'B1'))
  assert.equal(await check.handle({ orgId: '../bad', collection: 'overtimeReports', reportId: 'R1', report }), null)
})

test('review of #391: the job printed on an overtime line is compared with the booking\'s job', async () => {
  const booking = { operativeId: 'sam', projectId: 'P1', jobCollection: 'projects', date: Date.parse('2026-11-05T00:00:00Z'), timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00', status: 'Confirmed' }
  const input = { id: 'B1', collection: 'bookings', personId: 'sam', dayKey: '2026-11-05', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00', status: 'Confirmed' }
  const org = { countryCode: 'GB' }
  const figures = canonical.overtimeForBooking({ booking: input, organization: org, timeZone: 'Europe/London' })
  const fingerprint = canonical.overtimeBookingFingerprint(input)
  const line = { bookingId: 'B1', dayKey: '2026-11-05', jobNumber: 'J-1', jobName: 'Riverside', start: '07:30', end: '18:00', text: figures.text, clockHours: figures.clockHours, multiplier: figures.multiplier, overtimeHours: figures.overtimeHours, fingerprint }
  const docs = {
    [`organizations/${ORG}`]: org,
    [`organizations/${ORG}/bookings/B1`]: booking,
    [`organizations/${ORG}/projects/P1`]: { jobNumber: 'J-1', siteName: 'Riverside' },
    [`organizations/${ORG}/overtimeReviews/sam_B1`]: { userId: 'sam', bookingId: 'B1', decision: 'approved', fingerprint, reviewedBy: 'lee' },
  }
  const report = (lines) => ({ userId: 'sam', kind: 'overtime', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines, totals: { overtimeHours: figures.overtimeHours, lineCount: 1 } })
  const check = createReportIntegrityCheck({ store: fakeStore(docs), canonical, logger, serverTimestamp: () => 'T' })
  assert.equal((await check.handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R1', report: report([line]) })).ok, true)
  const other = await check.handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R2', report: report([{ ...line, jobNumber: 'J-OTHER' }]) })
  assert.deepEqual(other.problems.map((p) => p.code), ['job_differs'])
})

test('third review of #391: a custom place passes its name; a decline is checked against the decider\'s name', async () => {
  const input = { id: 'M1', collection: 'managerSiteBookings', personId: 'sam', dayKey: '2026-11-05', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00', status: 'Confirmed' }
  const org = { countryCode: 'GB', currencyCode: 'GBP' }
  const figures = canonical.overtimeForBooking({ booking: input, organization: org, timeZone: 'Europe/London' })
  const fingerprint = canonical.overtimeBookingFingerprint(input)
  const base = { bookingId: 'M1', dayKey: '2026-11-05', jobNumber: '', jobName: 'Head office', start: '07:30', end: '18:00', fingerprint }
  const docs = {
    [`organizations/${ORG}`]: org,
    [`organizations/${ORG}/managerSiteBookings/M1`]: { userId: 'sam', locationType: 'custom', customLocationName: 'Head office', date: Date.parse('2026-11-05T00:00:00Z'), timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' },
    'users/lee': { firstName: 'Lee', surname: 'Manager' },
  }
  const report = (line) => ({ userId: 'sam', kind: 'overtime', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines: [line], totals: { overtimeHours: line.overtimeHours, lineCount: 1 } })
  const approved = { ...docs, [`organizations/${ORG}/overtimeReviews/sam_M1`]: { userId: 'sam', bookingId: 'M1', decision: 'approved', fingerprint, reviewedBy: 'lee' } }
  const priced = { ...base, text: figures.text, clockHours: figures.clockHours, multiplier: figures.multiplier, overtimeHours: figures.overtimeHours, state: 'returnedApproved' }
  const check = createReportIntegrityCheck({ store: fakeStore(approved), canonical, logger, serverTimestamp: () => 'T' })
  assert.equal((await check.handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R1', report: report(priced) })).ok, true)

  const declined = { ...docs, [`organizations/${ORG}/overtimeReviews/sam_M1`]: { userId: 'sam', bookingId: 'M1', decision: 'declined', fingerprint, reviewedBy: 'lee', requestId: 'Q1' } }
  const zero = { ...base, text: 'Declined by Lee Manager · 0h', clockHours: 0, multiplier: 1, overtimeHours: 0, state: 'returnedDeclined', declined: true, declinedByName: 'Lee Manager' }
  const check2 = createReportIntegrityCheck({ store: fakeStore(declined), canonical, logger, serverTimestamp: () => 'T' })
  assert.equal((await check2.handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R2', report: report(zero) })).ok, true)
  const forged = await check2.handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R3', report: report({ ...zero, declinedByName: 'Nobody', text: 'Declined by Nobody · 0h' }) })
  assert.deepEqual(forged.problems.map((p) => p.code), ['details_differ', 'text_differs'])
})

test('a failing store is logged, never thrown to the trigger', async () => {
  const store = { getDoc: async () => { throw new Error('down') }, query: async () => [], setDoc: async () => {} }
  const errors = []
  const check = createReportIntegrityCheck({ store, canonical, logger: { ...logger, error: (m) => errors.push(m) }, serverTimestamp: () => 'T' })
  assert.equal(await check.handle({ orgId: ORG, collection: 'payeClaimReports', reportId: 'P1', report: { items: [] } }), null)
  assert.equal(errors.length, 1)
})
