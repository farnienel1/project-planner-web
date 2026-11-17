import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { NextRequest } from 'next/server'
import { handlePasswordResetRequest } from './passwordResetRoute.ts'
import {
  PASSWORD_RESET_PER_EMAIL_LIMIT,
  PASSWORD_RESET_PER_IP_LIMIT,
  passwordResetContinueUrl,
  runPasswordReset,
  type PasswordResetDeps,
} from './passwordResetRequest.ts'
import {
  PASSWORD_RESET_EMAIL_SUBJECT,
  PASSWORD_RESET_IGNORE_TEXT,
  PASSWORD_RESET_LINK_VALID_TEXT,
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
} from '../email/passwordResetEmail.ts'

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
const realInfo = console.info
const realWarn = console.warn
const realError = console.error
const realLog = console.log

afterEach(() => {
  globalThis.fetch = realFetch
  console.info = realInfo
  console.warn = realWarn
  console.error = realError
  console.log = realLog
  for (const name of ENV_NAMES) {
    const value = realEnv[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const serviceAccount = JSON.stringify({
  client_email: 'reset-test@demo.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  project_id: 'demo',
})

const OOB_LINK = 'https://www.projectplanner.us/__/auth/action?mode=resetPassword&oobCode=SECRET-CODE-123&apiKey=k&lang=en'

type Recorded = { url: string; body: unknown }

/** Google OAuth, Identity Toolkit and the email function, with `known` the emails that have accounts. */
function stubBackend(options: { known: string[]; emailFails?: boolean; configured?: boolean; linkFails?: boolean; fallbackFails?: boolean }) {
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
  const calls: Recorded[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    const raw = typeof init?.body === 'string' ? init.body : ''
    const body = raw.startsWith('{') ? JSON.parse(raw) : null
    calls.push({ url, body })
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 })
    }
    if (url.includes('accounts:sendOobCode?key=')) {
      // Firebase's own email (the server-side fallback).
      if (options.fallbackFails) return new Response(JSON.stringify({ error: { message: 'INTERNAL' } }), { status: 500 })
      return new Response(JSON.stringify({ email: (body as { email?: string }).email }), { status: 200 })
    }
    if (url.includes('accounts:sendOobCode')) {
      if (options.linkFails) return new Response(JSON.stringify({ error: { message: 'INTERNAL' } }), { status: 500 })
      const email = String((body as { email?: string }).email || '')
      if (!options.known.includes(email)) {
        return new Response(JSON.stringify({ error: { message: 'EMAIL_NOT_FOUND' } }), { status: 400 })
      }
      return new Response(JSON.stringify({ oobLink: OOB_LINK, email }), { status: 200 })
    }
    if (url === 'https://email.test/sendEmail') {
      if (options.emailFails) return new Response(JSON.stringify({ error: 'boom' }), { status: 502 })
      return new Response(JSON.stringify({ results: [{ id: 'm1' }] }), { status: 200 })
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
  return calls
}

let ipCounter = 0
function resetRequest(body: unknown, ip = `203.0.113.${++ipCounter % 250}`) {
  return new NextRequest('https://www.projectplanner.us/api/auth/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

function captureLogs(): string[] {
  const lines: string[] = []
  const capture = (...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg, Object.getOwnPropertyNames(arg ?? {})))).join(' '))
  }
  console.info = capture
  console.warn = capture
  console.error = capture
  console.log = capture
  return lines
}

/** Runs the route with no fixed wait, a memory per-email budget, and waits for its background work. */
const budget = new Map<string, number>()
async function run(body: unknown, ip?: string, extra: { fixedResponseMs?: number } = {}) {
  const pending: Promise<unknown>[] = []
  const res = await handlePasswordResetRequest(resetRequest(body, ip), {
    fixedResponseMs: extra.fixedResponseMs ?? 0,
    defer: (work) => pending.push(work),
    allowEmail: async (email) => {
      const used = budget.get(email) || 0
      if (used >= PASSWORD_RESET_PER_EMAIL_LIMIT) return false
      budget.set(email, used + 1)
      return true
    },
  })
  const statuses = await Promise.all(pending)
  return { res, statuses }
}

test('the route answers exactly the same for an existing and an unknown email', async () => {
  const calls = stubBackend({ known: ['known@firm.com'] })
  const known = await run({ email: 'Known@Firm.com' })
  const unknown = await run({ email: 'nobody@firm.com' })
  assert.equal(known.res.status, 200)
  assert.equal(unknown.res.status, 200)
  assert.equal(await known.res.text(), await unknown.res.text())
  assert.equal(known.res.headers.get('cache-control'), unknown.res.headers.get('cache-control'))
  assert.deepEqual(known.statuses, ['sent'])
  assert.deepEqual(unknown.statuses, ['no_account'])
  // Exactly one email, to the known account, carrying the Firebase link; Firebase was asked for a link, not to send.
  const sends = calls.filter((call) => call.url === 'https://email.test/sendEmail')
  assert.equal(sends.length, 1)
  const payload = sends[0]!.body as { template: string; to: string[]; data: { subject: string; html: string; text: string } }
  assert.equal(payload.template, 'auth_rendered')
  assert.deepEqual(payload.to, ['known@firm.com'])
  assert.equal(payload.data.subject, PASSWORD_RESET_EMAIL_SUBJECT)
  assert.ok(payload.data.html.includes('oobCode=SECRET-CODE-123'))
  assert.ok(payload.data.text.includes(OOB_LINK))
  const oob = calls.filter((call) => call.url.includes('/projects/demo/accounts:sendOobCode'))
  assert.ok(oob.length >= 2)
  for (const call of oob) {
    assert.equal((call.body as { returnOobLink?: boolean }).returnOobLink, true)
    assert.equal((call.body as { requestType?: string }).requestType, 'PASSWORD_RESET')
  }
  assert.equal(calls.filter((call) => call.url.includes('accounts:sendOobCode?key=')).length, 0)
})

test('the answer time is fixed: the link and the send run after it', async () => {
  stubBackend({ known: ['known@firm.com'] })
  const pending: Promise<unknown>[] = []
  let sendStarted = false
  const realFetchStub = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes('email.test')) sendStarted = true
    return realFetchStub(input, init)
  }) as typeof fetch
  const started = Date.now()
  const res = await handlePasswordResetRequest(resetRequest({ email: 'timing@firm.com' }), {
    fixedResponseMs: 120,
    defer: (work) => pending.push(work),
    allowEmail: async () => true,
  })
  const elapsed = Date.now() - started
  assert.equal(res.status, 200)
  assert.ok(elapsed >= 110, `answered after ${elapsed}ms`)
  assert.equal(pending.length, 1, 'the work is handed to after()')
  await Promise.all(pending)
  assert.equal(sendStarted, false, 'unknown address: nothing sent')
})

test('a failed send or link falls back to Firebase\'s own email, and still answers the same', async () => {
  let calls = stubBackend({ known: ['known@firm.com'], emailFails: true })
  let result = await run({ email: 'known@firm.com' })
  assert.equal(result.res.status, 200)
  assert.deepEqual(await result.res.json(), { ok: true })
  assert.deepEqual(result.statuses, ['sent_firebase_fallback'])
  const fallback = calls.filter((call) => call.url.includes('accounts:sendOobCode?key='))
  assert.equal(fallback.length, 1)
  assert.equal((fallback[0]!.body as { returnOobLink?: boolean }).returnOobLink, undefined)

  calls = stubBackend({ known: ['known2@firm.com'], linkFails: true })
  result = await run({ email: 'known2@firm.com' })
  assert.deepEqual(result.statuses, ['sent_firebase_fallback'])
  assert.equal(calls.filter((call) => call.url === 'https://email.test/sendEmail').length, 0)

  stubBackend({ known: ['known3@firm.com'], linkFails: true, fallbackFails: true })
  result = await run({ email: 'known3@firm.com' })
  assert.equal(result.res.status, 200)
  assert.deepEqual(result.statuses, ['fallback_failed'])
})

test('the route never logs the link, the code or the address', async () => {
  stubBackend({ known: ['private@firm.com'], emailFails: true })
  const lines = captureLogs()
  await run({ email: 'private@firm.com' })
  await run({ email: 'ghost@firm.com' })
  stubBackend({ known: ['private2@firm.com'] })
  await run({ email: 'private2@firm.com' })
  const joined = lines.join('\n')
  assert.ok(lines.length >= 3)
  for (const secret of ['SECRET-CODE-123', 'oobCode', 'private@firm.com', 'private2@firm.com', 'ghost@firm.com', 'resetPassword']) {
    assert.ok(!joined.includes(secret), `log contains ${secret}`)
  }
  assert.match(joined, /\[auth\/password-reset\] (sent|sent_firebase_fallback|no_account)/)
})

test('an invalid email is refused before anything is looked up', async () => {
  const calls = stubBackend({ known: [] })
  assert.equal((await run({ email: 'not-an-email' })).res.status, 400)
  assert.equal((await run({})).res.status, 400)
  assert.equal(calls.length, 0)
})

test('per-IP rate limit answers 429 after the limit', async () => {
  stubBackend({ known: [] })
  const ip = '198.51.100.77'
  for (let i = 0; i < PASSWORD_RESET_PER_IP_LIMIT; i += 1) {
    assert.equal((await run({ email: `p${i}@firm.com` }, ip)).res.status, 200)
  }
  assert.equal((await run({ email: 'p-last@firm.com' }, ip)).res.status, 429)
})

test('per-email budget stops sending but still answers the same', async () => {
  const calls = stubBackend({ known: ['busy@firm.com'] })
  const statuses: unknown[] = []
  for (let i = 0; i < PASSWORD_RESET_PER_EMAIL_LIMIT + 2; i += 1) {
    const result = await run({ email: 'busy@firm.com' })
    assert.equal(result.res.status, 200)
    assert.deepEqual(await result.res.json(), { ok: true })
    statuses.push(...result.statuses)
  }
  assert.equal(calls.filter((call) => call.url === 'https://email.test/sendEmail').length, PASSWORD_RESET_PER_EMAIL_LIMIT)
  assert.deepEqual(statuses.slice(-2), ['email_throttled', 'email_throttled'])
})

test('a server that cannot send answers 503 fallback before looking up any account', async () => {
  const calls = stubBackend({ known: ['known@firm.com'], configured: false })
  const known = await run({ email: 'known@firm.com' })
  assert.equal(known.res.status, 503)
  assert.deepEqual(await known.res.json(), { ok: false, fallback: 'firebase' })
  assert.equal((await run({ email: 'other@firm.com' })).res.status, 503)
  assert.equal(calls.length, 0)
})

test('continueUrl is limited to projectplanner.us login paths; the path follows the email', () => {
  const base = 'https://www.projectplanner.us'
  assert.equal(passwordResetContinueUrl('a@b.com', undefined, base), 'https://www.projectplanner.us/login')
  assert.equal(passwordResetContinueUrl('a@b.com', 'https://projectplanner.us/login', base), 'https://projectplanner.us/login')
  assert.equal(passwordResetContinueUrl('a@b.com', 'https://www.projectplanner.us/login', base), 'https://www.projectplanner.us/login')
  for (const bad of [
    'https://evil.example/login',
    'https://projectplanner.us.evil.example/login',
    'http://www.projectplanner.us/login',
    'https://www.projectplanner.us/dashboard',
    'https://www.projectplanner.us/login?next=https://evil.example',
    'https://www.projectplanner.us/login#x',
    'https://user:pw@www.projectplanner.us/login',
    'https://www.projectplanner.us:8443/login',
    'javascript:alert(1)',
    '//evil.example/login',
    42,
  ]) {
    assert.equal(passwordResetContinueUrl('a@b.com', bad, base), 'https://www.projectplanner.us/login', String(bad))
  }
  // The platform owner always returns to the developer login; a normal user never to it.
  assert.equal(
    passwordResetContinueUrl('info@projectplanner.us', 'https://www.projectplanner.us/login', base),
    'https://www.projectplanner.us/developer-login'
  )
  assert.equal(
    passwordResetContinueUrl('a@b.com', 'https://www.projectplanner.us/developer-login', base),
    'https://www.projectplanner.us/login'
  )
  // This server's own origin (local dev, previews) is allowed.
  assert.equal(passwordResetContinueUrl('a@b.com', 'http://localhost:3000/login', 'http://localhost:3000'), 'http://localhost:3000/login')
  assert.equal(passwordResetContinueUrl('a@b.com', 'http://localhost:4000/login', 'http://localhost:3000'), 'http://localhost:3000/login')
})

test('runPasswordReset statuses', async () => {
  const deps = (over: Partial<PasswordResetDeps>): PasswordResetDeps => ({
    configured: () => true,
    allowEmail: () => true,
    generateLink: async () => 'https://x/link',
    isAccountMissing: (error) => error instanceof Error && error.message === 'missing',
    isSetupError: (error) => error instanceof Error && error.message === 'setup',
    sendEmail: async () => undefined,
    ...over,
  })
  const input = { email: 'a@b.com', continueUrl: 'https://www.projectplanner.us/login' }
  assert.equal(await runPasswordReset(input, deps({})), 'sent')
  assert.equal(await runPasswordReset(input, deps({ configured: () => false })), 'not_configured')
  assert.equal(await runPasswordReset(input, deps({ allowEmail: () => false })), 'email_throttled')
  assert.equal(await runPasswordReset(input, deps({ generateLink: async () => { throw new Error('missing') } })), 'no_account')
  assert.equal(await runPasswordReset(input, deps({ generateLink: async () => { throw new Error('setup') } })), 'not_configured')
  assert.equal(await runPasswordReset(input, deps({ generateLink: async () => { throw new Error('other') } })), 'link_failed')
  assert.equal(await runPasswordReset(input, deps({ sendEmail: async () => { throw new Error('x') } })), 'send_failed')
})

test('the email renders: brand, button, fallback link, expiry, ignore line, signed Project Planner', () => {
  const html = buildPasswordResetEmailHtml({ to: 'sam@firm.com', link: OOB_LINK })
  const escaped = OOB_LINK.replace(/&/g, '&amp;')
  assert.ok(html.includes('pp-email-logo-on-navy.png'))
  assert.ok(html.includes('Reset your password'))
  assert.match(html, /class="btn-link" href="[^"]*oobCode=SECRET-CODE-123[^"]*"[^>]*>Reset password<\/a>/)
  // Fallback link shown as text, escaped.
  assert.ok(html.includes(`>${escaped}</a>`))
  assert.ok(!html.includes(`href="${OOB_LINK}"`), 'raw & in an attribute')
  assert.ok(html.includes('this link expires in 1 hour'))
  assert.ok(html.includes("If you didn&#39;t ask to reset your password") || html.includes('If you didn&#x27;t ask'))
  assert.ok(html.includes('Thanks,<br>Project Planner'))
  assert.ok(!/project-planner-f986c/.test(html))
  assert.ok(html.includes('sam@firm.com'))
  const text = buildPasswordResetEmailText({ to: 'sam@firm.com', link: OOB_LINK })
  assert.ok(text.includes(OOB_LINK))
  assert.ok(text.includes(PASSWORD_RESET_LINK_VALID_TEXT))
  assert.ok(text.includes(PASSWORD_RESET_IGNORE_TEXT))
  assert.ok(text.includes('Thanks,\nProject Planner'))
})

test('the email escapes what it is given', () => {
  const html = buildPasswordResetEmailHtml({ to: '<b>x</b>@firm.com', link: 'https://a/"><script>alert(1)</script>' })
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<b>x</b>'))
})

test('support and email-changed wording', () => {
  assert.ok(buildPasswordResetEmailHtml({ to: 'a@b.com', link: 'https://a', reason: 'support' }).includes('Project Planner support'))
  assert.ok(buildPasswordResetEmailText({ to: 'a@b.com', link: 'https://a', reason: 'emailChanged' }).includes('login email was changed'))
})
