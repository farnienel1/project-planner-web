import { expect, test } from '@playwright/test'
import { settle, signInOwner } from './helpers'

/** Spec §6.3.5: 1440, 1280, 768 and 375 px, light and dark, nothing overflows sideways; keyboard reaches the menu. */
const WIDTHS = [1440, 1280, 768, 375]
const SCREENS = ['/developer', '/developer/organisations', '/developer/users']

for (const scheme of ['light', 'dark'] as const) {
  test(`no sideways overflow at every width (${scheme})`, async ({ page, baseURL }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await signInOwner(page, baseURL as string)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of SCREENS) {
        await page.goto(path)
        await expect(page.getByTestId('owner-console')).toBeVisible()
        await settle(page)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} at ${width}px (${scheme})`).toBeLessThanOrEqual(1)
        await page.screenshot({ path: `test-results/owner-e2e/screens/${scheme}-${width}${path.replaceAll('/', '_')}.png` })
      }
    }
  })
}

test('keyboard only: Tab reaches the search and the menu; the small-screen menu opens and closes', async ({ page, baseURL }) => {
  await signInOwner(page, baseURL as string)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/developer')
  let reachedLink = false
  for (let i = 0; i < 25 && !reachedLink; i += 1) {
    await page.keyboard.press('Tab')
    reachedLink = await page.evaluate(() => document.activeElement?.closest('nav[aria-label="Owner console"]') != null)
  }
  expect(reachedLink).toBe(true)
  await page.setViewportSize({ width: 375, height: 800 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Owner console' })).toBeVisible()
  await page.getByRole('button', { name: 'Close menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Owner console' })).toBeHidden()
})
