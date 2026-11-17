/**
 * Owner bug 17 Nov: Developer → Data quality → Test organisations → Mark internal "does nothing".
 * Drives the real `/api/owner/mark-internal` route against the Firestore emulator and the current firestore.rules, so
 * the writes are exactly the route's REST writes with the owner's token: the `adminAuditLog` create (`requested`, then
 * `completed`) and the `organizations/{orgId}` PATCH with `updateMask` isInternal / isTest. Only the Identity Toolkit
 * `accounts:lookup` (who the token belongs to) is answered locally; every Firestore call reaches the emulator.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { NextRequest } from 'next/server'
import { PLATFORM_OWNER_EMAIL } from '../lib/canonical/passwordPolicy.ts'
import { encodeMfaOk } from '../lib/auth/mfa/mfaCookies.ts'
import { mfaCookieName, shouldSecureMfaCookies } from '../lib/auth/mfa/mfaCookiePolicy.ts'
import { POST as markInternal } from '../app/api/owner/mark-internal/route.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(process.env.RULES_PATH || path.join(root, 'firestore.rules'), 'utf8')
const PROJECT = 'demo-owner-mark-internal'
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080)
const OWNER = 'mi-owner'

let env: RulesTestEnvironment
const realFetch = globalThis.fetch

/** An unsigned ID token: the emulator reads its claims without checking a signature. */
function emulatorToken(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    sub: OWNER,
    user_id: OWNER,
    firebase: { sign_in_provider: 'password', identities: {} },
    ...claims,
  })}.`
}

const TOKEN = emulatorToken({ email: PLATFORM_OWNER_EMAIL, email_verified: true })

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules, host: '127.0.0.1', port: PORT },
  })
  await env.clearFirestore()
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = PROJECT
  process.env.NEXT_PUBLIC_USE_EMULATORS = '1'
  process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('accounts:lookup')) {
      return new Response(JSON.stringify({ users: [{ localId: OWNER, email: PLATFORM_OWNER_EMAIL, emailVerified: true, createdAt: '1000' }] }))
    }
    return realFetch(input, init)
  }) as typeof fetch
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', OWNER), { email: PLATFORM_OWNER_EMAIL, organizationId: 'platform-owner' })
    await setDoc(doc(db, 'organizations', 'org-plain'), { name: 'Acme Demo', creatorUserId: 'someone', members: { someone: 'admin' } })
    await setDoc(doc(db, 'organizations', 'org-test-only'), { name: 'Old test company', isTest: true, members: {} })
    await setDoc(doc(db, 'organizations', 'org-billing'), {
      name: 'Lapsed and scheduled',
      members: { a: 'Admin', b: true },
      billing: { status: 'canceled', accessOpen: false },
      deletion: { status: 'scheduled', eraseAfter: Timestamp.now(), restoreBy: 'super_admin' },
    })
  })
})

test.after(async () => {
  globalThis.fetch = realFetch
  await env.cleanup()
})

function request(body: unknown): NextRequest {
  const text = JSON.stringify(body)
  const req = new NextRequest('http://localhost/api/owner/mark-internal', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      'content-length': String(text.length),
      'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250)}`,
    },
    body: text,
  })
  req.cookies.set(mfaCookieName('ok', shouldSecureMfaCookies(req)), encodeMfaOk(OWNER, Date.now() + 60_000, Date.now()))
  return req
}

async function stored(orgId: string) {
  let data: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), 'organizations', orgId))
    data = snap.exists() ? snap.data() : undefined
  })
  return data
}

async function auditPhases(orgId: string): Promise<string[]> {
  const response = await realFetch(
    `http://127.0.0.1:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/adminAuditLog?pageSize=300`,
    { headers: { Authorization: 'Bearer owner' } }
  )
  const body = (await response.json()) as { documents?: { fields?: Record<string, { stringValue?: string }> }[] }
  return (body.documents || [])
    .filter((row) => row.fields?.targetOrgId?.stringValue === orgId)
    .map((row) => row.fields?.phase?.stringValue || '')
    .sort()
}

for (const orgId of ['org-plain', 'org-test-only', 'org-billing']) {
  test(`the owner marks ${orgId} internal: audit requested + completed, then isInternal and isTest stored true`, async () => {
    const response = await markInternal(request({ orgId, isInternal: true }))
    const body = (await response.json()) as { ok?: boolean; error?: string }
    assert.equal(response.status, 200, body.error)
    assert.equal(body.ok, true)
    const data = await stored(orgId)
    assert.equal(data?.isInternal, true)
    assert.equal(data?.isTest, true)
    assert.deepEqual(await auditPhases(orgId), ['completed', 'requested'])
  })
}

test('an organisation with no document is refused (404) and is never created by the patch', async () => {
  const response = await markInternal(request({ orgId: 'org-missing', isInternal: true }))
  assert.equal(response.status, 404)
  assert.equal(await stored('org-missing'), undefined)
})
