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
  variationEvidenceRemovalWriteFields,
  variationCustomLineFields,
  variationLineId,
  variationEvidenceAddWriteFields,
  variationLabourLineFields,
  variationMaterialLineFields,
  variationRenumberConflict,
  variationRenumberPlan,
  variationSubcontractorLineFields,
  VARIATION_RENUMBER_STALE_MESSAGE,
  writeMetadataFields,
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
  type VariationCustomLine,
  type VariationSubcontractorLine,
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
    // Rulebook 1.52.0: the crew and the quantity number are carried only when the stored row has them, so a save that
    // did not touch a line never rewrites it in the new shape (§1, never re-save what you didn't change).
    labour: parsed.labour.map((line) =>
      storedLineHas(data, 'labour', parsed.id, line.id, 'operatives')
        ? { id: line.id, trade: line.trade, hours: line.hours, operatives: line.operatives, hoursEach: line.hoursEach }
        : { id: line.id, trade: line.trade, hours: line.hours }
    ),
    materials: parsed.materials.map((line) =>
      storedLineHas(data, 'materials', parsed.id, line.id, 'quantityValue')
        ? { id: line.id, name: line.name, quantity: line.quantity, quantityValue: line.quantityValue, unit: line.unit }
        : { id: line.id, name: line.name, quantity: line.quantity }
    ),
    customLines: parsed.customLines.map((line) => ({ id: line.id, name: line.name, description: line.description, quantity: line.quantity, cost: line.cost })),
    subcontractorLines: parsed.subcontractorLines.map((line) => ({
      id: line.id,
      subcontractorId: line.subcontractorId,
      name: line.name,
      quoteNumber: line.quoteNumber,
      quantity: line.quantity,
      cost: line.cost,
    })),
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
    removedEvidence: parsed.removedEvidence.map((item) => ({
      path: item.path,
      name: item.name,
      removedBy: item.removedBy,
      removedAt: when(item.removedAtMs),
    })),
  }
}

/** Whether the stored row of that id (or derived id) carries `field`. */
function storedLineHas(data: Record<string, unknown>, kind: 'labour' | 'materials', variationId: string, lineId: string, field: string): boolean {
  const list = Array.isArray(data?.[kind]) ? (data[kind] as unknown[]) : []
  return list.some((entry, index) => {
    if (!entry || typeof entry !== 'object') return false
    const line = entry as Record<string, unknown>
    const id = (typeof line.id === 'string' && line.id.trim()) || variationLineId(variationId, kind, index, line)
    return id === lineId && line[field] != null
  })
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
    // Rulebook 1.52.0: labour with its crew, materials with the number and unit beside the text older builds read.
    labour: row.labour.map((line) =>
      line.operatives != null && line.hoursEach != null
        ? variationLabourLineFields({ id: line.id, trade: line.trade, operatives: line.operatives, hoursEach: line.hoursEach })
        : { id: line.id, trade: line.trade, hours: line.hours }
    ),
    materials: row.materials.map((line) =>
      line.quantityValue != null && line.unit
        ? variationMaterialLineFields({ id: line.id, name: line.name, quantity: line.quantityValue, unit: line.unit })
        : { id: line.id, name: line.name, quantity: line.quantity }
    ),
    customLines: (row.customLines || []).map((line) => variationCustomLineFields(line)),
    subcontractorLines: (row.subcontractorLines || []).map((line) => variationSubcontractorLineFields(line)),
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

/** Thrown when the variation itself saved but one of its copies did not (rulebook 1.52.0: never silent). */
export type VariationSaveOutcome = {
  /** The copies that did not save: 'item' (`settings/variationItem_{id}`) and / or 'log' (`settings/variations_{jobId}`). */
  copiesFailed: Array<'item' | 'log'>
}

/**
 * Rulebook 1.52.0: the variation document (`variations/{id}`) is written first — it is the copy the security rules
 * judge (a refused write leaves no copy behind) — then its two copies older iOS builds read
 * (`settings/variationItem_{id}`, the settings log entry) in parallel. An edit is a partial update of the changed
 * fields (`variationWriteFields`); the log entry is laid over its stored entry (`variationLogWriteFields`). A failed
 * copy is logged and returned, never swallowed; a failed variation write throws.
 */
async function persistVariationDocument(
  organizationId: string,
  variation: Variation,
  mode: 'create' | 'update' = 'update'
): Promise<VariationSaveOutcome> {
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
  if (mode === 'create') await setDoc(collectionRef, map, { merge: true })
  else await savePartialDocument(collectionRef, map, variationWriteFields, { userId })
  const [item, log] = await Promise.allSettled([
    mode === 'create'
      ? setDoc(itemRef, itemPayload, { merge: true })
      : savePartialDocument(itemRef, itemPayload, variationWriteFields, { userId }),
    saveVariationSettingsLog(organizationId, variation, map),
  ])
  const copiesFailed: Array<'item' | 'log'> = []
  if (item.status === 'rejected') {
    copiesFailed.push('item')
    console.error('[variations] the settings copy of the variation did not save', item.reason)
  }
  if (log.status === 'rejected') {
    copiesFailed.push('log')
    console.error('[variations] the settings log entry of the variation did not save', log.reason)
  }
  return { copiesFailed }
}

/** The toast line for copies that did not save, or null. */
export function variationCopyWarning(outcome: VariationSaveOutcome | null | undefined): string | null {
  if (!outcome || outcome.copiesFailed.length === 0) return null
  return 'Saved, but the copy older iPhone builds read did not update. Open the variation and save it again.'
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
  customLines?: VariationCustomLine[]
  subcontractorLines?: VariationSubcontractorLine[]
  evidence: VariationEvidence[]
  actor: { uid: string; name: string }
  users?: User[]
  managerIds?: string[]
  existingRows?: Variation[]
  tracker?: VariationTracker
}): Promise<Variation & { saveOutcome: VariationSaveOutcome }> {
  const allRows = input.existingRows ?? (await listParentVariations(input.organizationId, input.parentId))
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
    // Rulebook 1.52.0: one past the highest position on the job (deleted included), never the live count + 1.
    sequence: allRows.reduce((highest, row) => Math.max(highest, Number.isFinite(row.sequence) ? row.sequence : 0), 0) + 1,
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
    customLines: input.customLines || [],
    subcontractorLines: input.subcontractorLines || [],
  })
  const outcome = await persistVariationDocument(input.organizationId, draft, 'create')
  if (input.users) {
    void notifyCreated({
      organizationId: input.organizationId,
      variation: draft,
      users: input.users,
      creatorId: input.actor.uid,
      managerIds: input.managerIds || [],
    }).catch(() => {})
  }
  return { ...draft, saveOutcome: outcome }
}

export async function updateVariation(input: {
  organizationId: string
  variation: Variation
  actorUid: string
}): Promise<VariationSaveOutcome> {
  const next = withCounters({ ...input.variation, updatedByUid: input.actorUid, updatedAt: new Date() })
  return persistVariationDocument(input.organizationId, next)
}

/**
 * Rulebook 1.52.0 (`variationEvidenceAddWriteFields`): links uploaded files to the variation in one transaction on
 * `variations/{id}` built from the stored document (a file someone else added meanwhile is kept; at most 10), then the
 * same on its `settings/variationItem_{id}` copy and the settings log. Tried twice. Returns the entries that were
 * linked; throws when the variation itself could not be updated (the caller then deletes the uploaded objects).
 */
export async function addVariationEvidence(input: {
  organizationId: string
  variation: Variation
  entries: VariationEvidence[]
  actorUid: string
}): Promise<{ added: string[]; skipped: string[]; copiesFailed: Array<'item' | 'log'> }> {
  if (!db) throw new Error('Firestore not configured')
  const collectionRef = variationRef(input.organizationId, input.variation.id)
  const itemRef = settingsDoc(input.organizationId, variationItemDocId(input.variation.id))
  const now = Timestamp.now()
  const entries = input.entries.map((item) => sanitizeForFirestore({ ...item, uploadedAt: Timestamp.fromDate(item.uploadedAt) }) as Record<string, unknown>)
  const stamp = { updatedByUid: input.actorUid, updatedAt: now, ...(writeMetadataFields(input.actorUid, 'web') ?? {}) }
  const attempt = () =>
    runTransaction(db!, async (transaction) => {
      const snap = await transaction.get(collectionRef)
      if (!snap.exists()) throw new Error('This variation was removed on another device.')
      const write = variationEvidenceAddWriteFields(snap.data() as Record<string, unknown>, entries)
      if (write) transaction.update(collectionRef, { ...write.set, ...stamp })
      return { write, stored: snap.data() as Record<string, unknown> }
    })
  let result: Awaited<ReturnType<typeof attempt>>
  try {
    result = await attempt()
  } catch (first) {
    console.warn('[variations] linking evidence failed, trying once more', first)
    result = await attempt()
  }
  const copiesFailed: Array<'item' | 'log'> = []
  if (!result.write) return { added: [], skipped: entries.map((entry) => String(entry.storagePath || entry.id)), copiesFailed }
  try {
    await runTransaction(db!, async (transaction) => {
      const snap = await transaction.get(itemRef)
      if (!snap.exists()) return
      const write = variationEvidenceAddWriteFields(snap.data() as Record<string, unknown>, entries)
      if (write) transaction.update(itemRef, { ...write.set, ...stamp })
    })
  } catch (error) {
    copiesFailed.push('item')
    console.error('[variations] evidence did not reach the settings copy', error)
  }
  try {
    const next = variationFromFirestore(input.variation.id, { ...result.stored, ...result.write.set })
    await saveVariationSettingsLog(input.organizationId, next, variationToFirestore(next))
  } catch (error) {
    copiesFailed.push('log')
    console.error('[variations] evidence did not reach the settings log', error)
  }
  return { added: result.write.added, skipped: result.write.skipped, copiesFailed }
}

/**
 * Rulebook 1.27.0 §24 (`variationEvidenceRemovalWriteFields`, owner decision 4): unlinks one evidence file and records
 * `{ path, name, removedBy, removedAt }` on the variation's `removedEvidence`, as one partial update of
 * `variations/{id}` (and of its `settings/variationItem_{id}` copy and settings-log entry, best effort, which iOS reads
 * as a fallback). The list is built from the stored document, never from the screen's copy. Returns the variation as
 * saved, or null when the file is no longer on it.
 */
export async function removeVariationEvidence(input: {
  organizationId: string
  variation: Variation
  evidenceId: string
  actorUid: string
}): Promise<Variation | null> {
  if (!db) throw new Error('Firestore not configured')
  const collectionRef = variationRef(input.organizationId, input.variation.id)
  const itemRef = settingsDoc(input.organizationId, variationItemDocId(input.variation.id))
  const removedAt = Timestamp.now()
  const metadata = writeMetadataFields(input.actorUid, 'web') ?? {}
  const stamp = { updatedByUid: input.actorUid, updatedAt: removedAt, ...metadata }
  // The read and the write are one transaction, so a file added or removed by someone else meanwhile is never lost.
  const primary = await runTransaction(db!, async (transaction) => {
    const snap = await transaction.get(collectionRef)
    const stored = snap.exists() ? (snap.data() as Record<string, unknown>) : variationToFirestore(input.variation)
    const write = variationEvidenceRemovalWriteFields(stored, {
      evidenceId: input.evidenceId,
      removedBy: input.actorUid,
      removedAt,
      variationId: input.variation.id,
    })
    if (write && snap.exists()) transaction.update(collectionRef, { ...write.set, ...stamp })
    return { stored, write, exists: snap.exists() }
  })
  const { stored, write } = primary
  if (!write) return null
  const results = await Promise.allSettled([
    primary.exists ? Promise.resolve() : Promise.reject(new Error('missing')),
    (async () => {
      const item = await getDoc(itemRef)
      if (!item.exists()) return
      const itemWrite = variationEvidenceRemovalWriteFields(item.data() as Record<string, unknown>, {
        evidenceId: input.evidenceId,
        removedBy: input.actorUid,
        removedAt,
        variationId: input.variation.id,
      })
      if (itemWrite) await updateDoc(itemRef, { ...itemWrite.set, ...stamp })
    })(),
  ])
  if (results[0].status === 'rejected' && results[1].status === 'rejected') {
    const first = results[0].reason
    throw first instanceof Error ? first : new Error('Could not update this variation.')
  }
  const next = variationFromFirestore(input.variation.id, { ...stored, ...write.set, updatedByUid: input.actorUid, updatedAt: removedAt })
  // The settings log (iOS fallback) gets the shorter evidence list through its own partial write.
  await saveVariationSettingsLog(input.organizationId, next, variationToFirestore(next)).catch(() => undefined)
  return next
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

export async function softDeleteVariation(organizationId: string, variation: Variation, actorUid: string): Promise<VariationSaveOutcome> {
  return updateVariation({
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

export class VariationsChangedError extends Error {
  constructor() {
    super(VARIATION_RENUMBER_STALE_MESSAGE)
    this.name = 'VariationsChangedError'
  }
}

function renumberRow(row: Variation) {
  return {
    id: row.id,
    voNumber: row.voNumber,
    status: row.status,
    isDeleted: row.isDeleted,
    voNumberLocked: row.voNumberLocked,
    sequence: row.sequence,
    numberHistory: row.numberHistory,
  }
}

/**
 * Rulebook 1.52.0 (`variationRenumberPlan`, `variationRenumberConflict`, `variationRenumberWriteFields`): saves a new
 * tracker order. In one transaction it reads the tracker and every variation of the job as STORED, refuses with
 * `VariationsChangedError` when they changed since the screen loaded them (`baseRows`), works out the numbers from the
 * stored copies (pinned Submitted / Closed keep theirs; a number ever issued is never reused) and writes only each
 * row's `sequence` and, when its number changes, `voNumber` with one appended `numberHistory` entry; the tracker
 * version goes up. Then the `settings/variationItem_{id}` copies and the settings log get the same numbers; a copy
 * that fails is returned, never swallowed. Returns the plan rows that changed.
 */
export async function applyVariationOrder(input: {
  organizationId: string
  parentId: string
  order: string[]
  baseRows: Variation[]
  tracker: VariationTracker
  actor: { uid: string; name: string }
  notifyUserIds?: string[]
}): Promise<{ changed: Array<{ id: string; from: string; to: string }>; copiesFailed: string[] }> {
  if (!db) throw new Error('Firestore not configured')
  // A variation added since the screen loaded is not in `baseRows`: the job's ids are compared first.
  const current = await readCollectionVariations(input.organizationId, input.parentId)
  const baseIds = new Set(input.baseRows.filter((row) => row.id).map((row) => row.id.toLowerCase()))
  if (current.some((row) => !baseIds.has(row.id.toLowerCase()))) throw new VariationsChangedError()
  const trackerDoc = trackerRef(input.organizationId, input.parentId)
  const now = Timestamp.now()
  const stamp = { updatedAt: now, updatedByUid: input.actor.uid, ...(writeMetadataFields(input.actor.uid, 'web') ?? {}) }
  const outcome = await runTransaction(db!, async (transaction) => {
    const trackerSnap = await transaction.get(trackerDoc)
    const snaps = await Promise.all(input.baseRows.map((row) => transaction.get(variationRef(input.organizationId, row.id))))
    const stored = new Map<string, Record<string, unknown>>()
    const live: Variation[] = input.baseRows.map((row, index) => {
      const snap = snaps[index]
      if (!snap.exists()) return row
      const data = snap.data() as Record<string, unknown>
      stored.set(row.id, data)
      return variationFromFirestore(row.id, data)
    })
    if (variationRenumberConflict(input.baseRows.map(renumberRow), live.map(renumberRow))) throw new VariationsChangedError()
    const plan = variationRenumberPlan({
      rows: live.map(renumberRow),
      order: input.order,
      prefix: input.tracker.prefix,
      padding: input.tracker.padding,
    })
    const writes: Array<{ id: string; set: Record<string, unknown> }> = []
    for (const change of plan.changes) {
      const data = stored.get(change.id)
      if (!data) continue
      const write = variationRenumberWriteFields({ stored: data, to: change.to, sequence: change.sequence, at: now, byUid: input.actor.uid })
      if (!write) continue
      transaction.update(variationRef(input.organizationId, change.id), { ...write.set, ...stamp })
      writes.push({ id: change.id, set: write.set })
    }
    const renumbered = trackerSnap.exists()
      ? variationTrackerWriteFields(trackerSnap.data() as Record<string, unknown>, { kind: 'renumbered' })
      : null
    if (renumbered) transaction.update(trackerDoc, firestoreUpdateFields(renumbered))
    return { plan, writes, stored }
  })
  const copiesFailed: string[] = []
  await Promise.all(
    outcome.writes.map(async (write) => {
      const itemRef = settingsDoc(input.organizationId, variationItemDocId(write.id))
      try {
        const item = await getDoc(itemRef)
        if (item.exists()) {
          const itemWrite = variationRenumberWriteFields({ stored: item.data() as Record<string, unknown>, to: write.set.voNumber ?? (item.data() as Record<string, unknown>).voNumber, sequence: write.set.sequence ?? (item.data() as Record<string, unknown>).sequence, at: now, byUid: input.actor.uid })
          if (itemWrite) await updateDoc(itemRef, { ...itemWrite.set, ...stamp })
        }
      } catch (error) {
        copiesFailed.push(write.id)
        console.error('[variations] a renumbered settings copy did not save', error)
      }
      try {
        const next = variationFromFirestore(write.id, { ...(outcome.stored.get(write.id) || {}), ...write.set })
        const parent = input.baseRows.find((row) => row.id === write.id)
        await saveVariationSettingsLog(input.organizationId, { ...next, parentId: parent?.parentId || next.parentId, parentType: parent?.parentType || next.parentType }, variationToFirestore(next))
      } catch (error) {
        if (!copiesFailed.includes(write.id)) copiesFailed.push(write.id)
        console.error('[variations] a renumbered settings log entry did not save', error)
      }
    })
  )
  const changed = outcome.plan.rows.filter((row) => row.changed).map((row) => ({ id: row.id, from: row.from, to: row.to }))
  if (changed.length > 0) {
    const parentName = input.baseRows[0]?.parentName || 'this job'
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
  return { changed, copiesFailed }
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
