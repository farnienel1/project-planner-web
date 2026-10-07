import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WARNING_DETECTION } from '../settings/organizationSettings.ts'
import {
  partitionRowsByOrganization,
  publishReadyWarningLanes,
  retainWarningsAfterScan,
  warningDetectionForScan,
  warningScanLanes,
  warningsScanPartial,
  warningsScreenPhase,
} from './warningsScan.ts'

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

test('rows already found stay on screen while another source is still scanning', () => {
  assert.equal(
    warningsScreenPhase({
      detectionReady: true,
      rosterReady: false,
      operativesReady: true,
      projectsReady: false,
      warningCount: 4,
    }),
    'list'
  )
  const lanes = warningScanLanes({
    detectionReady: true,
    bookingsReady: true,
    managerReady: false,
    rosterReady: false,
    operativesReady: true,
    projectsReady: false,
    holidaysReady: false,
    materialsReady: false,
    sendRecordsReady: false,
  })
  assert.equal(lanes.clashes, true)
  assert.equal(lanes.unbooked, false)
  assert.equal(lanes.qualifications, true)
  const published = publishReadyWarningLanes({
    previous: {
      clashWarnings: [{ id: 'kept' }],
      managerClashWarnings: [],
      unbookedWarnings: [{ id: 'unbooked' }],
      materialWarnings: [],
      qualificationWarnings: [],
      unverifiedWarnings: [],
      coreCount: 2,
      highCount: 2,
      mediumCount: 0,
      lowCount: 0,
    },
    computed: {
      clashWarnings: [{ id: 'clash' }],
      managerClashWarnings: [],
      unbookedWarnings: [],
      materialWarnings: [],
      qualificationWarnings: [{ id: 'qual' }],
      unverifiedWarnings: [],
      coreCount: 2,
      highCount: 1,
      mediumCount: 0,
      lowCount: 1,
    },
    lanes,
    sameOrganization: true,
  })
  assert.equal(published.clashWarnings[0] && (published.clashWarnings[0] as { id: string }).id, 'clash')
  assert.equal(published.unbookedWarnings[0] && (published.unbookedWarnings[0] as { id: string }).id, 'unbooked')
  assert.equal(published.qualificationWarnings.length, 1)
  assert.equal(published.highCount, 2)
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

test('an empty partial scan does not wipe warnings already computed', () => {
  const previous = { id: 'unbooked-1' }
  const kept = retainWarningsAfterScan({
    previous,
    next: null,
    partial: true,
    previousCount: 12,
    nextCount: 0,
    sameOrganization: true,
  })
  assert.equal(kept, previous)
  const honestEmpty = retainWarningsAfterScan({
    previous,
    next: null,
    partial: false,
    previousCount: 12,
    nextCount: 0,
    sameOrganization: true,
  })
  assert.equal(honestEmpty, null)
})

test('rows from another company do not count as an empty scan for this one', () => {
  const scoped = partitionRowsByOrganization(
    [{ id: 'b', organizationId: 'other-org' }],
    '2C67391E-D1FE-4F9F-8055-7149ACDE1F96'
  )
  assert.equal(scoped.foreign, true)
  assert.equal(scoped.rows.length, 0)
  assert.equal(
    warningsScanPartial({
      detectionReady: true,
      rosterReady: true,
      operativesReady: true,
      projectsReady: true,
      bookingsLoading: false,
      ownBookingCount: 0,
      bookingsForeign: true,
      managerLoading: false,
      ownManagerBookingCount: 0,
      managerForeign: false,
      rosterForeign: false,
      operativesForeign: false,
    }),
    true
  )
})

test('an unsaved number-of-days draft does not replace the saved invoicing-period scan', () => {
  assert.equal(warningDetectionForScan(invoicingPeriod, unsavedDraft, false), null)
  const settled = warningDetectionForScan(invoicingPeriod, unsavedDraft, true)
  assert.equal(settled?.clashLookaheadMode, 'endOfInvoicingPeriod')
  assert.equal(settled?.clashLookaheadDays, 12)
})
