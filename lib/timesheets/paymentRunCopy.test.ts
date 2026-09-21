import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentPaymentRunCopy, listPreviousPayPeriods, payDateForPeriodEnd } from './paymentRunCopy.ts'
import { DEFAULT_INVOICING } from '../settings/organizationSettings.ts'
import { dayKey } from '../ios-parity/londonTime.ts'

const HALF_MONTH = {
  ...DEFAULT_INVOICING,
  paymentRunMode: 'date_ranges' as const,
  paymentDateMode: 'specific_dates' as const,
  paymentRunDateRanges: [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 },
  ],
  paymentDates: ['19', '5'],
  noteToUsers:
    "If your timesheet displays 0 against your rate, then your day/hourly rate hasn't been set by your line manager",
}

test('currentPaymentRunCopy uses the period containing today, not the first range', () => {
  const copy = currentPaymentRunCopy(HALF_MONTH, new Date(Date.UTC(2026, 8, 21, 12, 0, 0)))
  assert.equal(copy.periodLine, '16 – 30 September 2026')
  assert.equal(copy.paidLine, 'Paid on 5 October 2026')
  assert.match(copy.note, /day\/hourly rate/)
})

test('currentPaymentRunCopy first half of month uses 1–15 and the 19th pay date', () => {
  const copy = currentPaymentRunCopy(HALF_MONTH, new Date(Date.UTC(2026, 8, 10, 12, 0, 0)))
  assert.equal(copy.periodLine, '1 – 15 September 2026')
  assert.equal(copy.paidLine, 'Paid on 19 September 2026')
})

test('payDateForPeriodEnd skips payment days before period end and rolls to next month', () => {
  const pay = payDateForPeriodEnd(new Date(Date.UTC(2026, 8, 30, 12, 0, 0)), HALF_MONTH)
  assert.ok(pay)
  assert.equal(dayKey(pay!), '2026-10-05')
})

test('currentPaymentRunCopy formats recurring runs with this-run pay date', () => {
  const copy = currentPaymentRunCopy(DEFAULT_INVOICING, new Date(Date.UTC(2026, 8, 21, 12, 0, 0)))
  assert.match(copy.periodLine, /September 2026/)
  assert.match(copy.paidLine, /^Paid on /)
})

test('listPreviousPayPeriods walks backwards from the current half-month', () => {
  const previous = listPreviousPayPeriods(HALF_MONTH, new Date(Date.UTC(2026, 8, 21, 12, 0, 0)), 3)
  assert.equal(previous.length, 3)
  assert.equal(dayKey(previous[0].start), '2026-09-01')
  assert.equal(dayKey(previous[1].start), '2026-08-16')
})
