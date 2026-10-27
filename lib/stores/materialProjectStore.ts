'use client'

import { create } from 'zustand'
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { captureOrganizationContext, organizationContextStillCurrent } from '@/lib/canonical'
import { db } from '@/lib/firebase/config'
import { withAuthReadRetry } from '@/lib/firebase/waitForAuthToken'
import type { MaterialSendRecord, ProjectMaterialLine } from '@/types'
import { newUuid, parseFirestoreDate, parseNumber, parseOptionalString, parseString } from '@/lib/firebase/firestoreUtils'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function mapMaterialLine(docId: string, data: Record<string, unknown>): ProjectMaterialLine {
  return {
    id: docId,
    quantity: typeof data.quantity === 'number' ? data.quantity : Number(data.quantity) || 1,
    unit: parseString(data.unit, 'Number'),
    material: parseString(data.material) || parseString(data.name),
    addedBy: parseString(data.addedBy),
    projectId: parseString(data.projectId),
    date: parseFirestoreDate(data.date) || new Date(),
    status: parseString(data.status, 'draft'),
    brand: parseOptionalString(data.brand),
    productCode: parseOptionalString(data.productCode),
    category: parseOptionalString(data.category),
    catalogueItemId: parseOptionalString(data.catalogueItemId),
    notes: parseOptionalString(data.notes),
    size: parseOptionalString(data.size),
    length: parseOptionalString(data.length) || parseOptionalString(data.sizeOrLength),
    lengthUnit: parseOptionalString(data.lengthUnit),
    websiteURL: parseOptionalString(data.websiteURL),
    lastSentAt: parseFirestoreDate(data.lastSentAt),
    lastSentRequestType: parseOptionalString(data.lastSentRequestType),
  }
}

function mapSendRecord(docId: string, data: Record<string, unknown>): MaterialSendRecord | null {
  const projectId = parseString(data.projectId)
  const sentAt = parseFirestoreDate(data.sentAt)
  if (!projectId || !sentAt) return null
  return {
    id: docId,
    projectId,
    requestType: parseString(data.requestType) === 'Order' || parseString(data.requestType) === 'order' ? 'order' : 'quote',
    sentAt,
    materialsDate: parseFirestoreDate(data.materialsDate),
    sentBy: parseString(data.sentBy),
    deliveryRequiredAt: parseFirestoreDate(data.deliveryRequiredAt),
    recipients: Array.isArray(data.recipients)
      ? (data.recipients as Record<string, unknown>[]).map((r) => ({
          name: parseString(r.name),
          email: parseString(r.email),
          wholesalerName: parseOptionalString(r.wholesalerName),
        }))
      : [],
    lines: Array.isArray(data.lines)
      ? (data.lines as Record<string, unknown>[]).map((line) => ({
          materialId: parseString(line.materialId),
          name: parseString(line.name),
          quantity: typeof line.quantity === 'number' ? line.quantity : 1,
          unit: parseString(line.unit, 'Number'),
          brand: parseOptionalString(line.brand),
          productCode: parseOptionalString(line.productCode),
          lengthDisplay: parseOptionalString(line.lengthDisplay),
        }))
      : [],
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
  watchProjectMaterials: (organizationId: string, projectId: string) => () => void
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
  return snapshot.docs
    .map((entry) => mapMaterialLine(entry.id, entry.data() as Record<string, unknown>))
    .filter((m) => m.projectId.toLowerCase() === projectId.toLowerCase())
}

let materialsOrgId = ''

function keepMaterialRows(
  organizationId: string,
  previous: ProjectMaterialLine[],
  loaded: ProjectMaterialLine[]
): ProjectMaterialLine[] {
  const prior = materialsOrgId === organizationId ? previous : []
  return retainScopedRows(`materials:${organizationId}`, prior, loaded)
}

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
      const mapped = snapshot.docs.map((entry) =>
        mapMaterialLine(entry.id, entry.data() as Record<string, unknown>)
      )
      const materials = keepMaterialRows(organizationId, get().materials, mapped)
      materialsOrgId = organizationId
      set({ materials, loading: false })
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
      if (projectId) sendRecords = sendRecords.filter((r) => r.projectId === projectId)
      sendRecords.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      set({ sendRecords })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load send history' })
    }
  },

  watchProjectMaterials: (organizationId, projectId) => {
    const captured = captureOrganizationContext()
    const projectKey = projectId.toLowerCase()
    const inProject = (row: ProjectMaterialLine) => row.projectId.toLowerCase() === projectKey
    const current = () => organizationContextStillCurrent(organizationId, captured)
    if (!get().materials.some(inProject) || materialsOrgId !== organizationId) set({ loading: true, error: null })

    const unsubscribeMaterials = onSnapshot(
      query(collection(db, 'organizations', organizationId, 'materials'), where('projectId', '==', projectId)),
      (snapshot) => {
        if (!current()) return
        const loaded = snapshot.docs
          .map((entry) => mapMaterialLine(entry.id, entry.data() as Record<string, unknown>))
          .filter(inProject)
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
    const isUpdate = Boolean(existing)
    const normalizedDate = startOfDay(line.date)
    const addedByName = line.addedBy.trim()
    const payload: Record<string, unknown> = {
      id,
      quantity: line.quantity,
      unit: line.unit,
      material: line.material.trim(),
      name: line.material.trim(),
      addedBy: addedByName,
      addedByUserId: line.addedByUserId,
      projectId: line.projectId,
      date: Timestamp.fromDate(normalizedDate),
      status: line.status,
      updatedAt: Timestamp.now(),
      catalogueItemId: line.catalogueItemId || null,
      brand: line.brand?.trim() || null,
      productCode: line.productCode?.trim() || null,
      category: line.category?.trim() || null,
      notes: line.notes?.trim() || null,
      size: line.size?.trim() || null,
      length: line.length?.trim() || null,
      lengthUnit: line.length?.trim() ? line.lengthUnit || null : null,
      websiteURL: line.websiteURL?.trim() || null,
    }
    if (!isUpdate) {
      payload.addedAt = Timestamp.now()
      payload.createdAt = Timestamp.now()
    }

    try {
      await setDoc(doc(db, 'organizations', organizationId, 'materials', id), payload, isUpdate ? { merge: true } : {})
      const mapped = mapMaterialLine(id, payload)
      const saved: ProjectMaterialLine = existing
        ? {
            ...mapped,
            lastSentAt: existing.lastSentAt,
            lastSentRequestType: existing.lastSentRequestType,
            date: mapped.date,
          }
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
    const requestType = record.requestType === 'order' ? 'Order' : 'Quote'
    const payload: Record<string, unknown> = {
      id,
      projectId: record.projectId,
      requestType,
      sentAt: Timestamp.fromDate(record.sentAt),
      sentBy: record.sentBy,
      recipients: record.recipients,
      lines: record.lines.map((line) => ({
        materialId: line.materialId,
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        brand: line.brand || null,
        productCode: line.productCode || null,
        lengthDisplay: line.lengthDisplay || null,
      })),
    }
    if (record.materialsDate) payload.materialsDate = Timestamp.fromDate(record.materialsDate)
    if (record.deliveryRequiredAt) payload.deliveryRequiredAt = Timestamp.fromDate(record.deliveryRequiredAt)
    await setDoc(doc(db, 'organizations', organizationId, 'materialSendRecords', id), payload)
    const mapped = mapSendRecord(id, payload as Record<string, unknown>)
    if (mapped) {
      set({ sendRecords: [mapped, ...get().sendRecords.filter((r) => r.id !== id)] })
    }
  },

  updateMaterialWorkflowStatuses: async (organizationId, materialIds, status, requestType) => {
    const now = new Date()
    const next = [...get().materials]
    const writes: Promise<void>[] = []
    for (const materialId of materialIds) {
      const current = next.find((row) => row.id === materialId)
      if (!current) continue
      const nextStatus = current.status === 'ordered' && status === 'sentForQuote' ? 'ordered' : status
      const payload: Record<string, unknown> = {
        status: nextStatus,
        lastSentAt: Timestamp.fromDate(now),
        lastSentRequestType: requestType === 'order' ? 'Order' : 'Quote',
        updatedAt: Timestamp.now(),
      }
      writes.push(
        setDoc(doc(db, 'organizations', organizationId, 'materials', materialId), payload, { merge: true })
      )
      const index = next.findIndex((row) => row.id === materialId)
      if (index >= 0) {
        next[index] = {
          ...next[index],
          status: nextStatus,
          lastSentAt: now,
          lastSentRequestType: requestType === 'order' ? 'Order' : 'Quote',
        }
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
