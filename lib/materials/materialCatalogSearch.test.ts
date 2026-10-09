import assert from 'node:assert/strict'
import test from 'node:test'
import { filterCatalogueItems, searchMaterialCatalogue } from './materialCatalogSearch.ts'
import type { MaterialCatalogItem } from '@/types'

function item(name: string, extra: Partial<MaterialCatalogItem> = {}): MaterialCatalogItem {
  return {
    id: extra.id || name,
    name,
    brand: extra.brand || 'Custom',
    productCode: extra.productCode,
    defaultUnit: extra.defaultUnit || 'Drum',
    size: extra.size,
    length: extra.length,
    category: extra.category || 'Cable',
    createdAt: new Date(),
    createdByUserId: 'u1',
    createdByName: 'Tester',
  }
}

test('project material search returns every catalogue hit for 2.5mm LS, ranked', () => {
  const catalogue = [
    item('M6 Coach Screw', { id: 'screw', defaultUnit: 'Number', category: 'Fixings' }),
    item('1.5mm2 Twin & Earth Cable 6242Y LSZH (100m Drum)', { id: '15', productCode: '6242Y' }),
    item('2.5mm2 Twin & Earth Cable 6242B LSZH (100m Drum)', { id: '25', productCode: '6242B' }),
    item('4mm2 Twin & Earth Cable 6242B LSZH (100m Drum)', { id: '40', productCode: '6242B-4' }),
  ]
  const hits = searchMaterialCatalogue('2.5mm LS', catalogue, [], 80)
  assert.ok(hits.length >= 1)
  assert.equal(hits[0].name, '2.5mm2 Twin & Earth Cable 6242B LSZH (100m Drum)')
  assert.equal(
    hits.some((row) => row.name.startsWith('2.5mm2')),
    true
  )
  assert.equal(
    hits.some((row) => row.name.startsWith('M6')),
    false
  )
  const all = filterCatalogueItems('2.5mm LS', catalogue)
  assert.equal(all[0].id, '25')
  assert.ok(all.length >= 1)
})
