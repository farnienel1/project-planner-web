'use client'

import { create } from 'zustand'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { MaterialCatalogItem, MaterialLengthUnit, MaterialUnit } from '@/types'
import { newUuid, parseFirestoreDate, parseOptionalString, parseString, parseUuid } from '@/lib/firebase/firestoreUtils'

const MATERIAL_UNITS: MaterialUnit[] = ['Number', 'Box', 'Length', 'Drum', 'Pallet']

function parseMaterialUnit(value: unknown): MaterialUnit {
  const raw = parseString(value, 'Number')
  return MATERIAL_UNITS.includes(raw as MaterialUnit) ? (raw as MaterialUnit) : 'Number'
}

function parseLengthUnit(value: unknown): MaterialLengthUnit | undefined {
  const raw = parseString(value)
  return raw === 'M' || raw === 'MM' ? raw : undefined
}

function mapMaterialCatalogItem(docId: string, data: Record<string, unknown>): MaterialCatalogItem | null {
  const name = parseString(data.name)
  const brand = parseString(data.brand)
  const createdAt = parseFirestoreDate(data.createdAt)
  const createdByUserId = parseString(data.createdByUserId)
  const createdByName = parseString(data.createdByName)
  if (!name || !brand || !createdAt || !createdByUserId || !createdByName) return null

  const category = parseOptionalString(data.category) || 'Other'
  return {
    id: parseUuid(data.id, docId),
    name,
    brand,
    productCode: parseOptionalString(data.productCode),
    defaultUnit: parseMaterialUnit(data.defaultUnit),
    size: parseOptionalString(data.size),
    length: parseOptionalString(data.length) || parseOptionalString(data.sizeOrLength),
    lengthUnit: parseLengthUnit(data.lengthUnit),
    category,
    createdAt,
    createdByUserId,
    createdByName,
  }
}

function materialPayload(item: Omit<MaterialCatalogItem, 'createdAt'> & { createdAt?: Date }) {
  const payload: Record<string, unknown> = {
    id: item.id,
    name: item.name.trim(),
    brand: item.brand.trim(),
    defaultUnit: item.defaultUnit,
    category: item.category.trim() || 'Other',
    createdAt: Timestamp.fromDate(item.createdAt || new Date()),
    createdByUserId: item.createdByUserId,
    createdByName: item.createdByName,
  }
  if (item.productCode?.trim()) payload.productCode = item.productCode.trim()
  if (item.size?.trim()) payload.size = item.size.trim()
  if (item.length?.trim()) {
    payload.length = item.length.trim()
    payload.sizeOrLength = item.length.trim()
  }
  if (item.lengthUnit) payload.lengthUnit = item.lengthUnit
  return payload
}

interface MaterialCatalogState {
  items: MaterialCatalogItem[]
  loading: boolean
  error: string | null
  loadItems: (organizationId: string) => Promise<void>
  saveItem: (organizationId: string, item: Omit<MaterialCatalogItem, 'createdAt'> & { createdAt?: Date }) => Promise<void>
  deleteItem: (organizationId: string, id: string) => Promise<void>
}

export const useMaterialCatalogStore = create<MaterialCatalogState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  loadItems: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const ref = collection(db, 'organizations', organizationId, 'materialCatalogue')
      const snapshot = await getDocs(ref)
      const items = snapshot.docs
        .map((entry) => mapMaterialCatalogItem(entry.id, entry.data() as Record<string, unknown>))
        .filter((item): item is MaterialCatalogItem => item !== null)
        .sort((a, b) => a.name.localeCompare(b.name))
      set({ items, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load material catalogue', loading: false })
    }
  },

  saveItem: async (organizationId, item) => {
    const id = item.id || newUuid()
    const docRef = doc(db, 'organizations', organizationId, 'materialCatalogue', id)
    await setDoc(docRef, materialPayload({ ...item, id }))
    const { items } = get()
    const mapped = mapMaterialCatalogItem(id, materialPayload({ ...item, id, createdAt: item.createdAt || new Date() }))
    if (!mapped) return
    const next = [...items.filter((entry) => entry.id !== id), mapped].sort((a, b) => a.name.localeCompare(b.name))
    set({ items: next })
  },

  deleteItem: async (organizationId, id) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'materialCatalogue', id))
    set({ items: get().items.filter((item) => item.id !== id) })
  },
}))

export { MATERIAL_UNITS }
