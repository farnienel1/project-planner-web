import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WARNING_DETECTION } from '../settings/organizationSettings.ts'
import { warningDetectionForScan, warningsScreenPhase } from './warningsScan.ts'

const invoicingPeriod = {
  ...DEFAULT_WARNING_DETECTION,
  clashLookaheadMode: 'endOfInvoicingPeriod' as const,
  clashLookaheadDays: 12,
  excludedUserIdsFromUnbookedWarnings: ['admin-1'],
}

const unsavedDraft = {
  ...DEFAULT_WARNING_DETECTION,
  clashLookaheadMode: 'numberOfDays' as const,
  clashLookaheadDays: 25,
  excludedUserIdsFromUnbookedWarnings: ['admin-1'],
}

test('bookings in memory and an empty roster is still scanning, not an empty warnings list', () => {
  assert.equal(
    warningsScreenPhase({
      detectionReady: true,
      rosterReady: false,
      operativesReady: false,
      projectsReady: false,
      warningCount: 0,
    }),
    'scanning'
  )
})

test('the default list appears only after detection, roster, operatives, and projects are ready', () => {
  assert.equal(
    warningsScreenPhase({
      detectionReady: true,
      rosterReady: true,
      operativesReady: true,
      projectsReady: true,
      warningCount: 17,
    }),
    'list'
  )
  assert.equal(
    warningsScreenPhase({
      detectionReady: true,
      rosterReady: true,
      operativesReady: true,
      projectsReady: true,
      warningCount: 0,
    }),
    'empty'
  )
})

test('an unsaved number-of-days draft does not replace the saved invoicing-period scan', () => {
  assert.equal(warningDetectionForScan(invoicingPeriod, unsavedDraft, false), null)
  const settled = warningDetectionForScan(invoicingPeriod, unsavedDraft, true)
  assert.equal(settled?.clashLookaheadMode, 'endOfInvoicingPeriod')
  assert.equal(settled?.clashLookaheadDays, 12)
})
