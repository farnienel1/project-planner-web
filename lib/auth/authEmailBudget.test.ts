import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { AUTH_EMAIL_BUDGET_COLLECTION, authEmailBudgetDocId, consumeAuthEmailBudget, nextAuthEmailBudget } from './authEmailBudget.ts'

const realFetch = globalThis.fetch
const realKey = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
afterEach(() => {
  globalThis.fetch = realFetch
  if (realKey === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = realKey
})

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  client_email: 'budget-test@demo.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  project_id: 'demo',
})
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

test('nextAuthEmailBudget: fixed window', () => {
  const hour = 3_600_000
  let state = nextAuthEmailBudget(null, 1000, 2, hour)
  assert.deepEqual(state, { allowed: true, next: { count: 1, windowStartMs: 1000 } })
  state = nextAuthEmailBudget({ count: 1, windowStartMs: 1000 }, 2000, 2, hour)
  assert.deepEqual(state, { allowed: true, next: { count: 2, windowStartMs: 1000 } })
  assert.deepEqual(nextAuthEmailBudget({ count: 2, windowStartMs: 1000 }, 3000, 2, hour), { allowed: false })
  assert.deepEqual(nextAuthEmailBudget({ count: 2, windowStartMs: 1000 }, 1000 + hour, 2, hour), {
    allowed: true,
    next: { count: 1, windowStartMs: 1000 + hour },
  })
})

test('doc id is a hash: no email address is stored, and case does not matter', () => {
  const id = authEmailBudgetDocId('password-reset', 'Sam@Firm.com')
  assert.equal(id, authEmailBudgetDocId('password-reset', 'sam@firm.com'))
  assert.match(id, /^[0-9a-f]{64}$/)
  assert.ok(!id.includes('sam'))
  assert.notEqual(id, authEmailBudgetDocId('verify-email', 'sam@firm.com'))
})

/** A tiny Firestore REST double for one collection with updateTime preconditions. */
function firestoreDouble() {
  const docs = new Map<string, { fields: Record<string, unknown>; updateTime: string }>()
  let clock = 0
  const writes: Array<{ path: string; body: Record<string, unknown> }> = []
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'oauth2.googleapis.com') return new Response(JSON.stringify({ access_token: 't' }))
    const path = decodeURIComponent(url.pathname.split('/documents/')[1] || '')
    if (!init?.method || init.method === 'GET') {
      const doc = docs.get(path)
      return doc ? new Response(JSON.stringify({ fields: doc.fields, updateTime: doc.updateTime })) : new Response('{}', { status: 404 })
    }
    const existing = docs.get(path)
    const mustNotExist = url.searchParams.get('currentDocument.exists') === 'false'
    const wantTime = url.searchParams.get('currentDocument.updateTime')
    if ((mustNotExist && existing) || (wantTime && existing?.updateTime !== wantTime)) {
      return new Response(JSON.stringify({ error: { status: 'FAILED_PRECONDITION' } }), { status: 400 })
    }
    const body = JSON.parse(String(init.body)) as { fields: Record<string, unknown> }
    writes.push({ path, body })
    docs.set(path, { fields: body.fields, updateTime: `t${++clock}` })
    return new Response('{}')
  }) as typeof fetch
  return { docs, writes, fetcher }
}

test('consumeAuthEmailBudget counts in Firestore, with a TTL field, and stops at the limit', async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccount
  const store = firestoreDouble()
  globalThis.fetch = store.fetcher
  const results: boolean[] = []
  for (let i = 0; i < 4; i += 1) {
    results.push(await consumeAuthEmailBudget('password-reset', 'a@b.com', 3, 3_600_000, { nowMs: 5_000, fetcher: store.fetcher }))
  }
  assert.deepEqual(results, [true, true, true, false])
  const path = `${AUTH_EMAIL_BUDGET_COLLECTION}/${authEmailBudgetDocId('password-reset', 'a@b.com')}`
  assert.ok(store.docs.has(path))
  const last = store.writes.at(-1)!.body.fields as Record<string, { integerValue?: string; timestampValue?: string }>
  assert.equal(last.count.integerValue, '3')
  assert.ok(last.expireAt.timestampValue)
  assert.ok(!JSON.stringify(store.writes).includes('a@b.com'))
})

test('consumeAuthEmailBudget falls back to memory when Firestore cannot be reached', async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccount
  const failing = (async (input: string | URL | Request) => {
    if (String(input).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't' }))
    return new Response('down', { status: 503 })
  }) as typeof fetch
  globalThis.fetch = failing
  const results: boolean[] = []
  for (let i = 0; i < 3; i += 1) {
    results.push(await consumeAuthEmailBudget('verify-email', 'uid-memory', 2, 3_600_000, { fetcher: failing }))
  }
  assert.deepEqual(results, [true, true, false])
})
