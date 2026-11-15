import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CATALOGUE_CSV_HEADER, parseCatalogueCsv } from './materialCatalogCSV.ts'
import { STARTER_MATERIAL_CATALOGUE_CSV } from './starter/starterCatalogueCsv.ts'
import { starterCatalogueItems } from './starterCatalogue.ts'
import { materialCatalogueItemFields } from '../canonical/operationsDocuments.ts'
import { materialLineText, materialQuantityModel } from '../canonical/materialQuantity.ts'

test('the starter catalogue is a valid 1.48.0 CSV with the LSZH 2.5mm drum', () => {
  assert.equal(STARTER_MATERIAL_CATALOGUE_CSV.split(/\r?\n/)[0], CATALOGUE_CSV_HEADER)
  const parsed = parseCatalogueCsv(STARTER_MATERIAL_CATALOGUE_CSV)
  assert.deepEqual(parsed.errors, [])
  assert.deepEqual(parsed.duplicateRows, [])
  assert.equal(parsed.rows.length, 4034)
  const drum = parsed.rows.find((row) => row.name === '2.5mm2 Twin & Earth Cable 6242B LSZH (100m Drum)')
  assert.ok(drum)
  assert.equal(drum.category, 'Cable')
  assert.equal(drum.orderUnit, 'Drum')
  assert.equal(drum.contentAmount, 100)
  assert.equal(drum.contentMeasure, 'm')
  assert.match(drum.id, /^[0-9A-F-]{36}$/)
})

test('the starter list is clean: no float noise, no Size 1.0 placeholder, no Unknown brand, no test rows', () => {
  const rows = parseCatalogueCsv(STARTER_MATERIAL_CATALOGUE_CSV).rows
  assert.equal(STARTER_MATERIAL_CATALOGUE_CSV.includes('0000000'), false)
  assert.equal(rows.some((row) => row.size === '1' || row.size === '1.0'), false)
  assert.equal(rows.some((row) => /^unknown$/i.test(row.brand)), false)
  assert.equal(rows.some((row) => /^(new|new 2|n\/a)$/i.test(row.brand)), false)
  assert.equal(rows.some((row) => ['123-456', '12567', '4576-34'].includes(row.productCode)), false)
  assert.equal(new Set(rows.map((row) => row.id.toLowerCase())).size, rows.length)
  const timber = rows.find((row) => row.name === '3x2 (47x75mm) C24 Treated Timber - 2.4m')
  assert.ok(timber)
  assert.equal(materialLineText({ quantity: 6, ...timber }), '6no 2.4m lengths')
  const flex = rows.find((row) => row.name === '0.75mm2 12 Core YY Control Cable')
  assert.equal(flex?.orderUnit, 'Metre')
})

test('a seeded item stores the new fields and the nearest old meaning for older builds', () => {
  const [first] = starterCatalogueItems('u1', 'Ada', new Date('2026-11-15T00:00:00Z')).filter(
    (row) => row.orderUnit === 'Metre'
  )
  const fields = materialCatalogueItemFields({ ...first, createdAt: 'ts' })
  assert.equal(fields.orderUnit, 'Metre')
  assert.equal(fields.defaultUnit, 'Length')
  assert.equal(fields.length, '1')
  assert.equal(fields.lengthUnit, 'M')
  assert.equal(materialQuantityModel(fields).orderUnit, 'Metre')
})

test('the committed CSV file matches the bundled starter string', () => {
  const fromDisk = readFileSync(new URL('./starter/material_catalogue_starter.csv', import.meta.url), 'utf8')
  assert.equal(fromDisk.replace(/\r\n/g, '\n').trim(), STARTER_MATERIAL_CATALOGUE_CSV.replace(/\r\n/g, '\n').trim())
})
