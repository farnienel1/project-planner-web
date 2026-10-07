import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clampClashLookaheadDays,
  parseWarningDetection,
  resolveWarningDetectionRaw,
  warningDetectionFirestoreFields,
  warningDetectionLooksLikeFactoryDefault,
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

test('hub and warnings settings write organizations/{id}.warningDetection only', () => {
  const fields = warningDetectionFirestoreFields(
    parseWarningDetection({
      detectClashes: true,
      clashLookaheadMode: 'endOfInvoicingPeriod',
      clashLookaheadDays: 7,
      includeWeekendsForUnbookedLabour: false,
      excludedUserIdsFromUnbookedWarnings: ['paye-1'],
    })
  )
  const keys = Object.keys(fields)
  assert.deepEqual(keys.sort(), [
    'warningDetection.clashLookaheadDays',
    'warningDetection.clashLookaheadMode',
    'warningDetection.detectClashes',
    'warningDetection.excludedUserIdsFromUnbookedWarnings',
    'warningDetection.includeWeekendsForUnbookedLabour',
  ])
  assert.equal(fields['warningDetection.clashLookaheadMode'], 'endOfInvoicingPeriod')
  assert.equal(keys.some((key) => key.startsWith('settings.')), false)
})

test('warning mode is read from top-level warningDetection, not the nested web copy', () => {
  const raw = resolveWarningDetectionRaw(
    {
      detectClashes: true,
      clashLookaheadMode: 'endOfInvoicingPeriod',
      clashLookaheadDays: 7,
      includeWeekendsForUnbookedLabour: false,
    },
    {
      clashLookaheadMode: 'numberOfDays',
      clashLookaheadDays: 25,
      includeWeekendsForUnbookedLabour: true,
    }
  )
  const parsed = parseWarningDetection(raw)
  assert.equal(parsed.clashLookaheadMode, 'endOfInvoicingPeriod')
  assert.equal(parsed.clashLookaheadDays, 7)
  assert.equal(parsed.includeWeekendsForUnbookedLabour, false)
})

test('nested settings.warningDetection only fills excluded users the top-level map left out', () => {
  const raw = resolveWarningDetectionRaw(
    { detectClashes: true, clashLookaheadMode: 'endOfInvoicingPeriod' },
    {
      clashLookaheadMode: 'numberOfDays',
      clashLookaheadDays: 2,
      excludedUserIdsFromUnbookedWarnings: ['paye-1'],
    }
  )
  const parsed = parseWarningDetection(raw)
  assert.equal(parsed.clashLookaheadMode, 'endOfInvoicingPeriod')
  assert.equal(parsed.clashLookaheadDays, 7)
  assert.deepEqual(parsed.excludedUserIdsFromUnbookedWarnings, ['paye-1'])
})

test('Firestore integerValue wrappers still parse as 2', () => {
  assert.equal(clampClashLookaheadDays({ integerValue: '2' }), 2)
})

test('saved non-default windows are not treated as the factory 7-day preset', () => {
  assert.equal(
    warningDetectionLooksLikeFactoryDefault(
      parseWarningDetection({ clashLookaheadMode: 'numberOfDays', clashLookaheadDays: 7 })
    ),
    true
  )
  assert.equal(
    warningDetectionLooksLikeFactoryDefault(
      parseWarningDetection({ clashLookaheadMode: 'numberOfDays', clashLookaheadDays: 2 })
    ),
    false
  )
})
