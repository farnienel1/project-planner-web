'use strict'
/** Fifth review of #391: real reports the server check must accept (reviewer's cases), and the one forgery it must flag. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const R = './'
const canonical = require(R + 'loadCanonical')
const { createReportIntegrityCheck } = require(R + 'reportIntegrity')
const ORG = 'org1', TZ = 'Europe/London'
const logger = { warn() {}, error() {}, info() {} }
const childrenOf = (docs, cp) => Object.entries(docs).filter(([p]) => p.startsWith(cp + '/') && p.split('/').length === cp.split('/').length + 1).map(([p, d]) => ({ id: p.split('/').pop(), data: d }))
function fakeStore(docs) { return { async getDoc(p) { return docs[p] ?? null }, async list(cp) { return childrenOf(docs, cp) }, async query(cp, f, v) { return Object.entries(docs).filter(([p, d]) => p.startsWith(cp + '/') && p.split('/').length === cp.split('/').length + 1 && d[f] === v).map(([p, d]) => ({ id: p.split('/').pop(), data: d })) }, async setDoc() {} } }
const org = { name: 'Acme Ltd', countryCode: 'GB', creatorUserId: 'boss', payrollTimePolicy: { standardDayStart: '07:30', standardDayEnd: '16:00', unpaidBreakMinutes: 30, breakWindowStart: '12:00', breakWindowEnd: '12:30', weekdayOvertimeMultiplier: 1.5 } }
const mid = (d) => Date.parse(d + 'T00:00:00Z')
function appInput(collection, id, data) {
  if (collection === 'bookings') { const b = canonical.parseBookingDocument(id, data, { timeZone: TZ }).booking
    return { id, collection, personId: b.operativeId, dayKey: canonical.dayKeyInOrganizationZone(new Date(b.dateMs).toISOString(), TZ), timeSlot: b.timeSlot, workStartTime: b.workStartTime ?? null, workEndTime: b.workEndTime ?? null, isBreakRemoved: b.isBreakRemoved, otMultiplierOverride: b.otMultiplierOverride ?? null, status: b.status, jobId: b.projectId, jobNumber: 'J-1', jobName: 'Riverside' } }
  const b = canonical.parseManagerSiteBookingDocument(id, data, { timeZone: TZ }).booking
  return { id, collection, personId: b.userId, dayKey: canonical.dayKeyInOrganizationZone(new Date(b.dateMs).toISOString(), TZ), timeSlot: b.timeSlot, workStartTime: b.workStartTime ?? null, workEndTime: b.workEndTime ?? null, isBreakRemoved: b.isBreakRemoved, otMultiplierOverride: b.otMultiplierOverride ?? null, jobId: b.locationId ?? null, jobNumber: 'J-1', jobName: 'Riverside' }
}
async function run({ subjectId = 'sam', users, operatives = {}, bookings, reviewer = 'lee', userName, companyName = 'Acme Ltd', personIds }) {
  const docs = { [`organizations/${ORG}`]: org, [`organizations/${ORG}/projects/P1`]: { jobNumber: 'J-1', siteName: 'Riverside' } }
  for (const [id, u] of Object.entries(users)) docs[`users/${id}`] = u
  for (const [id, o] of Object.entries(operatives)) docs[`organizations/${ORG}/operatives/${id}`] = o
  const inputs = []; const reviews = []
  for (const [key, data] of Object.entries(bookings)) { const [c, id] = key.split('/'); docs[`organizations/${ORG}/${c}/${id}`] = data; const i = appInput(c, id, data); inputs.push(i)
    const r = { userId: subjectId, bookingId: id, collection: c, decision: 'approved', fingerprint: canonical.overtimeBookingFingerprint(i), reviewedBy: reviewer, requestId: reviewer === subjectId ? null : 'REQ' }
    docs[`organizations/${ORG}/overtimeReviews/${subjectId}_${id}`] = r; reviews.push(canonical.parseOvertimeReviewDocument(`${subjectId}_${id}`, r)) }
  const lines = canonical.payeOvertimeLines({ personIds, bookings: inputs, organization: org, timeZone: TZ, range: { start: '2026-11-01', end: '2026-11-30' }, reviews, requests: [], names: {}, jobs: [{ id: 'P1', jobNumber: 'J-1', jobName: 'Riverside' }] })
  const snap = canonical.overtimeReportSnapshot({ userId: subjectId, userName, companyName, rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines, generatedBy: subjectId })
  const res = await createReportIntegrityCheck({ store: fakeStore(docs), canonical, logger, serverTimestamp: () => 'T' }).handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R', report: JSON.parse(JSON.stringify(snap)) })
  return { n: snap.lines.length, ok: res.ok, p: res.problems.map((p) => p.code + ':' + p.severity) }
}
const lab = (op, extra = {}) => ({ operativeId: op, projectId: 'P1', jobCollection: 'projects', date: { seconds: mid('2026-11-05') / 1000 }, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00', status: 'Confirmed', ...extra })
const lee = { firstName: 'Lee', surname: 'Line', email: 'lee@x.com', manager: true, organizationId: ORG }
const appPersonIds = (subject, roster, operatives) => canonical.overtimePersonIds({ person: canonical.parseUserDocument(subject.id, subject.data, {}), roster: roster.map((r) => canonical.parseUserDocument(r.id, r.data, {})), operatives })
const FLAGGED = new Set(['LM active -> self mismatch (forgery)', 'LM single assignedManagerUserId'])
const t = (name, fn) =>
  test(name, async () => {
    const r = await fn()
    assert.ok(r.n >= 1, `${name}: the app put no line in the report`)
    assert.equal(r.ok, !FLAGGED.has(name), `${name}: ${JSON.stringify(r.p)}`)
    if (FLAGGED.has(name)) assert.deepEqual(r.p, ['self_reviewed:mismatch'])
  })

t('former id', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', formerUserIds: ['OLDINV'], assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, bookings: { 'bookings/B1': lab('OLDINV') }, userName: 'Sam Smith', personIds: ['sam', 'OLDINV'] }) })
t('mixed-case id', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, bookings: { 'bookings/B1': lab('SAM') }, userName: 'Sam Smith', personIds: ['sam'] }) })
t('operatives row on email', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, operatives: { OP1: { email: 'sam@x.com' } }, bookings: { 'bookings/B1': lab('OP1') }, userName: 'Sam Smith', personIds: ['sam', 'OP1'] }) })
t('operatives row mixed-case email', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, operatives: { OP1: { email: 'Sam@X.com' } }, bookings: { 'bookings/B1': lab('OP1') }, userName: 'Sam Smith', personIds: ['sam', 'OP1'] }) })
t('operatives row email with spaces', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, operatives: { OP1: { email: ' sam@x.com ' } }, bookings: { 'bookings/B1': lab('OP1') }, userName: 'Sam Smith', personIds: ['sam', 'OP1'] }) })
t('same-email users doc not listed', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', organizationId: ORG, assignedManagerUserIds: ['lee'] }, sam2: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', organizationId: ORG }, lee }
  const ids = appPersonIds({ id: 'sam', data: users.sam }, [{ id: 'sam', data: users.sam }, { id: 'sam2', data: users.sam2 }, { id: 'lee', data: lee }], [])
  return run({ users, bookings: { 'bookings/B1': lab('sam2') }, userName: 'Sam Smith', personIds: ids }).then((r) => ({ appIds: ids, ...r })) })
t('same-email listed', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', sameEmailUserIds: ['sam2'], assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, bookings: { 'bookings/B1': lab('sam2') }, userName: 'Sam Smith', personIds: ['sam', 'sam2'] }) })
t('msb under users id', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, bookings: { 'managerSiteBookings/M1': { userId: 'sam', locationType: 'project', locationId: 'P1', date: { seconds: mid('2026-11-05') / 1000 }, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' } }, userName: 'Sam Smith', personIds: ['sam'] }) })
t('userName blank', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com' } }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, userName: '', companyName: '', personIds: ['sam'] }) })
t('name only email (iOS fullName)', () => { const users = { sam: { firstName: '', surname: '', email: 'Sam@X.com' } }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, userName: 'Sam@X.com', personIds: ['sam'] }) })
t('name stored as displayName', () => { const users = { sam: { displayName: 'Sam Smith', email: 's@x.com' } }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, userName: 'Sam Smith', personIds: ['sam'] }) })
t('company stored as companyName', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith' } }
  const saved = org.name; delete org.name; org.companyName = 'Acme Ltd'
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, userName: 'Sam Smith', companyName: '', personIds: ['sam'] }).finally(() => { org.name = saved; delete org.companyName }) })
t('super admin (creator) with LM self-confirms', () => { const users = { boss: { firstName: 'Bo', surname: 'Ss', email: 'b@x.com', organizationId: ORG, adminAccess: true, assignedManagerUserIds: ['lee'] }, lee }
  return run({ subjectId: 'boss', users, bookings: { 'bookings/B1': lab('boss') }, reviewer: 'boss', userName: 'Bo Ss', personIds: ['boss'] }) })
t('isSuperAdmin flag with LM self-confirms', () => { const users = { sa: { firstName: 'Su', surname: 'Pa', email: 's@x.com', organizationId: ORG, isSuperAdmin: true, assignedManagerUserIds: ['lee'] }, lee }
  return run({ subjectId: 'sa', users, bookings: { 'bookings/B1': lab('sa') }, reviewer: 'sa', userName: 'Su Pa', personIds: ['sa'] }) })
t('LM inactive -> self ok', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', assignedManagerUserIds: ['lee'] }, lee: { ...lee, isActive: false } }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, reviewer: 'sam', userName: 'Sam Smith', personIds: ['sam'] }) })
t('LM active -> self mismatch (forgery)', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, reviewer: 'sam', userName: 'Sam Smith', personIds: ['sam'] }) })
t('LM single assignedManagerUserId', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', assignedManagerUserId: 'lee' }, lee }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, reviewer: 'sam', userName: 'Sam Smith', personIds: ['sam'] }) })
t('LM via permissions-only operative level lee', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', assignedManagerUserIds: ['lee'] }, lee: { firstName: 'Lee', operativeMode: true } }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, reviewer: 'sam', userName: 'Sam Smith', personIds: ['sam'] }) })
t('hasNoLineManager true with stale ids', () => { const users = { sam: { firstName: 'Sam', surname: 'Smith', adminAccess: true, hasNoLineManager: true, assignedManagerUserIds: ['lee'] }, lee }
  return run({ users, bookings: { 'bookings/B1': lab('sam') }, reviewer: 'sam', userName: 'Sam Smith', personIds: ['sam'] }) })

test('claims: an item filed under an unlisted same-email users document is the person\'s', async () => {
  const docs = {
    [`organizations/${ORG}`]: org,
    'users/sam': { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', organizationId: ORG },
    'users/sam2': { firstName: 'Sam', surname: 'Smith', email: 'SAM@x.com ', organizationId: ORG },
    [`organizations/${ORG}/expenseItems/E1`]: { userId: 'sam2', title: 'Fuel', date: '2026-11-05', amount: 12, currency: 'GBP', evidence: [] },
  }
  const item = canonical.parseExpenseDocument('E1', docs[`organizations/${ORG}/expenseItems/E1`], { timeZone: TZ, organizationId: ORG })
  const snap = canonical.payeClaimReportSnapshot({ kind: 'expense', userId: 'sam', userName: 'Sam Smith', currency: 'GBP', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', items: [item], generatedBy: 'sam' })
  const check = createReportIntegrityCheck({ store: fakeStore(docs), canonical, logger, serverTimestamp: () => 'T' })
  const ok = await check.handle({ orgId: ORG, collection: 'payeClaimReports', reportId: 'C', report: JSON.parse(JSON.stringify(snap)) })
  assert.equal(ok.ok, true, JSON.stringify(ok.problems))
  docs[`organizations/${ORG}/expenseItems/E1`] = { ...docs[`organizations/${ORG}/expenseItems/E1`], userId: 'ann' }
  const other = await check.handle({ orgId: ORG, collection: 'payeClaimReports', reportId: 'C', report: JSON.parse(JSON.stringify(snap)) })
  assert.deepEqual(other.problems.map((p) => p.code), ['not_their_item'])
})

test('sixth check: field masks on the roster reads, and the line reads start alongside the organisation read', async () => {
  const docs = {
    [`organizations/${ORG}`]: org,
    'users/sam': { firstName: 'Sam', surname: 'Smith', email: 'sam@x.com', organizationId: ORG },
    [`organizations/${ORG}/operatives/OP1`]: { email: 'SAM@x.com ' },
  }
  const base = fakeStore(docs)
  const calls = []
  let releaseOrg
  const orgGate = new Promise((resolve) => { releaseOrg = resolve })
  const store = {
    ...base,
    async getDoc(p) {
      calls.push(['get', p])
      if (p === `organizations/${ORG}`) await orgGate
      return base.getDoc(p)
    },
    async query(cp, f, v, fields) { calls.push(['query', cp, fields]); return base.query(cp, f, v) },
    async list(cp, fields) { calls.push(['list', cp, fields]); return base.list(cp) },
  }
  const report = { userId: 'sam', kind: 'overtime', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines: [{ bookingId: 'B1', dayKey: '2026-11-05', overtimeHours: 0 }], totals: { overtimeHours: 0, lineCount: 1 } }
  const run = createReportIntegrityCheck({ store, canonical, logger, serverTimestamp: () => 'T' }).handle({ orgId: ORG, collection: 'overtimeReports', reportId: 'R', report })
  // While the organisation read is still waiting, the line's booking and review reads have already started.
  await new Promise((resolve) => setImmediate(resolve))
  assert.ok(calls.some(([kind, p]) => kind === 'get' && p === `organizations/${ORG}/bookings/B1`))
  assert.ok(calls.some(([kind, p]) => kind === 'get' && p === `organizations/${ORG}/overtimeReviews/sam_B1`))
  releaseOrg()
  await run
  const usersQuery = calls.find(([kind, p]) => kind === 'query' && p === 'users')
  assert.ok(usersQuery, 'the organisation roster is read')
  for (const field of ['email', 'formerUserIds', 'sameEmailUserIds', 'isActive']) assert.ok(usersQuery[2].includes(field), field)
  assert.deepEqual(calls.find(([kind, p]) => kind === 'list' && p === `organizations/${ORG}/operatives`)[2], ['email'])
})
