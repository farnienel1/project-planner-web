import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TIMESHEET_INPUTS_FAILED_MESSAGE,
  TIMESHEET_INPUTS_LOADING_MESSAGE,
  timesheetInputsStatus,
} from './timesheetInputs'

test('timesheetInputsStatus: ready only when settings and pay history both loaded', () => {
  assert.deepEqual(timesheetInputsStatus({ details: 'loaded', history: 'loaded' }), {
    ready: true,
    failed: false,
    message: null,
  })
  for (const [details, history] of [
    ['loading', 'loaded'],
    ['loaded', 'loading'],
    ['loading', 'loading'],
  ] as const) {
    const status = timesheetInputsStatus({ details, history })
    assert.equal(status.ready, false)
    assert.equal(status.failed, false)
    assert.equal(status.message, TIMESHEET_INPUTS_LOADING_MESSAGE)
  }
})

test('timesheetInputsStatus: any failed load blocks pricing and asks for Retry', () => {
  for (const [details, history] of [
    ['failed', 'loaded'],
    ['loaded', 'failed'],
    ['failed', 'loading'],
  ] as const) {
    const status = timesheetInputsStatus({ details, history })
    assert.equal(status.ready, false)
    assert.equal(status.failed, true)
    assert.equal(status.message, TIMESHEET_INPUTS_FAILED_MESSAGE)
  }
})
