import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blankTalkWorkbookXml } from './blankTalkWorkbook.ts'

test('blank toolbox workbook is an Excel sheet with the talk fields', () => {
  const xml = blankTalkWorkbookXml()
  assert.match(xml, /Excel\.Sheet/)
  assert.match(xml, /Toolbox talk/)
  for (const field of ['Title', 'Category', 'Trades', 'Purpose', 'Key point 1']) {
    assert.equal(xml.includes(field), true)
  }
})
