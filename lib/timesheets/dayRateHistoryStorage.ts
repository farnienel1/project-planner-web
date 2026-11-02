/**
 * iOS parity: FirebaseBackend.loadOperativeDayRateHistory / recordOperativeDayRateChange
 * Collection: organizations/{orgId}/operativeDayRateHistory/{uuid}
 */
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { payRateHistoryWriteFields } from '@/lib/canonical/payRate'
import { organizationTimeZone } from '@/lib/canonical'
import { newUuid, parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
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

function parseEntry(id: string, data: Record<string, unknown>): OperativeDayRateHistoryEntry | null {
  // `dayRate: null` is a stored "rate cleared" row; a missing or unreadable amount is skipped.
  const cleared = data.dayRate === null
  const amount = typeof data.dayRate === 'number' ? data.dayRate : Number(data.dayRate)
  const effectiveAt = parseFirestoreDate(data.effectiveAt)
  if ((!cleared && (data.dayRate === undefined || !Number.isFinite(amount))) || !effectiveAt) return null
  const dayRate = cleared ? null : amount
  const userId = typeof data.userId === 'string' && data.userId.trim() ? data.userId.trim() : null
  const operativeId = typeof data.operativeId === 'string' && data.operativeId.trim() ? data.operativeId.trim() : null
  if (!userId && !operativeId) return null
  const payBasis = cleared ? undefined : data.payBasis === 'hourly' ? 'hourly' : data.payBasis === 'day' ? 'day' : undefined
  return {
    id,
    userId,
    operativeId,
    dayRate,
    payBasis,
    effectiveAt,
    createdAt: parseFirestoreDate(data.createdAt) || effectiveAt,
  }
}

export async function loadOperativeDayRateHistory(
  organizationId: string
): Promise<OperativeDayRateHistoryCollection> {
  const byUserId: Record<string, OperativeDayRateHistoryEntry[]> = {}
  const byOperativeId: Record<string, OperativeDayRateHistoryEntry[]> = {}
  try {
    const snap = await getDocs(collection(db, 'organizations', organizationId, 'operativeDayRateHistory'))
    for (const row of snap.docs) {
      const entry = parseEntry(row.id, row.data() as Record<string, unknown>)
      if (!entry) continue
      if (entry.userId) {
        byUserId[entry.userId] = [...(byUserId[entry.userId] || []), entry]
      }
      if (entry.operativeId) {
        byOperativeId[entry.operativeId] = [...(byOperativeId[entry.operativeId] || []), entry]
      }
    }
  } catch {
    return emptyDayRateHistory()
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
