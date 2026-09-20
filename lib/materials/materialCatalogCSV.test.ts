import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATALOGUE_CSV_HEADER,
  exportCatalogueCsv,
  exportCatalogueTemplateCsv,
  parseCatalogueCsv,
} from './materialCatalogCSV.ts'
import type { MaterialCatalogItem } from '../../types/index.ts'

const item: MaterialCatalogItem = {
  id: 'ABC',
  name: 'T&E 2.5mm',
  brand: 'Prysmian',
  productCode: 'TE25',
  defaultUnit: 'Length',
  size: '2.5mm',
  length: '100',
  lengthUnit: 'M',
  category: 'Electrical',
  createdAt: new Date(),
  createdByUserId: 'u1',
  createdByName: 'Ada',
}

test('exportCatalogueCsv uses the exact iOS header', () => {
  const csv = exportCatalogueCsv([item])
  assert.equal(csv.split('\n')[0], CATALOGUE_CSV_HEADER)
  assert.match(csv, /ABC,T&E 2.5mm,Electrical,Prysmian,TE25,Length,2.5mm,100,M/)
})

test('exportCatalogueTemplateCsv is headers only', () => {
  assert.equal(exportCatalogueTemplateCsv(), `${CATALOGUE_CSV_HEADER}\n`)
})

test('parseCatalogueCsv fills brand/category defaults and skips in-file duplicates', () => {
  const csv = `${CATALOGUE_CSV_HEADER}
,Cable,, ,C1,Number,,,
,Cable,, ,C1,Number,,,
`
  const parsed = parseCatalogueCsv(csv)
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0].brand, 'Unknown')
  assert.equal(parsed.rows[0].category, 'Other')
})
