import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import * as XLSX from 'xlsx'
import { parseVariationDocument, variationExportRows } from '../canonical/index.ts'
import { buildVariationWorkbook, imageSize } from './variationWorkbook.ts'

// A 2 × 1 PNG.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8DwnwEJMAIAKtYC/+KTrQ0AAAAASUVORK5CYII=', 'base64'))

const docs = [
  parseVariationDocument('v1', {
    voNumber: 'VO-002',
    heading: '=HYPERLINK("x")',
    status: 'open',
    createdAt: Date.UTC(2026, 10, 3),
    customLines: [{ name: 'Skip', quantity: 2, cost: 150 }],
    materials: [{ name: 'Flex', quantity: '100m' }],
  })!,
  parseVariationDocument('v0', { voNumber: 'VO-001', heading: 'No lines', status: 'closed' })!,
]

test('the workbook opens, has both sheets, every variation, totals and a logo drawing', () => {
  const rows = variationExportRows(docs, { timeZone: 'Europe/London', currency: 'GBP' })
  const size = imageSize(PNG)!
  assert.deepEqual(size, { type: 'png', width: 2, height: 1 })
  const bytes = buildVariationWorkbook({ rows, companyName: 'Acme & Co', jobNumber: 'J-1', jobName: 'Site', generatedBy: 'Sam', generatedAt: '15 Nov 2026, 10:00', logo: { bytes: PNG, ...size } })
  const parts = unzipSync(bytes)
  assert.ok(parts['xl/drawings/drawing1.xml'])
  assert.ok(parts['xl/media/image1.png'])
  assert.match(strFromU8(parts['xl/styles.xml']), /&quot;£&quot;#,##0.00/)
  const book = XLSX.read(bytes, { type: 'array' })
  assert.deepEqual(book.SheetNames, ['Variations', 'Line items'])
  const summary = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Variations, { header: 1, blankrows: false })
  assert.equal(summary[1][1], 'Acme & Co')
  const head = summary.findIndex((row) => row[0] === 'VO no.')
  assert.equal(summary[head + 1][0], 'VO-001')
  assert.equal(summary[head + 2][1], '=HYPERLINK("x")')
  // A text cell that starts with = is a string, never a formula.
  const cellRef = `B${head + 3}`
  assert.equal(book.Sheets.Variations[cellRef].t, 's')
  assert.equal(book.Sheets.Variations[cellRef].f, undefined)
  const totals = summary[head + 3]
  assert.equal(totals[0], 'Totals (2)')
  assert.equal(totals[10], 300)
  const lines = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['Line items'], { header: 1, blankrows: false })
  const material = lines.find((row) => row[1] === 'Material')!
  assert.deepEqual([material[3], material[4]], [100, 'm'])
})

test('without costs the money columns are left out', () => {
  const rows = variationExportRows(docs, { includeCost: false })
  const book = XLSX.read(buildVariationWorkbook({ rows, companyName: 'A', jobNumber: 'J', jobName: '', generatedBy: '', generatedAt: '' }), { type: 'array' })
  const summary = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Variations, { header: 1, blankrows: false })
  const head = summary.find((row) => row[0] === 'VO no.')!
  assert.equal(head.includes('Total cost'), false)
})
