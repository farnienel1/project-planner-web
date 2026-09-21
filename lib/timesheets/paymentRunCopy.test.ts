import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentPaymentRunCopy } from './paymentRunCopy.ts'
import { DEFAULT_INVOICING } from '../settings/organizationSettings.ts'

test('currentPaymentRunCopy formats recurring iOS payment-run card', () => {
  const copy = currentPaymentRunCopy(DEFAULT_INVOICING)
  assert.equal(copy.periodLine, 'In arrears: Monday to Sunday (of the previous week)')
  assert.equal(copy.paidLine, 'Paid every Friday')
})

test('currentPaymentRunCopy formats date-range runs as Day a - Day b', () => {
  const copy = currentPaymentRunCopy({
    ...DEFAULT_INVOICING,
    paymentRunMode: 'date_ranges',
    paymentDateMode: 'specific_dates',
    paymentRunDateRanges: [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: 31 },
    ],
    paymentDates: ['1', '16'],
  })
  assert.equal(copy.periodLine, 'Day 1 - Day 15')
  assert.equal(copy.paidLine, 'Paid on day 1 & 16')
})
