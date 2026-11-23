import { expect, test } from '@playwright/test'
import { SEED_PASSWORD } from '../../scripts/owner-console-seed/seedConstants.mjs'
import { addMfaCookie, apiHeaders, seedUser, SESSION_COOKIE } from './helpers'

/** Spec §1.1 / §6.3.5: only the platform owner gets in; org roles are refused on every page and owner route. */
const OWNER_ROUTES = [
  '/api/owner/counts',
  '/api/owner/directory/orgs',
  '/api/owner/directory/people',
  '/api/owner/search?q=large',
  '/api/owner/overview?period=month',
  '/api/owner/directory/people?seen=month',
  '/api/owner/people/op-large-001',
]

test.describe('owner routes refuse everyone but the owner', () => {
  for (const path of OWNER_ROUTES) {
    test(`signed out: ${path} is 401`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(401)
    })

    for (const role of ['superAdmin', 'admin', 'manager', 'operative'] as const) {
      test(`${role}: ${path} is 403 even with their own MFA cookie`, async ({ request }) => {
        const response = await request.get(path, { headers: await apiHeaders(request, role) })
        expect(response.status()).toBe(403)
      })
    }

    test(`owner without the MFA cookie: ${path} is 403`, async ({ request }) => {
      const response = await request.get(path, { headers: await apiHeaders(request, 'owner', false) })
      expect(response.status()).toBe(403)
    })
  }

  test('the old action routes refuse an org Super Admin too', async ({ request }) => {
    const headers = { ...(await apiHeaders(request, 'superAdmin')), 'Content-Type': 'application/json' }
    for (const path of [
      '/api/owner/mark-internal',
      '/api/owner/audit',
      '/api/owner/send-password-reset',
      '/api/owner/restore-organisation',
      // Owner console PR 5
      '/api/owner/actions/change-name',
      '/api/owner/actions/revoke-sessions',
      '/api/owner/change-email',
      '/api/owner/reverify',
      '/api/owner/people/op-large-001/reveal-email',
    ]) {
      const response = await request.post(path, { headers, data: { orgId: 'org-small', uid: seedUser('operative').uid, action: 'x' } })
      expect(response.status(), path).toBe(403)
    }
  })
})

test('signed out, /developer goes to verification or login, never the console', async ({ page }) => {
  await page.goto('/developer')
  await expect(page).not.toHaveURL(/\/developer(\/|$)(?!-login)/)
  await expect(page.getByTestId('owner-console')).toHaveCount(0)
})

test('an org Super Admin with a valid MFA cookie is sent away from /developer', async ({ page, baseURL }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').first().fill(seedUser('superAdmin').email)
  await page.locator('input[type="password"]').first().fill(SEED_PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/auth\/mfa/)
  await addMfaCookie(page.context(), baseURL as string, seedUser('superAdmin').uid)
  await page.goto('/developer')
  await page.waitForURL((url) => !url.pathname.startsWith('/developer') || url.pathname.startsWith('/developer-login'))
  await expect(page.getByTestId('owner-console')).toHaveCount(0)
})

/** Owner decision 17 Nov: the page gate needs the MFA cookie AND the Firebase session cookie, for the same uid. */
test('a valid MFA cookie alone (no session cookie) never opens /dashboard', async ({ page, baseURL }) => {
  await addMfaCookie(page.context(), baseURL as string, seedUser('superAdmin').uid)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/mfa/)
})

test('the session cookie is minted for the signed-in uid and an MFA cookie for another uid is refused', async ({ page, baseURL }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').first().fill(seedUser('superAdmin').email)
  await page.locator('input[type="password"]').first().fill(SEED_PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/auth\/mfa/)
  await addMfaCookie(page.context(), baseURL as string, seedUser('superAdmin').uid)
  await page.goto('/auth/mfa?next=%2Fdashboard')
  await page.waitForURL(/\/dashboard(\/|\?|$)/)
  const session = (await page.context().cookies()).find((cookie) => cookie.name === SESSION_COOKIE)
  expect(session?.httpOnly).toBe(true)
  expect(session?.secure).toBe(true)
  expect(session?.sameSite).toBe('Lax')

  // The same browser now carries an MFA cookie for a different person: the session (super admin) no longer matches.
  await addMfaCookie(page.context(), baseURL as string, seedUser('operative').uid)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/mfa/)
})
