/**
 * iOS parity: FirebaseBackend.loadOperativeDayRateHistory / recordOperativeDayRateChange
 * Collection: organizations/{orgId}/operativeDayRateHistory/{uuid}
 */
import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { newUuid, parseFirestoreDate, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'

export type OperativeDayRateHistoryEntry = {
  id: string
  userId?: string | null
  operativeId?: string | null
  dayRate: number
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

export function mergedDayRateEntries(
  history: OperativeDayRateHistoryCollection,
  userId?: string | null,
  operativeId?: string | null
): OperativeDayRateHistoryEntry[] {
  const seen = new Set<string>()
  const out: OperativeDayRateHistoryEntry[] = []
  const push = (entry: OperativeDayRateHistoryEntry) => {
    if (seen.has(entry.id)) return
    seen.add(entry.id)
    out.push(entry)
  }
  if (userId) for (const entry of history.byUserId[userId] || []) push(entry)
  if (operativeId) for (const entry of history.byOperativeId[operativeId] || []) push(entry)
  return out.sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime())
}

function parseEntry(id: string, data: Record<string, unknown>): OperativeDayRateHistoryEntry | null {
  const dayRate = typeof data.dayRate === 'number' ? data.dayRate : Number(data.dayRate)
  const effectiveAt = parseFirestoreDate(data.effectiveAt)
  if (!Number.isFinite(dayRate) || !effectiveAt) return null
  const userId = typeof data.userId === 'string' && data.userId.trim() ? data.userId.trim() : null
  const operativeId = typeof data.operativeId === 'string' && data.operativeId.trim() ? data.operativeId.trim() : null
  if (!userId && !operativeId) return null
  return {
    id,
    userId,
    operativeId,
    dayRate,
    effectiveAt,
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
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
    rows.sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime())
  for (const key of Object.keys(byUserId)) sort(byUserId[key])
  for (const key of Object.keys(byOperativeId)) sort(byOperativeId[key])
  return { byUserId, byOperativeId }
}

/** iOS recordOperativeDayRateChange — persist including an explicit £0. */
export async function recordOperativeDayRateChange({
  organizationId,
  userId,
  operativeId,
  dayRate,
  effectiveAt,
}: {
  organizationId: string
  userId?: string | null
  operativeId?: string | null
  dayRate: number
  effectiveAt: Date
}): Promise<void> {
  const uid = userId?.trim() || null
  const oid = operativeId?.trim() || null
  if (!uid && !oid) return
  const ref = doc(db, 'organizations', organizationId, 'operativeDayRateHistory', newUuid())
  await setDoc(
    ref,
    sanitizeForFirestore({
      dayRate,
      effectiveAt: Timestamp.fromDate(effectiveAt),
      createdAt: Timestamp.fromDate(new Date()),
      userId: uid || '',
      operativeId: oid || '',
    }) as Record<string, unknown>,
    { merge: true }
  )
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
  createdAt,
  effectiveAt = new Date(),
  history,
}: {
  organizationId: string
  userId?: string | null
  operativeId?: string | null
  previousDayRate?: number | null
  nextDayRate?: number | null
  createdAt?: Date
  effectiveAt?: Date
  history: OperativeDayRateHistoryCollection
}): Promise<void> {
  const previous = previousDayRate ?? null
  const next = nextDayRate ?? 0
  if (previous === next || (previous == null && nextDayRate == null)) return
  const merged = mergedDayRateEntries(history, userId, operativeId)
  if (merged.length === 0 && previous != null && previous > 0 && createdAt) {
    await recordOperativeDayRateChange({
      organizationId,
      userId,
      operativeId,
      dayRate: previous,
      effectiveAt: createdAt,
    })
  }
  await recordOperativeDayRateChange({
    organizationId,
    userId,
    operativeId,
    dayRate: next,
    effectiveAt,
  })
}
