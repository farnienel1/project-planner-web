import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_INVOICING, DEFAULT_WARNING_DETECTION } from '../settings/organizationSettings.ts'
import {
  organizationDetailsForWarningScan,
  partitionRowsByOrganization,
  warningScanUsers,
  publishReadyWarningLanes,
  retainWarningsAfterScan,
  warningDetectionForScan,
  warningScanInvoicingReady,
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

test('qualification rows stay hidden until the schedule scan is ready', () => {
  assert.equal(
    warningsScreenPhase({
      detectionReady: true,
      rosterReady: false,
      operativesReady: true,
      projectsReady: false,
      warningCount: 4,
    }),
    'scanning'
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
  assert.equal(lanes.clashes, false)
  assert.equal(lanes.unbooked, false)
  assert.equal(lanes.qualifications, false)
  assert.equal(lanes.unverified, false)
  const readyWithoutProjects = warningScanLanes({
    detectionReady: true,
    bookingsReady: true,
    managerReady: true,
    rosterReady: true,
    operativesReady: true,
    projectsReady: false,
    holidaysReady: true,
    materialsReady: false,
    sendRecordsReady: false,
  })
  assert.equal(readyWithoutProjects.qualifications, true)
  assert.equal(readyWithoutProjects.unbooked, true)
  assert.equal(readyWithoutProjects.materials, false)
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
  assert.equal(published.clashWarnings[0] && (published.clashWarnings[0] as { id: string }).id, 'kept')
  assert.equal(published.unbookedWarnings[0] && (published.unbookedWarnings[0] as { id: string }).id, 'unbooked')
  assert.equal(published.qualificationWarnings.length, 0)
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

test('a roster member whose user document names another company stays in the warning scan', () => {
  const orgId = '2C67391E-D1FE-4F9F-8055-7149ACDE1F96'
  const member = { id: 'admin-1', organizationId: '6b04f81d-a55e-41d2-8676-ecd116ad8450' }
  const colleague = { id: 'manager-1', organizationId: orgId }
  const kept = warningScanUsers([member, colleague], orgId, true)
  assert.equal(kept.foreign, false)
  assert.deepEqual(kept.rows.map((user) => user.id), ['admin-1', 'manager-1'])
  const otherCompany = warningScanUsers([member], orgId, false)
  assert.equal(otherCompany.foreign, true)
  assert.equal(otherCompany.rows.length, 0)
})

test('an unsaved number-of-days draft does not replace the saved invoicing-period scan', () => {
  assert.equal(warningDetectionForScan(invoicingPeriod, unsavedDraft, false), null)
  const settled = warningDetectionForScan(invoicingPeriod, unsavedDraft, true)
  assert.equal(settled?.clashLookaheadMode, 'endOfInvoicingPeriod')
  assert.equal(settled?.clashLookaheadDays, 12)
})

test('end-of-invoicing-period waits for live payment runs before scanning', () => {
  assert.equal(warningScanInvoicingReady(invoicingPeriod, undefined), false)
  assert.equal(warningScanInvoicingReady(invoicingPeriod, DEFAULT_INVOICING), true)
  assert.equal(warningScanInvoicingReady(unsavedDraft, undefined), true)
})

test('a later factory detection read must not keep a leftover 1–16 payment run', () => {
  const stale = {
    id: 'org',
    name: 'Firm',
    warningDetection: invoicingPeriod,
    invoicing: {
      ...DEFAULT_INVOICING,
      paymentRunDateRanges: [
        { startDay: 1, endDay: 16 },
        { startDay: 17, endDay: 31 },
      ],
    },
  }
  const live = {
    id: 'org',
    name: 'Firm',
    warningDetection: DEFAULT_WARNING_DETECTION,
    invoicing: {
      ...DEFAULT_INVOICING,
      paymentRunDateRanges: [
        { startDay: 1, endDay: 15 },
        { startDay: 16, endDay: 31 },
      ],
    },
  }
  const merged = organizationDetailsForWarningScan({
    current: stale as never,
    loaded: live as never,
    cachedDetection: invoicingPeriod,
  })
  assert.equal(merged.warningDetection.clashLookaheadMode, 'endOfInvoicingPeriod')
  assert.equal(merged.invoicing.paymentRunDateRanges[0].endDay, 15)
  assert.equal(merged.invoicing.paymentRunDateRanges[1].startDay, 16)
})
