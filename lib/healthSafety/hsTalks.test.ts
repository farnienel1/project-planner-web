import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HSToolboxTalk } from '../../types/index.ts'
import {
  combineLocalDateAndTime,
  filterToolboxTalks,
  groupTalksByCategory,
  nextRamsVersion,
  overlayToolboxLibraries,
  recipientsWithIssuer,
  talkTradeFilters,
} from './hsTalks.ts'

function talk(partial: Partial<HSToolboxTalk> & Pick<HSToolboxTalk, 'id' | 'title'>): HSToolboxTalk {
  return {
    category: 'general',
    isGeneral: true,
    trades: [],
    purpose: '',
    keyPoints: [],
    source: 'library',
    status: 'approved',
    version: 1,
    updatedAt: new Date('2026-01-01'),
    ...partial,
  }
}

test('talk filters match library search and trade chips including general talks', () => {
  const talks = [
    talk({ id: '1', title: 'Safe isolation', category: 'electrical', isGeneral: false, trades: ['Electrician'], purpose: 'Lock off' }),
    talk({ id: '2', title: 'Slips and trips', category: 'general', isGeneral: true, trades: [], purpose: 'Housekeeping' }),
    talk({ id: '3', title: 'Pipework', category: 'plumbing', isGeneral: false, trades: ['Plumber'] }),
  ]
  assert.deepEqual(talkTradeFilters(talks), ['All', 'General', 'Electrician', 'Plumber'])
  assert.deepEqual(
    filterToolboxTalks(talks, '', 'Electrician').map((row) => row.id),
    ['1']
  )
  assert.deepEqual(
    filterToolboxTalks(talks, '', 'General').map((row) => row.id),
    ['2']
  )
  assert.deepEqual(
    filterToolboxTalks(talks, 'lock', 'All').map((row) => row.id),
    ['1']
  )
  assert.deepEqual(
    groupTalksByCategory(talks).map((group) => group.category),
    ['General', 'Electrical', 'Plumbing']
  )
  assert.deepEqual(
    groupTalksByCategory([
      talk({ id: 'a', title: 'A', category: 'General' }),
      talk({ id: 'b', title: 'B', category: 'general' }),
    ]).map((group) => group.category),
    ['General']
  )
})

test('seed talks win over a thin firestore overlay and extras are kept', () => {
  const seed = [
    talk({ id: 'TBT-GEN-001', referenceCode: 'TBT-GEN-001', title: 'Working at Height', purpose: 'Falls', keyPoints: ['A'] }),
  ]
  const platform = [
    talk({ id: 'TBT-GEN-001', referenceCode: 'TBT-GEN-001', title: 'WH', purpose: '', keyPoints: [] }),
    talk({ id: 'TBT-CUSTOM-1', referenceCode: 'TBT-CUSTOM-1', title: 'Site specific', isGeneral: false, trades: ['Joinery'] }),
  ]
  const merged = overlayToolboxLibraries(seed, platform)
  assert.equal(merged.length, 2)
  const height = merged.find((row) => row.referenceCode === 'TBT-GEN-001')
  assert.equal(height?.title, 'Working at Height')
  assert.equal(height?.purpose, 'Falls')
  assert.equal(merged.some((row) => row.id === 'TBT-CUSTOM-1'), true)
})

test('issuer is added as a recipient so they can sign the talk they issued', () => {
  assert.deepEqual(recipientsWithIssuer(['op-1'], 'mgr-1', true).sort(), ['mgr-1', 'op-1'])
  assert.deepEqual(recipientsWithIssuer(['op-1'], 'mgr-1', false), ['op-1'])
  assert.deepEqual(recipientsWithIssuer([], 'mgr-1', true), ['mgr-1'])
})

test('combineLocalDateAndTime builds a local publishAt and rejects bad parts', () => {
  const value = combineLocalDateAndTime('2026-09-22', '08:30')
  assert.ok(value)
  assert.equal(value.getFullYear(), 2026)
  assert.equal(value.getMonth(), 8)
  assert.equal(value.getDate(), 22)
  assert.equal(value.getHours(), 8)
  assert.equal(value.getMinutes(), 30)
  assert.equal(combineLocalDateAndTime('', '08:00'), null)
  assert.equal(combineLocalDateAndTime('2026-09-22', ''), null)
  assert.equal(combineLocalDateAndTime('2026-02-31', '08:00'), null)
})

test('next RAMS copy increments version for the same title', () => {
  const docs = [
    { title: 'Electrical RAMS', version: 1 },
    { title: 'electrical rams', version: 2 },
    { title: 'Plumbing RAMS', version: 4 },
  ]
  assert.equal(nextRamsVersion(docs, 'Electrical RAMS'), 3)
  assert.equal(nextRamsVersion(docs, 'New RAMS'), 1)
})
