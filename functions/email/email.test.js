'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { nextRateLimitState, USER_LIMITS } = require('./rateLimit')
const { parseAttachments, MAX_TOTAL_BYTES } = require('./attachments')
const { resolveRecipients } = require('./recipients')
const { TEMPLATES, SERVER_TEMPLATES } = require('./templates')
const { createSendEmailHandler, resendSender, sameSecret } = require('./handler')

const ORG = 'org-1'
const INVITE_ID = '3f2c8a51-7d1e-4b6a-9c0f-2a4b6c8d0e1f'
const pdf = (bytes = 3) => Buffer.alloc(bytes, 1).toString('base64')

// ---------------------------------------------------------------------------------------------------------------
// Fixture organisation: admin A, manager M, operative O (all active), operative X deactivated, stranger S elsewhere.

function fixture(overrides = {}) {
  const users = {
    A: { email: 'admin@example.com', firstName: 'Ada', surname: 'Admin', organizationId: ORG, adminAccess: true, role: 'admin' },
    M: { email: 'manager@example.com', firstName: 'Max', surname: 'Manager', organizationId: ORG, role: 'manager', manager: true },
    O: { email: 'op@example.com', firstName: 'Oli', surname: 'Op', organizationId: ORG, role: 'operative', operativeMode: true },
    X: { email: 'gone@example.com', firstName: 'Xena', organizationId: ORG, role: 'operative', isActive: false },
    S: { email: 'stranger@example.com', firstName: 'Sam', organizationId: 'other-org', role: 'admin', adminAccess: true },
    ...overrides.users,
  }
  const org = {
    name: 'Acme <Builders> Ltd',
    countryCode: 'GB',
    creatorUserId: 'A',
    members: { A: 'admin', M: 'manager', O: 'operative', X: 'operative' },
    ...overrides.org,
  }
  const invitations = {
    [INVITE_ID]: { email: 'new.person@example.com', organizationId: ORG, firstName: 'Nia', isUsed: false },
    ...overrides.invitations,
  }
  const wholesalers = [
    { id: 'w1', data: { name: 'Pipes R Us', contacts: [{ name: 'Wendy Holesale', email: 'Wendy@Pipes.example' }] } },
  ]
  const reader = {
    getOrganization: async (id) => (id === ORG ? org : null),
    getUser: async (uid) => users[uid] || null,
    getMembership: async () => null,
    getInvitation: async (id) => invitations[id] || null,
    usersByEmail: async (email) =>
      Object.entries(users)
        .filter(([, data]) => String(data.email).toLowerCase() === email)
        .map(([id, data]) => ({ id, data })),
    listWholesalers: async () => wholesalers,
  }
  return { org, users, reader }
}

function makeHandler(options = {}) {
  const { org, users, reader } = fixture(options.fixture)
  const sent = []
  const logs = []
  const rateCalls = []
  const handler = createSendEmailHandler({
    verifyIdToken: async (token) => {
      if (!token.startsWith('token-')) throw new Error('bad token')
      const uid = token.slice(6)
      return { uid, email: users[uid] ? users[uid].email : `${uid}@example.com` }
    },
    verifyAppCheck: async (token) => {
      if (token !== 'good-app-check') throw new Error('bad app check')
    },
    reader,
    consumeRateLimit: async (key, count, limits) => {
      rateCalls.push({ key, count, limits })
      return options.rateLimited ? { allowed: false, retryAfterSec: 120 } : { allowed: true }
    },
    sendMessage: async (message) => {
      if (options.providerFails) throw new Error('provider down')
      sent.push(message)
      return { id: `msg-${sent.length}` }
    },
    serverKey: () => options.serverKey ?? 'server-secret',
    logger: { info: (...a) => logs.push(['info', ...a]), warn: (...a) => logs.push(['warn', ...a]), error: (...a) => logs.push(['error', ...a]) },
    now: () => new Date('2026-11-03T09:15:00Z'),
  })
  return { handler, sent, logs, rateCalls, org }
}

async function call(handler, { headers = {}, body, method = 'POST' }) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  const req = { method, body, get: (name) => lower[name.toLowerCase()] || '' }
  const res = {
    code: 0,
    payload: null,
    headers: {},
    status(code) {
      this.code = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
    set(name, value) {
      this.headers[name] = value
      return this
    },
  }
  await handler(req, res)
  return res
}

const auth = (uid) => ({ Authorization: `Bearer token-${uid}` })

// ---------------------------------------------------------------------------------------------------------------
// Rate limiter

test('rate limit: counts every message in fixed hour and day windows', () => {
  const t0 = Date.UTC(2026, 10, 3, 9, 0, 0)
  let state = null
  for (let i = 0; i < 60; i += 1) {
    const step = nextRateLimitState(state, t0 + i * 1000, 1, USER_LIMITS)
    assert.equal(step.allowed, true)
    state = step.next
  }
  const blocked = nextRateLimitState(state, t0 + 61_000, 1, USER_LIMITS)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.scope, 'hour')
  assert.equal(blocked.retryAfterSec, 3600 - 61)
  // Next hour: the hour count restarts, the day count carries on.
  const nextHour = nextRateLimitState(state, t0 + 3_600_000, 1, USER_LIMITS)
  assert.equal(nextHour.allowed, true)
  assert.equal(nextHour.next.hourCount, 1)
  assert.equal(nextHour.next.dayCount, 61)
})

test('rate limit: the day cap holds across hours, and a batch larger than what is left is refused whole', () => {
  const t0 = Date.UTC(2026, 10, 3, 0, 0, 0)
  const state = { hourStart: t0 + 5 * 3_600_000, hourCount: 0, dayStart: t0, dayCount: 299 }
  const blocked = nextRateLimitState(state, t0 + 5 * 3_600_000, 2, USER_LIMITS)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.scope, 'day')
  assert.equal(nextRateLimitState(state, t0 + 5 * 3_600_000, 1, USER_LIMITS).allowed, true)
  assert.equal(nextRateLimitState(state, t0 + 24 * 3_600_000, 2, USER_LIMITS).allowed, true, 'a new day resets')
})

// ---------------------------------------------------------------------------------------------------------------
// Attachments

test('attachments: PDF / XLSX / CSV only, content type from the extension, 10 MB total', () => {
  const parsed = parseAttachments(
    [
      { filename: 'Sheet.pdf', content: pdf(), type: 'text/html' },
      { fileName: 'pay.xlsx', content: pdf() },
      { filename: 'pay.csv', content: pdf() },
    ],
    ['pdf', 'xlsx', 'csv']
  )
  assert.deepEqual(parsed.map((row) => row.contentType), [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ])
  assert.throws(() => parseAttachments([{ filename: 'run.exe', content: pdf() }], ['pdf']), /Only PDF/)
  assert.throws(() => parseAttachments([{ filename: 'a.html', content: pdf() }], ['pdf']), /Only PDF/)
  assert.throws(() => parseAttachments([{ filename: '../a.pdf', content: pdf() }], ['pdf']), /plain file name/)
  assert.throws(() => parseAttachments([{ filename: 'a.pdf', content: 'not base64!' }], ['pdf']), /not base64/)
  assert.throws(() => parseAttachments([{ filename: 'a.pdf', content: pdf() }], []), /does not take attachments/)
  const half = pdf(MAX_TOTAL_BYTES / 2 + 3)
  assert.throws(
    () => parseAttachments([{ filename: 'a.pdf', content: half }, { filename: 'b.pdf', content: half }], ['pdf']),
    (error) => error.status === 413
  )
})

// ---------------------------------------------------------------------------------------------------------------
// Recipient rules

async function recipients(templateName, to, data = {}, callerEmail = 'manager@example.com') {
  const { org, reader } = fixture()
  return resolveRecipients(TEMPLATES[templateName], to, { orgId: ORG, org, data, caller: { email: callerEmail }, reader })
}

test("recipients: an invite goes only to its invitation's email, for an unused invitation of this organisation", async () => {
  const rows = await recipients('invite_setup', ['New.Person@example.com'], { invitationId: INVITE_ID })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].email, 'new.person@example.com')
  await assert.rejects(recipients('invite_setup', ['attacker@example.com'], { invitationId: INVITE_ID }), /invitation's email/)
  await assert.rejects(recipients('invite_setup', ['new.person@example.com'], { invitationId: 'nope' }), /invitationId/)
  await assert.rejects(
    recipients('invite_setup', ['new.person@example.com', 'x@example.com'], { invitationId: INVITE_ID }),
    /At most 1/
  )
  const { org, reader } = fixture({ invitations: { [INVITE_ID]: { email: 'new.person@example.com', organizationId: 'other-org' } } })
  await assert.rejects(
    resolveRecipients(TEMPLATES.invite_setup, ['new.person@example.com'], { orgId: ORG, org, data: { invitationId: INVITE_ID }, caller: {}, reader }),
    /does not belong/
  )
})

test('recipients: member templates reach active members of this organisation only', async () => {
  const rows = await recipients('timesheet_export', ['OP@example.com'])
  assert.equal(rows[0].userId, 'O')
  await assert.rejects(recipients('timesheet_export', ['gone@example.com']), /not an active member/)
  await assert.rejects(recipients('timesheet_export', ['stranger@example.com']), /not an active member/)
  await assert.rejects(recipients('timesheet_export', ['nobody@example.com']), /not an active member/)
})

test("recipients: a material request reaches the organisation's wholesaler contacts and the sender's own copy", async () => {
  const rows = await recipients('material_request', ['wendy@pipes.example', 'manager@example.com'])
  assert.deepEqual(rows.map((row) => [row.email, Boolean(row.isSelf), row.contactName || '']), [
    ['wendy@pipes.example', false, 'Wendy Holesale'],
    ['manager@example.com', true, ''],
  ])
  // Rulebook 1.15.0 `materialOrderRecipientCheck`: up to 3 typed addresses not saved on a wholesaler.
  const typed = await recipients('material_request', ['one@shop.example', 'two@shop.example', 'Three@shop.example', 'manager@example.com'])
  assert.deepEqual(typed.map((row) => [row.email, Boolean(row.isTyped), Boolean(row.isSelf)]), [
    ['one@shop.example', true, false],
    ['two@shop.example', true, false],
    ['three@shop.example', true, false],
    ['manager@example.com', false, true],
  ])
  await assert.rejects(
    recipients('material_request', ['wendy@pipes.example', 'a@x.example', 'b@x.example', 'c@x.example', 'd@x.example']),
    /at most 3 email addresses/
  )
  await assert.rejects(recipients('material_request', ['manager@example.com']), /Choose a wholesaler contact or add an email address/)
})

// ---------------------------------------------------------------------------------------------------------------
// Handler: authentication, membership, roles, templates

const inviteBody = { orgId: ORG, template: 'invite_setup', to: ['new.person@example.com'], data: { invitationId: INVITE_ID } }

test('handler: no token, a bad token or a GET is refused before anything is read or sent', async () => {
  const { handler, sent } = makeHandler()
  assert.equal((await call(handler, { body: inviteBody })).code, 401)
  assert.equal((await call(handler, { headers: { Authorization: 'Bearer forged' }, body: inviteBody })).code, 401)
  assert.equal((await call(handler, { method: 'GET', headers: auth('A'), body: inviteBody })).code, 405)
  assert.equal(sent.length, 0)
})

test('handler: App Check is verified when present and only logged when absent', async () => {
  const { handler, logs, sent } = makeHandler()
  const bad = await call(handler, { headers: { ...auth('A'), 'X-Firebase-AppCheck': 'forged' }, body: inviteBody })
  assert.equal(bad.code, 401)
  const good = await call(handler, { headers: { ...auth('A'), 'X-Firebase-AppCheck': 'good-app-check' }, body: inviteBody })
  assert.equal(good.code, 200)
  const none = await call(handler, { headers: auth('A'), body: inviteBody })
  assert.equal(none.code, 200)
  assert.ok(logs.some((row) => row[0] === 'warn' && /App Check/.test(row[1])))
  assert.equal(sent.length, 2)
})

test('handler: an invite renders server-side from a fixed address with the organisation as display name', async () => {
  const { handler, sent, rateCalls } = makeHandler()
  const res = await call(handler, { headers: auth('M'), body: { ...inviteBody, data: { ...inviteBody.data, html: '<b>evil</b>' }, fromName: 'PayPal' } })
  assert.equal(res.code, 200)
  assert.equal(res.payload.sent, true)
  assert.equal(sent.length, 1)
  const message = sent[0]
  assert.equal(message.from, '"Acme Builders Ltd" <info@projectplanner.us>')
  assert.deepEqual(message.to, ['new.person@example.com'])
  assert.equal(message.reply_to, 'info@projectplanner.us')
  assert.match(message.subject, /^Welcome to Project Planner — Acme <Builders> Ltd$/)
  assert.ok(message.html.includes(`https://www.projectplanner.us/setup-password.html?token=${INVITE_ID}`))
  assert.ok(message.html.includes('Acme &lt;Builders&gt; Ltd'))
  assert.ok(!message.html.includes('<b>evil</b>'))
  assert.deepEqual(rateCalls, [{ key: 'M', count: 1, limits: USER_LIMITS }])
})

test('handler: callers outside the organisation, deactivated callers and operatives on staff templates are refused', async () => {
  const { handler, sent } = makeHandler()
  assert.equal((await call(handler, { headers: auth('S'), body: inviteBody })).code, 403, 'admin of another company')
  assert.equal((await call(handler, { headers: auth('X'), body: inviteBody })).code, 403, 'deactivated')
  assert.equal((await call(handler, { headers: auth('O'), body: inviteBody })).code, 403, 'operative')
  assert.equal((await call(handler, { headers: auth('A'), body: { ...inviteBody, orgId: 'missing' } })).code, 404)
  assert.equal(sent.length, 0)
})

test('handler: an app cannot send free HTML (web_rendered is server only) or an unknown template', async () => {
  const { handler, sent } = makeHandler()
  const free = await call(handler, {
    headers: auth('A'),
    body: { orgId: ORG, template: 'web_rendered', to: ['victim@example.com'], data: { subject: 'Hi', html: '<a href="x">Login</a>' } },
  })
  assert.equal(free.code, 400)
  assert.equal((await call(handler, { headers: auth('A'), body: { ...inviteBody, template: 'anything' } })).code, 400)
  assert.equal(sent.length, 0)
})

test('handler: material request — admins and managers only (1.15.0 canSendMaterialOrders), contacts plus own copy, reply-to the sender', async () => {
  const { handler, sent } = makeHandler()
  const materialBody = {
    orgId: ORG,
    template: 'material_request',
    to: ['wendy@pipes.example'],
    data: { requestType: 'quote', jobNumber: 'J-1', materials: [{ material: 'Pipe', quantity: 1, unit: 'Number' }] },
  }
  const refused = await call(handler, { headers: auth('O'), body: materialBody })
  assert.equal(refused.code, 403)
  assert.match(refused.payload.error || JSON.stringify(refused.payload), /Only admins and managers can send quotes and orders/)
  assert.equal(sent.length, 0)
  assert.equal((await call(handler, { headers: auth('A'), body: materialBody })).code, 200)
  sent.length = 0
  const res = await call(handler, {
    headers: auth('M'),
    body: {
      orgId: ORG,
      template: 'material_request',
      to: ['wendy@pipes.example', 'manager@example.com'],
      data: {
        requestType: 'order',
        jobNumber: 'J-100',
        siteName: 'High St',
        siteAddress: '1 High St',
        deliveryRequiredAt: '2026-11-04T08:00:00Z',
        materials: [{ material: '22mm pipe', quantity: 4, unit: 'length' }],
      },
    },
  })
  assert.equal(res.code, 200, JSON.stringify(res.payload))
  assert.equal(sent.length, 2)
  assert.equal(sent[0].subject, 'Material order request — J-100 — Acme <Builders> Ltd')
  assert.equal(sent[1].subject, 'Copy: Material order request — J-100 — Acme <Builders> Ltd')
  assert.equal(sent[0].reply_to, 'manager@example.com')
  assert.ok(sent[0].html.includes('Hi Wendy,'))
  assert.ok(sent[0].html.includes('4 Lengths'))
  assert.ok(sent[0].html.includes('Wednesday 4 November at 08:00'))
  assert.ok(sent[0].html.includes('Tuesday, 3 November 2026 at 09:15'))
})

test('handler: timesheet export — staff only, a member recipient, PDF attachments, Storage-only links', async () => {
  const { handler, sent } = makeHandler()
  const body = {
    orgId: ORG,
    template: 'timesheet_export',
    to: ['manager@example.com'],
    data: { weekTitle: 'Week 44', paymentRunStamp: '26.10.26 01.11.26', timesheetCount: 1 },
    attachments: [{ filename: 'Oli Op timesheet.pdf', content: pdf(), type: 'application/pdf' }],
  }
  const ok = await call(handler, { headers: auth('M'), body })
  assert.equal(ok.code, 200, JSON.stringify(ok.payload))
  assert.equal(sent[0].attachments[0].content_type, 'application/pdf')
  assert.ok(sent[0].html.includes('Hello Max,'))
  assert.equal((await call(handler, { headers: auth('O'), body })).code, 403)
  const phishing = await call(handler, {
    headers: auth('M'),
    body: { ...body, data: { ...body.data, downloadLinks: [{ fileName: 'x.pdf', url: 'https://evil.example/x.pdf' }] } },
  })
  assert.equal(phishing.code, 400)
  const exe = await call(handler, { headers: auth('M'), body: { ...body, attachments: [{ filename: 'x.exe', content: pdf() }] } })
  assert.equal(exe.code, 400)
  assert.equal(sent.length, 1)
})

test('handler: rate limited senders get 429 with Retry-After and nothing is sent', async () => {
  const { handler, sent } = makeHandler({ rateLimited: true })
  const res = await call(handler, { headers: auth('A'), body: inviteBody })
  assert.equal(res.code, 429)
  assert.equal(res.headers['Retry-After'], '120')
  assert.equal(sent.length, 0)
})

test('handler: provider failure is a 502 with sent false', async () => {
  const { handler } = makeHandler({ providerFails: true })
  const res = await call(handler, { headers: auth('A'), body: inviteBody })
  assert.equal(res.code, 502)
  assert.equal(res.payload.sent, false)
})

// ---------------------------------------------------------------------------------------------------------------
// Web server mode

const webBody = { template: 'web_rendered', to: ['someone@example.com'], data: { subject: 'Your code', html: '<p>123456</p>', replyTo: 'visitor@example.com' } }

test('server mode: the server key is required and compared exactly; app templates are not available with it', async () => {
  const { handler, sent } = makeHandler()
  assert.equal((await call(handler, { headers: { 'X-Project-Planner-Server-Key': 'guess' }, body: webBody })).code, 401)
  const unset = makeHandler({ serverKey: '' })
  assert.equal((await call(unset.handler, { headers: { 'X-Project-Planner-Server-Key': 'server-secret' }, body: webBody })).code, 401)
  const appTemplate = await call(handler, { headers: { 'X-Project-Planner-Server-Key': 'server-secret' }, body: inviteBody })
  assert.equal(appTemplate.code, 400)
  assert.equal(sent.length, 0)
})

test('server mode: web_rendered sends the HTML the web route built, from the fixed address', async () => {
  const { handler, sent, rateCalls } = makeHandler()
  const res = await call(handler, {
    headers: { 'X-Project-Planner-Server-Key': 'server-secret', ...auth('A') },
    body: { ...webBody, orgId: ORG, fromName: 'PayPal', data: { ...webBody.data, headers: { 'List-Unsubscribe': '<https://x>', Bcc: 'all@example.com' } } },
  })
  assert.equal(res.code, 200, JSON.stringify(res.payload))
  assert.equal(sent[0].from, '"Acme Builders Ltd" <info@projectplanner.us>')
  assert.equal(sent[0].html, '<p>123456</p>')
  assert.equal(sent[0].reply_to, 'visitor@example.com')
  assert.deepEqual(sent[0].headers, { 'List-Unsubscribe': '<https://x>' })
  assert.equal(rateCalls[0].key, 'A')
  const anonymous = await call(handler, { headers: { 'X-Project-Planner-Server-Key': 'server-secret' }, body: webBody })
  assert.equal(anonymous.code, 200)
  assert.equal(sent[1].from, '"Project Planner" <info@projectplanner.us>')
  assert.equal(rateCalls[1].key, 'server')
  assert.equal(SERVER_TEMPLATES.web_rendered.maxRecipients, 1)
})

// ---------------------------------------------------------------------------------------------------------------
// Resend call (mocked fetch)

test('resendSender posts one message to Resend with the secret key', async () => {
  const calls = []
  const send = resendSender(() => 're_test', async (url, init) => {
    calls.push({ url, init })
    return { ok: true, text: async () => JSON.stringify({ id: 'abc' }) }
  })
  const result = await send({ from: 'x', to: ['a@example.com'], subject: 's', html: 'h' })
  assert.equal(result.id, 'abc')
  assert.equal(calls[0].url, 'https://api.resend.com/emails')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test')
  const failing = resendSender('re_test', async () => ({ ok: false, status: 422, text: async () => 'bad' }))
  await assert.rejects(failing({}), /Resend 422/)
  await assert.rejects(resendSender('')({}), /RESEND_API_KEY/)
})

test('server mode: a stored key or header with a trailing newline or spaces still matches (trimmed both sides)', async () => {
  assert.equal(sameSecret('server-secret', 'server-secret\n'), true)
  assert.equal(sameSecret(' server-secret\r\n', 'server-secret'), true)
  assert.equal(sameSecret('server-secret', 'server-secret2'), false)
  assert.equal(sameSecret('   ', '   '), false)
  assert.equal(sameSecret('', ''), false)
  assert.equal(sameSecret(undefined, 'server-secret'), false)
  const fromFile = makeHandler({ serverKey: 'server-secret\n' })
  const res = await call(fromFile.handler, { headers: { 'X-Project-Planner-Server-Key': 'server-secret' }, body: webBody })
  assert.equal(res.code, 200, JSON.stringify(res.payload))
  const blank = makeHandler({ serverKey: '\n' })
  assert.equal((await call(blank.handler, { headers: { 'X-Project-Planner-Server-Key': 'server-secret' }, body: webBody })).code, 401)
})
