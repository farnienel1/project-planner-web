import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  expandedVersionRowsForSession,
  formatCompactPayRun,
  formatExportedStamp,
  resetVersionRowsForTests,
  toggleVersionRow,
} from './exportedListFormat.ts'

const LONDON = 'Europe/London'
const now = new Date('2026-11-24T21:00:00Z')

test('exported stamp leaves the current year out', () => {
  assert.equal(formatExportedStamp(new Date('2026-11-24T20:07:00Z'), LONDON, now), '24 Nov, 20:07')
})

test('exported stamp shows the year when it is another year', () => {
  assert.equal(formatExportedStamp(new Date('2025-11-24T20:07:00Z'), LONDON, now), '24 Nov 2025, 20:07')
})

test('exported stamp uses the organisation zone (BST and the year boundary)', () => {
  assert.equal(formatExportedStamp(new Date('2026-07-01T23:30:00Z'), LONDON, now), '2 Jul, 00:30')
  // 31 Dec 2025 23:30 UTC is already 1 Jan 2026 in Auckland: same year as now there.
  assert.equal(formatExportedStamp(new Date('2025-12-31T23:30:00Z'), 'Pacific/Auckland', now), '1 Jan, 12:30')
})

test('exported stamp uses a 24-hour clock with two-digit hours', () => {
  assert.equal(formatExportedStamp(new Date('2026-03-03T09:05:00Z'), LONDON, now), '3 Mar, 09:05')
})

test('pay run on one line, same month', () => {
  assert.equal(
    formatCompactPayRun(new Date('2026-11-16T00:00:00Z'), new Date('2026-11-30T00:00:00Z'), LONDON),
    '16–30 Nov 2026'
  )
})

test('pay run across months and years', () => {
  assert.equal(
    formatCompactPayRun(new Date('2026-10-26T00:00:00Z'), new Date('2026-11-25T00:00:00Z'), LONDON),
    '26 Oct – 25 Nov 2026'
  )
  assert.equal(
    formatCompactPayRun(new Date('2025-12-29T00:00:00Z'), new Date('2026-01-04T00:00:00Z'), LONDON),
    '29 Dec 2025 – 4 Jan 2026'
  )
})

test('pay run reads the organisation-zone day (London midnight in BST)', () => {
  // 1 Jun 2026 00:00 BST is 31 May 23:00 UTC.
  assert.equal(
    formatCompactPayRun(new Date('2026-05-31T23:00:00Z'), new Date('2026-06-14T23:00:00Z'), LONDON),
    '1–15 Jun 2026'
  )
})

test('versions start collapsed and toggle per row for the session', () => {
  resetVersionRowsForTests()
  assert.equal(expandedVersionRowsForSession().size, 0)
  const opened = toggleVersionRow(expandedVersionRowsForSession(), 'a')
  assert.deepEqual([...opened], ['a'])
  const both = toggleVersionRow(opened, 'b')
  assert.deepEqual([...both].sort(), ['a', 'b'])
  // Remembered for the session (a fresh mount reads it back).
  assert.deepEqual([...expandedVersionRowsForSession()].sort(), ['a', 'b'])
  const closed = toggleVersionRow(both, 'a')
  assert.deepEqual([...closed], ['b'])
  assert.deepEqual([...expandedVersionRowsForSession()], ['b'])
  // The set passed in is never changed.
  assert.deepEqual([...both].sort(), ['a', 'b'])
  resetVersionRowsForTests()
})
