'use client'

import { create } from 'zustand'
import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { MaterialSendRecord, ProjectMaterialLine } from '@/types'
import { newUuid, parseFirestoreDate, parseNumber, parseOptionalString, parseString } from '@/lib/firebase/firestoreUtils'

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
  }
}

function mapSendRecord(docId: string, data: Record<string, unknown>): MaterialSendRecord | null {
  const projectId = parseString(data.projectId)
  const sentAt = parseFirestoreDate(data.sentAt)
  if (!projectId || !sentAt) return null
  return {
    id: docId,
    projectId,
    requestType: parseString(data.requestType) === 'order' ? 'order' : 'quote',
    sentAt,
    materialsDate: parseFirestoreDate(data.materialsDate),
    sentBy: parseString(data.sentBy),
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
}

interface MaterialProjectState {
  materials: ProjectMaterialLine[]
  sendRecords: MaterialSendRecord[]
  loading: boolean
  error: string | null
  loadProjectMaterials: (organizationId: string, projectId: string) => Promise<void>
  loadSendRecords: (organizationId: string, projectId?: string) => Promise<void>
  saveMaterialLine: (organizationId: string, line: SaveMaterialLineInput) => Promise<void>
  saveSendRecord: (organizationId: string, record: MaterialSendRecord) => Promise<void>
}

export const useMaterialProjectStore = create<MaterialProjectState>((set, get) => ({
  materials: [],
  sendRecords: [],
  loading: false,
  error: null,

  loadProjectMaterials: async (organizationId, projectId) => {
    set({ loading: true, error: null })
    try {
      const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'materials'))
      const materials = snapshot.docs
        .map((entry) => mapMaterialLine(entry.id, entry.data() as Record<string, unknown>))
        .filter((m) => m.projectId === projectId)
      set({ materials, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load materials', loading: false })
      throw error
    }
  },

  loadSendRecords: async (organizationId, projectId) => {
    try {
      const snapshot = await getDocs(
        collection(db, 'organizations', organizationId, 'materialSendRecords')
      )
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

  saveMaterialLine: async (organizationId, line) => {
    const id = line.id || newUuid()
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
      addedAt: Timestamp.now(),
      projectId: line.projectId,
      date: Timestamp.fromDate(normalizedDate),
      status: line.status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }
    if (line.catalogueItemId) payload.catalogueItemId = line.catalogueItemId
    if (line.brand?.trim()) payload.brand = line.brand.trim()
    if (line.productCode?.trim()) payload.productCode = line.productCode.trim()
    if (line.category?.trim()) payload.category = line.category.trim()
    if (line.notes?.trim()) payload.notes = line.notes.trim()

    try {
      await setDoc(doc(db, 'organizations', organizationId, 'materials', id), payload)
      const saved = mapMaterialLine(id, payload)
      set({ materials: [...get().materials.filter((m) => m.id !== id), saved], error: null })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save material'
      set({ error: message })
      throw new Error(message)
    }
  },

  saveSendRecord: async (organizationId, record) => {
    const id = record.id || newUuid()
    const payload: Record<string, unknown> = {
      id,
      projectId: record.projectId,
      requestType: record.requestType,
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
    await setDoc(doc(db, 'organizations', organizationId, 'materialSendRecords', id), payload)
    const mapped = mapSendRecord(id, payload as Record<string, unknown>)
    if (mapped) {
      set({ sendRecords: [mapped, ...get().sendRecords.filter((r) => r.id !== id)] })
    }
  },
}))
