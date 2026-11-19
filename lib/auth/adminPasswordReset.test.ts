import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  ADMIN_RESET_NOT_ALLOWED_MESSAGE,
  ADMIN_RESET_NOT_SET_UP_MESSAGE,
  ADMIN_RESET_NO_LOGIN_MESSAGE,
  handleAdminPasswordReset,
} from './adminPasswordReset.ts'
import { AuthAccountNotFoundError } from '../owner/identityToolkitAdmin.ts'

const ENV = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'EMAIL_SERVER_KEY'] as const
const realEnv = Object.fromEntries(ENV.map((name) => [name, process.env[name]]))
const realFetch = globalThis.fetch
const realInfo = console.info
afterEach(() => {
  globalThis.fetch = realFetch
  console.info = realInfo
  for (const name of ENV) {
    const value = realEnv[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const ORG = '11111111-2222-4333-8444-555555555555'
const OTHER = '99999999-2222-4333-8444-555555555555'

function value(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { integerValue: String(v) }
  if (v && typeof v === 'object') return { mapValue: { fields: fields(v as Record<string, unknown>) } }
  return { nullValue: null }
}
function fields(plain: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(plain).map(([key, v]) => [key, value(v)]))
}

const people: Record<string, Record<string, unknown>> = {
  admin: { organizationId: ORG, email: 'admin@firm.com', firstName: 'Ada', lastName: 'Min', role: 'admin', adminAccess: true, passwordSet: true },
  opsManager: { organizationId: ORG, email: 'ops@firm.com', firstName: 'Op', lastName: 'Man', role: 'manager', manager: true, operatives: true, passwordSet: true },
  plainManager: { organizationId: ORG, email: 'pm@firm.com', firstName: 'Pl', lastName: 'Man', role: 'manager', manager: true, passwordSet: true },
  operative: { organizationId: ORG, email: 'op@firm.com', firstName: 'Ope', lastName: 'Rative', role: 'operative', operativeMode: true, passwordSet: true },
  pending: { organizationId: ORG, email: 'new@firm.com', firstName: 'New', lastName: 'Person', role: 'operative', operativeMode: true, passwordSet: false },
  ghost: { organizationId: ORG, email: '', firstName: 'Gho', lastName: 'St', role: 'operative', operativeMode: true, ghost: true },
  stranger: { organizationId: OTHER, email: 'x@other.com', firstName: 'X', lastName: 'Y', role: 'operative', operativeMode: true, passwordSet: true },
  boss: { organizationId: ORG, email: 'boss@firm.com', firstName: 'Bo', lastName: 'Ss', role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true },
}

function stub() {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  process.env.EMAIL_SERVER_KEY = 'k'
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'a@demo.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    project_id: 'demo',
  })
  const members = { admin: 'admin', opsManager: 'manager', plainManager: 'manager', operative: 'operative', boss: 'admin' }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('accounts:lookup?key=')) {
      const uid = String(JSON.parse(String(init?.body)).idToken).replace('tok-', '')
      return new Response(JSON.stringify({ users: [{ localId: uid, email: `${uid}@firm.com`, emailVerified: true }] }))
    }
    const path = decodeURIComponent(url.split('/documents/')[1] || '')
    if (path === `organizations/${ORG}`) {
      return new Response(JSON.stringify({ fields: fields({ name: 'Firm', creatorUserId: 'boss', members }) }))
    }
    const userMatch = path.match(/^users\/(.+)$/)
    if (userMatch && people[userMatch[1]!]) return new Response(JSON.stringify({ fields: fields(people[userMatch[1]!]!) }))
    return new Response('{}', { status: 404 })
  }) as typeof fetch
}

function req(caller: string, userId: string, organizationId = ORG) {
  return new NextRequest('https://www.projectplanner.us/api/users/send-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer tok-${caller}`, 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ organizationId, userId }),
  })
}

function recorder() {
  const branded: Array<{ email: string; reason?: string }> = []
  const firebase: string[] = []
  return {
    branded,
    firebase,
    deps: {
      sendBranded: async (input: { email: string; reason?: string }) => {
        branded.push({ email: input.email, reason: input.reason })
      },
      sendFirebase: async (email: string) => {
        firebase.push(email)
      },
    },
  }
}

test('an admin sends a reset to the stored address; the admin wording is used', async () => {
  stub()
  const rec = recorder()
  const res = await handleAdminPasswordReset(req('admin', 'operative'), rec.deps)
  assert.equal(res.status, 200)
  assert.deepEqual(rec.branded, [{ email: 'op@firm.com', reason: 'admin' }])
  assert.deepEqual(rec.firebase, [])
})

test('there is no per-email cap on admin resets', async () => {
  stub()
  const rec = recorder()
  for (let i = 0; i < 6; i += 1) assert.equal((await handleAdminPasswordReset(req('admin', 'operative'), rec.deps)).status, 200)
  assert.equal(rec.branded.length, 6)
})

test('permissions follow canEditTargetUser', async () => {
  stub()
  const rec = recorder()
  assert.equal((await handleAdminPasswordReset(req('opsManager', 'operative'), rec.deps)).status, 200)
  const notOperative = await handleAdminPasswordReset(req('opsManager', 'plainManager'), rec.deps)
  assert.equal(notOperative.status, 403)
  assert.equal((await notOperative.json()).error, ADMIN_RESET_NOT_ALLOWED_MESSAGE)
  assert.equal((await handleAdminPasswordReset(req('plainManager', 'operative'), rec.deps)).status, 403)
  assert.equal((await handleAdminPasswordReset(req('admin', 'boss'), rec.deps)).status, 403)
  assert.equal((await handleAdminPasswordReset(req('boss', 'admin'), rec.deps)).status, 200)
  // An operative has no staff access at all.
  assert.equal((await handleAdminPasswordReset(req('operative', 'operative'), rec.deps)).status, 403)
  // A person of another company.
  assert.equal((await handleAdminPasswordReset(req('admin', 'stranger'), rec.deps)).status, 403)
  assert.equal(rec.branded.length, 2)
})

test('pending invites and ghosts have no login to reset', async () => {
  stub()
  const rec = recorder()
  for (const target of ['pending', 'ghost']) {
    const res = await handleAdminPasswordReset(req('admin', target), rec.deps)
    assert.equal(res.status, 400)
    assert.equal((await res.json()).error, ADMIN_RESET_NOT_SET_UP_MESSAGE)
  }
  assert.equal((await handleAdminPasswordReset(req('admin', 'nobody'), rec.deps)).status, 404)
})

test('the real result is reported: Firebase fallback, no login, failure', async () => {
  stub()
  const lines: string[] = []
  console.info = (...args: unknown[]) => lines.push(args.join(' '))
  const fallback = recorder()
  fallback.deps.sendBranded = async () => {
    throw new Error('email function down')
  }
  assert.equal((await handleAdminPasswordReset(req('admin', 'operative'), fallback.deps)).status, 200)
  assert.deepEqual(fallback.firebase, ['op@firm.com'])

  const noLogin = recorder()
  noLogin.deps.sendBranded = async () => {
    throw new AuthAccountNotFoundError()
  }
  const missing = await handleAdminPasswordReset(req('admin', 'operative'), noLogin.deps)
  assert.equal(missing.status, 404)
  assert.equal((await missing.json()).error, ADMIN_RESET_NO_LOGIN_MESSAGE)

  const broken = recorder()
  broken.deps.sendBranded = async () => {
    throw new Error('down')
  }
  broken.deps.sendFirebase = async () => {
    throw new Error('also down')
  }
  assert.equal((await handleAdminPasswordReset(req('admin', 'operative'), broken.deps)).status, 502)
  assert.ok(!lines.join('\n').includes('op@firm.com'))
})

test('signed in only', async () => {
  stub()
  const res = await handleAdminPasswordReset(
    new NextRequest('https://www.projectplanner.us/api/users/send-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: ORG, userId: 'operative' }),
    }),
    recorder().deps
  )
  assert.equal(res.status, 401)
})
