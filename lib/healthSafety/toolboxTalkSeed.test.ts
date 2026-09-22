import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('bundled toolbox talk seed matches the iOS master library', () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'toolboxTalkSeed.json')
  const talks = JSON.parse(readFileSync(path, 'utf8')) as Array<{
    id: string
    referenceCode: string
    category: string
    isGeneral: boolean
    trades: string[]
    purpose: string
    keyPoints: string[]
  }>
  assert.equal(talks.length, 568)
  const general = talks.filter((talk) => talk.category === 'General' || talk.isGeneral)
  assert.equal(general.length, 48)
  assert.equal(talks[0]?.referenceCode, 'TBT-GEN-001')
  assert.equal(talks[talks.length - 1]?.referenceCode, 'TBT-PLA-040')
  const categories = new Set(talks.map((talk) => talk.category))
  for (const category of [
    'General',
    'Electrical',
    'Mechanical',
    'Plumbing & Gas',
    'Groundworks',
    'Scaffolding',
    'Brick & Block',
    'Joinery',
    'Drylining',
    'Painting',
    'Roofing',
    'Demolition',
    'Steel Fixing',
    'Plant',
  ]) {
    assert.equal(categories.has(category), true, `missing category ${category}`)
  }
  assert.equal(
    talks.every((talk) => talk.purpose.trim().length > 0 && talk.keyPoints.length > 0),
    true
  )
})
