import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blankTalkWorkbookXml, parseBlankTalkRows, parseBlankTalkWorkbookXml } from './blankTalkWorkbook.ts'

test('blank toolbox workbook matches the talk sheet sections', () => {
  const xml = blankTalkWorkbookXml()
  assert.match(xml, /Excel\.Sheet/)
  assert.match(xml, /PROJECT PLANNER/)
  assert.match(xml, /TOOLBOX TALK/)
  for (const field of [
    'TITLE',
    'CATEGORY',
    'TRADES',
    'PROJECT',
    'WEEK COMMENCING',
    'PRESENTED BY',
    'PURPOSE',
    'KEY CONTROL POINTS',
    'REFERENCES',
    'ATTENDEE SIGN-OFF',
    'NAME',
    'TRADE',
    'SIGNATURE',
    'DATE &amp; TIME',
  ]) {
    assert.equal(xml.includes(field), true, field)
  }
  assert.match(xml, /FitToPage/)
})

test('filled toolbox workbook reads back the talk fields', () => {
  const parsed = parseBlankTalkRows([
    ['PROJECT PLANNER', 'TOOLBOX TALK', 'REF', 'TBT-BLANK'],
    ['TITLE', 'Ladder safety'],
    ['CATEGORY', 'General', 'TRADES', 'Electrical', 'VERSION', '1'],
    ['PROJECT', 'North site', 'WEEK COMMENCING', '6 Apr 2026', 'PRESENTED BY', 'Sam'],
    ['PURPOSE'],
    ['Check the ladder before anyone climbs.'],
    ['KEY CONTROL POINTS'],
    ['Key point 1', 'Feet on firm ground'],
    ['Key point 2', 'Three points of contact'],
    ['REFERENCES', 'Master RAMS'],
  ])
  assert.ok(parsed)
  assert.equal(parsed?.title, 'Ladder safety')
  assert.equal(parsed?.category, 'General')
  assert.equal(parsed?.trades, 'Electrical')
  assert.equal(parsed?.project, 'North site')
  assert.equal(parsed?.weekCommencing, '6 Apr 2026')
  assert.equal(parsed?.presentedBy, 'Sam')
  assert.equal(parsed?.purpose, 'Check the ladder before anyone climbs.')
  assert.deepEqual(parsed?.keyPoints, ['Feet on firm ground', 'Three points of contact'])
})

test('blank workbook xml parses as a template with the default category', () => {
  const parsed = parseBlankTalkWorkbookXml(blankTalkWorkbookXml())
  assert.equal(parsed?.category, 'General')
  assert.equal(parsed?.title, '')
})
