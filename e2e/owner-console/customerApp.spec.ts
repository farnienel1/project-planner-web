import { expect, test } from '@playwright/test'
import { SEED_PASSWORD } from '../../scripts/owner-console-seed/seedConstants.mjs'
import { addMfaCookie, seedUser, watchConsole } from './helpers'

/** Guardrail 7 / spec §6.3.6 (first part): an organisation admin still signs in and reaches their dashboard. */
test('an organisation Super Admin signs in and opens the dashboard', async ({ page, baseURL }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').first().fill(seedUser('superAdmin').email)
  await page.locator('input[type="password"]').first().fill(SEED_PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/auth\/mfa/)
  await addMfaCookie(page.context(), baseURL as string, seedUser('superAdmin').uid)
  const errors = watchConsole(page)
  await page.goto('/auth/mfa?next=%2Fdashboard')
  await page.waitForURL(/\/dashboard/)
  await expect(page.locator('body')).toContainText('Large Build Ltd')
  expect(errors.filter((text) => !/favicon/i.test(text))).toEqual([])
})
