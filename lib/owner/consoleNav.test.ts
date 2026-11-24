import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { CONSOLE_NAV, CONSOLE_UNLISTED_ROUTES, activeConsoleHref, consolePageUsesPeriod, visibleConsoleNav } from './consoleNav.ts'

function pageFile(href: string): string {
  return new URL(`../../app${href}/page.tsx`, import.meta.url).pathname
}

test('spec §4: the sidebar groups, in order', () => {
  assert.deepEqual(
    CONSOLE_NAV.map((group) => group.label),
    ['Today', 'Customers', 'Money', 'Product', 'Platform', 'Record', 'Account']
  )
})

test('useful-only: every menu entry has a page; nothing planned or unconnected is listed', () => {
  for (const group of visibleConsoleNav()) {
    for (const item of group.items) {
      assert.ok(item.href, item.label)
      assert.ok(existsSync(pageFile(item.href)), `${item.label}: ${item.href} has no page`)
    }
  }
  const shownLabels = visibleConsoleNav().flatMap((group) => group.items.map((item) => item.label))
  for (const hidden of ['Needs you', 'Timesheet value', 'Emails & notifications', 'Releases & switches', 'Audit log']) {
    assert.equal(shownLabels.includes(hidden), false, hidden)
  }
  assert.equal(shownLabels.includes('Website stats'), false)
  // 1.84.0 (D7): Errors reads clientErrors.
  assert.equal(shownLabels.includes('Errors'), true)
})

test('spec §6.6: every old console page is still a route, listed or not', () => {
  const old = ['', '/organisations', '/users', '/growth', '/revenue', '/usage', '/pages', '/website-stats', '/analytics', '/feedback', '/register-interest', '/roadmap', '/data-quality', '/account']
  for (const suffix of old) assert.ok(existsSync(pageFile(`/developer${suffix}`)), suffix)
  for (const route of CONSOLE_UNLISTED_ROUTES) assert.ok(existsSync(pageFile(route.href)), route.href)
})

test('every item carries a note (what it reads, or why it is not shown)', () => {
  for (const group of CONSOLE_NAV) for (const item of group.items) assert.ok(item.note.length > 5, item.label)
})

test('the current page mark follows the longest address', () => {
  assert.equal(activeConsoleHref('/developer'), '/developer')
  assert.equal(activeConsoleHref('/developer/organisations/abc'), '/developer/organisations')
  assert.equal(activeConsoleHref('/developer/website-stats'), null)
  assert.equal(consolePageUsesPeriod('/developer'), true)
  assert.equal(consolePageUsesPeriod('/developer/users'), false)
})
