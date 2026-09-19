import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clampClashLookaheadDays,
  parseWarningDetection,
  warningDetectionToFirestore,
} from './organizationSettings.ts'

test('saved number-of-days windows round-trip instead of falling back to 7', () => {
  const parsed = parseWarningDetection({
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: 2,
  })
  assert.equal(parsed.clashLookaheadMode, 'numberOfDays')
  assert.equal(parsed.clashLookaheadDays, 2)
  assert.equal(warningDetectionToFirestore(parsed).clashLookaheadDays, 2)
})

test('days UI aliases still load as numberOfDays with the saved count', () => {
  const parsed = parseWarningDetection({
    clashLookaheadMode: 'days',
    lookaheadDays: 2,
  })
  assert.equal(parsed.clashLookaheadMode, 'numberOfDays')
  assert.equal(parsed.clashLookaheadDays, 2)
})

test('invalid day counts clamp instead of becoming NaN', () => {
  assert.equal(clampClashLookaheadDays(0), 1)
  assert.equal(clampClashLookaheadDays(400), 365)
  assert.equal(clampClashLookaheadDays('nope'), 7)
})

test('numeric strings from Firestore still load as 2, not the default 7', () => {
  const parsed = parseWarningDetection({
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: '2',
  })
  assert.equal(parsed.clashLookaheadDays, 2)
})

test('missing detection map stays on the documented default of 7', () => {
  assert.equal(parseWarningDetection(undefined).clashLookaheadDays, 7)
})
