import { expect, test } from '@playwright/test'
import { FORBIDDEN_TEXT, settle, signInOwner, watchConsole } from './helpers'

/** Every console page loads for the owner with no console errors and no broken text (spec §6.3.5). */
const PAGES = [
  '/developer',
  '/developer/organisations',
  '/developer/organisations/org-large',
  '/developer/users',
  '/developer/growth',
  '/developer/revenue',
  '/developer/usage',
  '/developer/analytics',
  '/developer/feedback',
  '/developer/register-interest',
  '/developer/roadmap',
  '/developer/data-quality',
  '/developer/account',
  // Kept at their address, not in the menu (D8; no error source connected).
  '/developer/pages',
  '/developer/website-stats',
]

const SIDEBAR = {
  Today: ['Overview'],
  Customers: ['Organisations', 'People', 'Register interest'],
  Money: ['Revenue'],
  Product: ['Growth & engagement', 'Feature usage', 'Analytics', 'Feedback', 'Roadmap'],
  Platform: ['Status', 'Health & data', 'Errors'],
}

test.describe('owner console pages', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signInOwner(page, baseURL as string)
  })

  test('every page loads with no console errors and no undefined / NaN / [object Object]', async ({ page }) => {
    for (const path of PAGES) {
      const errors = watchConsole(page)
      await page.goto(path)
      await expect(page.getByTestId('owner-console')).toBeVisible()
      await settle(page)
      const text = await page.locator('main').innerText()
      for (const pattern of FORBIDDEN_TEXT) expect(text, `${path}: ${pattern}`).not.toMatch(pattern)
      expect(errors, `${path}: console errors`).toEqual([])
      page.removeAllListeners('console')
      page.removeAllListeners('pageerror')
      page.removeAllListeners('response')
    }
  })

  test('the sidebar has the spec §4 groups, only built pages, and every link opens its page', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Owner console' })
    for (const [group, labels] of Object.entries(SIDEBAR)) {
      await expect(nav.getByText(group, { exact: true })).toBeVisible()
      // A badge (triage count) can follow the label, so the name starts with it.
      for (const label of labels) await expect(nav.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible()
    }
    for (const missing of ['Needs you', 'Timesheet value', 'Website stats', 'Audit log', 'Pages & errors']) {
      await expect(nav.getByRole('link', { name: missing, exact: true })).toHaveCount(0)
    }
    const links = await nav.getByRole('link').all()
    const hrefs = await Promise.all(links.map((link) => link.getAttribute('href')))
    for (const href of hrefs) {
      await nav.locator(`a[href="${href}"]`).click()
      await page.waitForURL((url) => url.pathname === href)
      await expect(nav.locator(`a[href="${href}"]`)).toHaveAttribute('aria-current', 'page')
    }
  })

  test('the period selector appears only where a page reads it, and remembers the choice', async ({ page }) => {
    await page.goto('/developer')
    const group = page.getByRole('group', { name: 'Period' })
    await expect(group).toBeVisible()
    await group.getByRole('button', { name: 'This week' }).click()
    await expect(group.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/developer/users')
    await expect(page.getByRole('group', { name: 'Period' })).toHaveCount(0)
  })
})
