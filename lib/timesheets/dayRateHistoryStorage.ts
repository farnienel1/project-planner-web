/**
 * iOS parity: FirebaseBackend.loadOperativeDayRateHistory / recordOperativeDayRateChange
 * Collection: organizations/{orgId}/operativeDayRateHistory/{uuid}
 */
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { newUuid, parseFirestoreDate, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { londonMidnight } from '@/lib/ios-parity/londonTime'
import type { PayBasis } from '@/lib/timesheets/payBasis'

export type OperativeDayRateHistoryEntry = {
  id: string
  userId?: string | null
  operativeId?: string | null
  /** Amount per day or per hour. The field name stays dayRate so old rows still load. */
  dayRate: number
  /** Missing on old rows means day. */
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
  const dayRate = typeof data.dayRate === 'number' ? data.dayRate : Number(data.dayRate)
  const effectiveAt = parseFirestoreDate(data.effectiveAt)
  if (!Number.isFinite(dayRate) || !effectiveAt) return null
  const userId = typeof data.userId === 'string' && data.userId.trim() ? data.userId.trim() : null
  const operativeId = typeof data.operativeId === 'string' && data.operativeId.trim() ? data.operativeId.trim() : null
  if (!userId && !operativeId) return null
  const payBasis = data.payBasis === 'hourly' ? 'hourly' : data.payBasis === 'day' ? 'day' : undefined
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

/** iOS recordOperativeDayRateChange — persist including an explicit £0. */
export async function recordOperativeDayRateChange({
  organizationId,
  userId,
  operativeId,
  dayRate,
  payBasis = 'day',
  effectiveAt,
}: {
  organizationId: string
  userId?: string | null
  operativeId?: string | null
  dayRate: number
  payBasis?: PayBasis
  effectiveAt: Date
}): Promise<void> {
  const uid = userId?.trim() || null
  const oid = operativeId?.trim() || null
  if (!uid && !oid) return
  const ref = doc(db, 'organizations', organizationId, 'operativeDayRateHistory', newUuid())
  const payload = sanitizeForFirestore({
    dayRate,
    payBasis: payBasis === 'hourly' ? 'hourly' : 'day',
    effectiveAt: Timestamp.fromDate(londonMidnight(effectiveAt)),
    userId: uid || '',
    operativeId: oid || '',
  }) as Record<string, unknown>
  payload.createdAt = serverTimestamp()
  await setDoc(ref, payload, { merge: true })
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
}): Promise<void> {
  const previous = previousDayRate ?? null
  const next = nextDayRate ?? null
  const prevBasis = previousPayBasis === 'hourly' || previousPayBasis === 'day' ? previousPayBasis : null
  const nextBasis: PayBasis = nextPayBasis === 'hourly' ? 'hourly' : 'day'
  const basisChanged = prevBasis != null && prevBasis !== nextBasis
  if (next == null) return
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
    })
  }
  await recordOperativeDayRateChange({
    organizationId,
    userId,
    operativeId,
    dayRate: next,
    payBasis: nextBasis,
    effectiveAt,
  })
}
