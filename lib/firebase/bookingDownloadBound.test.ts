import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bookingDownloadConstraints,
  bookingDownloadQueryId,
  launchBookingNeededDayKeys,
  nextBookingDownload,
} from './bookingDownloadBound.ts'

const SAT = new Date('2026-10-31T10:00:00Z')

test('without the organisation document the launch bound reaches the first of the previous month', () => {
  assert.deepEqual(launchBookingNeededDayKeys(SAT, null), ['2026-10-26', '2026-09-01'])
  assert.deepEqual(launchBookingNeededDayKeys(new Date('2026-01-15T10:00:00Z'), null)[1], '2025-12-01')
})

test('with organisation settings the launch bound is this Monday or the warning window start', () => {
  const working = launchBookingNeededDayKeys(SAT, { warningDetection: { clashLookaheadMode: 'endOfWorkingWeek' } })
  assert.deepEqual(working, ['2026-10-26', '2026-10-26'])
  const invoicing = launchBookingNeededDayKeys(SAT, { warningDetection: { clashLookaheadMode: 'endOfInvoicingPeriod' } })
  assert.equal(invoicing[0], '2026-10-26')
  assert.ok(invoicing[1] <= '2026-10-26')
})

test('the download starts at the launch bound, moves earlier for an older week, and never later', () => {
  const launch = ['2026-10-26', '2026-10-16']
  const first = nextBookingDownload({ loadedFromDayKey: null, fullHistory: false }, launch)
  assert.deepEqual(first, { loadedFromDayKey: '2026-10-16', fullHistory: false, changed: true })
  const same = nextBookingDownload(first, launch)
  assert.equal(same.changed, false)
  const older = nextBookingDownload(first, launch, { fromDayKey: '2026-09-07' })
  assert.deepEqual(older, { loadedFromDayKey: '2026-09-07', fullHistory: false, changed: true })
  const later = nextBookingDownload(older, launch, { fromDayKey: '2026-11-02' })
  assert.equal(later.loadedFromDayKey, '2026-09-07')
  assert.equal(later.changed, false)
  const full = nextBookingDownload(older, launch, { fullHistory: true })
  assert.deepEqual(full, { loadedFromDayKey: null, fullHistory: true, changed: true })
  assert.equal(nextBookingDownload(full, launch, { fromDayKey: '2026-10-01' }).changed, false)
})

test('listener id and bound follow the download', () => {
  assert.equal(bookingDownloadQueryId({ loadedFromDayKey: '2026-10-16', fullHistory: false }), 'from:2026-10-16')
  assert.equal(bookingDownloadQueryId({ loadedFromDayKey: null, fullHistory: true }), '')
  assert.equal(bookingDownloadConstraints({ loadedFromDayKey: null, fullHistory: true }).length, 0)
  assert.equal(bookingDownloadConstraints({ loadedFromDayKey: '2026-10-16', fullHistory: false }).length, 1)
})
