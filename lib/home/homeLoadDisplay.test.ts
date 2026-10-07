import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activeProjectSubtitle,
  readRememberedHomeCount,
  shownHomeCount,
  warningStatusLabel,
  writeRememberedHomeCount,
} from './homeLoadDisplay.ts'

test('an unfinished warning scan is not All clear', () => {
  assert.equal(warningStatusLabel(null), 'Scanning…')
  assert.equal(warningStatusLabel(0), 'All clear')
  assert.equal(warningStatusLabel(12), '12 active')
})

test('active project subtitle stays on loading until the jobs have been read', () => {
  assert.equal(activeProjectSubtitle(null), 'Loading projects…')
  assert.equal(activeProjectSubtitle(1), '1 active project')
  assert.equal(activeProjectSubtitle(4), '4 active projects')
})

test('a remembered company count stays up until the new read finishes', () => {
  const memory = new Map<string, string>()
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
  }
  writeRememberedHomeCount(storage, 'warnings', 'org-1', 12)
  assert.equal(readRememberedHomeCount(storage, 'warnings', 'org-1'), 12)
  assert.equal(readRememberedHomeCount(storage, 'warnings', 'org-2'), null)
  assert.equal(shownHomeCount(null, 12), 12)
  assert.equal(shownHomeCount(9, 12), 9)
  assert.equal(shownHomeCount(0, 12), 0)
})
