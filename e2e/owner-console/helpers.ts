import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'
import { SEED_AUTH_USERS, SEED_PASSWORD } from '../../scripts/owner-console-seed/seedConstants.mjs'

// Playwright runs these as CommonJS, so the path is from the repository root (where the suite starts).
export const expected = JSON.parse(readFileSync(path.join(process.cwd(), 'scripts/owner-console-seed/expected.json'), 'utf8'))

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const signingSecret = process.env.MFA_SIGNING_SECRET || ''

export type SeedRole = 'owner' | 'superAdmin' | 'admin' | 'manager' | 'operative'

export function seedUser(role: SeedRole) {
  const user = SEED_AUTH_USERS.find((entry) => entry.role === role)
  if (!user) throw new Error(`no seeded ${role}`)
  return user
}

/** The signed "ok" cookie the MFA verify route writes (lib/auth/mfa/mfaCookies.ts encodeMfaOk), for the test server's secret. */
export function mfaOkCookieValue(uid: string, iatMs = Date.now()): string {
  if (!signingSecret) throw new Error('MFA_SIGNING_SECRET must be set for the e2e suite')
  const payload = Buffer.from(JSON.stringify({ kind: 'ok', uid, exp: Date.now() + 60 * 60 * 1000, iat: iatMs }), 'utf8').toString('base64url')
  const sig = createHmac('sha256', signingSecret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** `next start` runs with NODE_ENV=production, so the cookie is the Secure `__Host-` one (lib/auth/mfa/mfaCookiePolicy.ts). */
export const MFA_OK_COOKIE = '__Host-pp_mfa_ok'

/** The Firebase session cookie the status route mints for the same uid (lib/auth/mfa/mfaSessionCookie.ts). */
export const SESSION_COOKIE = '__Host-pp_session'

export async function addMfaCookie(context: BrowserContext, baseURL: string, uid: string) {
  // Chromium treats http://localhost as a secure origin, so a Secure `__Host-` cookie is stored and sent there.
  const host = new URL(baseURL).hostname
  await context.addCookies([{ name: MFA_OK_COOKIE, value: mfaOkCookieValue(uid), domain: host, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
}

/** An ID token from the Auth emulator (password sign-in), for calling the API routes directly. */
export async function idToken(request: APIRequestContext, role: SeedRole): Promise<string> {
  const user = seedUser(role)
  const response = await request.post(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=e2e-key`, {
    data: { email: user.email, password: SEED_PASSWORD, returnSecureToken: true },
  })
  expect(response.ok()).toBeTruthy()
  return ((await response.json()) as { idToken: string }).idToken
}

/** Headers for an owner-route call as `role`: their ID token and (optionally) their own MFA cookie. */
export async function apiHeaders(request: APIRequestContext, role: SeedRole, withMfa = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await idToken(request, role)}` }
  if (withMfa) headers.Cookie = `${MFA_OK_COOKIE}=${mfaOkCookieValue(seedUser(role).uid)}`
  return headers
}

/**
 * Signs the owner in through the real login page, then completes the second step with the signed cookie the verify
 * route would write (the emailed code itself is covered by the MFA unit tests; the emulator sends no email). Opening
 * /auth/mfa then calls the status route, which mints the Firebase session cookie from the Auth emulator for the same
 * uid, so the middleware lets /developer through.
 */
export async function signInOwner(page: Page, baseURL: string) {
  await page.goto('/developer-login')
  await page.locator('input[type="password"]').first().fill(SEED_PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/auth\/mfa/)
  await addMfaCookie(page.context(), baseURL, seedUser('owner').uid)
  await page.goto('/auth/mfa?next=%2Fdeveloper')
  await page.waitForURL(/\/developer(\?|$)/)
  await expect(page.getByTestId('owner-console')).toBeVisible()
}

/**
 * Errors the harness itself causes, never the app: each names why. Anything else fails the page.
 * - Register interest reads its list through /api/interest/registrations, which needs the server's storage
 *   (Netlify Blobs / the service-account key) that the emulator harness does not have; the page then falls back to
 *   the live Firestore listener, as on a site without the key. The browser logs the refused fetch as a console error.
 *   Each page load asks again, so a fast walk through every page also meets that route's own limit (429, 40 per
 *   10 minutes) — listed as a follow-up in the PR.
 * - A Firestore listen channel that the page closed (navigating away) is answered 400 "unknown session" by the
 *   emulator; the SDK opens a new one. A refused listener is reported inside the stream, never as this HTTP status.
 */
export const HARNESS_EXPECTED_ERRORS: RegExp[] = [
  /(503|429) GET \S+\/api\/interest\/registrations/,
  /400 (GET|POST) http:\/\/127\.0\.0\.1:8080\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel/,
]
const BROWSER_RESOURCE_ERROR = /^Failed to load resource: the server responded with a status of (\d{3})/

/** Collects console errors, page errors and failed requests while a test runs (minus HARNESS_EXPECTED_ERRORS). */
export function watchConsole(page: Page): string[] {
  const errors: string[] = []
  const expectedStatuses: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const resource = message.text().match(BROWSER_RESOURCE_ERROR)
    // The named request (below) carries the URL; drop the browser's unnamed copy of an expected one.
    if (resource && expectedStatuses.includes(resource[1])) {
      expectedStatuses.splice(expectedStatuses.indexOf(resource[1]), 1)
      return
    }
    errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  // Name the failing request: the browser's own message ("Failed to load resource") does not say which one.
  page.on('response', (response) => {
    if (response.status() < 400) return
    const line = `${response.status()} ${response.request().method()} ${response.url()}`
    if (HARNESS_EXPECTED_ERRORS.some((pattern) => pattern.test(line))) expectedStatuses.push(String(response.status()))
    else errors.push(line)
  })
  return errors
}

/** Text that must never reach the screen. */
export const FORBIDDEN_TEXT = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/]

/**
 * Waits for a console page to finish its first load. Firestore listeners keep a connection open, so the network is
 * never idle: wait for the page load, then for the "Loading…" / "Refreshing…" notes to go.
 */
export async function settle(page: Page) {
  await page.waitForLoadState('load')
  await page
    .waitForFunction(() => !/\b(Loading|Refreshing|Checking owner access)\b/.test(document.querySelector('main')?.textContent || ''), undefined, { timeout: 20_000 })
    .catch(() => undefined)
  await page.waitForTimeout(500)
}
