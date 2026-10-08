import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HSToolboxTalk } from '../../types/index.ts'
import { displayTalkTitle, isPlaceholderTalkTitle, mergeToolboxTalks, talkFileNameHint } from './mergeToolboxTalks.ts'

function talk(partial: Partial<HSToolboxTalk> & Pick<HSToolboxTalk, 'id' | 'title'>): HSToolboxTalk {
  return {
    category: 'General',
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

test('placeholder titles match the iOS filler list and bare TBT codes', () => {
  for (const title of ['', 'TBT', 'custom', 'Toolbox talk', 'Untitled', 'TBT-ELE-004', 'tbt-gen-001']) {
    assert.equal(isPlaceholderTalkTitle(title), true, title)
  }
  assert.equal(isPlaceholderTalkTitle('Working at Height'), false)
  assert.equal(isPlaceholderTalkTitle('TBT for the roof edge'), false)
})

test('a storage object name is not shown as the talk title', () => {
  const stored = talk({
    id: 'upload-audit',
    title: 'dul1tDjfQfMX6ruXPHb8kJX5P7g2 1789399717 SiteAudit C983 Pre-Start 2Jun26',
    source: 'uploaded',
    fileURL: 'https://storage.example/siteAudits/dul1tDjfQfMX6ruXPHb8kJX5P7g2%201789399717%20SiteAudit%20C983%20Pre-Start%202Jun26.pdf',
  })
  const merged = mergeToolboxTalks([], [], [stored])
  assert.equal(merged[0]?.title, 'SiteAudit C983 Pre-Start 2Jun26')
  assert.equal(displayTalkTitle('Working at Height'), 'Working at Height')
})

test('file name hint uses the uploaded file name', () => {
  assert.equal(
    talkFileNameHint('https://storage.example/o/organizations%2Forg%2Ftalks%2FSite_induction.pdf?alt=media'),
    'Site induction'
  )
})

test('stored TBT rows are repaired or dropped and the real catalogue stays', () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'toolboxTalkSeed.json')
  const seed = JSON.parse(readFileSync(path, 'utf8')) as Array<HSToolboxTalk & { referenceCode: string }>
  const catalog = seed.map((row) => talk(row))
  const stored = [
    talk({ id: 'TBT-GEN-001', title: 'TBT', purpose: 'TBT', keyPoints: [] }),
    talk({ id: 'junk-1', title: 'TBT' }),
    talk({ id: 'junk-2', title: 'TBT-ELE-004' }),
    talk({
      id: 'upload-1',
      title: 'TBT',
      source: 'uploaded',
      fileURL: 'https://storage.example/talks/Hot_works_permit.pdf',
      purpose: 'Our site permit rules',
      keyPoints: ['Permit first'],
    }),
    talk({ id: 'custom-1', title: 'Site specific induction', isGeneral: false, trades: ['Joinery'] }),
  ]
  const platform = [
    talk({ id: 'TBT-GEN-001', title: 'TBT' }),
    talk({ id: 'platform-1', title: 'TBT' }),
    talk({ id: 'platform-2', title: 'Yard traffic plan', isGeneral: false, trades: ['Plant'] }),
  ]
  const merged = mergeToolboxTalks(catalog, platform, stored)
  assert.equal(merged.length, 568 + 3)
  const height = merged.find((row) => row.id === 'TBT-GEN-001')
  assert.equal(height?.title, 'Working at Height')
  assert.match(height?.purpose || '', /Falls from height/)
  assert.ok((height?.keyPoints.length || 0) > 0)
  assert.equal(merged.some((row) => row.title === 'TBT' || row.title === 'TBT-ELE-004'), false)
  assert.equal(merged.find((row) => row.id === 'upload-1')?.title, 'Hot works permit')
  assert.equal(merged.some((row) => row.id === 'custom-1'), true)
  assert.equal(merged.some((row) => row.id === 'platform-2'), true)
  assert.equal(merged.some((row) => row.id === 'platform-1'), false)
})
