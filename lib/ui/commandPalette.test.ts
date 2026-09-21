import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterPaletteItems, groupPaletteItems, type PaletteItem } from './commandPalette.ts'

const items: PaletteItem[] = [
  { group: 'Jobs', label: 'C984 · Broadwick', href: '/dashboard/projects/1', hue: 'proj' },
  { group: 'People', label: 'Test Admin', href: '/dashboard/users/a', meta: 'Admin', hue: 'user' },
  { group: 'Pages', label: 'Qualifications', href: '/dashboard/qualifications', hue: 'rep' },
  { group: 'Actions', label: 'New project', href: '/dashboard/projects/new', hue: 'proj' },
]

test('command palette filters across jobs, people, pages and actions', () => {
  assert.deepEqual(
    filterPaletteItems(items, 'qual').map((row) => row.label),
    ['Qualifications']
  )
  assert.deepEqual(
    filterPaletteItems(items, 'admin').map((row) => row.label),
    ['Test Admin']
  )
})

test('command palette groups keep existing live destinations', () => {
  const groups = groupPaletteItems(items)
  assert.deepEqual(
    groups.map((g) => g.group),
    ['Jobs', 'People', 'Pages', 'Actions']
  )
})
