/**
 * Writes for organizations/{orgId}/variations and variationTrackers.
 * Every write recomputes the three counters and stamps updatedAt / updatedByUid.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { retainLoadedRows } from '@/lib/staff/rosterRetain'
import { db, storage } from '@/lib/firebase/config'
import { newUuid, parseFirestoreDate, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import {
  excludeActor,
  parseVariationDocument,
  receivesJobNotification,
  parseVariationTrades,
  VARIATION_TRADES_DOCUMENT_ID,
  variationLogWriteFields,
  variationRenumberWriteFields,
  variationTrackerWriteFields,
  variationTradesWriteFields,
  variationWriteFields,
} from '@/lib/canonical'
import { firestoreUpdateFields, savePartialDocument } from '@/lib/firebase/partialWrite'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import { staffAccountRole } from '@/lib/permissions'
import type { User } from '@/types'
import {
  TRACKER_ADDED_DESCRIPTION,
  TRACKER_LOCK_MS,
  variationCounters,
  type Variation,
  type VariationEvidence,
  type VariationLabourLine,
  type VariationMaterialLine,
  type VariationOrigin,
  type VariationParentType,
  type VariationStatus,
  type VariationTracker,
} from '@/lib/variations/variationModel'
import { formatVoNumber, nextFreeVoNumber, orderForTrackerEnable, voNumberTaken } from '@/lib/variations/variationNumbering'
import {
  fallbackItemMaps,
  mergeVariationSources,
  variationItemDocId,
  variationsLogDocId,
} from '@/lib/variations/variationFallback'

/**
 * A variation through the rulebook reader `parseVariationDocument` (rulebook 1.8.0): lines with any content are kept,
 * a line stored without an id gets the same `variationLineId` on every read and platform, counters are recomputed.
 */
export function variationFromFirestore(id: string, data: Record<string, unknown>): Variation {
  const parsed = parseVariationDocument(id, data) ?? parseVariationDocument(newUuid(), data)!
  const when = (ms: number | null | undefined) => (ms != null ? new Date(ms) : null)
  return {
    id: parsed.id,
    orgId: parsed.orgId,
    parentType: parsed.parentType,
    parentId: parsed.parentId,
    parentName: parsed.parentName,
    origin: parsed.origin,
    voNumber: parsed.voNumber,
    sequence: parsed.sequence,
    voNumberLocked: parsed.voNumberLocked,
    numberHistory: parsed.numberHistory.map((item) => ({ from: item.from, to: item.to, at: when(item.atMs) || new Date(), byUid: item.byUid })),
    heading: parsed.heading,
    description: parsed.description,
    status: parsed.status,
    labour: parsed.labour.map((line) => ({ id: line.id, trade: line.trade, hours: line.hours })),
    materials: parsed.materials.map((line) => ({ id: line.id, name: line.name, quantity: line.quantity })),
    evidence: parsed.evidence.map(
      (item): VariationEvidence => ({
        id: item.id,
        fileName: item.fileName,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        storagePath: item.storagePath,
        downloadURL: item.downloadURL,
        uploadedByUid: item.uploadedByUid,
        uploadedAt: when(item.uploadedAtMs) || new Date(),
      })
    ),
    totalLabourHours: parsed.totalLabourHours,
    materialLineCount: parsed.materialLineCount,
    evidenceCount: parsed.evidenceCount,
    createdByUid: parsed.createdByUid,
    createdByName: parsed.createdByName,
    createdAt: when(parsed.createdAtMs) || new Date(),
    updatedByUid: parsed.updatedByUid,
    updatedAt: when(parsed.updatedAtMs) || new Date(),
    statusHistory: parsed.statusHistory.map((item) => ({ status: item.status, byUid: item.byUid, byName: item.byName, at: when(item.atMs) || new Date() })),
    submittedAt: when(parsed.submittedAtMs),
    closedAt: when(parsed.closedAtMs),
    isDeleted: parsed.isDeleted,
  }
}

function stamp(value: unknown): Date | null {
  return parseFirestoreDate(value) || null
}

function toTimestamp(date: Date | null | undefined): Timestamp | null {
  return date ? Timestamp.fromDate(date) : null
}

export function variationToFirestore(row: Variation): Record<string, unknown> {
  return sanitizeForFirestore({
    id: row.id,
    orgId: row.orgId,
    parentType: row.parentType,
    parentId: row.parentId,
    parentName: row.parentName,
    origin: row.origin,
    voNumber: row.voNumber,
    sequence: row.sequence,
    voNumberLocked: row.voNumberLocked,
    numberHistory: row.numberHistory.map((item) => ({
      from: item.from,
      to: item.to,
      at: Timestamp.fromDate(item.at),
      byUid: item.byUid,
    })),
    heading: row.heading,
    description: row.description,
    status: row.status,
    labour: row.labour,
    materials: row.materials,
    evidence: row.evidence.map((item) => ({
      ...item,
      uploadedAt: Timestamp.fromDate(item.uploadedAt),
    })),
    totalLabourHours: row.totalLabourHours,
    materialLineCount: row.materialLineCount,
    evidenceCount: row.evidenceCount,
    createdByUid: row.createdByUid,
    createdByName: row.createdByName,
    createdAt: Timestamp.fromDate(row.createdAt),
    updatedByUid: row.updatedByUid,
    updatedAt: Timestamp.fromDate(row.updatedAt),
    statusHistory: row.statusHistory.map((item) => ({
      status: item.status,
      byUid: item.byUid,
      byName: item.byName,
      at: Timestamp.fromDate(item.at),
    })),
    submittedAt: toTimestamp(row.submittedAt),
    closedAt: toTimestamp(row.closedAt),
    isDeleted: row.isDeleted,
  }) as Record<string, unknown>
}

function variationsCollection(organizationId: string) {
  if (!db) throw new Error('Firestore is not configured.')
  return collection(db, 'organizations', organizationId, 'variations')
}

function variationRef(organizationId: string, id: string) {
  if (!db) throw new Error('Firestore is not configured.')
  return doc(db, 'organizations', organizationId, 'variations', id)
}

function trackerRef(organizationId: string, parentId: string) {
  if (!db) throw new Error('Firestore is not configured.')
  return doc(db, 'organizations', organizationId, 'variationTrackers', parentId)
}

function settingsDoc(organizationId: string, docId: string) {
  if (!db) throw new Error('Firestore is not configured.')
  return doc(db, 'organizations', organizationId, 'settings', docId)
}

function variationsFromMaps(rows: Record<string, unknown>[]): Variation[] {
  return rows.map((row) => variationFromFirestore(typeof row.id === 'string' ? row.id : '', row))
}

async function readCollectionVariations(organizationId: string, parentId: string): Promise<Variation[]> {
  try {
    const snap = await getDocs(query(variationsCollection(organizationId), where('parentId', '==', parentId)))
    return snap.docs.map((entry) => variationFromFirestore(entry.id, entry.data() as Record<string, unknown>))
  } catch {
    return []
  }
}

async function readFallbackVariations(organizationId: string, parentId: string): Promise<Variation[]> {
  try {
    const snap = await getDoc(settingsDoc(organizationId, variationsLogDocId(parentId)))
    if (!snap.exists()) return []
    return variationsFromMaps(fallbackItemMaps(snap.data() as Record<string, unknown>))
  } catch {
    return []
  }
}

async function readItemDocVariations(organizationId: string, parentId: string): Promise<Variation[]> {
  try {
    const snap = await getDocs(
      query(collection(db!, 'organizations', organizationId, 'settings'), where('recordType', '==', 'variationItem'))
    )
    return snap.docs.flatMap((entry) => {
      const data = entry.data() as Record<string, unknown>
      if (data.parentId !== parentId) return []
      const rawId =
        (typeof data.id === 'string' && data.id) || entry.id.replace(/^variationItem_/, '')
      return [variationFromFirestore(rawId, data)]
    })
  } catch {
    return []
  }
}

async function saveVariationSettingsLog(
  organizationId: string,
  variation: Variation,
  map: Record<string, unknown>
): Promise<void> {
  const ref = settingsDoc(organizationId, variationsLogDocId(variation.parentId))
  // Rulebook 1.9.0 `variationLogWriteFields`: this entry laid over its stored entry (others untouched), entries
  // stored without an id get their `variationLogItemId`. A failed read never rewrites the log from a local copy.
  const existing = await getDoc(ref)
  const stored = existing.exists() ? (existing.data() as Record<string, unknown>) : null
  const write = variationLogWriteFields(stored, map, {
    parentId: variation.parentId,
    parentType: variation.parentType,
    organizationId,
  })
  if (!write) return
  const fields = { ...write.set, updatedAt: Timestamp.fromDate(new Date()) }
  if (stored) await updateDoc(ref, fields)
  else await setDoc(ref, fields, { merge: true })
}

/**
 * iOS writes the settings log and item doc first. The collection write is best-effort. Rulebook 1.8.0 §1: an edit of
 * an existing variation is a partial update of the changed fields (`variationWriteFields`) on the item document and
 * the collection document; the settings log entry is laid over its stored entry so fields another app wrote stay.
 */
async function persistVariationDocument(
  organizationId: string,
  variation: Variation,
  mode: 'create' | 'update' = 'update'
): Promise<void> {
  const map = variationToFirestore(variation)
  const itemPayload = {
    ...map,
    recordType: 'variationItem',
    parentId: variation.parentId,
    parentType: variation.parentType,
    organizationId,
  }
  const itemRef = settingsDoc(organizationId, variationItemDocId(variation.id))
  const collectionRef = variationRef(organizationId, variation.id)
  const userId = variation.updatedByUid || undefined
  const results = await Promise.allSettled([
    saveVariationSettingsLog(organizationId, variation, map),
    mode === 'create'
      ? setDoc(itemRef, itemPayload, { merge: true })
      : savePartialDocument(itemRef, itemPayload, variationWriteFields, { userId }),
    mode === 'create'
      ? setDoc(collectionRef, map, { merge: true })
      : savePartialDocument(collectionRef, map, variationWriteFields, { userId }),
  ])
  if (results.every((result) => result.status === 'rejected')) {
    const first = results[0].status === 'rejected' ? results[0].reason : null
    throw first instanceof Error ? first : new Error('Could not save this variation.')
  }
}

export function emptyTracker(parentId: string, parentType: VariationParentType): VariationTracker {
  return {
    parentId,
    parentType,
    enabled: false,
    numberingMode: 'lockSubmitted',
    prefix: 'VO-',
    padding: 3,
    version: 0,
  }
}

export function trackerFromFirestore(parentId: string, data: Record<string, unknown> | undefined): VariationTracker {
  if (!data) return emptyTracker(parentId, 'project')
  return {
    parentId,
    parentType: data.parentType === 'smallWork' ? 'smallWork' : 'project',
    enabled: data.enabled === true,
    enabledAt: stamp(data.enabledAt),
    enabledByUid: typeof data.enabledByUid === 'string' ? data.enabledByUid : null,
    numberingMode: data.numberingMode === 'resequenceAll' ? 'resequenceAll' : 'lockSubmitted',
    prefix: typeof data.prefix === 'string' && data.prefix ? data.prefix : 'VO-',
    padding: typeof data.padding === 'number' ? data.padding : 3,
    version: typeof data.version === 'number' ? data.version : 0,
    lockedByUid: typeof data.lockedByUid === 'string' ? data.lockedByUid : null,
    lockedByName: typeof data.lockedByName === 'string' ? data.lockedByName : null,
    lockedAt: stamp(data.lockedAt),
  }
}

const lastVariationRows = new Map<string, Variation[]>()

export function subscribeParentVariations(
  organizationId: string,
  parentId: string,
  onRows: (rows: Variation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!db) {
    onRows([])
    return () => {}
  }
  const key = `${organizationId}:${parentId}`
  const sources = {
    collection: [] as Variation[],
    fallback: [] as Variation[],
    items: [] as Variation[],
  }
  const publish = () => {
    const next = mergeVariationSources(sources.collection, sources.fallback, sources.items)
    const kept = retainLoadedRows(lastVariationRows.get(key) ?? [], next)
    lastVariationRows.set(key, kept)
    onRows(kept)
  }
  const unsubs = [
    onSnapshot(
      query(variationsCollection(organizationId), where('parentId', '==', parentId)),
      (snap) => {
        // A denied collection write stays in the local cache until the server answers.
        if (snap.metadata.hasPendingWrites) return
        sources.collection = snap.docs.map((entry) =>
          variationFromFirestore(entry.id, entry.data() as Record<string, unknown>)
        )
        publish()
      },
      () => {
        sources.collection = []
        publish()
      }
    ),
    onSnapshot(
      settingsDoc(organizationId, variationsLogDocId(parentId)),
      (snap) => {
        sources.fallback = snap.exists()
          ? variationsFromMaps(fallbackItemMaps(snap.data() as Record<string, unknown>))
          : []
        publish()
      },
      (error) => onError?.(error)
    ),
    onSnapshot(
      query(collection(db!, 'organizations', organizationId, 'settings'), where('recordType', '==', 'variationItem')),
      (snap) => {
        sources.items = snap.docs.flatMap((entry) => {
          const data = entry.data() as Record<string, unknown>
          if (data.parentId !== parentId) return []
          const rawId = (typeof data.id === 'string' && data.id) || entry.id.replace(/^variationItem_/, '')
          return [variationFromFirestore(rawId, data)]
        })
        publish()
      },
      () => publish()
    ),
  ]
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

const lastOrgVariationRows = new Map<string, Variation[]>()

/**
 * Company-wide list. iOS stores variations in the collection and in settings
 * logs (`variations_{parentId}` / `variationItem_{id}`). The collection alone
 * shows an empty rollup when the log is the copy that actually saved.
 */
export function subscribeOrganisationVariations(
  organizationId: string,
  onRows: (rows: Variation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!db) {
    onRows(lastOrgVariationRows.get(organizationId) ?? [])
    return () => {}
  }
  const sources = {
    collection: [] as Variation[],
    fallback: [] as Variation[],
    items: [] as Variation[],
  }
  const publish = () => {
    const next = mergeVariationSources(sources.collection, sources.fallback, sources.items)
    const kept = retainLoadedRows(lastOrgVariationRows.get(organizationId) ?? [], next)
    lastOrgVariationRows.set(organizationId, kept)
    onRows(kept)
  }
  const settings = collection(db, 'organizations', organizationId, 'settings')
  const unsubs = [
    onSnapshot(
      variationsCollection(organizationId),
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        sources.collection = snap.docs.map((entry) =>
          variationFromFirestore(entry.id, entry.data() as Record<string, unknown>)
        )
        publish()
      },
      (error) => onError?.(error)
    ),
    onSnapshot(
      query(settings, where('recordType', '==', 'variationLog')),
      (snap) => {
        sources.fallback = snap.docs.flatMap((entry) =>
          variationsFromMaps(fallbackItemMaps(entry.data() as Record<string, unknown>))
        )
        publish()
      },
      (error) => onError?.(error)
    ),
    onSnapshot(
      query(settings, where('recordType', '==', 'variationItem')),
      (snap) => {
        sources.items = snap.docs.flatMap((entry) => {
          const data = entry.data() as Record<string, unknown>
          const rawId = (typeof data.id === 'string' && data.id) || entry.id.replace(/^variationItem_/, '')
          return [variationFromFirestore(rawId, data)]
        })
        publish()
      },
      (error) => onError?.(error)
    ),
  ]
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

export async function loadVariationTracker(organizationId: string, parentId: string): Promise<VariationTracker> {
  const snap = await getDoc(trackerRef(organizationId, parentId))
  return trackerFromFirestore(parentId, snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
}

export function subscribeVariationTracker(
  organizationId: string,
  parentId: string,
  onTracker: (tracker: VariationTracker) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  if (!db) {
    onTracker(emptyTracker(parentId, 'project'))
    return () => {}
  }
  return onSnapshot(
    trackerRef(organizationId, parentId),
    (snap) => {
      onTracker(trackerFromFirestore(parentId, snap.exists() ? (snap.data() as Record<string, unknown>) : undefined))
    },
    (error) => onError?.(error)
  )
}

async function listParentVariations(organizationId: string, parentId: string): Promise<Variation[]> {
  const [collectionRows, fallbackRows, itemDocs] = await Promise.all([
    readCollectionVariations(organizationId, parentId),
    readFallbackVariations(organizationId, parentId),
    readItemDocVariations(organizationId, parentId),
  ])
  return mergeVariationSources(collectionRows, fallbackRows, itemDocs)
}

function withCounters(row: Variation): Variation {
  const counters = variationCounters(row)
  return { ...row, ...counters }
}

/**
 * Variation notice recipients (rulebook §13): `receivesJobNotification` (admins always; a manager only as an
 * assigned manager of this job — seeing the job in the list is not enough), then `excludeActor` (never the person
 * who made the change under any of their ids, no inactive account). No "all admins" fallback beyond that rule.
 */
export function variationRecipientIds(
  users: ReadonlyArray<User>,
  actorId: string | null | undefined,
  assignedManagerUserIds: ReadonlyArray<string>
): string[] {
  const managers = [...assignedManagerUserIds]
  const ids = users
    .filter((person) => receivesJobNotification({ userId: person.id, role: staffAccountRole(person), assignedManagerUserIds: managers }))
    .map((person) => person.id)
  const actorKey = String(actorId ?? '').trim()
  const actorUser = actorKey ? users.find((person) => person.id === actorKey) : undefined
  return excludeActor(ids, actorUser ? rulebookPerson(actorUser, users) : actorKey || null, rulebookRoster(users))
}

async function notifyCreated(input: {
  organizationId: string
  variation: Variation
  users: User[]
  creatorId: string
  managerIds: string[]
}) {
  // The job's assigned managers for every variation, whatever its origin.
  const assignedManagerUserIds = input.managerIds
  const recipients = variationRecipientIds(input.users, input.creatorId, assignedManagerUserIds)
  const title = input.variation.origin === 'tracker' ? 'New variation from the QS' : 'New variation added'
  const message =
    input.variation.origin === 'tracker'
      ? `${input.variation.voNumber} added to ${input.variation.parentName} — hours and materials needed`
      : `New variation added to ${input.variation.parentName}`
  await Promise.all(
    recipients.map((userId) =>
      saveInboxNotification({
        organizationId: input.organizationId,
        type: 'variation',
        title,
        message,
        userId,
        relatedId: input.variation.id,
      })
    )
  )
}

export async function createVariation(input: {
  organizationId: string
  parentType: VariationParentType
  parentId: string
  parentName: string
  origin: VariationOrigin
  voNumber?: string
  heading: string
  description: string
  status?: VariationStatus
  labour: VariationLabourLine[]
  materials: VariationMaterialLine[]
  evidence: VariationEvidence[]
  actor: { uid: string; name: string }
  users?: User[]
  managerIds?: string[]
  existingRows?: Variation[]
  tracker?: VariationTracker
}): Promise<Variation> {
  const allRows = input.existingRows ?? (await listParentVariations(input.organizationId, input.parentId))
  const existing = allRows.filter((row) => !row.isDeleted)
  const tracker = input.tracker ?? (await loadVariationTracker(input.organizationId, input.parentId))
  const voNumber =
    input.origin === 'tracker' || tracker.enabled
      ? nextFreeVoNumber(allRows, tracker.prefix, tracker.padding)
      : (input.voNumber || nextFreeVoNumber(allRows, tracker.prefix, tracker.padding)).trim()
  if (!tracker.enabled && input.origin !== 'tracker' && voNumberTaken(allRows, voNumber)) {
    throw new Error(`${voNumber} is already used on this job. Pick another number.`)
  }
  const now = new Date()
  const id = newUuid()
  const draft = withCounters({
    id,
    orgId: input.organizationId,
    parentType: input.parentType,
    parentId: input.parentId,
    parentName: input.parentName,
    origin: input.origin,
    voNumber,
    sequence: existing.length + 1,
    voNumberLocked: false,
    numberHistory: [],
    heading: input.heading.trim(),
    description: input.origin === 'tracker' ? input.description || TRACKER_ADDED_DESCRIPTION : input.description,
    status: input.status || 'open',
    labour: input.labour,
    materials: input.materials,
    evidence: input.evidence,
    totalLabourHours: 0,
    materialLineCount: 0,
    evidenceCount: 0,
    createdByUid: input.actor.uid,
    createdByName: input.actor.name,
    createdAt: now,
    updatedByUid: input.actor.uid,
    updatedAt: now,
    statusHistory: [{ status: input.status || 'open', byUid: input.actor.uid, byName: input.actor.name, at: now }],
    isDeleted: false,
  })
  await persistVariationDocument(input.organizationId, draft, 'create')
  if (input.users) {
    void notifyCreated({
      organizationId: input.organizationId,
      variation: draft,
      users: input.users,
      creatorId: input.actor.uid,
      managerIds: input.managerIds || [],
    }).catch(() => {})
  }
  return draft
}

export async function updateVariation(input: {
  organizationId: string
  variation: Variation
  actorUid: string
}): Promise<void> {
  const next = withCounters({ ...input.variation, updatedByUid: input.actorUid, updatedAt: new Date() })
  await persistVariationDocument(input.organizationId, next)
}

export async function setVariationStatus(input: {
  organizationId: string
  variation: Variation
  status: VariationStatus
  actor: { uid: string; name: string }
}): Promise<Variation> {
  const now = new Date()
  const next = withCounters({
    ...input.variation,
    status: input.status,
    voNumberLocked: input.status === 'submitted' || input.status === 'closed' ? true : input.variation.voNumberLocked,
    submittedAt: input.status === 'submitted' ? now : input.variation.submittedAt,
    closedAt: input.status === 'closed' ? now : input.variation.closedAt,
    statusHistory: [
      ...input.variation.statusHistory,
      { status: input.status, byUid: input.actor.uid, byName: input.actor.name, at: now },
    ],
    updatedByUid: input.actor.uid,
    updatedAt: now,
  })
  await updateVariation({ organizationId: input.organizationId, variation: next, actorUid: input.actor.uid })
  return next
}

export async function softDeleteVariation(organizationId: string, variation: Variation, actorUid: string): Promise<void> {
  await updateVariation({
    organizationId,
    variation: { ...variation, isDeleted: true },
    actorUid,
  })
}

export async function loadCustomTrades(organizationId: string): Promise<string[]> {
  if (!db) return []
  const snap = await getDoc(doc(db, 'organizations', organizationId, 'settings', VARIATION_TRADES_DOCUMENT_ID))
  // Rulebook 1.9.0 `parseVariationTrades`.
  return parseVariationTrades(snap.exists() ? (snap.data() as Record<string, unknown>) : null).customTrades
}

export async function saveCustomTrade(organizationId: string, trade: string): Promise<string[]> {
  const name = trade.trim()
  if (!name || !db) return []
  const ref = doc(db, 'organizations', organizationId, 'settings', VARIATION_TRADES_DOCUMENT_ID)
  const snap = await getDoc(ref)
  const stored = snap.exists() ? (snap.data() as Record<string, unknown>) : null
  // Rulebook 1.9.0 `variationTradesWriteFields`: only the trade added in this action.
  const write = variationTradesWriteFields(stored, { add: [name] })
  if (!write) return parseVariationTrades(stored).customTrades
  if (stored) await updateDoc(ref, write.set)
  else await setDoc(ref, write.set, { merge: true })
  return write.set.customTrades
}

export function trackerLockActive(tracker: VariationTracker, now = new Date()): boolean {
  if (!tracker.lockedByUid || !tracker.lockedAt) return false
  return now.getTime() - tracker.lockedAt.getTime() < TRACKER_LOCK_MS
}

export async function claimTrackerLock(input: {
  organizationId: string
  parentId: string
  parentType: VariationParentType
  actor: { uid: string; name: string }
}): Promise<VariationTracker> {
  const ref = trackerRef(input.organizationId, input.parentId)
  return runTransaction(db!, async (transaction) => {
    const snap = await transaction.get(ref)
    const current = trackerFromFirestore(input.parentId, snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
    const now = new Date()
    if (trackerLockActive(current, now) && current.lockedByUid !== input.actor.uid) {
      throw new Error(`${current.lockedByName || 'Someone else'} is editing the tracker.`)
    }
    const next: VariationTracker = {
      ...current,
      parentType: input.parentType,
      lockedByUid: input.actor.uid,
      lockedByName: input.actor.name,
      lockedAt: now,
    }
    // Rulebook 1.9.0 `variationTrackerWriteFields` (lock): the three lock fields only, never the whole tracker.
    const stored = snap.exists() ? (snap.data() as Record<string, unknown>) : null
    const write = variationTrackerWriteFields(stored, {
      kind: 'lock',
      parentId: input.parentId,
      parentType: input.parentType,
      actorUid: input.actor.uid,
      actorName: input.actor.name,
      at: Timestamp.fromDate(now),
    })
    if (write) {
      if (stored) transaction.update(ref, firestoreUpdateFields(write))
      else transaction.set(ref, write.set, { merge: true })
    }
    return next
  })
}

export async function releaseTrackerLock(organizationId: string, parentId: string, uid: string): Promise<void> {
  const ref = trackerRef(organizationId, parentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const current = trackerFromFirestore(parentId, snap.data() as Record<string, unknown>)
  if (current.lockedByUid !== uid) return
  const write = variationTrackerWriteFields(snap.data() as Record<string, unknown>, { kind: 'unlock' })
  if (write) await updateDoc(ref, firestoreUpdateFields(write))
}

/** One-time. Writes sequence only. Does not change any VO number. */
export async function enableTracker(input: {
  organizationId: string
  parentId: string
  parentType: VariationParentType
  actorUid: string
}): Promise<void> {
  const rows = (await listParentVariations(input.organizationId, input.parentId)).filter((row) => !row.isDeleted)
  const ordered = orderForTrackerEnable(rows)
  const now = new Date()
  for (const [index, row] of ordered.entries()) {
    const locked = row.status === 'submitted' || row.status === 'closed'
    await persistVariationDocument(input.organizationId, {
      ...row,
      sequence: index + 1,
      voNumberLocked: locked || row.voNumberLocked,
      updatedAt: now,
      updatedByUid: input.actorUid,
    })
  }
  // Rulebook 1.9.0 `variationTrackerWriteFields` (enable): an existing tracker keeps its mode, prefix, padding and
  // version; a new one is created with the defaults.
  const ref = trackerRef(input.organizationId, input.parentId)
  const trackerSnap = await getDoc(ref)
  const stored = trackerSnap.exists() ? (trackerSnap.data() as Record<string, unknown>) : null
  const write = variationTrackerWriteFields(stored, {
    kind: 'enable',
    parentId: input.parentId,
    parentType: input.parentType,
    actorUid: input.actorUid,
    at: Timestamp.fromDate(now),
  })
  if (!write) return
  if (stored) await updateDoc(ref, firestoreUpdateFields(write))
  else await setDoc(ref, write.set, { merge: true })
}

export async function setTrackerMode(
  organizationId: string,
  parentId: string,
  numberingMode: 'lockSubmitted' | 'resequenceAll'
): Promise<void> {
  const ref = trackerRef(organizationId, parentId)
  const snap = await getDoc(ref)
  const write = variationTrackerWriteFields(snap.exists() ? (snap.data() as Record<string, unknown>) : null, {
    kind: 'mode',
    numberingMode,
  })
  if (!write) return
  if (snap.exists()) await updateDoc(ref, firestoreUpdateFields(write))
  else await setDoc(ref, { ...write.set, parentId }, { merge: true })
}

export async function disableTracker(organizationId: string, parentId: string): Promise<void> {
  const ref = trackerRef(organizationId, parentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const write = variationTrackerWriteFields(snap.data() as Record<string, unknown>, { kind: 'disable' })
  if (write) await updateDoc(ref, firestoreUpdateFields(write))
}

export class TrackerVersionError extends Error {
  constructor() {
    super('Someone else renumbered this tracker. Reload the list and apply again.')
    this.name = 'TrackerVersionError'
  }
}

/** One batch. All numbers change together, or none do. */
export async function applyNumbering(input: {
  organizationId: string
  parentId: string
  expectedVersion: number
  actor: { uid: string; name: string }
  changes: Array<{ id: string; to: string; sequence: number }>
  rows: Variation[]
  notifyUserIds?: string[]
}): Promise<void> {
  const ref = trackerRef(input.organizationId, input.parentId)
  await runTransaction(db!, async (transaction) => {
    const snap = await transaction.get(ref)
    const tracker = trackerFromFirestore(input.parentId, snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
    if (tracker.version !== input.expectedVersion) throw new TrackerVersionError()
    const now = new Date()
    for (const change of input.changes) {
      const row = input.rows.find((item) => item.id === change.id)
      if (!row) continue
      // Rulebook 1.8.0 `variationRenumberWriteFields`: only the sequence and, when the number changes, the number
      // with one appended history entry. The tracker applies the new numbers whatever the lock (`resequenceAll`).
      const write = variationRenumberWriteFields({
        stored: variationToFirestore(row),
        to: change.to,
        sequence: change.sequence,
        at: Timestamp.fromDate(now),
        byUid: input.actor.uid,
        numberingMode: 'resequenceAll',
      })
      if (!write) continue
      transaction.update(variationRef(input.organizationId, row.id), {
        ...write.set,
        updatedAt: Timestamp.fromDate(now),
        updatedByUid: input.actor.uid,
      })
    }
    // Rulebook 1.9.0 `variationTrackerWriteFields` (renumbered): version + 1 and the lock removed.
    const renumbered = snap.exists()
      ? variationTrackerWriteFields(snap.data() as Record<string, unknown>, { kind: 'renumbered' })
      : null
    if (renumbered) transaction.update(ref, firestoreUpdateFields(renumbered))
    else transaction.set(ref, { version: tracker.version + 1 }, { merge: true })
  })
  const parentName = input.rows[0]?.parentName || 'this job'
  await Promise.all(
    excludeActor(input.notifyUserIds || [], input.actor.uid).map((userId) =>
      saveInboxNotification({
        organizationId: input.organizationId,
        type: 'variation_renumbered',
        title: 'Variation numbers updated',
        message: `Variation numbers updated on ${parentName} by ${input.actor.name}`,
        userId,
        relatedId: input.parentId,
      })
    )
  ).catch(() => {})
}

export async function removeEvidenceObject(storagePath: string): Promise<void> {
  if (!storage || !storagePath) return
  await deleteObject(ref(storage, storagePath)).catch(() => {})
}

export function nextSequenceLabel(existing: Variation[], tracker: VariationTracker): string {
  return nextFreeVoNumber(existing, tracker.prefix, tracker.padding)
}

export function formatSequence(sequence: number, tracker: VariationTracker): string {
  return formatVoNumber(sequence, tracker.prefix, tracker.padding)
}
