/**
 * Rulebook 1.43.0 (review r318, blocking): a timesheet is signed only once its period's bookings have truly arrived.
 * The booking stores set `coverage` only from an authoritative snapshot; these are the decisions behind that.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingCoverageIsArchive, cachedReplayAuthoritative, orgPlanAuthoritative } from './orgCollectionMerge.ts'

test('a plan is authoritative only when every part has a server snapshot and none was refused', () => {
  // The publish when the plan starts: no part has answered.
  assert.equal(orgPlanAuthoritative([{ settled: false }, { settled: false }]), false)
  // One part answered from the server, the other only from cache.
  assert.equal(orgPlanAuthoritative([{ settled: true, serverSnapshot: true }, { settled: true, serverSnapshot: false }]), false)
  // A refused part: the rows are incomplete.
  assert.equal(orgPlanAuthoritative([{ settled: true, serverSnapshot: true }, { settled: true, failed: true }]), false)
  // Every part answered by the server.
  assert.equal(orgPlanAuthoritative([{ settled: true, serverSnapshot: true }, { settled: true, serverSnapshot: true }]), true)
  // Nothing to read.
  assert.equal(orgPlanAuthoritative([]), true)
})

test('replayed rows are authoritative only for the same live query after a server snapshot', () => {
  const org = 'org-1'
  // Widening the bound: the remembered rows belong to the narrower query.
  assert.equal(
    cachedReplayAuthoritative({ liveQueryId: 'from:2026-11-09', requestedQueryId: 'full', serverDeliveredQuery: `${org}|from:2026-11-09`, organizationId: org }),
    false
  )
  // No live listener yet.
  assert.equal(cachedReplayAuthoritative({ liveQueryId: null, requestedQueryId: 'full', serverDeliveredQuery: null, organizationId: org }), false)
  // Same query, but only cache so far.
  assert.equal(cachedReplayAuthoritative({ liveQueryId: 'full', requestedQueryId: 'full', serverDeliveredQuery: null, organizationId: org }), false)
  // Same query, server answered.
  assert.equal(cachedReplayAuthoritative({ liveQueryId: 'full', requestedQueryId: 'full', serverDeliveredQuery: `${org}|full`, organizationId: org }), true)
  // Another organisation's answer never counts.
  assert.equal(cachedReplayAuthoritative({ liveQueryId: 'full', requestedQueryId: 'full', serverDeliveredQuery: 'org-2|full', organizationId: org }), false)
})

test('the timesheet screens need the whole archive of the open organisation', () => {
  assert.equal(bookingCoverageIsArchive({ organizationId: 'org-1', fullHistory: true }, 'org-1'), true)
  assert.equal(bookingCoverageIsArchive({ organizationId: 'org-1', fullHistory: false }, 'org-1'), false)
  assert.equal(bookingCoverageIsArchive({ organizationId: 'org-2', fullHistory: true }, 'org-1'), false)
  assert.equal(bookingCoverageIsArchive(null, 'org-1'), false)
  assert.equal(bookingCoverageIsArchive({ organizationId: 'org-1', fullHistory: true }, null), false)
})
