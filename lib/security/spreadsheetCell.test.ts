import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvEscapeCell, neutralizeSpreadsheetFormula } from './spreadsheetCell.ts'

test('formula-leading cells are prefixed with a single quote', () => {
  assert.equal(neutralizeSpreadsheetFormula('=1+1'), "'=1+1")
  assert.equal(neutralizeSpreadsheetFormula('+cmd'), "'+cmd")
  assert.equal(neutralizeSpreadsheetFormula('-2+2'), "'-2+2")
  assert.equal(neutralizeSpreadsheetFormula('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(neutralizeSpreadsheetFormula('Tray'), 'Tray')
  assert.equal(neutralizeSpreadsheetFormula(''), '')
})

test('csvEscapeCell quotes commas and still neutralizes formulas', () => {
  assert.equal(csvEscapeCell('Tray, 9m'), '"Tray, 9m"')
  assert.equal(csvEscapeCell('=HYPERLINK("http://evil")'), '"\'=HYPERLINK(""http://evil"")"')
})
