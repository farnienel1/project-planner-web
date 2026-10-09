import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CATALOGUE_CSV_HEADER, parseCatalogueCsv } from './materialCatalogCSV.ts'
import { STARTER_MATERIAL_CATALOGUE_CSV } from './starter/starterCatalogueCsv.ts'

test('the starter catalogue is a valid CSV with the iOS header and the LSZH 2.5mm drum', () => {
  assert.equal(STARTER_MATERIAL_CATALOGUE_CSV.split(/\r?\n/)[0], CATALOGUE_CSV_HEADER)
  const parsed = parseCatalogueCsv(STARTER_MATERIAL_CATALOGUE_CSV)
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.rows.length, 4032)
  const drum = parsed.rows.find((row) => row.name === '2.5mm2 Twin & Earth Cable 6242B LSZH (100m Drum)')
  assert.ok(drum)
  assert.equal(drum.category, 'Cable')
  assert.equal(drum.defaultUnit, 'Drum')
  assert.equal(drum.length, '100')
  assert.equal(drum.lengthUnit, 'M')
  assert.match(drum.id, /^[0-9A-F-]{36}$/)
})

test('the committed CSV file matches the bundled starter string', () => {
  const fromDisk = readFileSync(new URL('./starter/material_catalogue_starter.csv', import.meta.url), 'utf8')
  assert.equal(fromDisk.replace(/\r\n/g, '\n').trim(), STARTER_MATERIAL_CATALOGUE_CSV.replace(/\r\n/g, '\n').trim())
})
