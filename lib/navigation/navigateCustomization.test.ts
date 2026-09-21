import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addEntry,
  availableCatalogItems,
  defaultNavigateConfig,
  moveEntry,
  parseNavigateConfig,
  removeEntry,
  resolveNavigateRows,
  type NavigateConfig,
} from './navigateCustomization.ts'
import type { DashboardNavItem } from './dashboardNavigation.ts'

function item(partial: Pick<DashboardNavItem, 'id' | 'href' | 'label' | 'section'>): DashboardNavItem {
  return {
    subtitle: '',
    navigationLabelKey: partial.id,
    iconPath: '',
    tileClasses: '',
    ...partial,
  }
}

const catalog: DashboardNavItem[] = [
  item({ id: 'dashboard_home', href: '/dashboard', label: 'Home', section: 'home' }),
  item({ id: 'dashboard_projects', href: '/dashboard/projects', label: 'Projects', section: 'navigate' }),
  item({ id: 'dashboard_small_works', href: '/dashboard/small-works', label: 'Small works', section: 'navigate' }),
  item({ id: 'dashboard_warnings', href: '/dashboard/warnings', label: 'Warnings', section: 'tools' }),
]

test('parseNavigateConfig ignores unknown shapes and keeps project shortcuts', () => {
  const parsed = parseNavigateConfig({
    version: 1,
    entries: [
      { type: 'item', id: 'dashboard_projects' },
      { type: 'project', id: 'P1', label: 'Riverside', jobNumber: 'J-1' },
      { type: 'nope', id: 'x' },
      { type: 'item', id: '' },
    ],
  })
  assert.ok(parsed)
  assert.equal(parsed!.entries.length, 2)
  assert.equal(parsed!.entries[1].type, 'project')
})

test('resolveNavigateRows skips removed pages and keeps finished-job shortcuts', () => {
  const config: NavigateConfig = {
    version: 1,
    entries: [
      { type: 'item', id: 'dashboard_projects' },
      { type: 'item', id: 'dashboard_gone' },
      { type: 'smallWorks', id: 'SW1', label: 'Loft', jobNumber: 'SW-9' },
    ],
  }
  const rows = resolveNavigateRows(config, catalog.filter((i) => i.section === 'navigate'), catalog)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].href, '/dashboard/projects')
  assert.equal(rows[1].href, '/dashboard/small-works/SW1')
  assert.equal(rows[1].label, 'SW-9 · Loft')
})

test('add, remove and reorder Navigate entries', () => {
  let config = defaultNavigateConfig(catalog.filter((i) => i.section === 'navigate'))
  config = addEntry(config, { type: 'project', id: 'P1', label: 'Site A', jobNumber: 'J-1' })
  config = addEntry(config, { type: 'project', id: 'P1', label: 'Site A', jobNumber: 'J-1' })
  assert.equal(config.entries.filter((e) => e.type === 'project').length, 1)
  config = moveEntry(config, config.entries.length - 1, 0)
  assert.equal(config.entries[0].type, 'project')
  config = removeEntry(config, 'project:P1')
  assert.equal(config.entries.some((e) => e.type === 'project'), false)
  const leftover = availableCatalogItems(config, catalog)
  assert.ok(leftover.some((item) => item.id === 'dashboard_warnings'))
  assert.equal(leftover.some((item) => item.id === 'dashboard_home'), false)
})
