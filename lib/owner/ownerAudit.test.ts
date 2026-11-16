import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import {
  OWNER_AUDIT_FIELDS,
  OWNER_AUDIT_PHASES,
  OwnerAuditUnavailableError,
  beginOwnerAudit,
  ownerAuditDocumentFields,
  recordOwnerEvent,
  sanitizeAuditDetail,
} from './ownerAudit.ts'

const realFetch = globalThis.fetch
const realProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
afterEach(() => {
  globalThis.fetch = realFetch
  if (realProject === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = realProject
})

type Written = { url: string; fields: Record<string, { stringValue?: string; timestampValue?: string }> }

function captureWrites(okStatuses: number[] = []): Written[] {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  const writes: Written[] = []
  let call = 0
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const status = okStatuses[call] ?? 200
    call += 1
    writes.push({ url: String(url), fields: JSON.parse(String(init.body)).fields })
    return new Response('{}', { status })
  }) as typeof fetch
  return writes
}

function request(): NextRequest {
  return new NextRequest('http://localhost/api/owner/x', {
    method: 'POST',
    headers: { authorization: 'Bearer owner-token', 'user-agent': 'Playwright/1', 'x-forwarded-for': '203.0.113.9' },
  })
}

const fixedNow = () => new Date('2026-11-16T10:00:00.000Z')

test('A4: requested is written first, then completed with the same requestId and every A4 field', async () => {
  const writes = captureWrites()
  const run = await beginOwnerAudit(
    request(),
    'owner-uid',
    { action: 'ownerMarkInternal', targetOrgId: 'org-1', reason: 'mark the demo company', before: { isInternal: false } },
    { requestId: 'req-1', now: fixedNow }
  )
  assert.equal(writes.length, 1)
  assert.equal(writes[0].fields.phase.stringValue, 'requested')
  assert.equal(await run.complete({ isInternal: true }), true)
  assert.equal(writes.length, 2)
  const [requested, completed] = writes
  assert.ok(requested.url.endsWith('/adminAuditLog'))
  assert.equal(requested.fields.requestId.stringValue, 'req-1')
  assert.equal(completed.fields.requestId.stringValue, 'req-1')
  assert.equal(completed.fields.phase.stringValue, 'completed')
  assert.equal(completed.fields.actorUid.stringValue, 'owner-uid')
  assert.equal(completed.fields.targetOrgId.stringValue, 'org-1')
  assert.equal(completed.fields.reason.stringValue, 'mark the demo company')
  assert.equal(completed.fields.before.stringValue, '{"isInternal":false}')
  assert.equal(completed.fields.after.stringValue, '{"isInternal":true}')
  assert.equal(completed.fields.ip.stringValue, '203.0.113.9')
  assert.equal(completed.fields.userAgent.stringValue, 'Playwright/1')
  assert.equal(completed.fields.at.timestampValue, '2026-11-16T10:00:00.000Z')
  for (const key of Object.keys(completed.fields)) assert.ok((OWNER_AUDIT_FIELDS as readonly string[]).includes(key), key)
})

test('A4: when requested cannot be stored, beginOwnerAudit throws and no second write happens', async () => {
  const writes = captureWrites([403])
  await assert.rejects(
    beginOwnerAudit(request(), 'owner-uid', { action: 'x' }, { requestId: 'r', now: fixedNow }),
    OwnerAuditUnavailableError
  )
  assert.equal(writes.length, 1)
})

test('A4: a failed completion is reported as false, never thrown (the action already happened)', async () => {
  captureWrites([200, 500])
  const run = await beginOwnerAudit(request(), 'owner-uid', { action: 'x' }, { requestId: 'r', now: fixedNow })
  assert.equal(await run.complete(), false)
})

test('A4: fail records phase failed and the error text', async () => {
  const writes = captureWrites()
  const run = await beginOwnerAudit(request(), 'owner-uid', { action: 'x' }, { requestId: 'r', now: fixedNow })
  await run.fail(new Error('Firestore said no'))
  assert.equal(writes[1].fields.phase.stringValue, 'failed')
  assert.match(String(writes[1].fields.after.stringValue), /Firestore said no/)
})

test('A4: recordOwnerEvent writes one completed entry and throws when not stored', async () => {
  const writes = captureWrites()
  const id = await recordOwnerEvent(request(), 'owner-uid', { action: 'ownerRevealEmail', targetUserId: 'u1' }, { requestId: 'e1', now: fixedNow })
  assert.equal(id, 'e1')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].fields.phase.stringValue, 'completed')
  captureWrites([500])
  await assert.rejects(recordOwnerEvent(request(), 'owner-uid', { action: 'y' }), OwnerAuditUnavailableError)
})

test('A4: no token or project means the audit is unavailable', async () => {
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const bare = new NextRequest('http://localhost/api/owner/x', { method: 'POST' })
  await assert.rejects(beginOwnerAudit(bare, 'owner-uid', { action: 'x' }), OwnerAuditUnavailableError)
})

test('A4: emails are masked and pay, tax and secret keys never stored, at any depth', () => {
  const out = sanitizeAuditDetail({
    email: 'jane.smith@example.com',
    dayRate: 250,
    hourlyRate: 30,
    payBasis: 'day',
    taxIds: { utr: '1234567890' },
    nested: { otherEmail: 'bob@example.co.uk', password: 'x', idToken: 'y', separate: 'kept', passwordSet: true },
    list: ['a@b.co', 'plain'],
  })
  assert.deepEqual(out, {
    email: 'j•••@example.com',
    nested: { otherEmail: 'b•••@example.co.uk', separate: 'kept', passwordSet: true },
    list: ['a•••@b.co', 'plain'],
  })
})

test('A4: long fields are clipped and the phase list is the three phases', () => {
  const fields = ownerAuditDocumentFields({
    requestId: 'r',
    action: 'a'.repeat(200),
    phase: 'requested',
    actorUid: 'u',
    reason: 'x'.repeat(900),
    after: { note: 'y'.repeat(4000) },
    userAgent: 'z'.repeat(800),
    atIso: '2026-11-16T10:00:00.000Z',
  }) as Record<string, { stringValue: string }>
  assert.equal(fields.action.stringValue.length, 80)
  assert.equal(fields.reason.stringValue.length, 500)
  assert.equal(fields.after.stringValue.length, 1500)
  assert.equal(fields.userAgent.stringValue.length, 300)
  assert.equal('targetOrgId' in fields, false)
  assert.deepEqual([...OWNER_AUDIT_PHASES], ['requested', 'completed', 'failed'])
})

test('review #348 L7: emails are masked anywhere inside a text, in details, reason and the failure text', async () => {
  assert.deepEqual(sanitizeAuditDetail({ note: 'moved from jane.smith@example.com to bob@example.co.uk today' }), {
    note: 'moved from j•••@example.com to b•••@example.co.uk today',
  })
  const fields = ownerAuditDocumentFields({
    requestId: 'r', action: 'x', phase: 'requested', actorUid: 'u', atIso: '2026-11-16T10:00:00.000Z',
    reason: 'customer jane@acme.co.uk asked',
  }) as Record<string, { stringValue: string }>
  assert.equal(fields.reason.stringValue, 'customer j•••@acme.co.uk asked')
  const writes = captureWrites()
  const run = await beginOwnerAudit(request(), 'owner-uid', { action: 'x' }, { requestId: 'r', now: fixedNow })
  await run.fail(new Error('EMAIL_EXISTS for someone@else.example'))
  assert.match(String(writes[1].fields.after.stringValue), /s•••@else\.example/)
  assert.doesNotMatch(String(writes[1].fields.after.stringValue), /someone@/)
})

test('review #348: a refused action can be recorded as failed', async () => {
  const writes = captureWrites()
  await recordOwnerEvent(request(), 'owner-uid', { action: 'ownerDeleteOrganisation.blocked' }, { phase: 'failed' })
  assert.equal(writes[0].fields.phase.stringValue, 'failed')
})
