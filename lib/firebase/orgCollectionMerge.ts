/**
 * The pure part of the organisation listeners (`subscribeOrgCollection`): how one snapshot replaces the documents
 * the app holds for that listener. No Firebase import, so the data-parity fixture (rulebook 1.38.0 §27,
 * `lib/canonical/data-parity-fixture.json`) runs the same code in tests.
 */
import { retainLoadedRows } from '@/lib/staff/rosterRetain'

export type OrgCollectionDoc = { id: string; data: Record<string, unknown> }

/**
 * A server snapshot is the collection (rows missing from it are gone, even when that empties the list); a cache
 * snapshot never empties the list and never drops a row on screen (`retainLoadedRows`). Documents this app deleted
 * (`removedIds`) never come back. `fromCache` null means the snapshot did not say: not authoritative.
 */
export function mergeOrgCollectionSnapshot(input: {
  previous: readonly OrgCollectionDoc[]
  docs: readonly OrgCollectionDoc[]
  removedIds?: ReadonlySet<string> | null
  fromCache: boolean | null
}): { docs: OrgCollectionDoc[]; authoritative: boolean } {
  const removed = input.removedIds
  const keep = (rows: readonly OrgCollectionDoc[]) => (removed && removed.size > 0 ? rows.filter((row) => !removed.has(row.id)) : [...rows])
  const authoritative = input.fromCache === null ? false : !input.fromCache
  return { docs: retainLoadedRows(keep(input.previous), keep(input.docs), { authoritative }), authoritative }
}

/** How many held documents the job readers deliberately leave out (the legacy `INITIAL-PLACEHOLDER`). */
export function readerDroppedJobDocuments(docs: readonly OrgCollectionDoc[], isPlaceholder: (id: string) => boolean): number {
  return docs.filter((row) => isPlaceholder(row.id)).length
}

/**
 * Rulebook 1.38.0 §27 (re-review fix): the listeners run with `includeMetadataChanges` so the data check learns when
 * the server answered — a cache-first listener whose server confirmation changes no document raises only a metadata
 * snapshot otherwise never seen. Such a snapshot (no document added, changed or removed, after the listener's first)
 * only updates the check's flags; the store never sees it, so it gets exactly the snapshots it got before.
 */
export function isMetadataOnlySnapshot(input: { documentChangeCount: number; deliveredBefore: boolean }): boolean {
  return input.deliveredBefore && input.documentChangeCount === 0
}

/**
 * 1.43.0: a plan's merged rows (`subscribeOrgPlan`) are authoritative — the complete answer to every query — only
 * when every part has settled with a server (not cache) snapshot and none was refused. The publish made when the plan
 * starts (before any part answered) and a cache snapshot are not. A plan with no parts reads nothing: complete.
 */
export function orgPlanAuthoritative(
  parts: ReadonlyArray<{ settled: boolean; failed?: boolean; serverSnapshot?: boolean }>
): boolean {
  return parts.every((part) => part.settled && part.failed !== true && part.serverSnapshot === true)
}

/**
 * 1.43.0: the remembered rows a listener replays on (re)subscribe are the server's copy of the requested query only
 * when the live listener is that same query and has had a server snapshot. The memory is kept per listener key and
 * organisation, not per query, so a widened bound (bookings → the whole archive) first replays the narrower rows.
 */
export function cachedReplayAuthoritative(input: {
  liveQueryId: string | null
  requestedQueryId: string
  serverDeliveredQuery: string | null
  organizationId: string
}): boolean {
  if (input.liveQueryId == null || input.liveQueryId !== input.requestedQueryId) return false
  return input.serverDeliveredQuery === `${input.organizationId}|${input.requestedQueryId}`
}

/** 1.43.0: a booking store's `coverage` is the whole archive of the open organisation (the timesheet screens' need). */
export function bookingCoverageIsArchive(
  coverage: { organizationId: string; fullHistory: boolean } | null | undefined,
  organizationId: string | null | undefined
): boolean {
  return Boolean(coverage && organizationId && coverage.organizationId === organizationId && coverage.fullHistory)
}

export type BookingCoverage = { organizationId: string; fullHistory: boolean; fromDayKey: string | null }

/**
 * 1.43.0 (review r318, second round): a booking store's `coverage` after one publish of its listener — the listener's
 * own coverage when the publish is authoritative (a server answer of the whole query), else none. A cache replay, a
 * plan that was re-planned or restarted by the data check, or a part that has not answered yet clears it until the new
 * query answers, so a timesheet is never signed on rows from an earlier query.
 */
export function bookingCoverageAfterPublish(
  listenerCoverage: BookingCoverage,
  meta: { authoritative?: boolean } | null | undefined
): BookingCoverage | null {
  return meta?.authoritative === true ? listenerCoverage : null
}

/**
 * 1.43.0: `coverage` when a listener is (re)started — kept only when the same live query keeps running; any new query
 * (a wider bound, a new plan) starts with none.
 */
export function bookingCoverageOnSubscribe(
  current: BookingCoverage | null,
  sameLiveQuery: boolean
): BookingCoverage | null {
  return sameLiveQuery ? current : null
}
