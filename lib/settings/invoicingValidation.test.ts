import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_INVOICING } from './organizationSettings.ts'
import { paymentRunModeChange } from './invoicingValidation.ts'

test('choosing the payment-run mode that is already on does not replace the saved ranges', () => {
  const current = {
    ...DEFAULT_INVOICING,
    paymentRunMode: 'date_ranges' as const,
    paymentRunDateRanges: [
      { startDay: 1, endDay: 16 },
      { startDay: 17, endDay: 31 },
    ],
  }
  assert.deepEqual(paymentRunModeChange(current, 'date_ranges'), {})
  const switched = paymentRunModeChange(
    { ...current, paymentRunMode: 'recurring_timeframe' },
    'date_ranges'
  )
  assert.deepEqual(switched.paymentRunDateRanges, current.paymentRunDateRanges)
})
