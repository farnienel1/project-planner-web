import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeUnsavedChangesMessage,
  confirmLeaveIfUnsaved,
  linkClickLeavesPage,
  registerUnsavedChangesGuard,
  resetUnsavedChangesGuardsForTests,
  type LinkClickInput,
} from '@/lib/navigation/unsavedChangesGuard'

const here = 'https://app.test/dashboard/site-audit/new'
const click = (over: Partial<LinkClickInput> = {}): LinkClickInput => ({
  href: 'https://app.test/dashboard',
  currentHref: here,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  target: '',
  download: false,
  defaultPrevented: false,
  ...over,
})

test('guard registry: nothing to ask until a page registers; the newest message wins; removal clears it', () => {
  resetUnsavedChangesGuardsForTests()
  assert.equal(activeUnsavedChangesMessage(), null)
  assert.equal(confirmLeaveIfUnsaved(() => false), true)
  const offA = registerUnsavedChangesGuard('A')
  const offB = registerUnsavedChangesGuard('B')
  assert.equal(activeUnsavedChangesMessage(), 'B')
  offB()
  assert.equal(activeUnsavedChangesMessage(), 'A')
  const asked: string[] = []
  assert.equal(confirmLeaveIfUnsaved((m) => (asked.push(m), false)), false)
  assert.equal(confirmLeaveIfUnsaved((m) => (asked.push(m), true)), true)
  assert.deepEqual(asked, ['A', 'A'])
  offA()
  offA()
  assert.equal(activeUnsavedChangesMessage(), null)
})

test('link clicks: an in-app link to another page leaves (sidebar, job tabs, header)', () => {
  assert.equal(linkClickLeavesPage(click()), true)
  assert.equal(linkClickLeavesPage(click({ href: '/dashboard/projects/p1/tasks' })), true)
  assert.equal(linkClickLeavesPage(click({ href: '/dashboard/site-audit/new?job=1' })), true)
  assert.equal(linkClickLeavesPage(click({ target: '_self' })), true)
})

test('link clicks that lose nothing are never asked about', () => {
  assert.equal(linkClickLeavesPage(click({ href: null })), false)
  assert.equal(linkClickLeavesPage(click({ href: '#top' })), false)
  assert.equal(linkClickLeavesPage(click({ href: here })), false)
  assert.equal(linkClickLeavesPage(click({ metaKey: true })), false)
  assert.equal(linkClickLeavesPage(click({ ctrlKey: true })), false)
  assert.equal(linkClickLeavesPage(click({ shiftKey: true })), false)
  assert.equal(linkClickLeavesPage(click({ altKey: true })), false)
  assert.equal(linkClickLeavesPage(click({ button: 1 })), false)
  assert.equal(linkClickLeavesPage(click({ target: '_blank' })), false)
  assert.equal(linkClickLeavesPage(click({ download: true })), false)
  assert.equal(linkClickLeavesPage(click({ defaultPrevented: true })), false)
  // Another site: the browser's own beforeunload asks.
  assert.equal(linkClickLeavesPage(click({ href: 'https://example.com/' })), false)
  assert.equal(linkClickLeavesPage(click({ href: 'mailto:a@b.test' })), false)
})
