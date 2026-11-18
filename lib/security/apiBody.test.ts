import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiFlag, apiNumber, apiObject, apiText, parseApiBody, readApiBody } from './apiBody'

const PRIVILEGE_KEYS = {
  role: 'admin',
  isAdmin: true,
  isSuperAdmin: true,
  adminAccess: true,
  organizationId: 'someone-elses-org',
  permissions: { adminAccess: true },
  passwordSet: true,
}

const schema = apiObject({
  name: apiText(20),
  count: apiNumber(),
  flag: apiFlag(),
  rows: z.array(apiObject({ email: apiText(50) })).optional(),
})

function jsonRequest(body: unknown): NextRequest {
  const text = JSON.stringify(body)
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)) },
    body: text,
  })
}

test('strip mode: role / isAdmin / isSuperAdmin / organizationId and every other unknown key are dropped', () => {
  const parsed = parseApiBody({ name: ' Ann ', ...PRIVILEGE_KEYS, rows: [{ email: 'a@x.com', role: 'admin' }] }, schema)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  // Only schema keys come back (a missing optional number is simply absent).
  for (const key of Object.keys(parsed.value)) assert.ok(['count', 'flag', 'name', 'rows'].includes(key), key)
  assert.equal(parsed.value.name, 'Ann')
  assert.equal(parsed.value.flag, false)
  assert.equal(parsed.value.count, undefined)
  // Nested objects strip their unknown keys too.
  assert.deepEqual(parsed.value.rows, [{ email: 'a@x.com' }])
  for (const key of Object.keys(PRIVILEGE_KEYS)) assert.equal(key in parsed.value, false, key)
})

test('strict mode: any unknown key refuses the request', () => {
  const parsed = parseApiBody({ name: 'Ann', isSuperAdmin: true }, schema, 'strict')
  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.match(parsed.error, /does not accept/)
  assert.equal(parseApiBody({ name: 'Ann' }, schema, 'strict').ok, true)
})

test('field helpers never throw on the wrong type and cap text', () => {
  const parsed = parseApiBody({ name: 42, count: '7', flag: 'true' }, schema)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.name, '')
  assert.equal(parsed.value.count, undefined)
  assert.equal(parsed.value.flag, false)
  const long = parseApiBody({ name: 'x'.repeat(100) }, schema)
  assert.equal(long.ok && long.value.name.length, 20)
})

test('readApiBody: privilege keys never reach the route; bad JSON, arrays and oversize bodies are refused', async () => {
  const ok = await readApiBody(jsonRequest({ name: 'Ann', ...PRIVILEGE_KEYS }), schema)
  assert.equal(ok.ok, true)
  if (ok.ok) for (const key of Object.keys(PRIVILEGE_KEYS)) assert.equal(key in ok.value, false, key)

  const strict = await readApiBody(jsonRequest({ name: 'Ann', role: 'admin' }), schema, { mode: 'strict' })
  assert.equal(strict.ok, false)
  if (!strict.ok) assert.equal(strict.response.status, 400)

  const array = await readApiBody(jsonRequest([{ name: 'Ann' }]), schema)
  assert.equal(array.ok, false)

  const broken = new NextRequest('http://localhost/api/test', { method: 'POST', body: '{"name":' })
  const bad = await readApiBody(broken, schema)
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.equal(bad.response.status, 400)

  const big = await readApiBody(jsonRequest({ name: 'x'.repeat(5000) }), schema, { maxBytes: 100 })
  assert.equal(big.ok, false)
  if (!big.ok) assert.equal(big.response.status, 413)

  const empty = await readApiBody(new NextRequest('http://localhost/api/test', { method: 'POST' }), schema)
  assert.equal(empty.ok, true)
})
