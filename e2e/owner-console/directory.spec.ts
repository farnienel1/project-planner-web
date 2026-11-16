import { expect, test } from '@playwright/test'
import { apiHeaders, expected, signInOwner } from './helpers'

/** The PR 1 routes return the hand-worked seed figures (scripts/owner-console-seed/expected.json). */
test('directory, counts and search routes equal the seed fixtures', async ({ request }) => {
  const headers = await apiHeaders(request, 'owner')
  const json = async (path: string) => {
    const response = await request.get(path, { headers })
    expect(response.status(), path).toBe(200)
    return response.json()
  }
  expect((await json('/api/owner/directory/orgs?includeTestData=1')).total).toBe(expected.organisations.rows)
  expect((await json('/api/owner/directory/orgs')).total).toBe(expected.organisations.rowsWithoutTest)
  expect((await json('/api/owner/directory/orgs?filter=scheduled')).total).toBe(expected.organisations.scheduled)
  expect((await json('/api/owner/directory/people?includeTestData=1')).total).toBe(expected.people.rows)
  expect((await json('/api/owner/directory/people')).total).toBe(expected.people.rowsWithoutTest)
  expect((await json('/api/owner/directory/people?filter=pending&includeTestData=1')).total).toBe(expected.people.pending)
  const counts = await json('/api/owner/counts')
  expect(counts.organisations).toBe(expected.counts.organisationsWithoutTest)
  expect(counts.accounts).toBe(expected.counts.accountsWithoutTest)
  const withTest = await json('/api/owner/counts?includeTestData=1')
  expect(withTest.organisations).toBe(expected.counts.organisations)
  expect(withTest.accounts).toBe(expected.counts.accounts)
  const search = await json('/api/owner/search?q=dee%40dual')
  expect(search.people.map((row: { id: string }) => row.id)).toEqual(['dual-1'])
})

test('header counts link to their lists and follow Include test data; search opens an organisation', async ({ page, baseURL }) => {
  await signInOwner(page, baseURL as string)
  const counts = page.getByTestId('console-counts')
  await expect(counts).toContainText(`${expected.counts.organisationsWithoutTest} organisations`)
  await expect(counts).toContainText(`${expected.counts.accountsWithoutTest} accounts`)
  await page.getByTestId('include-test-data').click()
  await expect(counts).toContainText(`${expected.counts.organisations} organisations`)
  await page.getByTestId('include-test-data').click()
  await counts.getByRole('link', { name: /organisations/ }).click()
  await page.waitForURL(/\/developer\/organisations$/)

  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('owner-search')).toBeFocused()
  await page.getByTestId('owner-search').fill('Large Build')
  const result = page.locator('#owner-search-results a[href="/developer/organisations/org-large"]')
  await expect(result).toBeVisible()
  await result.click()
  await page.waitForURL(/\/developer\/organisations\/org-large$/)
})
