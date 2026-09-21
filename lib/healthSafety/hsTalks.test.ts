import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HSToolboxTalk } from '../../types/index.ts'
import {
  combineLocalDateAndTime,
  filterToolboxTalks,
  groupTalksByCategory,
  nextRamsVersion,
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
  assert.deepEqual(talkTradeFilters(talks), ['All', 'Electrician', 'Plumber'])
  assert.deepEqual(
    filterToolboxTalks(talks, '', 'Electrician').map((row) => row.id),
    ['1', '2']
  )
  assert.deepEqual(
    filterToolboxTalks(talks, 'lock', 'All').map((row) => row.id),
    ['1']
  )
  assert.deepEqual(
    groupTalksByCategory(talks).map((group) => group.category),
    ['electrical', 'general', 'plumbing']
  )
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
