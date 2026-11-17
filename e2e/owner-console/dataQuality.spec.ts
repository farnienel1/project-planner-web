import { expect, test } from '@playwright/test'
import { settle, signInOwner, watchConsole } from './helpers'

/**
 * Owner bug 17 Nov: Data quality → Test organisations → "Mark internal" did nothing. The list held only organisations
 * already marked, so the click re-wrote the same flags and the row looked the same. Now an unmarked organisation is
 * offered, the button shows progress, the row says what happened, and it moves to "Marked internal".
 * The test unmarks it again at the end, so the seed's counts stay as expected.json says for the later specs.
 */
test.describe('owner console data quality', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signInOwner(page, baseURL as string)
  })

  test('Mark internal marks an organisation, shows progress and a message on its row, and Unmark undoes it', async ({ page }) => {
    const errors = watchConsole(page)
    await page.goto('/developer/data-quality')
    await settle(page)

    const marked = page.getByRole('list', { name: 'Organisations marked internal' })
    const markable = page.getByRole('list', { name: 'Organisations not marked internal' })
    // The seeded test company is listed as marked, never offered the button again.
    const demo = marked.getByRole('listitem').filter({ hasText: 'Demo Co (internal)' })
    await expect(demo.getByText('Marked internal', { exact: true })).toBeVisible()
    await expect(demo.getByRole('button', { name: 'Mark internal' })).toHaveCount(0)

    await page.getByRole('searchbox', { name: 'Search organisations to mark internal' }).fill('dublin')
    const row = markable.getByRole('listitem').filter({ hasText: 'Dublin Fitters' })
    await expect(row).toHaveCount(1)
    const request = page.waitForResponse((response) => response.url().endsWith('/api/owner/mark-internal'))
    await row.getByRole('button', { name: 'Mark internal' }).click()
    expect((await request).status()).toBe(200)

    const done = marked.getByRole('listitem').filter({ hasText: 'Dublin Fitters' })
    await expect(done.getByText('Marked internal', { exact: true })).toBeVisible()
    await expect(done.getByRole('status')).toHaveText(/Marked internal\. It is now hidden from customer counts\./)
    await expect(markable.getByRole('listitem').filter({ hasText: 'Dublin Fitters' })).toHaveCount(0)

    // Still marked after a full reload (the flag was stored, not only shown).
    await page.reload()
    await settle(page)
    const reloaded = page.getByRole('list', { name: 'Organisations marked internal' }).getByRole('listitem').filter({ hasText: 'Dublin Fitters' })
    await expect(reloaded.getByText('Marked internal', { exact: true })).toBeVisible()

    // Undo, so the later specs see the seed as it was.
    await reloaded.getByRole('button', { name: 'Unmark' }).click()
    await expect(page.getByRole('list', { name: 'Organisations not marked internal' }).getByRole('listitem').filter({ hasText: 'Dublin Fitters' })).toHaveCount(1)
    expect(errors).toEqual([])
  })
})
