import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTimesheetMoneyAmount } from './timesheetMoney.ts'

test('parseTimesheetMoneyAmount strips a pound sign like iOS', () => {
  assert.equal(parseTimesheetMoneyAmount('£12.50'), 12.5)
  assert.equal(parseTimesheetMoneyAmount('  40  '), 40)
  assert.equal(parseTimesheetMoneyAmount('£0'), null)
  assert.equal(parseTimesheetMoneyAmount(''), null)
  assert.equal(parseTimesheetMoneyAmount('abc'), null)
})
