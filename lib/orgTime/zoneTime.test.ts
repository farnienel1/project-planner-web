import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayKeyInZone, midnightInZone, partsInZone } from './zoneTime.ts'
import { listPreviousPayPeriods } from '../timesheets/paymentRunCopy.ts'

const HALF_MONTH = {
  paymentRunMode: 'date_ranges',
  ranges: [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 },
  ],
  paymentDateMode: 'specific_dates',
  paymentDates: ['20', '5'],
  recurringRunStartDay: 'monday',
  recurringRunEndDay: 'sunday',
  recurringPaymentDay: 'friday',
} as unknown as Parameters<typeof listPreviousPayPeriods>[0]

function countingDateTimeFormat<T>(run: () => T): { result: T; constructed: number } {
  const Original = Intl.DateTimeFormat
  let constructed = 0
  const Counting = function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
    constructed += 1
    return new Original(...args)
  } as unknown as typeof Intl.DateTimeFormat
  Counting.supportedLocalesOf = Original.supportedLocalesOf
  Intl.DateTimeFormat = Counting
  try {
    return { result: run(), constructed }
  } finally {
    Intl.DateTimeFormat = Original
  }
}

test('partsInZone answers the same instant from memory', () => {
  const instant = new Date(Date.UTC(2026, 6, 14, 23, 30, 0))
  const first = partsInZone(instant, 'Europe/London')
  const second = partsInZone(new Date(instant.getTime()), 'Europe/London')
  assert.deepEqual(first, { y: 2026, m: 7, d: 15, h: 0, min: 30 })
  assert.equal(second, first)
  assert.equal(dayKeyInZone(instant, 'Europe/London'), '2026-07-15')
})

test('midnightInZone stays correct across the clock change with memoised parts', () => {
  const beforeChange = midnightInZone(new Date(Date.UTC(2026, 2, 29, 12, 0, 0)), 'Europe/London')
  const afterChange = midnightInZone(new Date(Date.UTC(2026, 2, 30, 12, 0, 0)), 'Europe/London')
  assert.equal(beforeChange.toISOString(), '2026-03-29T00:00:00.000Z')
  assert.equal(afterChange.toISOString(), '2026-03-29T23:00:00.000Z')
  assert.equal(midnightInZone(new Date(Date.UTC(2026, 0, 1, 3, 0, 0)), 'America/New_York').toISOString(), '2025-12-31T05:00:00.000Z')
})

test('walking 120 pay periods builds a handful of formatters, not thousands', () => {
  // A fresh zone so no earlier test has warmed the per-zone formatter.
  const zone = 'Europe/Dublin'
  const { result, constructed } = countingDateTimeFormat(() =>
    listPreviousPayPeriods(HALF_MONTH, new Date(Date.UTC(2026, 8, 21, 12, 0, 0)), 120, zone)
  )
  assert.equal(result.length, 120)
  // One Intl.DateTimeFormat per zone (plus a formatter or two in the pay-date
  // copy) is the budget. My Timesheets used to build one per calendar lookup,
  // which blocked the main thread for most of a second on every open.
  assert.ok(constructed <= 4, `built ${constructed} Intl.DateTimeFormat instances for one pay-period walk`)
})

test('walking 120 pay periods stays well under the old main-thread cost', () => {
  const started = performance.now()
  for (let round = 0; round < 3; round += 1) {
    listPreviousPayPeriods(HALF_MONTH, new Date(Date.UTC(2026, 8, 21 + round, 12, 0, 0)), 120, 'Europe/London')
  }
  const elapsed = performance.now() - started
  // Three walks took ~700ms before formatters were cached; allow a wide margin
  // for slow CI machines while still failing on a return to per-call Intl work.
  assert.ok(elapsed < 250, `three 120-period walks took ${elapsed.toFixed(0)}ms`)
})
