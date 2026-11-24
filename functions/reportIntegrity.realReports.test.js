'use strict'
/**
 * Fourth review of #391 (B1): real reports, built exactly as the apps build them (`payeOvertimeLines` →
 * `overtimeReportSnapshot` from bookings read through the rulebook readers), must pass the server check. Based on the
 * reviewer's harness.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const R = './'
const canonical = require(R + 'loadCanonical')
const { createReportIntegrityCheck } = require(R + 'reportIntegrity')
const ORG = 'org1'
const TZ = 'Europe/London'
const logger = { warn() {}, error() {}, info() {} }
function fakeStore(docs) {
  const written = {}
  return { written,
    async getDoc(p) { return docs[p] ?? null },
    async query(cp, f, v) { return Object.entries(docs).filter(([p, d]) => p.startsWith(cp + '/') && p.split('/').length === cp.split('/').length + 1 && d[f] === v).map(([p, d]) => ({ id: p.split('/').pop(), data: d })) },
    async setDoc(p, d) { written[p] = d } }
}
const org = { countryCode: 'GB', payrollTimePolicy: { standardDayStart: '07:30', standardDayEnd: '16:00', unpaidBreakMinutes: 30, breakWindowStart: '12:00', breakWindowEnd: '12:30', weekdayOvertimeMultiplier: 1.5 } }
const londonMidnight = (day) => canonical.dateFromDayKeyInZone ? canonical.dateFromDayKeyInZone(day, TZ).getTime() : Date.parse(day + 'T00:00:00Z')
// The app's way: web bookingInputFromDoc
function appInput(collection, id, data, jobs) {
  if (collection === 'bookings') {
    const p = canonical.parseBookingDocument(id, data, { timeZone: TZ }); if (!p.ok) throw new Error('parse ' + JSON.stringify(p))
    const b = p.booking; const j = jobs[b.projectId]
    return { id, collection, personId: b.operativeId, dayKey: canonical.dayKeyInOrganizationZone(new Date(b.dateMs).toISOString(), TZ), timeSlot: b.timeSlot, workStartTime: b.workStartTime ?? null, workEndTime: b.workEndTime ?? null, isBreakRemoved: b.isBreakRemoved, otMultiplierOverride: b.otMultiplierOverride ?? null, status: b.status, jobId: b.projectId, jobNumber: j ? j.jobNumber : '', jobName: j ? j.siteName : '' }
  }
  const p = canonical.parseManagerSiteBookingDocument(id, data, { timeZone: TZ }); if (!p.ok) throw new Error('parse msb')
  const b = p.booking; const j = jobs[b.locationId]
  return { id, collection, personId: b.userId, dayKey: canonical.dayKeyInOrganizationZone(new Date(b.dateMs).toISOString(), TZ), timeSlot: b.timeSlot, workStartTime: b.workStartTime ?? null, workEndTime: b.workEndTime ?? null, isBreakRemoved: b.isBreakRemoved, otMultiplierOverride: b.otMultiplierOverride ?? null, jobId: b.locationId ?? null, jobNumber: j ? j.jobNumber : '', jobName: j ? j.siteName : (b.customLocationName ?? '') }
}
function parsedUserName(id, data) { const u = canonical.parseUserDocument(id, data, {}); const n = [u.firstName, u.surname].filter(Boolean).join(' '); return n || u.email }
async function run({ bookings = {}, reviews = {}, users = {}, jobs = {}, requests = [], range = ['2026-07-01', '2026-11-30'], extra = {}, printedNames = {} }) {
  const docs = { [`organizations/${ORG}`]: org, ...extra }
  const inputs = []
  for (const [key, data] of Object.entries(bookings)) { const [c, id] = key.split('/'); docs[`organizations/${ORG}/${c}/${id}`] = data; if (data) inputs.push(appInput(c, id, data, jobs)) }
  for (const [id, j] of Object.entries(jobs)) docs[`organizations/${ORG}/${j.coll || 'projects'}/${id}`] = { jobNumber: j.rawNumber ?? j.jobNumber, siteName: j.siteName }
  const reviewRecs = []
  for (const [id, r] of Object.entries(reviews)) { docs[`organizations/${ORG}/overtimeReviews/${id}`] = r; reviewRecs.push(canonical.parseOvertimeReviewDocument(id, r)) }
  const names = {}
  for (const [id, u] of Object.entries(users)) { docs[`users/${id}`] = u; names[id] = printedNames[id] ?? parsedUserName(id, u) }
  const jobRows = Object.entries(jobs).map(([id, j]) => ({ id, jobNumber: j.jobNumber, jobName: j.siteName }))
  const lines = canonical.payeOvertimeLines({ personIds: ['sam'], bookings: inputs, organization: org, timeZone: TZ, range: { start: range[0], end: range[1] }, reviews: reviewRecs, requests, names, jobs: jobRows })
  const snap = canonical.overtimeReportSnapshot({ userId: 'sam', userName: 'Sam', rangeStart: range[0], rangeEnd: range[1], lines, generatedBy: 'sam' })
  const check = createReportIntegrityCheck({ store: fakeStore(docs), canonical, logger, serverTimestamp: () => 'T' })
  const res = await check.handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R', report: JSON.parse(JSON.stringify(snap)) })
  return { res, snap, lines }
}
const fp = (input) => canonical.overtimeBookingFingerprint(input)
function rev(bookingId, input, decision, reviewedBy, requestId = 'REQ1') { return { userId: 'sam', bookingId, collection: input.collection, decision, fingerprint: fp(input), reviewedBy, requestId } }
const labour = (day, s, e, extra = {}) => ({ operativeId: 'sam', projectId: 'P1', jobCollection: 'projects', date: { seconds: londonMidnight(day) / 1000, nanoseconds: 0 }, timeSlot: 'CUSTOM_HOURS', workStartTime: s, workEndTime: e, status: 'Confirmed', ...extra })
const jobs = { P1: { jobNumber: 'J-1', siteName: 'Riverside' } }
function show(t, r) { if (!r.res.ok) assert.fail(`${t}: ${JSON.stringify(r.res.problems)}`) }

test('GMT weekday approved', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'lee') }, jobs, users: { lee: { firstName: 'Lee', surname: 'Line' } } })
  show('gmt', r); assert.equal(r.snap.lines.length, 1); assert.equal(r.res.ok, true)
})
test('BST weekday approved', async () => {
  const b = labour('2026-07-15', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'lee') }, jobs })
  show('bst', r); assert.equal(r.snap.lines[0].dayKey, '2026-07-15'); assert.equal(r.res.ok, true)
})
test('declined line with decider name (surname)', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'declined', 'lee') }, jobs, users: { lee: { firstName: 'Lee', surname: 'Line', email: 'l@x' } } })
  show('declined', r); assert.equal(r.snap.lines[0].state, 'returnedDeclined'); assert.equal(r.res.ok, true)
})
test('declined line with decider stored as lastName', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'declined', 'lee') }, jobs, users: { lee: { firstName: 'Lee', lastName: 'Line', email: 'l@x' } } })
  show('declined lastName', r); assert.equal(r.res.ok, true)
})
test('declined line with decider stored as displayName only', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'declined', 'lee') }, jobs, users: { lee: { displayName: 'Lee Line', email: 'l@x' } } })
  show('declined displayName', r); assert.equal(r.res.ok, true)
})
test('deleted line', async () => {
  const b = labour('2026-11-06', '17:00', '20:00'); const i = appInput('bookings', 'B2', b, jobs)
  const requests = [canonical.parseOvertimeRequestDocument('REQ1', { userId: 'sam', status: 'approved', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines: [{ bookingId: 'B2', collection: 'bookings', dayKey: '2026-11-06', jobId: 'P1', fingerprint: fp(i) }], deletedBookingIds: ['B2'], decidedBy: 'lee' })]
  const r = await run({ bookings: { 'bookings/B2': null }, reviews: { sam_B2: rev('B2', i, 'deleted', 'lee') }, jobs, requests, users: { lee: { firstName: 'Lee', surname: 'Line' } } })
  show('deleted', r); assert.equal(r.snap.lines[0].state, 'deleted'); assert.equal(r.res.ok, true)
})
test('self confirmed (no LM) line', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'sam', null) }, jobs })
  show('self', r); assert.equal(r.res.ok, true)
})
test('manager site: custom place', async () => {
  const d = { userId: 'sam', locationType: 'custom', customLocationName: 'Depot', date: { seconds: londonMidnight('2026-11-05') / 1000 }, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' }
  const i = appInput('managerSiteBookings', 'M1', d, jobs)
  const r = await run({ bookings: { 'managerSiteBookings/M1': d }, reviews: { sam_M1: rev('M1', i, 'approved', 'lee') }, jobs })
  show('custom', r); assert.equal(r.res.ok, true)
})
test('manager site: office', async () => {
  const d = { userId: 'sam', locationType: 'office', date: { seconds: londonMidnight('2026-11-05') / 1000 }, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' }
  const i = appInput('managerSiteBookings', 'M1', d, jobs)
  const r = await run({ bookings: { 'managerSiteBookings/M1': d }, reviews: { sam_M1: rev('M1', i, 'approved', 'lee') }, jobs })
  show('office', r); assert.equal(r.res.ok, true)
})
test('manager site on a project', async () => {
  const d = { userId: 'sam', locationType: 'project', locationId: 'P1', date: { seconds: londonMidnight('2026-11-05') / 1000 }, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' }
  const i = appInput('managerSiteBookings', 'M1', d, jobs)
  const r = await run({ bookings: { 'managerSiteBookings/M1': d }, reviews: { sam_M1: rev('M1', i, 'approved', 'lee') }, jobs })
  show('msb project', r); assert.equal(r.res.ok, true)
})
test('manager site on a project, locationType missing (legacy)', async () => {
  const d = { userId: 'sam', locationId: 'P1', date: { seconds: londonMidnight('2026-11-05') / 1000 }, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' }
  const i = appInput('managerSiteBookings', 'M1', d, jobs)
  const r = await run({ bookings: { 'managerSiteBookings/M1': d }, reviews: { sam_M1: rev('M1', i, 'approved', 'lee') }, jobs })
  show('msb legacy', r); assert.equal(r.res.ok, true)
})
test('labour with legacy projectID key', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); delete b.projectId; b.projectID = 'P1'
  const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'lee') }, jobs })
  show('projectID', r); assert.equal(r.res.ok, true)
})
test('self confirmed with 12h clock strings', async () => {
  const b = labour('2026-11-05', '7:30 AM', '6:00 PM'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'sam', null) }, jobs })
  show('12h self', r); assert.equal(r.res.ok, true)
})
test('numeric jobNumber', async () => {
  const j = { P1: { jobNumber: '4521', rawNumber: 4521, siteName: 'Riverside' } }
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, j)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'lee') }, jobs: j })
  show('numjob', r); assert.equal(r.res.ok, true)
})
test('small works job', async () => {
  const j = { S1: { jobNumber: 'SW-1', siteName: 'Leak', coll: 'smallWorks' } }
  const b = labour('2026-11-05', '07:30', '18:00', { projectId: 'S1', jobCollection: 'smallWorks' }); const i = appInput('bookings', 'B1', b, j)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'lee') }, jobs: j })
  show('sw', r); assert.equal(r.res.ok, true)
})
test('weekend Sunday BST every hour', async () => {
  const b = labour('2026-07-19', '07:30', '14:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'changed', 'lee') }, jobs })
  show('sunday', r); assert.equal(r.res.ok, true)
})
test('BST clock-change day (29 Mar 2026)', async () => {
  const b = labour('2026-03-30', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'lee') }, jobs, range: ['2026-03-01', '2026-03-31'] })
  show('mar', r); assert.equal(r.res.ok, true)
})

test('self confirmed with a Timestamp clock time', async () => {
  const end = { seconds: Date.parse('2026-11-05T18:00:00Z') / 1000, nanoseconds: 0 }
  const b = labour('2026-11-05', '7:30 AM', end); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'sam', null) }, jobs })
  show('timestamp self', r); assert.equal(r.res.ok, true)
})
test('S1: a colleague\'s booking put into the report with a self review is flagged', async () => {
  const b = labour('2026-11-05', '07:30', '21:00', { operativeId: 'ann' }); const i = { ...appInput('bookings', 'B9', b, jobs), personId: 'sam' }
  const docs = { [`organizations/${ORG}`]: org, [`organizations/${ORG}/bookings/B9`]: b, [`organizations/${ORG}/projects/P1`]: { jobNumber: 'J-1', siteName: 'Riverside' },
    [`organizations/${ORG}/overtimeReviews/sam_B9`]: rev('B9', i, 'approved', 'sam', null), 'users/sam': { firstName: 'Sam', email: 's@x' } }
  const lines = canonical.payeOvertimeLines({ personIds: ['sam'], bookings: [i], organization: org, timeZone: TZ, range: { start: '2026-11-01', end: '2026-11-30' }, reviews: [canonical.parseOvertimeReviewDocument('sam_B9', docs[`organizations/${ORG}/overtimeReviews/sam_B9`])], names: {}, jobs: [] })
  const snap = canonical.overtimeReportSnapshot({ userId: 'sam', userName: 'Sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines, generatedBy: 'sam' })
  const res = await createReportIntegrityCheck({ store: fakeStore(docs), canonical, logger, serverTimestamp: () => 'T' }).handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'X', report: JSON.parse(JSON.stringify(snap)) })
  assert.equal(res.ok, false)
  assert.ok(res.problems.some((p) => p.code === 'not_their_booking'))
})
test('S2: a self-confirmed line is a mismatch when the person has an active line manager', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'approved', 'sam', null) }, jobs,
    users: { sam: { firstName: 'Sam', email: 's@x', assignedManagerUserIds: ['lee'] }, lee: { firstName: 'Lee', surname: 'Line', role: 'manager', manager: true } } })
  assert.equal(r.res.ok, false)
  assert.deepEqual(r.res.problems.map((p) => [p.code, p.severity]), [['self_reviewed', 'mismatch']])
})
test('N3: an unreadable decider leaves the name unchecked with a note', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const r = await run({ bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'declined', 'lee') }, jobs })
  assert.equal(r.res.ok, true)
  assert.deepEqual(r.res.problems.map((p) => p.code), ['decider_unknown'])
})

test('1.81.0 declined by a decider with an organisation name: either name on the report passes', async () => {
  const b = labour('2026-11-05', '07:30', '18:00'); const i = appInput('bookings', 'B1', b, jobs)
  const base = { bookings: { 'bookings/B1': b }, reviews: { sam_B1: rev('B1', i, 'declined', 'lee') }, jobs, users: { lee: { firstName: 'Lee', surname: 'Line', email: 'l@x' } }, extra: { [`organizations/${ORG}/memberNames/lee`]: { firstName: 'Leo', surname: 'Lane' } } }
  const account = await run(base)
  show('account name printed', account)
  const company = await run({ ...base, printedNames: { lee: 'Leo Lane' } })
  show('company name printed', company)
  const other = await run({ ...base, printedNames: { lee: 'Someone Else' } })
  assert.equal(other.res.ok, false)
})
