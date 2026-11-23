import test from 'node:test'
import assert from 'node:assert/strict'
import { createBackNavigationGuard, type TraverseInput } from './backNavigationGuard'

const PAGE = 'https://app.example/dashboard/site-audit/new'
const HUB = 'https://app.example/dashboard/site-audit'

function traverse(over: Partial<TraverseInput> = {}): TraverseInput {
  return {
    navigationType: 'traverse',
    sameDocument: true,
    cancelable: true,
    destinationKey: 'k-hub',
    destinationUrl: HUB,
    currentKey: 'k-page',
    currentUrl: PAGE,
    ...over,
  }
}

test('Cancel on a cancelable Back prevents it, and the guard stays armed for the next Back', () => {
  const guard = createBackNavigationGuard()
  assert.equal(guard.onNavigate(traverse(), () => false), 'prevent')
  assert.equal(guard.busy(), false)
  assert.equal(guard.onNavigate(traverse(), () => false), 'prevent')
  assert.deepEqual(guard.onPopState(), { action: 'pass' })
})

test('OK lets the traversal go exactly where the browser was going (one step, or a long-press jump)', () => {
  const guard = createBackNavigationGuard()
  assert.equal(guard.onNavigate(traverse(), () => true), 'allow')
  assert.equal(guard.onNavigate(traverse({ destinationKey: 'k-three-back' }), () => true), 'allow')
  assert.deepEqual(guard.onPopState(), { action: 'pass' })
})

test('Cancel on a non-cancelable Back: the popstate is swallowed and the page returns to its own entry, without asking again', () => {
  const guard = createBackNavigationGuard()
  let asked = 0
  const ask = () => {
    asked += 1
    return false
  }
  assert.equal(guard.onNavigate(traverse({ cancelable: false }), ask), 'restore')
  assert.equal(guard.busy(), true)
  assert.deepEqual(guard.onPopState(), { action: 'swallowAndReturn', key: 'k-page' })
  // The return traversal (to our own entry) is allowed without a question.
  assert.equal(
    guard.onNavigate(traverse({ cancelable: false, destinationKey: 'k-page', destinationUrl: PAGE, currentKey: 'k-hub', currentUrl: HUB }), ask),
    'allow'
  )
  assert.deepEqual(guard.onPopState(), { action: 'swallow' })
  assert.equal(guard.busy(), false)
  assert.equal(asked, 1)
  // Back again afterwards asks again.
  assert.equal(guard.onNavigate(traverse(), ask), 'prevent')
  assert.equal(asked, 2)
})

test('a multi-step non-cancelable jump is undone to the exact entry the person was on', () => {
  const guard = createBackNavigationGuard()
  guard.onNavigate(traverse({ cancelable: false, destinationKey: 'k-five-back', currentKey: 'k-page' }), () => false)
  assert.deepEqual(guard.onPopState(), { action: 'swallowAndReturn', key: 'k-page' })
})

test('not asked: push / replace / reload, another document, the same route, nothing unsaved', () => {
  const guard = createBackNavigationGuard()
  const never = () => {
    throw new Error('must not ask')
  }
  assert.equal(guard.onNavigate(traverse({ navigationType: 'push' }), never), 'allow')
  assert.equal(guard.onNavigate(traverse({ navigationType: 'reload' }), never), 'allow')
  assert.equal(guard.onNavigate(traverse({ sameDocument: false }), never), 'allow')
  assert.equal(guard.onNavigate(traverse({ destinationUrl: `${PAGE}#photos` }), never), 'allow')
  assert.equal(guard.onNavigate(traverse(), () => true), 'allow')
  assert.deepEqual(guard.onPopState(), { action: 'pass' })
})

test('a restore whose popstate never came is forgotten by the next navigation, so an unrelated popstate is not swallowed', () => {
  const guard = createBackNavigationGuard()
  guard.onNavigate(traverse({ cancelable: false }), () => false)
  guard.onNavigate(traverse({ navigationType: 'push' }), () => true)
  assert.equal(guard.busy(), false)
  assert.deepEqual(guard.onPopState(), { action: 'pass' })
})

test('with no current entry key a non-cancelable Back cannot be undone and is allowed', () => {
  const guard = createBackNavigationGuard()
  assert.equal(guard.onNavigate(traverse({ cancelable: false, currentKey: null }), () => false), 'allow')
})
