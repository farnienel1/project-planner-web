import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATALOGUE_CSV_HEADER,
  catalogueCsvTextFromBytes,
  exportCatalogueCsv,
  exportCatalogueTemplateCsv,
  parseCatalogueCsv,
} from './materialCatalogCSV.ts'
import {
  MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE,
  MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE,
  MATERIAL_CATALOGUE_CSV_LEGACY_HEADER,
} from '../canonical/materialCatalogueCsv.ts'
import type { MaterialCatalogItem } from '../../types/index.ts'

const item: MaterialCatalogItem = {
  id: 'ABC',
  name: 'T&E 2.5mm',
  brand: 'Prysmian',
  productCode: 'TE25',
  defaultUnit: 'Drum',
  orderUnit: 'Drum',
  contentAmount: 100,
  contentMeasure: 'm',
  size: '2.5mm',
  category: 'Electrical',
  createdAt: new Date(),
  createdByUserId: 'u1',
  createdByName: 'Ada',
}

test('exportCatalogueCsv writes the 1.48.0 columns and no category notes', () => {
  const csv = exportCatalogueCsv([item])
  assert.equal(csv.split('\n')[0], CATALOGUE_CSV_HEADER)
  assert.equal(
    CATALOGUE_CSV_HEADER,
    'Catalogue ID,Name,Category,Manufacturer/Brand,Product Code,Order unit,Contents amount,Contents measure,Size,Default Type (Length Drum Box Pallet or Number),Length,Length Unit (M or MM)'
  )
  // The old columns follow, with the nearest old meaning, for older iPhones.
  assert.match(csv, /ABC,T&E 2.5mm,Electrical,Prysmian,TE25,Drum,100,m,2.5mm,Drum,100,M\n/)
  assert.match(exportCatalogueCsv([{ ...item, orderUnit: 'Reel' }]), /,Reel,100,m,2.5mm,Drum,100,M\n/)
  assert.match(exportCatalogueCsv([{ ...item, defaultUnit: 'Length', orderUnit: 'Metre', contentAmount: undefined, contentMeasure: undefined }]), /,Metre,,,2.5mm,Length,1,M\n/)
  assert.equal(csv.includes('# Categories'), false)
})

test('exportCatalogueCsv neutralises formulas in every text cell', () => {
  const csv = exportCatalogueCsv([{ ...item, name: '=1+1', brand: '+SUM(A1)', productCode: '@cmd', category: '-2' }])
  assert.match(csv, /'=1\+1,'-2,'\+SUM\(A1\),'@cmd/)
})

test('exportCatalogueTemplateCsv is headers only', () => {
  assert.equal(exportCatalogueTemplateCsv(), `${CATALOGUE_CSV_HEADER}\n`)
})

test('parseCatalogueCsv keeps a blank brand, defaults the category and skips in-file duplicates', () => {
  const csv = `${CATALOGUE_CSV_HEADER}
,Cable,, ,C1,Each,,,
,Cable,, ,C1,Each,,,
`
  const parsed = parseCatalogueCsv(csv)
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0].brand, '')
  assert.equal(parsed.rows[0].category, 'Other')
  assert.deepEqual(parsed.duplicateRows, [3])
})

test('parseCatalogueCsv still reads the old layout and ignores a leftover category note', () => {
  const csv = `${MATERIAL_CATALOGUE_CSV_LEGACY_HEADER}
# Project Planner category guide (this row is ignored on upload).
# Categories: Electrical | Lighting | Cable
ABC,T&E 2.5mm,Electrical,Prysmian,TE25,Length,2.5mm,100,M
DEF,Flex,Cable,,,Length,,1,M
GHI,Socket,Electrical,,,Number,1.0,,
`
  const parsed = parseCatalogueCsv(csv)
  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.rows.length, 3)
  assert.equal(parsed.rows[0].orderUnit, 'Length')
  assert.equal(parsed.rows[0].contentAmount, 100)
  assert.equal(parsed.rows[1].orderUnit, 'Metre')
  assert.equal(parsed.rows[2].orderUnit, 'Each')
  assert.equal(parsed.rows[2].size, '')
})

test('a round trip keeps a formula-looking name as plain text', () => {
  const parsed = parseCatalogueCsv(exportCatalogueCsv([{ ...item, name: '=HYPERLINK("x")' }]))
  assert.equal(parsed.rows[0].name, '=HYPERLINK("x")')
  // A tab-led cell: the apostrophe comes off before the tab becomes a space.
  const tabbed = parseCatalogueCsv(exportCatalogueCsv([{ ...item, name: '\t=cmd' }]))
  assert.equal(tabbed.rows[0].name, '=cmd')
})

test('the browser byte check refuses NUL bytes and bytes that are not UTF-8', () => {
  assert.deepEqual(catalogueCsvTextFromBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])), {
    error: MATERIAL_CATALOGUE_CSV_BINARY_MESSAGE,
  })
  assert.deepEqual(catalogueCsvTextFromBytes(new Uint8Array([0x4e, 0x61, 0x6d, 0x65, 0xff, 0xfe, 0x2c])), {
    error: MATERIAL_CATALOGUE_CSV_ENCODING_MESSAGE,
  })
  const ok = catalogueCsvTextFromBytes(new TextEncoder().encode(`${CATALOGUE_CSV_HEADER}\n,Pipe,Plumbing,,,Each,,,\n`))
  assert.ok('text' in ok)
})
