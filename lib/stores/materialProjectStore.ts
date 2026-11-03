'use client'

import { create } from 'zustand'
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import {
  captureOrganizationContext,
  materialLineFields,
  materialLineWriteFields,
  materialSendRecordCreateFields,
  materialSendStatusWriteFields,
  organizationContextStillCurrent,
  parseMaterialLineDocument,
  parseMaterialSendRecordDocument,
} from '@/lib/canonical'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { dateFromDayKeyInZone, dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { db } from '@/lib/firebase/config'
import { withAuthReadRetry } from '@/lib/firebase/waitForAuthToken'
import type { MaterialSendRecord, ProjectMaterialLine } from '@/types'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'

/** `materials/{id}` through the rulebook reader `parseMaterialLineDocument` (rulebook 1.8.0): never dropped for an
 * odd id, quantity or unit; the day is the stored `dayKey`, else the organisation-zone day of `date`. */
function mapMaterialLine(docId: string, data: Record<string, unknown>): ProjectMaterialLine | null {
  const zone = organizationZoneOr()
  const parsed = parseMaterialLineDocument(docId, data, { timeZone: zone })
  if (!parsed) return null
  const day = parsed.dayKey ? dateFromDayKeyInZone(parsed.dayKey, zone) : null
  return {
    id: parsed.id,
    quantity: parsed.quantity,
    unit: parsed.unit,
    material: parsed.material,
    addedBy: parsed.addedBy,
    projectId: parsed.projectId,
    date: day ?? (parsed.dateMs != null ? new Date(parsed.dateMs) : new Date(0)),
    dayKey: parsed.dayKey ?? undefined,
    status: parsed.status,
    brand: parsed.brand ?? undefined,
    productCode: parsed.productCode ?? undefined,
    category: parsed.category ?? undefined,
    catalogueItemId: parsed.catalogueItemId ?? undefined,
    notes: parsed.notes ?? undefined,
    size: parsed.size ?? undefined,
    length: parsed.length ?? undefined,
    lengthUnit: parsed.lengthUnit ?? undefined,
    websiteURL: parsed.websiteURL ?? undefined,
    lastSentAt: parsed.lastSentAtMs != null ? new Date(parsed.lastSentAtMs) : undefined,
    lastSentRequestType: parsed.lastSentRequestType ?? undefined,
  }
}

function mapMaterialLines(docs: ReadonlyArray<{ id: string; data: () => unknown }>): ProjectMaterialLine[] {
  return docs
    .map((entry) => mapMaterialLine(entry.id, entry.data() as Record<string, unknown>))
    .filter((row): row is ProjectMaterialLine => row !== null)
}

/** `materialSendRecords/{id}` through `parseMaterialSendRecordDocument` (rulebook 1.8.0). */
function mapSendRecord(docId: string, data: Record<string, unknown>): MaterialSendRecord | null {
  const parsed = parseMaterialSendRecordDocument(docId, data, { timeZone: organizationZoneOr() })
  if (!parsed) return null
  return {
    id: parsed.id,
    projectId: parsed.projectId,
    requestType: parsed.requestType,
    sentAt: new Date(parsed.sentAtMs),
    materialsDate: parsed.materialsDateMs != null ? new Date(parsed.materialsDateMs) : undefined,
    sentBy: parsed.sentBy,
    deliveryRequiredAt: parsed.deliveryRequiredAtMs != null ? new Date(parsed.deliveryRequiredAtMs) : undefined,
    recipients: parsed.recipients.map((recipient) => ({
      name: recipient.name,
      email: recipient.email,
      wholesalerName: recipient.wholesalerName ?? undefined,
    })),
    lines: parsed.lines.map((line) => ({
      materialId: line.materialId,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      brand: line.brand ?? undefined,
      productCode: line.productCode ?? undefined,
      lengthDisplay: line.lengthDisplay ?? undefined,
    })),
  }
}

export type SaveMaterialLineInput = {
  id?: string
  quantity: number
  unit: string
  material: string
  addedBy: string
  addedByUserId: string
  projectId: string
  date: Date
  /** The materials day (organisation zone). When left out, the organisation-zone day of `date`. */
  dayKey?: string
  status: string
  brand?: string
  productCode?: string
  category?: string
  catalogueItemId?: string
  notes?: string
  size?: string
  length?: string
  lengthUnit?: string
  websiteURL?: string
}

interface MaterialProjectState {
  materials: ProjectMaterialLine[]
  sendRecords: MaterialSendRecord[]
  loading: boolean
  error: string | null
  loadProjectMaterials: (organizationId: string, projectId: string) => Promise<void>
  loadAllMaterials: (organizationId: string) => Promise<void>
  loadSendRecords: (organizationId: string, projectId?: string) => Promise<void>
  /**
   * Keep one job's material lines and quote/order history current while its
   * Materials screen is open (lines added on iOS or another browser appear
   * without a reload). Returns the unsubscribe.
   */
  watchProjectMaterials: (
    organizationId: string,
    projectId: string,
    options?: { includeSendRecords?: boolean }
  ) => () => void
  saveMaterialLine: (organizationId: string, line: SaveMaterialLineInput) => Promise<void>
  deleteMaterialLine: (organizationId: string, materialId: string) => Promise<void>
  saveSendRecord: (organizationId: string, record: MaterialSendRecord) => Promise<void>
  updateMaterialWorkflowStatuses: (
    organizationId: string,
    materialIds: string[],
    status: string,
    requestType: 'quote' | 'order'
  ) => Promise<void>
}

async function fetchProjectMaterials(organizationId: string, projectId: string): Promise<ProjectMaterialLine[]> {
  let snapshot
  try {
    snapshot = await getDocs(
      query(
        collection(db, 'organizations', organizationId, 'materials'),
        where('projectId', '==', projectId)
      )
    )
  } catch {
    snapshot = await getDocs(collection(db, 'organizations', organizationId, 'materials'))
  }
  return mapMaterialLines(snapshot.docs).filter((m) => m.projectId.toLowerCase() === projectId.toLowerCase())
}

let materialsOrgId = ''

function isPermissionDenied(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'permission-denied')
}

function keepMaterialRows(
  organizationId: string,
  previous: ProjectMaterialLine[],
  loaded: ProjectMaterialLine[],
  options?: { authoritative?: boolean }
): ProjectMaterialLine[] {
  const prior = materialsOrgId === organizationId ? previous : []
  return retainScopedRows(`materials:${organizationId}`, prior, loaded, options)
}

let allMaterialsUnsub: (() => void) | null = null
let allMaterialsWatchOrgId = ''
let allSendRecordsUnsub: (() => void) | null = null
let allSendRecordsWatchOrgId = ''

export const useMaterialProjectStore = create<MaterialProjectState>((set, get) => ({
  materials: [],
  sendRecords: [],
  loading: false,
  error: null,

  loadProjectMaterials: async (organizationId, projectId) => {
    const already = get().materials.some(
      (row) => row.projectId.toLowerCase() === projectId.toLowerCase()
    )
    if (already) {
      void fetchProjectMaterials(organizationId, projectId)
        .then((loaded) => {
          const others = get().materials.filter(
            (row) => row.projectId.toLowerCase() !== projectId.toLowerCase()
          )
          const previous = get().materials.filter(
            (row) => row.projectId.toLowerCase() === projectId.toLowerCase()
          )
          const kept = keepMaterialRows(organizationId, previous, loaded)
          materialsOrgId = organizationId
          set({ materials: [...others, ...kept], loading: false })
        })
        .catch(() => {})
      return
    }
    set({ loading: true, error: null })
    try {
      const loaded = await fetchProjectMaterials(organizationId, projectId)
      const others = get().materials.filter(
        (row) => row.projectId.toLowerCase() !== projectId.toLowerCase()
      )
      const previous = get().materials.filter(
        (row) => row.projectId.toLowerCase() === projectId.toLowerCase()
      )
      const kept = keepMaterialRows(organizationId, previous, loaded)
      materialsOrgId = organizationId
      set({ materials: [...others, ...kept], loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load materials', loading: false })
      throw error
    }
  },

  loadAllMaterials: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const snapshot = await withAuthReadRetry(() =>
        getDocs(collection(db, 'organizations', organizationId, 'materials'))
      )
      const mapped = mapMaterialLines(snapshot.docs)
      const materials = keepMaterialRows(organizationId, get().materials, mapped)
      materialsOrgId = organizationId
      set({ materials, loading: false })
      // Rulebook 1.10.0 (1.9.0 leftover, LIVE_COLLECTIONS `materials`): the org-wide list (Home, Warnings) stays
      // live after the first read; the listener is replaced when the organisation changes.
      if (allMaterialsWatchOrgId !== organizationId) {
        allMaterialsUnsub?.()
        allMaterialsWatchOrgId = organizationId
        allMaterialsUnsub = onSnapshot(
          collection(db, 'organizations', organizationId, 'materials'),
          (snap) => {
            if (allMaterialsWatchOrgId !== organizationId) return
            set({
              materials: keepMaterialRows(organizationId, get().materials, mapMaterialLines(snap.docs), {
                authoritative: !snap.metadata.fromCache,
              }),
            })
          },
          () => undefined
        )
      }
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load materials', loading: false })
      throw error
    }
  },

  loadSendRecords: async (organizationId, projectId) => {
    try {
      let snapshot
      if (projectId) {
        try {
          snapshot = await getDocs(
            query(
              collection(db, 'organizations', organizationId, 'materialSendRecords'),
              where('projectId', '==', projectId)
            )
          )
        } catch {
          snapshot = await getDocs(collection(db, 'organizations', organizationId, 'materialSendRecords'))
        }
      } else {
        snapshot = await getDocs(collection(db, 'organizations', organizationId, 'materialSendRecords'))
      }
      let sendRecords = snapshot.docs
        .map((entry) => mapSendRecord(entry.id, entry.data() as Record<string, unknown>))
        .filter((r): r is MaterialSendRecord => r !== null)
      if (projectId) sendRecords = sendRecords.filter((r) => r.projectId.toLowerCase() === projectId.toLowerCase())
      sendRecords.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      set({ sendRecords })
      // Rulebook 1.10.0: the org-wide send-record list (material cut-off warnings) stays live after the first read.
      if (!projectId && allSendRecordsWatchOrgId !== organizationId) {
        allSendRecordsUnsub?.()
        allSendRecordsWatchOrgId = organizationId
        allSendRecordsUnsub = onSnapshot(
          collection(db, 'organizations', organizationId, 'materialSendRecords'),
          (snap) => {
            if (allSendRecordsWatchOrgId !== organizationId) return
            const rows = snap.docs
              .map((entry) => mapSendRecord(entry.id, entry.data() as Record<string, unknown>))
              .filter((r): r is MaterialSendRecord => r !== null)
              .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
            set({ sendRecords: rows })
          },
          () => undefined
        )
      }
    } catch (error: unknown) {
      // Operatives never read history (`canViewMaterialOrderHistory` / Firestore `canReadMaterialSendHistory`).
      if (isPermissionDenied(error)) {
        set({ sendRecords: [] })
        return
      }
      set({ error: error instanceof Error ? error.message : 'Failed to load send history' })
    }
  },

  watchProjectMaterials: (organizationId, projectId, options) => {
    const captured = captureOrganizationContext()
    const projectKey = projectId.toLowerCase()
    const inProject = (row: ProjectMaterialLine) => row.projectId.toLowerCase() === projectKey
    const current = () => organizationContextStillCurrent(organizationId, captured)
    if (!get().materials.some(inProject) || materialsOrgId !== organizationId) set({ loading: true, error: null })

    const unsubscribeMaterials = onSnapshot(
      query(collection(db, 'organizations', organizationId, 'materials'), where('projectId', '==', projectId)),
      (snapshot) => {
        if (!current()) return
        const loaded = mapMaterialLines(snapshot.docs).filter(inProject)
        const scoped = materialsOrgId === organizationId ? get().materials : []
        const previous = scoped.filter(inProject)
        // A server snapshot is the job's list, even when another device removed the last line.
        // A cache snapshot must not blank lines already on screen.
        const rows = snapshot.metadata.fromCache
          ? retainScopedRows(`materials:${organizationId}`, previous, loaded)
          : loaded
        materialsOrgId = organizationId
        set({ materials: [...scoped.filter((row) => !inProject(row)), ...rows], loading: false, error: null })
      },
      () => {
        if (!current()) return
        // The listener was refused: fall back to the one-off read.
        void get().loadProjectMaterials(organizationId, projectId).catch(() => {})
      }
    )

    // Quote and order history only for viewers who may read it (`canViewMaterialOrderHistory`).
    if (options?.includeSendRecords === false) {
      return unsubscribeMaterials
    }

    const unsubscribeSends = onSnapshot(
      query(collection(db, 'organizations', organizationId, 'materialSendRecords'), where('projectId', '==', projectId)),
      (snapshot) => {
        if (!current()) return
        const sendRecords = snapshot.docs
          .map((entry) => mapSendRecord(entry.id, entry.data() as Record<string, unknown>))
          .filter((record): record is MaterialSendRecord => record !== null)
          .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
        const shown = get().sendRecords.some((record) => record.projectId === projectId)
        if (snapshot.metadata.fromCache && sendRecords.length === 0 && shown) return
        set({ sendRecords })
      },
      () => {
        if (!current()) return
        void get().loadSendRecords(organizationId, projectId)
      }
    )

    return () => {
      unsubscribeMaterials()
      unsubscribeSends()
    }
  },

  saveMaterialLine: async (organizationId, line) => {
    const id = line.id || newUuid()
    const existing = get().materials.find((row) => row.id === id)
    const zone = organizationZoneOr()
    const dayKey = line.dayKey || existing?.dayKey || dayKeyInZone(line.date, zone)
    // Rulebook 1.8.0 §1: the stored shape is `materialLineFields` (organisation-zone midnight `date` plus `dayKey`),
    // saved as a partial update of the changed fields (`materialLineWriteFields`); owner fields are create-only.
    const fields = materialLineFields(
      {
        id,
        projectId: line.projectId,
        quantity: line.quantity,
        unit: line.unit,
        material: line.material,
        dayKey,
        status: line.status,
        addedBy: line.addedBy.trim(),
        addedByUserId: line.addedByUserId,
        addedAt: existing ? undefined : Timestamp.now(),
        catalogueItemId: line.catalogueItemId ?? null,
        brand: line.brand ?? null,
        productCode: line.productCode ?? null,
        category: line.category ?? null,
        notes: line.notes ?? null,
        size: line.size ?? null,
        length: line.length ?? null,
        lengthUnit: line.lengthUnit ?? null,
        websiteURL: line.websiteURL ?? null,
      },
      zone
    )
    const dateMs = typeof fields.date === 'number' ? fields.date : dateFromDayKeyInZone(dayKey, zone).getTime()
    const payload: Record<string, unknown> = { ...fields, date: Timestamp.fromMillis(dateMs) }
    if (!existing) payload.createdAt = Timestamp.now()

    try {
      await savePartialDocument(
        doc(db, 'organizations', organizationId, 'materials', id),
        payload,
        materialLineWriteFields,
        { userId: line.addedByUserId }
      )
      const mapped = mapMaterialLine(id, payload)
      if (!mapped) return
      const saved: ProjectMaterialLine = existing
        ? { ...mapped, lastSentAt: existing.lastSentAt, lastSentRequestType: existing.lastSentRequestType }
        : mapped
      set({ materials: [...get().materials.filter((m) => m.id !== id), saved], error: null })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save material'
      set({ error: message })
      throw new Error(message)
    }
  },

  saveSendRecord: async (organizationId, record) => {
    const id = record.id || newUuid()
    // Rulebook 1.8.0: one stored shape for every platform (`materialSendRecordCreateFields`).
    const payload = materialSendRecordCreateFields({
      id,
      projectId: record.projectId,
      requestType: record.requestType,
      sentAt: Timestamp.fromDate(record.sentAt),
      sentBy: record.sentBy,
      materialsDate: record.materialsDate ? Timestamp.fromDate(record.materialsDate) : undefined,
      deliveryRequiredAt: record.deliveryRequiredAt ? Timestamp.fromDate(record.deliveryRequiredAt) : undefined,
      recipients: record.recipients,
      lines: record.lines,
    })
    await setDoc(doc(db, 'organizations', organizationId, 'materialSendRecords', id), payload)
    const mapped = mapSendRecord(id, payload)
    if (mapped) {
      set({ sendRecords: [mapped, ...get().sendRecords.filter((r) => r.id !== id)] })
    }
  },

  updateMaterialWorkflowStatuses: async (organizationId, materialIds, status, requestType) => {
    const now = new Date()
    const next = [...get().materials]
    const writes: Promise<void>[] = []
    // No write metadata here: firestore.rules `isStaffMaterialStatusWrite` lets staff who are not the line's owner
    // change only status, lastSentAt, lastSentRequestType and updatedAt.
    for (const materialId of materialIds) {
      const index = next.findIndex((row) => row.id === materialId)
      if (index < 0) continue
      // `materialSendStatusWriteFields`: an ordered line is never moved back to sent-for-quote.
      const fields = materialSendStatusWriteFields(next[index].status, status === 'ordered' ? 'Order' : 'Quote')
      writes.push(
        updateDoc(doc(db, 'organizations', organizationId, 'materials', materialId), {
          status: fields.status,
          lastSentRequestType: requestType === 'order' ? 'Order' : 'Quote',
          lastSentAt: Timestamp.fromDate(now),
          updatedAt: serverTimestamp(),
        })
      )
      next[index] = {
        ...next[index],
        status: fields.status,
        lastSentAt: now,
        lastSentRequestType: requestType === 'order' ? 'Order' : 'Quote',
      }
    }
    await Promise.all(writes)
    set({ materials: next })
  },

  deleteMaterialLine: async (organizationId, materialId) => {
    try {
      await deleteDoc(doc(db, 'organizations', organizationId, 'materials', materialId))
      markRowsRemoved(`materials:${organizationId}`, [materialId])
      set({ materials: get().materials.filter((row) => row.id !== materialId), error: null })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete material'
      set({ error: message })
      throw new Error(message)
    }
  },
}))
