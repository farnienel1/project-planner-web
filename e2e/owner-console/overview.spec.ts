import { expect, test } from '@playwright/test'
import { apiHeaders, expected, settle, signInOwner } from './helpers'

/**
 * Owner console PR 2: the Overview (spec §4.1). The server runs at the real time while the seed is fixed at
 * SEED_NOW, so only the date-independent figures are compared here; the dated ones are unit-tested at SEED_NOW
 * (lib/owner/commandCentre.test.ts).
 */
test('overview route: MRR and the attention list equal the seed fixtures', async ({ request }) => {
  const headers = await apiHeaders(request, 'owner')
  const response = await request.get('/api/owner/overview?period=month', { headers })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.headline.mrr.pence).toBe(expected.commandCentre.mrr.pence)
  expect(body.headline.mrr.payingOrganisations).toBe(expected.commandCentre.mrr.payingOrganisations)
  const ids = body.attention.map((row: { orgId: string }) => row.orgId)
  for (const id of ['org-scheduled', 'org-lapsed', 'org-unfinished']) expect(ids).toContain(id)
  expect(ids).not.toContain('org-test')
})

test.describe('overview page', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signInOwner(page, baseURL as string)
  })

  test('every figure links to its list; attention rows and feed rows open the organisation', async ({ page }) => {
    await page.goto('/developer')
    await settle(page)
    const headline = page.getByTestId('overview-headline')
    await expect(headline).toBeVisible()
    await expect(page.getByTestId('overview-mrr')).toContainText('£148')
    for (const [metric, href] of [
      ['activeOrganisations', '/developer/organisations'],
      // Owner console PR 5: the people tiles open the matching list for the selected period (default This month).
      ['activePeople', '/developer/users?seen=month'],
      ['mrr', '/developer/revenue'],
      ['newPeople', '/developer/users?joined=month'],
      ['newOrganisations', '/developer/organisations'],
    ] as const) {
      const links = page.getByTestId(`overview-${metric}`).getByRole('link')
      await expect(links.first()).toHaveAttribute('href', href)
    }
    const closing = page.getByTestId('overview-attention').getByRole('link', { name: /Closing Co/ })
    await expect(closing).toContainText('Scheduled for deletion')
    await closing.click()
    await page.waitForURL(/\/developer\/organisations\/org-scheduled$/)
  })

  test('Include test data brings the test company into the feed', async ({ page }) => {
    await page.goto('/developer')
    await settle(page)
    const feed = page.getByTestId('overview-feed')
    await expect(feed).not.toContainText('New organisation: Demo Co (internal)')
    await page.getByTestId('include-test-data').click()
    await expect(feed).toContainText('New organisation: Demo Co (internal)')
    await page.getByTestId('include-test-data').click()
  })

  test('the old scoreboard is on Growth, with the period selector', async ({ page }) => {
    await page.goto('/developer/growth')
    await settle(page)
    await expect(page.getByTestId('platform-scoreboard')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Period' })).toBeVisible()
  })
})
