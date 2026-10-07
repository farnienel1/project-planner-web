import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jobHubTiles } from './jobHubTiles.ts'

test('operatives do not see Scheduling or View, and respect materials/site-audit flags', () => {
  const tiles = jobHubTiles({
    isOperative: true,
    showViewTile: true,
    canViewMaterials: false,
    canViewSiteAudit: false,
  })
  assert.deepEqual(
    tiles.map((tile) => tile.href),
    ['tasks', 'health-safety', 'deadlines', 'location']
  )
})

test('managers see Scheduling, optional View, materials and site audit', () => {
  const tiles = jobHubTiles({
    isOperative: false,
    showViewTile: true,
    canViewMaterials: true,
    canViewSiteAudit: true,
    locationCaption: '12 High St',
  })
  assert.deepEqual(
    tiles.map((tile) => tile.label),
    ['Scheduling', 'View', 'Tasks', 'Materials', 'H&S', 'Deadlines', 'Site Audit', 'Location']
  )
  assert.equal(tiles.at(-1)?.desc, '12 High St')
})

test('Active users is a manager tile and stays hidden in operative mode', () => {
  const managerTiles = jobHubTiles({
    isOperative: false,
    showViewTile: false,
    canViewMaterials: true,
    canViewSiteAudit: true,
    showActiveUsers: true,
  })
  assert.equal(managerTiles.at(-1)?.href, 'active-users')
  assert.equal(managerTiles.at(-1)?.label, 'Active users')

  const operativeTiles = jobHubTiles({
    isOperative: true,
    showViewTile: false,
    canViewMaterials: true,
    canViewSiteAudit: true,
    showActiveUsers: true,
  })
  assert.equal(
    operativeTiles.some((tile) => tile.href === 'active-users'),
    false
  )
})
