import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  abandonedSignupCutoff,
  isAbandonedUnfinishedSignup,
  isUnfinishedSetupName,
  unfinishedSetupLabel,
} from './unfinishedSetup.ts'

test('never labels missing org docs as Unknown organisation', () => {
  assert.equal(unfinishedSetupLabel('jane@company.co.uk'), 'Unfinished setup · j•••@company.co.uk')
  assert.equal(unfinishedSetupLabel('jane@company.co.uk', true), 'Unfinished setup · jane@company.co.uk')
  assert.equal(unfinishedSetupLabel(''), 'Unfinished setup')
  assert.equal(isUnfinishedSetupName('Unknown organisation'), true)
  assert.equal(isUnfinishedSetupName('Alpha Ltd'), false)
})

test('12-month abandoned sign-up cutoff', () => {
  const now = new Date('2026-09-22T12:00:00Z')
  assert.equal(isAbandonedUnfinishedSignup(new Date('2025-09-22T12:00:00Z'), now), true)
  assert.equal(isAbandonedUnfinishedSignup(new Date('2026-01-01T00:00:00Z'), now), false)
  assert.ok(abandonedSignupCutoff(now).getTime() < now.getTime())
})
