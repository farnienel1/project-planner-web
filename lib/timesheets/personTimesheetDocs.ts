/**
 * A person's timesheet documents under every id they go by (guardrail 1). The ids are the rulebook's `personIdSet`
 * (`timesheetMemberIds`: own id, `formerUserIds`, `sameEmailUserIds`, same-email users documents); a document belongs
 * to the person when its stored `userId` is one of them, or — for a sheet an older build stored without `userId` —
 * when its document id names one of them (`timesheetDocumentSubjectId`, rulebook 1.31.0). Firestore queries match ids
 * exactly as stored (case-sensitive), so each id is asked as `personIdSet` lists it; the filter below then compares
 * without case (`normalizeDocumentId`). A sheet stored under an id in another letter case than any id the person's
 * documents list is not found by these queries (the company-wide Exported read still matches it). No pay, period or
 * status rule here: the rows go on to the existing readers.
 */
import { normalizeDocumentId } from '@/lib/canonical'
import { timesheetDocumentSubjectId } from '@/lib/canonical/timesheetPeriod'
import { queryIdsSkippingRefused } from '@/lib/timesheets/timesheetQueue'

export type SettingsDocument = { id: string; data: Record<string, unknown> }

/** Firestore `in` chunk for the alias ids (both apps use 10). */
export const PERSON_TIMESHEET_ID_CHUNK = 10

function storedUserId(data: Record<string, unknown>): string {
  return typeof data.userId === 'string' ? data.userId.trim() : ''
}

/** The person a timesheet document is filed under: its stored `userId`, else the id its document id names. */
export function timesheetDocumentOwnerId(entry: SettingsDocument): string {
  return storedUserId(entry.data) || timesheetDocumentSubjectId(entry.id) || ''
}

/**
 * The timesheet documents (ids starting `timesheet_`) of `docs` that belong to the person with `ids`, once each by
 * document id. A document with a stored `userId` belongs to whoever that names, never to the id its document id
 * names, so another person's sheet is never borrowed.
 */
export function timesheetDocsForPerson(ids: ReadonlyArray<string>, docs: ReadonlyArray<SettingsDocument>): SettingsDocument[] {
  const keys = new Set(ids.map((id) => normalizeDocumentId(id)).filter(Boolean))
  const seen = new Set<string>()
  const out: SettingsDocument[] = []
  for (const entry of docs) {
    if (!entry.id.startsWith('timesheet_') || seen.has(entry.id)) continue
    const owner = normalizeDocumentId(timesheetDocumentOwnerId(entry))
    if (!owner || !keys.has(owner)) continue
    seen.add(entry.id)
    out.push(entry)
  }
  return out
}

/**
 * Newest pay run first; within one pay run (same `weekStart`) the sheet filed under the person's own id comes last, so
 * a screen that keys one sheet per pay run and lets the later row win keeps the own-id sheet and shows an alias's sheet
 * only for a pay run that has none under the own id. Review of #386: the order across pay runs stays newest first.
 */
export function newestFirstOwnIdLast<T extends { userId: string; weekStart: Date }>(rows: ReadonlyArray<T>, ownId: string): T[] {
  const own = normalizeDocumentId(ownId)
  const isOwn = (row: T) => Number(normalizeDocumentId(row.userId) === own)
  return [...rows].sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime() || isOwn(a) - isOwn(b))
}

export type PersonTimesheetQueries = {
  /** Settings documents with `userId ==` the one id given, or `userId in` the ids given. */
  byUserIds: (ids: string[]) => Promise<SettingsDocument[]>
  /**
   * Settings documents whose document id starts `timesheet_{id}_` (sheets stored without `userId`); null when the
   * viewer may not run that query (an operative, review of #386 N1).
   */
  byDocumentPrefix: ((id: string) => Promise<SettingsDocument[]>) | null
  /** Logged, never shown. */
  warn?: (message: string, detail: unknown) => void
}

/**
 * Reads a person's timesheet documents: their own id first (`userId ==`, the query the 1.43.0 rules let anyone run for
 * themselves), then their other ids in chunks of `PERSON_TIMESHEET_ID_CHUNK` and the document-id prefix of every id.
 * A query the rules refuse (for example an operative querying their own former invite id) is skipped and logged —
 * never an error and never at the cost of the sheets already read. Returns only the person's documents.
 */
export async function personTimesheetDocs(
  ids: ReadonlyArray<string>,
  queries: PersonTimesheetQueries
): Promise<SettingsDocument[]> {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const key = normalizeDocumentId(id)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(id.trim())
  }
  if (unique.length === 0) return []
  const warn = queries.warn ?? (() => {})
  const [ownId, ...aliases] = unique
  const found: SettingsDocument[] = []
  const tasks: Promise<void>[] = [
    queries.byUserIds([ownId]).then(
      (docs) => void found.push(...docs),
      (error) => warn('own userId query failed', error)
    ),
  ]
  if (aliases.length > 0) {
    tasks.push(
      queryIdsSkippingRefused(aliases, PERSON_TIMESHEET_ID_CHUNK, queries.byUserIds).then(
        ({ rows, refusedIds }) => {
          found.push(...rows)
          if (refusedIds.length > 0) warn('alias userId query refused', refusedIds)
        },
        (error) => warn('alias userId query failed', error)
      )
    )
  }
  const byDocumentPrefix = queries.byDocumentPrefix
  for (const id of byDocumentPrefix ? unique : []) {
    tasks.push(
      byDocumentPrefix!(id).then(
        (docs) => void found.push(...docs),
        (error) => warn('document-id query failed', { id, error })
      )
    )
  }
  await Promise.all(tasks)
  return timesheetDocsForPerson(unique, found)
}
