import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NO_WARNING_DECISION_FAILURES, warningDecisionsFailed } from './warningDecisionsLoad.ts'

test('warningDecisionsFailed: any failed approval source blocks the open list', () => {
  assert.equal(warningDecisionsFailed(NO_WARNING_DECISION_FAILURES), false)
  assert.equal(warningDecisionsFailed({ ...NO_WARNING_DECISION_FAILURES, accepted: true }), true)
  assert.equal(warningDecisionsFailed({ ...NO_WARNING_DECISION_FAILURES, dismissed: true }), true)
  assert.equal(warningDecisionsFailed({ ...NO_WARNING_DECISION_FAILURES, resolved: true }), true)
})
