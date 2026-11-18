'use strict'
/** Fourth review of #391: real claims reports (built with `payeClaimReportSnapshot`) pass the server check. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const R = './'
const canonical = require(R + 'loadCanonical')
const { createReportIntegrityCheck } = require(R + 'reportIntegrity')
const ORG = 'org1'
const logger = { warn() {}, error() {}, info() {} }
function fakeStore(docs) { return { async getDoc(p) { return docs[p] ?? null }, async query() { return [] }, async setDoc() {} } }
const ev = (n) => ({ path: `organizations/${ORG}/payeClaims/sam/sam_17000000000${n}.jpg`, name: `r${n}.jpg`, kind: 'photo', contentType: 'image/jpeg' })
async function run(kind, orgDoc, itemDocs, opts = {}) {
  const docs = { [`organizations/${ORG}`]: orgDoc, 'users/sam': { firstName: 'Sam' } }
  const coll = kind === 'priceWork' ? 'priceWorkItems' : 'expenseItems'
  const items = []
  for (const [id, d] of Object.entries(itemDocs)) {
    docs[`organizations/${ORG}/${coll}/${id}`] = d
    items.push(kind === 'priceWork' ? canonical.parsePriceWorkDocument(id, d, { timeZone: 'Europe/London', organizationId: ORG }) : canonical.parseExpenseDocument(id, d, { timeZone: 'Europe/London', organizationId: ORG }))
  }
  const currency = canonical.resolveOrganizationCurrency(orgDoc)
  const snap = canonical.payeClaimReportSnapshot({ kind, userId: 'sam', userName: 'Sam', currency, rangeStart: '2026-10-26', rangeEnd: '2026-11-25', items, generatedBy: 'sam' })
  const report = JSON.parse(JSON.stringify(opts.mutate ? opts.mutate(snap) : snap))
  const check = createReportIntegrityCheck({ store: fakeStore(docs), canonical, logger, serverTimestamp: () => 'T' })
  return check.handle({ orgId: ORG, collection: 'payeClaimReports', reportId: 'C', report })
}
test('expense, several evidence files, EUR org, currency not on item', async () => {
  const r = await run('expense', { countryCode: 'IE' }, { E1: { userId: 'sam', title: 'Fuel', details: 'Van', jobNumber: 'J-1', date: '2026-11-05', amount: 40.5, evidence: [ev(1), ev(2), ev(3)] } })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
})
test('expense, GBP item date as Timestamp (BST)', async () => {
  const r = await run('expense', { countryCode: 'GB' }, { E1: { userId: 'sam', title: 'Fuel', date: { seconds: Date.parse('2026-10-26T23:00:00Z') / 1000 }, amount: 12, currency: 'GBP', evidence: [ev(1)] } })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
})
test('price work with approver', async () => {
  const r = await run('priceWork', { countryCode: 'GB', currencyCode: 'GBP' }, { W1: { userId: 'sam', title: 'Fit', details: 'x', jobNumber: 'J-2', startDate: '2026-11-03', endDate: '2026-11-07', approvedByUserId: 'lee', approvedByName: 'Lee Line', amount: 500, currency: 'GBP', evidence: [] } })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
})
test('price work, numeric jobNumber, no endDate', async () => {
  const r = await run('priceWork', { countryCode: 'GB' }, { W1: { userId: 'sam', title: 'Fit', jobNumber: 4521, startDate: '2026-11-03', approvedByName: 'Lee', amount: '500.00', evidence: [] } })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
})
test('forgery: approver name swapped', async () => {
  const r = await run('priceWork', { countryCode: 'GB' }, { W1: { userId: 'sam', title: 'Fit', jobNumber: 'J', startDate: '2026-11-03', endDate: '2026-11-03', approvedByName: 'Lee', amount: 500, evidence: [] } }, { mutate: (s) => { s.items[0].approvedByName = 'The Director'; return s } })
  assert.equal(r.ok, false)
})
test('forgery: evidence entry dropped', async () => {
  const r = await run('expense', { countryCode: 'GB' }, { E1: { userId: 'sam', title: 'Fuel', date: '2026-11-05', amount: 40, evidence: [ev(1), ev(2)] } }, { mutate: (s) => { s.items[0].evidence = [s.items[0].evidence[0]]; s.totals.evidenceCount = 1; return s } })
  assert.equal(r.ok, false)
})
test('forgery: report currency USD in GBP org', async () => {
  const r = await run('expense', { countryCode: 'GB' }, { E1: { userId: 'sam', title: 'Fuel', date: '2026-11-05', amount: 40, evidence: [ev(1)] } }, { mutate: (s) => { s.currency = 'USD'; return s } })
  assert.equal(r.ok, false)
})
