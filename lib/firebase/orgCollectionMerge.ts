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
