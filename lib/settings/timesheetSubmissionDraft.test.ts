import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_INVOICING } from './organizationSettings.ts'
import {
  previewTimesheetSubmissionCopy,
  resetTimesheetSubmissionAt,
  withPaymentDateAt,
  withTimesheetSubmissionAt,
} from './timesheetSubmissionDraft.ts'

test('setting a payment date fills deadline and notify-at from the rulebook', () => {
  const next = withPaymentDateAt(DEFAULT_INVOICING, 0, 20)
  assert.equal(next.paymentDates?.[0], '20')
  assert.equal(next.timesheetSubmission?.[0].notifyDay, 17)
  assert.equal(next.timesheetSubmission?.[0].timesheetDeadlineDay, 19)
  assert.equal(next.timesheetSubmission?.[0].notifyCustomised, false)
})

test('a customised row is not overwritten when the payment day changes', () => {
  const started = {
    ...DEFAULT_INVOICING,
    paymentDates: ['20', '5'],
    timesheetSubmission: withPaymentDateAt(DEFAULT_INVOICING, 0, 20).timesheetSubmission ?? [],
  }
  const customised = {
    ...started,
    timesheetSubmission: withTimesheetSubmissionAt(started, 0, { notifyDay: 10 }),
  }
  const moved = withPaymentDateAt(customised, 0, 5)
  assert.equal(moved.timesheetSubmission?.[0].notifyDay, 10)
  assert.equal(moved.timesheetSubmission?.[0].notifyCustomised, true)
  const reset = resetTimesheetSubmissionAt({ ...customised, paymentDates: ['5', '5'] }, 0)
  assert.equal(reset[0].notifyDay, 2)
  assert.equal(reset[0].notifyCustomised, false)
})

test('preview copy comes from the deadline picker and payment day', () => {
  const draft = {
    ...DEFAULT_INVOICING,
    paymentDates: ['20', '5'],
    timesheetSubmission: withPaymentDateAt(DEFAULT_INVOICING, 0, 20).timesheetSubmission ?? [],
  }
  assert.equal(
    previewTimesheetSubmissionCopy(draft, 0),
    'Timesheets need to be submitted by close of play on the 19th for payment on the 20th.'
  )
})
