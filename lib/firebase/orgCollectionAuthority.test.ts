/**
 * Rulebook 1.43.0 (review r318, blocking): a timesheet is signed only once its period's bookings have truly arrived.
 * The booking stores set `coverage` only from an authoritative snapshot; these are the decisions behind that.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bookingCoverageAfterPublish,
  bookingCoverageIsArchive,
  bookingCoverageOnSubscribe,
  cachedReplayAuthoritative,
  orgPlanAuthoritative,
  republishHeldAsAuthoritative,
} from './orgCollectionMerge.ts'

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

test('review r318 (2): coverage is cleared by a non-authoritative publish and by a new query', () => {
  const full = { organizationId: 'org-1', fullHistory: true, fromDayKey: null }
  // A server answer of the whole query sets it.
  assert.deepEqual(bookingCoverageAfterPublish(full, { authoritative: true }), full)
  // A cache replay, a re-planned or restarted plan, or a publish that does not say: cleared until the new query answers.
  assert.equal(bookingCoverageAfterPublish(full, { authoritative: false }), null)
  assert.equal(bookingCoverageAfterPublish(full, undefined), null)
  // Starting a new query (wider bound, new plan) drops what the old one covered; the same live query keeps it.
  assert.equal(bookingCoverageOnSubscribe(full, false), null)
  assert.deepEqual(bookingCoverageOnSubscribe(full, true), full)
  // The sequence a timesheet sees: answered → re-plan publishes before its parts answer → answered again.
  let coverage: typeof full | null = bookingCoverageAfterPublish(full, { authoritative: true })
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), true)
  coverage = bookingCoverageOnSubscribe(coverage, false)
  coverage = bookingCoverageAfterPublish(full, { authoritative: orgPlanAuthoritative([{ settled: false }]) })
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), false)
  coverage = bookingCoverageAfterPublish(full, { authoritative: orgPlanAuthoritative([{ settled: true, serverSnapshot: true }]) })
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), true)
})

test('review r318 (3): answered → cached change → server confirms unchanged rows → coverage restored', () => {
  const full = { organizationId: 'org-1', fullHistory: true, fromDayKey: null }
  // Mirrors subscribeOrgCollection: each publish records whether it was authoritative; a metadata-only server
  // confirmation re-publishes the held rows when the last publish was not.
  let lastAuthoritative = false
  let coverage: typeof full | null = null
  const publish = (authoritative: boolean) => {
    lastAuthoritative = authoritative
    coverage = bookingCoverageAfterPublish(full, { authoritative })
  }
  const confirm = (input: { fromCache: boolean; hasPendingWrites: boolean }) => {
    if (republishHeldAsAuthoritative({ ...input, heldIsSnapshot: true, lastPublishAuthoritative: lastAuthoritative })) publish(true)
  }
  publish(true) // the server's answer
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), true)
  publish(false) // network blip: a cached snapshot with a change
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), false)
  confirm({ fromCache: true, hasPendingWrites: false }) // still offline: nothing
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), false)
  confirm({ fromCache: false, hasPendingWrites: true }) // the server answered but this device has an unconfirmed write
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), false)
  confirm({ fromCache: false, hasPendingWrites: false }) // reconnected: the server confirms the same rows
  assert.equal(bookingCoverageIsArchive(coverage, 'org-1'), true)
  // Already authoritative: a further confirmation publishes nothing new.
  assert.equal(republishHeldAsAuthoritative({ fromCache: false, hasPendingWrites: false, heldIsSnapshot: true, lastPublishAuthoritative: true }), false)
  // Rows held from an older bound are not this snapshot: never re-published as its answer.
  assert.equal(republishHeldAsAuthoritative({ fromCache: false, hasPendingWrites: false, heldIsSnapshot: false, lastPublishAuthoritative: false }), false)
})

test('review r318 (3): a plan part that published a cached change is not authoritative until the server confirms it', () => {
  // Plan parts carry `currentFromServer` (not the sticky "ever answered"): a cached change makes the plan non-authoritative.
  assert.equal(orgPlanAuthoritative([{ settled: true, serverSnapshot: true }, { settled: true, serverSnapshot: false }]), false)
  const confirmed = republishHeldAsAuthoritative({ fromCache: false, hasPendingWrites: false, heldIsSnapshot: true, lastPublishAuthoritative: false })
  assert.equal(confirmed, true)
  assert.equal(orgPlanAuthoritative([{ settled: true, serverSnapshot: true }, { settled: true, serverSnapshot: confirmed }]), true)
})
