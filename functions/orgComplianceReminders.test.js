'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const canonical = require('./loadCanonical')
const { createOrgComplianceReminders, renderOrgComplianceReminderEmail } = require('./orgComplianceReminders')

// Rulebook 1.85.0 §31: the daily insurance & accreditation expiry reminder (reads, sends, ledger; the rule is the rulebook's).

const ORG = 'org-1'
// 31 Jan 2027 08:00 London: the 2-month threshold of a 31 Mar 2027 expiry.
const NOW = Date.parse('2027-01-31T08:00:00Z')
const SET = Date.parse('2026-06-01T10:00:00Z')

function entry(id, expiresOn) {
  return {
    id,
    docType: 'public_liability',
    title: `Public liability ${id}`,
    expiresOn,
    path: `organizations/${ORG}/compliance/u1_${id}.pdf`,
    fileName: 'pl.pdf',
    contentType: 'application/pdf',
    uploadedAtMs: SET,
    updatedAtMs: SET,
    uploadedBy: 'admin',
    updatedBy: 'admin',
  }
}

function storeWith({ enabled = true, documents, ledger = null, org = {} }) {
  const state = { ledger, writes: 0 }
  return {
    state,
    store: {
      remindersEnabled: async () => enabled,
      complianceDocuments: async () => [{ orgId: ORG, documents, ledger: state.ledger }],
      organization: async () => ({ name: 'Acme Ltd', countryCode: 'GB', creatorUserId: 'admin', members: { admin: 'admin' }, ...org }),
      users: async () => [
        { id: 'admin', data: { organizationId: ORG, email: 'Boss@acme.test', firstName: 'Bea', isSuperAdmin: true, passwordSet: true } },
        { id: 'admin2', data: { organizationId: ORG, email: 'two@acme.test', firstName: 'Al', adminAccess: true, passwordSet: true } },
        { id: 'mgr', data: { organizationId: ORG, email: 'm@acme.test', manager: true, passwordSet: true } },
      ],
      writeLedger: async (_orgId, fields) => {
        state.ledger = fields
        state.writes += 1
      },
    },
  }
}

const quiet = { info() {}, warn() {}, error() {} }

test('1.85.0 sends one branded email per admin, then never again for that threshold', async () => {
  const { store, state } = storeWith({ documents: { documents: { insurance: [entry('a', '2027-03-31')] } } })
  const sent = []
  const run = createOrgComplianceReminders({ store, canonical, sendEmail: async (m, o) => sent.push({ m, o }), logger: quiet, now: () => NOW })
  const report = await run.run()
  assert.equal(report[0].delivered, 2)
  assert.deepEqual(sent.map((s) => s.m.to[0]).sort(), ['boss@acme.test', 'two@acme.test'])
  assert.match(sent[0].m.subject, /Public liability a expires 31 Mar 2027 — Acme Ltd/)
  assert.match(sent[0].m.html, /Open Insurance &amp; accreditations/)
  assert.match(sent[0].o.idempotencyKey, /^orgComplianceReminder:org-1:admin2?:2027-01-31:[0-9a-f]{16}$/)
  assert.equal(state.ledger.entries['insurance:a'].sent.twoMonths, '2027-01-31')
  // Second run the same day: nothing sent, nothing written.
  sent.length = 0
  await run.run()
  assert.equal(sent.length, 0)
  assert.equal(state.writes, 1)
})

test('1.85.0 switch off: a dry run that sends and writes nothing', async () => {
  const { store, state } = storeWith({ enabled: false, documents: { documents: { insurance: [entry('a', '2027-03-31')] } } })
  const sent = []
  const logs = []
  const logger = { info: (...a) => logs.push(a), warn() {}, error() {} }
  const report = await createOrgComplianceReminders({ store, canonical, sendEmail: async (m) => sent.push(m), logger, now: () => NOW }).run()
  assert.equal(sent.length, 0)
  assert.equal(report[0].dryRun, true)
  // Review of #447: the dry run records the set day (never a send), so an edit before switch-on cannot move it.
  assert.equal(state.writes, 1)
  assert.equal(state.ledger.entries['insurance:a'].setDayKey, '2026-06-01')
  assert.equal(JSON.stringify(state.ledger.entries['insurance:a'].sent), '{}')
  assert.ok(logs.some(([msg]) => /dry run, switch off/.test(msg)))
})

test('1.85.0 every send failing marks nothing sent (retried the next day)', async () => {
  const { store, state } = storeWith({ documents: { documents: { insurance: [entry('a', '2027-03-31')] } } })
  await createOrgComplianceReminders({
    store,
    canonical,
    sendEmail: async () => {
      throw new Error('Resend 500')
    },
    logger: quiet,
    now: () => NOW,
  }).run()
  assert.equal(JSON.stringify(state.ledger.entries['insurance:a'].sent), '{}')
})

test('1.85.0 a lapsed or deleted organisation is skipped', async () => {
  const { store } = storeWith({
    documents: { documents: { insurance: [entry('a', '2027-03-31')] } },
    org: { deletion: { status: 'scheduled', eraseAfter: '2027-02-28T00:00:00Z' } },
  })
  const sent = []
  const report = await createOrgComplianceReminders({ store, canonical, sendEmail: async (m) => sent.push(m), logger: quiet, now: () => NOW }).run()
  assert.equal(sent.length, 0)
  assert.ok(report[0].skipped)
})

test('1.85.0 the rendered email escapes document titles', () => {
  const words = canonical.orgComplianceReminderEmail({
    organizationName: 'A&B',
    reminders: [{ section: 'insurance', sectionTitle: 'PI', entryId: 'x', title: '<b>x</b>', docTypeLabel: 'PL', expiresOn: '2027-03-31', threshold: 'sevenDays', thresholdLabel: '7 days', daysLeft: 7 }],
  })
  const out = renderOrgComplianceReminderEmail(words, { firstName: 'Bea' })
  assert.ok(!out.html.includes('<b>x</b>'))
  assert.match(out.html, /&lt;b&gt;x&lt;\/b&gt;/)
  assert.match(out.text, /Expires in 7 days/)
})

test('1.85.0 review: the ledger is claimed before any email; a failed write sends nothing', async () => {
  const { store, state } = storeWith({ documents: { documents: { insurance: [entry('a', '2027-03-31')] } } })
  const order = []
  store.writeLedger = async (_orgId, fields) => {
    order.push(`write:${JSON.stringify(fields.entries['insurance:a'].sent)}`)
    state.ledger = fields
  }
  await createOrgComplianceReminders({ store, canonical, sendEmail: async () => order.push('send'), logger: quiet, now: () => NOW }).run()
  assert.deepEqual(order, ['write:{"twoMonths":"2027-01-31"}', 'send', 'send'])
  const failing = storeWith({ documents: { documents: { insurance: [entry('a', '2027-03-31')] } } })
  failing.store.writeLedger = async () => {
    throw new Error('write refused')
  }
  const sent = []
  const report = await createOrgComplianceReminders({ store: failing.store, canonical, sendEmail: async (m) => sent.push(m), logger: quiet, now: () => NOW }).run()
  assert.equal(sent.length, 0)
  assert.ok(report[0].error)
})

test('1.85.0 review: failures are logged by status only, never the provider body', async () => {
  const { store } = storeWith({ documents: { documents: { insurance: [entry('a', '2027-03-31')] } } })
  const warns = []
  const logger = { info() {}, warn: (...a) => warns.push(JSON.stringify(a)), error() {} }
  await createOrgComplianceReminders({
    store,
    canonical,
    sendEmail: async () => {
      throw new Error('Resend 422: {"secret":"body text"}')
    },
    logger,
    now: () => NOW,
  }).run()
  assert.ok(warns.some((w) => w.includes('422')))
  assert.ok(!warns.some((w) => w.includes('body text')))
})

test('1.85.0 review: no first name greets with "Hello,"', () => {
  const words = canonical.orgComplianceReminderEmail({
    organizationName: 'Acme',
    reminders: [{ section: 'insurance', sectionTitle: 'PI', entryId: 'x', title: 'PL', docTypeLabel: 'PL', expiresOn: '2027-03-31', threshold: 'sevenDays', thresholdLabel: '7 days', daysLeft: 7 }],
  })
  assert.match(renderOrgComplianceReminderEmail(words, { firstName: '' }).text, /^Hello,\n/)
})
