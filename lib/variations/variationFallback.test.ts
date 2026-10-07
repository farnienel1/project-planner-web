import assert from 'node:assert/strict'
import test from 'node:test'
import { fallbackItemMaps, mergeVariationSources, variationItemDocId, variationsLogDocId } from './variationFallback.ts'
import type { Variation } from './variationModel.ts'

function row(partial: Pick<Variation, 'id' | 'updatedAt'> & Partial<Variation>): Variation {
  return {
    orgId: 'org',
    parentType: 'project',
    parentId: 'job',
    parentName: 'C1 · Site',
    origin: 'app',
    voNumber: 'VO-001',
    sequence: 1,
    voNumberLocked: false,
    numberHistory: [],
    heading: 'Heading',
    description: '',
    status: 'open',
    labour: [],
    materials: [],
    evidence: [],
    totalLabourHours: 0,
    materialLineCount: 0,
    evidenceCount: 0,
    createdByUid: 'u',
    createdByName: 'A',
    createdAt: partial.updatedAt,
    updatedByUid: 'u',
    statusHistory: [],
    isDeleted: false,
    ...partial,
  }
}

test('settings document ids match iOS', () => {
  assert.equal(variationsLogDocId('JOB'), 'variations_JOB')
  assert.equal(variationItemDocId('VAR'), 'variationItem_VAR')
})

test('fallback items accept an array or a map keyed by id', () => {
  assert.deepEqual(fallbackItemMaps({ items: [{ id: 'a', heading: 'A' }] }).map((item) => item.id), ['a'])
  const mapped = fallbackItemMaps({ items: { b: { heading: 'B' } } })
  assert.equal(mapped[0]?.id, 'b')
  assert.equal(mapped[0]?.heading, 'B')
})

test('a newer settings row fills a variation the collection does not have', () => {
  const older = row({ id: 'a', heading: 'Old', updatedAt: new Date('2026-10-01T00:00:00Z') })
  const newer = row({ id: 'a', heading: 'New', updatedAt: new Date('2026-10-06T00:00:00Z') })
  const onlySettings = row({ id: 'b', heading: 'Settings', updatedAt: new Date('2026-10-06T00:00:00Z') })
  const merged = mergeVariationSources([older], [newer, onlySettings], [])
  assert.equal(merged.find((item) => item.id === 'a')?.heading, 'New')
  assert.equal(merged.find((item) => item.id === 'b')?.heading, 'Settings')
})

test('the collection copy wins when timestamps match', () => {
  const when = new Date('2026-10-06T12:00:00Z')
  const merged = mergeVariationSources(
    [row({ id: 'a', heading: 'Collection', updatedAt: when })],
    [row({ id: 'a', heading: 'Settings', updatedAt: when })],
    []
  )
  assert.equal(merged[0]?.heading, 'Collection')
})
