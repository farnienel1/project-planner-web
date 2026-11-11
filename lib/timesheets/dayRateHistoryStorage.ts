/**
 * iOS parity: FirebaseBackend.loadOperativeDayRateHistory / recordOperativeDayRateChange
 * Collection: organizations/{orgId}/operativeDayRateHistory/{uuid}
 */
import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where, type QueryConstraint, type Unsubscribe } from 'firebase/firestore'
import { watchOrgCollection } from '@/lib/firebase/watchOrgQuery'
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'
import { rateHistoryQueryPlan, type RateHistoryQueryPlan } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { payPlanSubjects } from '@/lib/pay/payProfileOverlay'
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
  // 1.36.0 (FU-5): ids compare without case (rulebook §1 `normalizeDocumentId`), so a row filed under an iOS
  // upper-case id, or a person's id in another letter case, is still that person's history.
  const userKeys = new Set(idList(userId).map((id) => id.toLowerCase()))
  const operativeKeys = new Set(idList(operativeId).map((id) => id.toLowerCase()))
  for (const [key, entries] of Object.entries(history.byUserId)) {
    if (userKeys.has(key.trim().toLowerCase())) for (const entry of entries) push(entry)
  }
  for (const [key, entries] of Object.entries(history.byOperativeId)) {
    if (operativeKeys.has(key.trim().toLowerCase())) for (const entry of entries) push(entry)
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

/**
 * Rulebook 1.26.0 §8 / §16 (`rateHistoryQueryPlan`): the whole collection while `privatePay` is off for this
 * organisation, and for admins; otherwise one `userId ==` query per person whose pay the signed-in user may see
 * (their own and their reports'), since the rules refuse a non-admin's whole-collection read once it is on.
 */
function rateHistoryPlanFor(organizationId: string): RateHistoryQueryPlan {
  const roster = useOrgUserStore.getState().users
  // 1.27.0: the catalogue operatives too (`payPlanSubjects`), each read `operativeId ==` + `userId == ''`.
  return rateHistoryQueryPlan(useAuthStore.getState().user as never, payPlanSubjects(organizationId, roster as never), roster as never, {
    privatePay: privatePayFor(organizationId),
  })
}

/** The per-person queries of a `people` plan: `userId ==` per person, `operativeId ==` + `userId == ''` per catalogue row. */
function planQueries(plan: Extract<RateHistoryQueryPlan, { kind: 'people' }>): Array<{ key: string; constraints: QueryConstraint[] }> {
  return [
    ...plan.userIds.map((userId) => ({ key: `user:${userId}`, constraints: [where('userId', '==', userId)] })),
    ...(plan.operativeIds || []).map((operativeId) => ({
      key: `operative:${operativeId}`,
      constraints: [where('operativeId', '==', operativeId), where('userId', '==', '')],
    })),
  ]
}

async function readRateHistoryDocs(organizationId: string): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const col = collection(db, 'organizations', organizationId, 'operativeDayRateHistory')
  await securitySwitchesReady()
  const plan = rateHistoryPlanFor(organizationId)
  const snaps = plan.kind === 'all'
    ? [await getDocs(col)]
    : // One refused query (a row the rules count differently) never empties the rest of the history.
      (await Promise.allSettled(planQueries(plan).map((entry) => getDocs(query(col, ...entry.constraints)))))
        .flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  const byId = new Map<string, { id: string; data: Record<string, unknown> }>()
  for (const snap of snaps) {
    for (const row of snap.docs) byId.set(row.id, { id: row.id, data: row.data() as Record<string, unknown> })
  }
  return [...byId.values()]
}

export async function loadOperativeDayRateHistory(
  organizationId: string
): Promise<OperativeDayRateHistoryCollection> {
  try {
    return historyFromDocs(await readRateHistoryDocs(organizationId))
  } catch {
    return emptyDayRateHistory()
  }
}

/** Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): pay history is live while a screen showing it is open. */
export function watchOperativeDayRateHistory(
  organizationId: string,
  onHistory: (history: OperativeDayRateHistoryCollection) => void
): Unsubscribe {
  const plan = rateHistoryPlanFor(organizationId)
  if (plan.kind === 'all') {
    return watchOrgCollection(organizationId, 'operativeDayRateHistory', (docs) => onHistory(historyFromDocs(docs)))
  }
  // 1.26.0: one listener per person (`rateHistoryQueryPlan`), merged.
  const perPerson = new Map<string, Array<{ id: string; data: Record<string, unknown> }>>()
  const emit = () => {
    const byId = new Map<string, { id: string; data: Record<string, unknown> }>()
    for (const rows of perPerson.values()) for (const row of rows) byId.set(row.id, row)
    onHistory(historyFromDocs([...byId.values()]))
  }
  const stops = planQueries(plan).map((entry) =>
    watchOrgCollection(
      organizationId,
      'operativeDayRateHistory',
      (docs) => {
        perPerson.set(entry.key, docs)
        emit()
      },
      { constraints: entry.constraints }
    )
  )
  if (stops.length === 0) onHistory(emptyDayRateHistory())
  return () => {
    for (const stop of stops) stop()
  }
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
    return historyFromDocs(await readRateHistoryDocs(organizationId))
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
  /**
   * 1.36.0 (FU-5): every id the person's existing history may be filed under (`personRateHistoryIds`), so a person
   * whose rows sit under a former invite id or another `operatives` row is not treated as having no history (which
   * wrote a duplicate seed row). Defaults to `userId` / `operativeId`. The written row still carries `userId` /
   * `operativeId`.
   */
  historyUserIds?: string[]
  historyOperativeIds?: string[]
  previous: { rate: number | null | undefined; payBasis?: PayBasis | null }
  next: { rate: number | null | undefined; payBasis?: PayBasis | null }
  effectiveAt: Date
  seedEffective?: Date | null
  timeZone?: string | null
}): PayHistoryBatchRow[] {
  const personRows = input.history
    ? mergedDayRateEntries(
        input.history,
        [input.userId ?? '', ...(input.historyUserIds ?? [])],
        [input.operativeId ?? '', ...(input.historyOperativeIds ?? [])]
      )
    : null
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
