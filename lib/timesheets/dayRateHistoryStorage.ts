/**
 * iOS parity: FirebaseBackend.loadOperativeDayRateHistory / recordOperativeDayRateChange
 * Collection: organizations/{orgId}/operativeDayRateHistory/{uuid}
 */
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp, type Unsubscribe } from 'firebase/firestore'
import { watchOrgCollection } from '@/lib/firebase/watchOrgQuery'
import { auth, db } from '@/lib/firebase/config'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { payRateChangeWrites, payRateHistoryWriteFields } from '@/lib/canonical/payRate'
import { parsePayRateHistoryDocument } from '@/lib/canonical/peopleDocuments'
import { organizationTimeZone } from '@/lib/canonical'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'
import type { PayBasis } from '@/lib/timesheets/payBasis'

export type OperativeDayRateHistoryEntry = {
  id: string
  userId?: string | null
  operativeId?: string | null
  /**
   * Amount per day or per hour. The field name stays dayRate so old rows still load. null is a "rate cleared"
   * row: no rate from its effective day (`payRateOnDay`).
   */
  dayRate: number | null
  /** Missing on old rows means day; missing on a cleared row. */
  payBasis?: PayBasis
  effectiveAt: Date
  createdAt: Date
}

export type OperativeDayRateHistoryCollection = {
  byUserId: Record<string, OperativeDayRateHistoryEntry[]>
  byOperativeId: Record<string, OperativeDayRateHistoryEntry[]>
}

export function emptyDayRateHistory(): OperativeDayRateHistoryCollection {
  return { byUserId: {}, byOperativeId: {} }
}

function idList(value?: string | string[] | null): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  return raw.map((id) => id.trim()).filter(Boolean)
}

export function mergedDayRateEntries(
  history: OperativeDayRateHistoryCollection,
  userId?: string | string[] | null,
  operativeId?: string | string[] | null
): OperativeDayRateHistoryEntry[] {
  const seen = new Set<string>()
  const out: OperativeDayRateHistoryEntry[] = []
  const push = (entry: OperativeDayRateHistoryEntry) => {
    if (seen.has(entry.id)) return
    seen.add(entry.id)
    out.push(entry)
  }
  for (const id of idList(userId)) {
    for (const entry of history.byUserId[id] || []) push(entry)
  }
  for (const id of idList(operativeId)) {
    for (const entry of history.byOperativeId[id] || []) push(entry)
  }
  return out.sort((a, b) => {
    const byEffective = a.effectiveAt.getTime() - b.effectiveAt.getTime()
    if (byEffective !== 0) return byEffective
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

/** One history row through the rulebook reader `parsePayRateHistoryDocument` (rulebook 1.6.0, §8). */
function parseEntry(id: string, data: Record<string, unknown>): OperativeDayRateHistoryEntry | null {
  const parsed = parsePayRateHistoryDocument(id, data)
  if (!parsed) return null
  return {
    id: parsed.id,
    userId: parsed.userId,
    operativeId: parsed.operativeId,
    dayRate: parsed.dayRate,
    payBasis: parsed.payBasis ?? undefined,
    effectiveAt: new Date(parsed.effectiveAt),
    createdAt: new Date(parsed.createdAt),
  }
}

function historyFromDocs(docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>): OperativeDayRateHistoryCollection {
  const byUserId: Record<string, OperativeDayRateHistoryEntry[]> = {}
  const byOperativeId: Record<string, OperativeDayRateHistoryEntry[]> = {}
  for (const row of docs) {
    const entry = parseEntry(row.id, row.data)
    if (!entry) continue
    if (entry.userId) {
      byUserId[entry.userId] = [...(byUserId[entry.userId] || []), entry]
    }
    if (entry.operativeId) {
      byOperativeId[entry.operativeId] = [...(byOperativeId[entry.operativeId] || []), entry]
    }
  }
  const sort = (rows: OperativeDayRateHistoryEntry[]) =>
    rows.sort((a, b) => {
      const byEffective = a.effectiveAt.getTime() - b.effectiveAt.getTime()
      if (byEffective !== 0) return byEffective
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  for (const key of Object.keys(byUserId)) sort(byUserId[key])
  for (const key of Object.keys(byOperativeId)) sort(byOperativeId[key])
  return { byUserId, byOperativeId }
}

export async function loadOperativeDayRateHistory(
  organizationId: string
): Promise<OperativeDayRateHistoryCollection> {
  try {
    const snap = await getDocs(collection(db, 'organizations', organizationId, 'operativeDayRateHistory'))
    return historyFromDocs(snap.docs.map((row) => ({ id: row.id, data: row.data() as Record<string, unknown> })))
  } catch {
    return emptyDayRateHistory()
  }
}

/** Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): pay history is live while a screen showing it is open. */
export function watchOperativeDayRateHistory(
  organizationId: string,
  onHistory: (history: OperativeDayRateHistoryCollection) => void
): Unsubscribe {
  return watchOrgCollection(organizationId, 'operativeDayRateHistory', (docs) => onHistory(historyFromDocs(docs)))
}

/** The open organisation's business zone (`organizationTimeZone`), for callers that do not pass one. */
function openOrganizationTimeZone(): string {
  const data = useOrganizationDocumentStore.getState().data
  const country = data && typeof data.countryCode === 'string' ? data.countryCode : null
  return organizationTimeZone(country)
}

/**
 * iOS recordOperativeDayRateChange — one new history row (`payRateHistoryWriteFields`): the effective day is
 * the organisation-zone day and `effectiveAt` its midnight in that zone. An explicit 0 is a rate; `null`
 * records "rate cleared" (`dayRate: null, payBasis: null`).
 */
export async function recordOperativeDayRateChange({
  organizationId,
  userId,
  operativeId,
  dayRate,
  payBasis = 'day',
  effectiveAt,
  timeZone,
}: {
  organizationId: string
  userId?: string | null
  operativeId?: string | null
  dayRate: number | null
  payBasis?: PayBasis
  effectiveAt: Date
  /** Organisation business zone; defaults to the open organisation's. */
  timeZone?: string | null
}): Promise<void> {
  const fields = payRateHistoryWriteFields({
    userId,
    operativeId,
    rate: dayRate,
    payBasis,
    effective: effectiveAt,
    timeZone: timeZone || openOrganizationTimeZone(),
  })
  if (!fields) return
  const ref = doc(db, 'organizations', organizationId, 'operativeDayRateHistory', newUuid())
  const payload: Record<string, unknown> = {
    dayRate: fields.dayRate,
    payBasis: fields.payBasis,
    effectiveAt: Timestamp.fromMillis(fields.effectiveAtMs),
    userId: fields.userId,
    operativeId: fields.operativeId,
    createdAt: serverTimestamp(),
  }
  Object.assign(payload, writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}, { updatedAt: serverTimestamp() })
  await setDoc(ref, payload)
}

/**
 * iOS UserStore: if no history yet, seed the previous live rate from account createdAt,
 * then write the new rate (including £0).
 */
export async function recordDayRateChangeIfNeeded({
  organizationId,
  userId,
  operativeId,
  previousDayRate,
  nextDayRate,
  previousPayBasis,
  nextPayBasis,
  createdAt,
  effectiveAt = new Date(),
  history,
  timeZone,
}: {
  organizationId: string
  userId?: string | null
  operativeId?: string | null
  previousDayRate?: number | null
  nextDayRate?: number | null
  previousPayBasis?: PayBasis | null
  nextPayBasis?: PayBasis | null
  createdAt?: Date
  effectiveAt?: Date
  history: OperativeDayRateHistoryCollection
  /** Organisation business zone; defaults to the open organisation's. */
  timeZone?: string | null
}): Promise<void> {
  const previous = previousDayRate ?? null
  const next = nextDayRate ?? null
  const prevBasis = previousPayBasis === 'hourly' || previousPayBasis === 'day' ? previousPayBasis : null
  const nextBasis: PayBasis = nextPayBasis === 'hourly' ? 'hourly' : 'day'
  const basisChanged = prevBasis != null && prevBasis !== nextBasis
  // Clearing a saved rate writes a "rate cleared" row (`payRateHistoryWriteFields` with no rate).
  if (next == null) {
    if (previous == null) return
    await recordOperativeDayRateChange({ organizationId, userId, operativeId, dayRate: null, effectiveAt, timeZone })
    return
  }
  if (!basisChanged && previous === next) return
  const merged = mergedDayRateEntries(history, userId, operativeId)
  if (merged.length === 0 && previous != null && previous > 0 && createdAt) {
    await recordOperativeDayRateChange({
      organizationId,
      userId,
      operativeId,
      dayRate: previous,
      payBasis: prevBasis === 'hourly' ? 'hourly' : 'day',
      effectiveAt: createdAt,
      timeZone,
    })
  }
  await recordOperativeDayRateChange({
    organizationId,
    userId,
    operativeId,
    dayRate: next,
    payBasis: nextBasis,
    effectiveAt,
    timeZone,
  })
}

/** Rulebook 1.10.0: the history, or null when it did not load (never treated as empty, `payRateChangeWrites`). */
export async function loadOperativeDayRateHistoryOrNull(
  organizationId: string
): Promise<OperativeDayRateHistoryCollection | null> {
  try {
    const snap = await getDocs(collection(db, 'organizations', organizationId, 'operativeDayRateHistory'))
    return historyFromDocs(snap.docs.map((row) => ({ id: row.id, data: row.data() as Record<string, unknown> })))
  } catch {
    return null
  }
}

/** A history row to write in the same batch as the profile save (`payRateChangeWrites` row → Firestore fields). */
export type PayHistoryBatchRow = { id: string; fields: Record<string, unknown> }

/**
 * Rulebook 1.10.0 §8 (`payRateChangeWrites`): the seed row (only when the person has no history yet) and the new
 * row, ready for the profile save's batch. Throws `PAY_HISTORY_NOT_LOADED_MESSAGE` when the history did not load.
 */
export function payHistoryBatchRows(input: {
  history: OperativeDayRateHistoryCollection | null
  userId?: string | null
  operativeId?: string | null
  previous: { rate: number | null | undefined; payBasis?: PayBasis | null }
  next: { rate: number | null | undefined; payBasis?: PayBasis | null }
  effectiveAt: Date
  seedEffective?: Date | null
  timeZone?: string | null
}): PayHistoryBatchRow[] {
  const personRows = input.history ? mergedDayRateEntries(input.history, input.userId, input.operativeId) : null
  const result = payRateChangeWrites({
    userId: input.userId,
    operativeId: input.operativeId,
    previousProfile: input.previous,
    nextProfile: input.next,
    history: personRows,
    effectiveDayKey: input.effectiveAt,
    seedEffective: input.seedEffective ?? null,
    timeZone: input.timeZone || openOrganizationTimeZone(),
  })
  if (!result.ok) throw new Error(result.message)
  const metadata = writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}
  return result.rows.map((row) => ({
    id: newUuid(),
    fields: {
      dayRate: row.dayRate,
      payBasis: row.payBasis,
      effectiveAt: Timestamp.fromMillis(row.effectiveAtMs),
      userId: row.userId,
      operativeId: row.operativeId,
      createdAt: serverTimestamp(),
      ...metadata,
      updatedAt: serverTimestamp(),
    },
  }))
}
