import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveBootTheme, themeToggleCopy } from './theme.ts'

test('boot theme uses saved preference over the system setting', () => {
  assert.equal(resolveBootTheme('light', true), 'light')
  assert.equal(resolveBootTheme('dark', false), 'dark')
})

test('boot theme follows the system when nothing is saved', () => {
  assert.equal(resolveBootTheme(null, true), 'dark')
  assert.equal(resolveBootTheme(null, false), 'light')
})

test('account menu toggle label flips with the current theme', () => {
  assert.deepEqual(themeToggleCopy(false), { label: 'Dark mode', icon: 'moon' })
  assert.deepEqual(themeToggleCopy(true), { label: 'Light mode', icon: 'sun' })
})
