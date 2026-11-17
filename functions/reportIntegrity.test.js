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
    userId: 'sam', kind: 'expense', currency: 'GBP',
    items: [{ id: 'E1', title: 'Fuel', amount: 400 }],
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

test('a failing store is logged, never thrown to the trigger', async () => {
  const store = { getDoc: async () => { throw new Error('down') }, query: async () => [], setDoc: async () => {} }
  const errors = []
  const check = createReportIntegrityCheck({ store, canonical, logger: { ...logger, error: (m) => errors.push(m) }, serverTimestamp: () => 'T' })
  assert.equal(await check.handle({ orgId: ORG, collection: 'payeClaimReports', reportId: 'P1', report: { items: [] } }), null)
  assert.equal(errors.length, 1)
})
