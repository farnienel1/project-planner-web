/**
 * Writes for organizations/{orgId}/variations and variationTrackers.
 * Every write recomputes the three counters and stamps updatedAt / updatedByUid.
 */
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/config'
import { newUuid, parseFirestoreDate, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { hasAdminAccess } from '@/lib/permissions'
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

function stamp(value: unknown): Date | null {
  return parseFirestoreDate(value) || null
}

function mapLabour(rows: unknown): VariationLabourLine[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const data = (row || {}) as Record<string, unknown>
      const trade = typeof data.trade === 'string' ? data.trade.trim() : ''
      if (!trade) return null
      return {
        id: typeof data.id === 'string' && data.id ? data.id : newUuid(),
        trade,
        hours: typeof data.hours === 'number' ? data.hours : Number(data.hours) || 0,
      }
    })
    .filter((row): row is VariationLabourLine => Boolean(row))
}

function mapMaterials(rows: unknown): VariationMaterialLine[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const data = (row || {}) as Record<string, unknown>
      const name = typeof data.name === 'string' ? data.name.trim() : ''
      if (!name) return null
      return {
        id: typeof data.id === 'string' && data.id ? data.id : newUuid(),
        name,
        quantity: typeof data.quantity === 'string' ? data.quantity : '',
      }
    })
    .filter((row): row is VariationMaterialLine => Boolean(row))
}

function mapEvidence(rows: unknown): VariationEvidence[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const data = (row || {}) as Record<string, unknown>
      const id = typeof data.id === 'string' ? data.id : ''
      const storagePath = typeof data.storagePath === 'string' ? data.storagePath : ''
      if (!id || !storagePath) return null
      return {
        id,
        fileName: typeof data.fileName === 'string' ? data.fileName : 'file',
        contentType: typeof data.contentType === 'string' ? data.contentType : '',
        sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
        storagePath,
        downloadURL: typeof data.downloadURL === 'string' ? data.downloadURL : '',
        uploadedByUid: typeof data.uploadedByUid === 'string' ? data.uploadedByUid : '',
        uploadedAt: stamp(data.uploadedAt) || new Date(),
      }
    })
    .filter((row): row is VariationEvidence => Boolean(row))
}

export function variationFromFirestore(id: string, data: Record<string, unknown>): Variation {
  const labour = mapLabour(data.labour)
  const materials = mapMaterials(data.materials)
  const evidence = mapEvidence(data.evidence)
  const counters = variationCounters({ labour, materials, evidence })
  const status = data.status === 'submitted' || data.status === 'closed' || data.status === 'open' ? data.status : 'open'
  return {
    id,
    orgId: typeof data.orgId === 'string' ? data.orgId : '',
    parentType: data.parentType === 'smallWork' ? 'smallWork' : 'project',
    parentId: typeof data.parentId === 'string' ? data.parentId : '',
    parentName: typeof data.parentName === 'string' ? data.parentName : '',
    origin: data.origin === 'tracker' ? 'tracker' : 'app',
    voNumber: typeof data.voNumber === 'string' ? data.voNumber : '',
    sequence: typeof data.sequence === 'number' ? data.sequence : 0,
    voNumberLocked: data.voNumberLocked === true,
    numberHistory: Array.isArray(data.numberHistory)
      ? data.numberHistory.map((row) => {
          const item = (row || {}) as Record<string, unknown>
          return {
            from: typeof item.from === 'string' ? item.from : '',
            to: typeof item.to === 'string' ? item.to : '',
            at: stamp(item.at) || new Date(),
            byUid: typeof item.byUid === 'string' ? item.byUid : '',
          }
        })
      : [],
    heading: typeof data.heading === 'string' ? data.heading : '',
    description: typeof data.description === 'string' ? data.description : '',
    status,
    labour,
    materials,
    evidence,
    totalLabourHours: counters.totalLabourHours,
    materialLineCount: counters.materialLineCount,
    evidenceCount: counters.evidenceCount,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
    createdByName: typeof data.createdByName === 'string' ? data.createdByName : '',
    createdAt: stamp(data.createdAt) || new Date(),
    updatedByUid: typeof data.updatedByUid === 'string' ? data.updatedByUid : '',
    updatedAt: stamp(data.updatedAt) || new Date(),
    statusHistory: Array.isArray(data.statusHistory)
      ? data.statusHistory.map((row) => {
          const item = (row || {}) as Record<string, unknown>
          return {
            status: typeof item.status === 'string' ? item.status : '',
            byUid: typeof item.byUid === 'string' ? item.byUid : '',
            byName: typeof item.byName === 'string' ? item.byName : '',
            at: stamp(item.at) || new Date(),
          }
        })
      : [],
    submittedAt: stamp(data.submittedAt),
    closedAt: stamp(data.closedAt),
    isDeleted: data.isDeleted === true,
  }
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
  return onSnapshot(
    query(variationsCollection(organizationId), where('parentId', '==', parentId)),
    (snap) => {
      onRows(snap.docs.map((entry) => variationFromFirestore(entry.id, entry.data() as Record<string, unknown>)))
    },
    (error) => onError?.(error)
  )
}

export async function loadVariationTracker(organizationId: string, parentId: string): Promise<VariationTracker> {
  const snap = await getDoc(trackerRef(organizationId, parentId))
  return trackerFromFirestore(parentId, snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
}

export function subscribeVariationTracker(
  organizationId: string,
  parentId: string,
  onTracker: (tracker: VariationTracker) => void
): Unsubscribe {
  if (!db) {
    onTracker(emptyTracker(parentId, 'project'))
    return () => {}
  }
  return onSnapshot(trackerRef(organizationId, parentId), (snap) => {
    onTracker(trackerFromFirestore(parentId, snap.exists() ? (snap.data() as Record<string, unknown>) : undefined))
  })
}

async function listParentVariations(organizationId: string, parentId: string): Promise<Variation[]> {
  const snap = await getDocs(query(variationsCollection(organizationId), where('parentId', '==', parentId)))
  return snap.docs.map((entry) => variationFromFirestore(entry.id, entry.data() as Record<string, unknown>))
}

function withCounters(row: Variation): Variation {
  const counters = variationCounters(row)
  return { ...row, ...counters }
}

async function notifyCreated(input: {
  organizationId: string
  variation: Variation
  users: User[]
  creatorId: string
  managerIds: string[]
}) {
  const recipients =
    input.variation.origin === 'tracker'
      ? input.users.filter(
          (person) =>
            person.id !== input.creatorId &&
            (hasAdminAccess(person) || input.managerIds.includes(person.id))
        )
      : input.users.filter((person) => person.id !== input.creatorId && hasAdminAccess(person))
  const title = input.variation.origin === 'tracker' ? 'New variation from the QS' : 'New variation added'
  const message =
    input.variation.origin === 'tracker'
      ? `${input.variation.voNumber} added to ${input.variation.parentName} — hours and materials needed`
      : `New variation added to ${input.variation.parentName}`
  await Promise.all(
    recipients.map((person) =>
      saveInboxNotification({
        organizationId: input.organizationId,
        type: 'variation',
        title,
        message,
        userId: person.id,
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
}): Promise<Variation> {
  const allRows = await listParentVariations(input.organizationId, input.parentId)
  const existing = allRows.filter((row) => !row.isDeleted)
  const tracker = await loadVariationTracker(input.organizationId, input.parentId)
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
  const batch = writeBatch(db!)
  batch.set(variationRef(input.organizationId, id), variationToFirestore(draft))
  await batch.commit()
  if (input.users) {
    await notifyCreated({
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
  const batch = writeBatch(db!)
  batch.set(variationRef(input.organizationId, next.id), variationToFirestore(next))
  await batch.commit()
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
  const snap = await getDoc(doc(db, 'organizations', organizationId, 'settings', 'variationTrades'))
  const raw = snap.exists() ? snap.data().customTrades : []
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

export async function saveCustomTrade(organizationId: string, trade: string): Promise<string[]> {
  const name = trade.trim()
  if (!name || !db) return []
  const ref = doc(db, 'organizations', organizationId, 'settings', 'variationTrades')
  const current = await loadCustomTrades(organizationId)
  if (current.some((item) => item.toLowerCase() === name.toLowerCase())) return current
  const customTrades = [...current, name]
  await updateDoc(ref, { customTrades }).catch(async () => {
    const { setDoc } = await import('firebase/firestore')
    await setDoc(ref, { customTrades }, { merge: true })
  })
  return customTrades
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
    transaction.set(
      ref,
      sanitizeForFirestore({
        ...next,
        lockedAt: Timestamp.fromDate(now),
        enabledAt: next.enabledAt ? Timestamp.fromDate(next.enabledAt) : null,
      }) as Record<string, unknown>,
      { merge: true }
    )
    return next
  })
}

export async function releaseTrackerLock(organizationId: string, parentId: string, uid: string): Promise<void> {
  const ref = trackerRef(organizationId, parentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const current = trackerFromFirestore(parentId, snap.data() as Record<string, unknown>)
  if (current.lockedByUid !== uid) return
  await updateDoc(ref, { lockedByUid: deleteField(), lockedByName: deleteField(), lockedAt: deleteField() })
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
  const batch = writeBatch(db!)
  ordered.forEach((row, index) => {
    const locked = row.status === 'submitted' || row.status === 'closed'
    batch.update(variationRef(input.organizationId, row.id), {
      sequence: index + 1,
      voNumberLocked: locked || row.voNumberLocked,
      updatedAt: Timestamp.now(),
      updatedByUid: input.actorUid,
    })
  })
  const now = Timestamp.now()
  batch.set(
    trackerRef(input.organizationId, input.parentId),
    {
      parentId: input.parentId,
      parentType: input.parentType,
      enabled: true,
      enabledAt: now,
      enabledByUid: input.actorUid,
      numberingMode: 'lockSubmitted',
      prefix: 'VO-',
      padding: 3,
      version: 1,
    },
    { merge: true }
  )
  await batch.commit()
}

export async function setTrackerMode(
  organizationId: string,
  parentId: string,
  numberingMode: 'lockSubmitted' | 'resequenceAll'
): Promise<void> {
  await updateDoc(trackerRef(organizationId, parentId), { numberingMode })
}

export async function disableTracker(organizationId: string, parentId: string): Promise<void> {
  await updateDoc(trackerRef(organizationId, parentId), {
    enabled: false,
    lockedByUid: deleteField(),
    lockedByName: deleteField(),
    lockedAt: deleteField(),
  })
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
      const numberChanged = change.to !== row.voNumber
      transaction.update(variationRef(input.organizationId, row.id), sanitizeForFirestore({
        sequence: change.sequence,
        voNumber: change.to,
        numberHistory: numberChanged
          ? [...row.numberHistory, { from: row.voNumber, to: change.to, at: Timestamp.fromDate(now), byUid: input.actor.uid }].map(
              (item) => ({
                from: item.from,
                to: item.to,
                at: item.at instanceof Date ? Timestamp.fromDate(item.at) : item.at,
                byUid: item.byUid,
              })
            )
          : row.numberHistory.map((item) => ({
              from: item.from,
              to: item.to,
              at: Timestamp.fromDate(item.at),
              byUid: item.byUid,
            })),
        updatedAt: Timestamp.fromDate(now),
        updatedByUid: input.actor.uid,
      }) as Record<string, unknown>)
    }
    transaction.update(ref, {
      version: tracker.version + 1,
      lockedByUid: deleteField(),
      lockedByName: deleteField(),
      lockedAt: deleteField(),
    })
  })
  const parentName = input.rows[0]?.parentName || 'this job'
  await Promise.all(
    (input.notifyUserIds || []).map((userId) =>
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
