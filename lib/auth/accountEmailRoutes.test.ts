import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  CHANGE_EMAIL_RECENT_LOGIN_CODE,
  handleChangeEmailRequest,
  handleVerifyEmailRequest,
  idTokenAuthTimeMs,
} from './accountEmailRoutes.ts'
import { PASSWORD_RESET_PER_EMAIL_LIMIT, allowedAccountEmailContinueUrl } from './passwordResetRequest.ts'
import {
  CHANGE_EMAIL_SUBJECT,
  VERIFY_EMAIL_SUBJECT,
  buildChangeEmailHtml,
  buildChangeEmailText,
  buildVerifyEmailHtml,
  buildVerifyEmailText,
} from '../email/accountEmails.ts'
import { isApplyEmailAction, parseEmailActionSearch } from './emailAction.ts'

const ENV_NAMES = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'EMAIL_SERVER_KEY',
  'EMAIL_FUNCTION_URL',
  'NEXT_PUBLIC_APP_URL',
] as const
const realEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]))
const realFetch = globalThis.fetch
const realConsole = { info: console.info, warn: console.warn, error: console.error, log: console.log }

afterEach(() => {
  globalThis.fetch = realFetch
  Object.assign(console, realConsole)
  for (const name of ENV_NAMES) {
    const value = realEnv[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const serviceAccount = JSON.stringify({
  client_email: 'email-test@demo.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  project_id: 'demo',
})

const VERIFY_LINK = 'https://www.projectplanner.us/__/auth/action?mode=verifyEmail&oobCode=VERIFY-SECRET&apiKey=k'
const CHANGE_LINK = 'https://www.projectplanner.us/__/auth/action?mode=verifyAndChangeEmail&oobCode=CHANGE-SECRET&apiKey=k'

/** A fake ID token: Auth's lookup (stubbed) accepts it; the route reads `auth_time` from its payload. */
function idToken(uid: string, authTimeSec: number): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'RS256' })}.${part({ user_id: uid, auth_time: authTimeSec })}.sig`
}

type Account = { uid: string; email: string; emailVerified: boolean }

function stubBackend(options: { accounts: Account[]; taken?: string[]; configured?: boolean; emailFails?: boolean }) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key'
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.projectplanner.us'
  process.env.EMAIL_FUNCTION_URL = 'https://email.test/sendEmail'
  if (options.configured === false) {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    delete process.env.EMAIL_SERVER_KEY
  } else {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccount
    process.env.EMAIL_SERVER_KEY = 'server-key'
  }
  const calls: Array<{ url: string; body: Record<string, unknown> | null }> = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    const raw = typeof init?.body === 'string' ? init.body : ''
    const body = raw.startsWith('{') ? (JSON.parse(raw) as Record<string, unknown>) : null
    calls.push({ url, body })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 })
    }
    if (url.includes('accounts:lookup?key=')) {
      const token = String(body?.idToken || '')
      const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8') || '{}')
      const account = options.accounts.find((row) => row.uid === payload.user_id)
      if (!account) return new Response(JSON.stringify({ error: { message: 'INVALID_ID_TOKEN' } }), { status: 400 })
      return new Response(JSON.stringify({ users: [{ localId: account.uid, email: account.email, emailVerified: account.emailVerified }] }))
    }
    if (url.includes('/projects/demo/accounts:sendOobCode')) {
      if (body?.requestType === 'VERIFY_AND_CHANGE_EMAIL' && options.taken?.includes(String(body.newEmail))) {
        return new Response(JSON.stringify({ error: { message: 'EMAIL_EXISTS' } }), { status: 400 })
      }
      return new Response(JSON.stringify({ oobLink: body?.requestType === 'VERIFY_EMAIL' ? VERIFY_LINK : CHANGE_LINK }))
    }
    if (url === 'https://email.test/sendEmail') {
      if (options.emailFails) return new Response(JSON.stringify({ error: 'boom' }), { status: 502 })
      return new Response(JSON.stringify({ results: [{ id: 'm1' }] }))
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
  return calls
}

const used = new Map<string, number>()
const opts = {
  minResponseMs: 0,
  allowAccount: async (scope: string, uid: string) => {
    const key = `${scope}:${uid}`
    const n = used.get(key) || 0
    if (n >= PASSWORD_RESET_PER_EMAIL_LIMIT) return false
    used.set(key, n + 1)
    return true
  },
}

let ip = 0
function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-forwarded-for': `192.0.2.${++ip % 250}` }
  if (token) headers.Authorization = `Bearer ${token}`
  return new NextRequest(`https://www.projectplanner.us${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}

const now = Math.floor(Date.now() / 1000)
const alice: Account = { uid: 'alice', email: 'alice@firm.com', emailVerified: false }
const bob: Account = { uid: 'bob', email: 'bob@firm.com', emailVerified: true }

test('verify email: signed in only, own address, branded, Firebase sends nothing itself', async () => {
  const calls = stubBackend({ accounts: [alice, bob] })
  const anon = await handleVerifyEmailRequest(post('/api/auth/verify-email', {}), opts)
  assert.equal(anon.status, 401)
  const res = await handleVerifyEmailRequest(post('/api/auth/verify-email', { email: 'evil@x.com' }, idToken('alice', now)), opts)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
  const oob = calls.filter((call) => call.url.includes('sendOobCode'))
  assert.equal(oob.length, 1)
  assert.equal(oob[0]!.body!.requestType, 'VERIFY_EMAIL')
  assert.equal(oob[0]!.body!.email, 'alice@firm.com')
  assert.equal(oob[0]!.body!.returnOobLink, true)
  const send = calls.find((call) => call.url === 'https://email.test/sendEmail')!
  assert.deepEqual(send.body!.to, ['alice@firm.com'])
  assert.equal((send.body!.data as { subject: string }).subject, VERIFY_EMAIL_SUBJECT)
  // Already verified: same answer, nothing sent.
  const verified = await handleVerifyEmailRequest(post('/api/auth/verify-email', {}, idToken('bob', now)), opts)
  assert.equal(verified.status, 200)
  assert.deepEqual(await verified.json(), { ok: true })
  assert.equal(calls.filter((call) => call.url === 'https://email.test/sendEmail').length, 1)
})

test('verify email: per-account limit is silent', async () => {
  const calls = stubBackend({ accounts: [{ uid: 'carol', email: 'carol@firm.com', emailVerified: false }] })
  for (let i = 0; i < PASSWORD_RESET_PER_EMAIL_LIMIT + 2; i += 1) {
    const res = await handleVerifyEmailRequest(post('/api/auth/verify-email', {}, idToken('carol', now)), opts)
    assert.equal(res.status, 200)
  }
  assert.equal(calls.filter((call) => call.url === 'https://email.test/sendEmail').length, PASSWORD_RESET_PER_EMAIL_LIMIT)
})

test('change email: acts only on the caller, needs a recent sign-in, same answer when the address is taken', async () => {
  const calls = stubBackend({ accounts: [alice, bob], taken: ['bob@firm.com'] })
  const anon = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'new@firm.com' }), opts)
  assert.equal(anon.status, 401)
  const stale = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'new@firm.com' }, idToken('alice', now - 3600)), opts)
  assert.equal(stale.status, 401)
  assert.equal((await stale.json()).code, CHANGE_EMAIL_RECENT_LOGIN_CODE)
  const bad = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'nope' }, idToken('alice', now)), opts)
  assert.equal(bad.status, 400)
  const same = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'Alice@firm.com' }, idToken('alice', now)), opts)
  assert.equal(same.status, 400)

  const ok = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'New@Firm.com', email: 'bob@firm.com' }, idToken('alice', now)), opts)
  const taken = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'bob@firm.com' }, idToken('alice', now)), opts)
  assert.equal(ok.status, 200)
  assert.equal(taken.status, 200)
  assert.equal(await ok.text(), await taken.text())

  const oob = calls.filter((call) => call.url.includes('sendOobCode'))
  for (const call of oob) {
    assert.equal(call.body!.requestType, 'VERIFY_AND_CHANGE_EMAIL')
    // Always the caller's own account, never an address from the request body.
    assert.equal(call.body!.email, 'alice@firm.com')
    assert.equal(call.body!.returnOobLink, true)
  }
  const sends = calls.filter((call) => call.url === 'https://email.test/sendEmail')
  assert.equal(sends.length, 1)
  assert.deepEqual(sends[0]!.body!.to, ['new@firm.com'])
  assert.equal((sends[0]!.body!.data as { subject: string }).subject, CHANGE_EMAIL_SUBJECT)
})

test('account email routes fall back only when the server cannot send', async () => {
  const calls = stubBackend({ accounts: [alice], configured: false })
  const verify = await handleVerifyEmailRequest(post('/api/auth/verify-email', {}, idToken('alice', now)), opts)
  assert.equal(verify.status, 503)
  assert.deepEqual(await verify.json(), { ok: false, fallback: 'firebase' })
  const change = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'n@firm.com' }, idToken('alice', now)), opts)
  assert.equal(change.status, 503)
  assert.equal(calls.filter((call) => call.url.includes('sendOobCode')).length, 0)
})

test('account email routes never log links, codes or addresses', async () => {
  stubBackend({ accounts: [alice], emailFails: true })
  const lines: string[] = []
  const capture = (...args: unknown[]) => lines.push(args.map((arg) => String(arg)).join(' '))
  Object.assign(console, { info: capture, warn: capture, error: capture, log: capture })
  await handleVerifyEmailRequest(post('/api/auth/verify-email', {}, idToken('alice', now)), opts)
  await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'secret-new@firm.com' }, idToken('alice', now)), opts)
  const joined = lines.join('\n')
  assert.ok(lines.length >= 2)
  for (const secret of ['VERIFY-SECRET', 'CHANGE-SECRET', 'oobCode', 'alice@firm.com', 'secret-new@firm.com']) {
    assert.ok(!joined.includes(secret), `log contains ${secret}`)
  }
})

test('account email continue URL: login pages on projectplanner.us only, else none', () => {
  const base = 'https://www.projectplanner.us'
  assert.equal(allowedAccountEmailContinueUrl(undefined, base), null)
  assert.equal(allowedAccountEmailContinueUrl('https://projectplanner.us/login', base), 'https://projectplanner.us/login')
  assert.equal(allowedAccountEmailContinueUrl('https://evil.example/login', base), null)
  assert.equal(allowedAccountEmailContinueUrl('https://www.projectplanner.us/dashboard', base), null)
  assert.equal(allowedAccountEmailContinueUrl('https://www.projectplanner.us/login?x=1', base), null)
})

test('idTokenAuthTimeMs reads auth_time', () => {
  assert.equal(idTokenAuthTimeMs(idToken('a', 1700000000)), 1700000000000)
  assert.equal(idTokenAuthTimeMs('garbage'), null)
})

test('verify and change emails render the branded layout', () => {
  for (const [html, text, link, button] of [
    [buildVerifyEmailHtml({ to: 'a@b.com', link: VERIFY_LINK }), buildVerifyEmailText({ to: 'a@b.com', link: VERIFY_LINK }), VERIFY_LINK, 'Verify email'],
    [buildChangeEmailHtml({ to: 'a@b.com', link: CHANGE_LINK }), buildChangeEmailText({ to: 'a@b.com', link: CHANGE_LINK }), CHANGE_LINK, 'Confirm new email'],
  ] as const) {
    assert.ok(html.includes('pp-email-logo-on-navy.png'))
    assert.match(html, new RegExp(`class="btn-link"[^>]*>${button}</a>`))
    assert.ok(html.includes(link.replace(/&/g, '&amp;')))
    assert.ok(html.includes('Thanks,<br>Project Planner'))
    assert.ok(!/project-planner-f986c/.test(html))
    assert.ok(text.includes(link))
    assert.match(html, /<meta name="color-scheme" content="light dark"/)
    const bare = html.match(/<(p|h1|h2|h3|li|ul|pre|strong|a)(\s[^>]*)?>/g) ?? []
    assert.deepEqual(bare.filter((tag) => !/style="[^"]*color:/.test(tag)), [])
  }
})

test('the action page recognises verify, change and undo links', () => {
  for (const mode of ['verifyEmail', 'verifyAndChangeEmail', 'recoverEmail']) {
    assert.ok(isApplyEmailAction(parseEmailActionSearch(new URLSearchParams(`mode=${mode}&oobCode=x`))))
  }
  assert.ok(!isApplyEmailAction(parseEmailActionSearch(new URLSearchParams('mode=resetPassword&oobCode=x'))))
  assert.ok(!isApplyEmailAction(parseEmailActionSearch(new URLSearchParams('mode=verifyEmail'))))
})

test('verify and change report a failed send as the fallback (they act on the caller only)', async () => {
  const calls = stubBackend({ accounts: [{ uid: 'dan', email: 'dan@firm.com', emailVerified: false }], emailFails: true })
  const verify = await handleVerifyEmailRequest(post('/api/auth/verify-email', {}, idToken('dan', now)), opts)
  assert.equal(verify.status, 503)
  assert.deepEqual(await verify.json(), { ok: false, fallback: 'firebase' })
  const change = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail: 'dan2@firm.com' }, idToken('dan', now)), opts)
  assert.equal(change.status, 503)
  // Sent through the account-email rate bucket.
  for (const send of calls.filter((call) => call.url === 'https://email.test/sendEmail')) {
    assert.equal(send.body!.template, 'auth_rendered')
  }
})

test('change email answers no sooner than the minimum, taken or free', async () => {
  stubBackend({ accounts: [{ uid: 'eve', email: 'eve@firm.com', emailVerified: true }], taken: ['taken@firm.com'] })
  for (const newEmail of ['taken@firm.com', 'free@firm.com']) {
    const started = Date.now()
    const res = await handleChangeEmailRequest(post('/api/auth/change-email', { newEmail }, idToken('eve', now)), {
      ...opts,
      minResponseMs: 150,
    })
    assert.equal(res.status, 200)
    assert.ok(Date.now() - started >= 140, `${newEmail} answered early`)
  }
})
