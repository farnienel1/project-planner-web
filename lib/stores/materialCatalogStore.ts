'use client'

import { create } from 'zustand'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import {
  MATERIAL_UNITS as CANONICAL_MATERIAL_UNITS,
  materialCatalogueItemFields,
  materialCatalogueItemWriteFields,
  materialCatalogueWrites,
  parseMaterialCatalogueDocument,
} from '@/lib/canonical'
import { firestoreUpdateFields, savePartialDocument } from '@/lib/firebase/partialWrite'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { useAuthStore } from '@/lib/stores/authStore'
import { db } from '@/lib/firebase/config'
import type { MaterialCatalogItem, MaterialLengthUnit, MaterialUnit } from '@/types'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'

const MATERIAL_UNITS: MaterialUnit[] = [...CANONICAL_MATERIAL_UNITS] as MaterialUnit[]

/** `materialCatalogue/{id}` through the rulebook reader `parseMaterialCatalogueDocument` (rulebook 1.8.0). */
function mapMaterialCatalogItem(docId: string, data: Record<string, unknown>): MaterialCatalogItem | null {
  const parsed = parseMaterialCatalogueDocument(docId, data)
  if (!parsed) return null
  return {
    id: parsed.id,
    name: parsed.name,
    brand: parsed.brand,
    productCode: parsed.productCode ?? undefined,
    defaultUnit: parsed.defaultUnit as MaterialUnit,
    size: parsed.size ?? undefined,
    length: parsed.length ?? undefined,
    lengthUnit: (parsed.lengthUnit ?? undefined) as MaterialLengthUnit | undefined,
    category: parsed.category,
    createdAt: parsed.createdAtMs != null ? new Date(parsed.createdAtMs) : new Date(),
    createdByUserId: parsed.createdByUserId || 'unknown',
    createdByName: parsed.createdByName || 'Unknown',
  }
}

type CatalogueItemInput = Omit<MaterialCatalogItem, 'createdAt'> & { createdAt?: Date }

/** The stored shape (`materialCatalogueItemFields`); creator fields and `createdAt` are only written on create. */
function materialPayload(item: CatalogueItemInput): Record<string, unknown> {
  return materialCatalogueItemFields({
    ...item,
    createdAt: Timestamp.fromDate(item.createdAt || new Date()),
  })
}

interface MaterialCatalogState {
  items: MaterialCatalogItem[]
  loading: boolean
  error: string | null
  loadItems: (organizationId: string) => Promise<void>
  saveItem: (organizationId: string, item: Omit<MaterialCatalogItem, 'createdAt'> & { createdAt?: Date }) => Promise<void>
  deleteItem: (organizationId: string, id: string) => Promise<void>
  replaceAllItems: (
    organizationId: string,
    items: Array<Omit<MaterialCatalogItem, 'createdAt'> & { createdAt?: Date }>
  ) => Promise<void>
}

let materialCatalogOrgId = ''

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
      const previous = materialCatalogOrgId === organizationId ? get().items : []
      const kept = retainScopedRows(`materialCatalogue:${organizationId}`, previous, items)
      materialCatalogOrgId = organizationId
      set({ items: kept, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load material catalogue', loading: false })
    }
  },

  saveItem: async (organizationId, item) => {
    const id = item.id || newUuid()
    const docRef = doc(db, 'organizations', organizationId, 'materialCatalogue', id)
    // Rulebook 1.8.0 §1: a partial update of the fields that changed (`materialCatalogueItemWriteFields`).
    await savePartialDocument(docRef, materialPayload({ ...item, id }), materialCatalogueItemWriteFields, {
      userId: useAuthStore.getState().user?.id,
    })
    const { items } = get()
    const mapped = mapMaterialCatalogItem(id, materialPayload({ ...item, id, createdAt: item.createdAt || new Date() }))
    if (!mapped) return
    const next = [...items.filter((entry) => entry.id !== id), mapped].sort((a, b) => a.name.localeCompare(b.name))
    set({ items: next })
  },

  deleteItem: async (organizationId, id) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'materialCatalogue', id))
    markRowsRemoved(`materialCatalogue:${organizationId}`, [id])
    set({ items: get().items.filter((item) => item.id !== id) })
  },

  replaceAllItems: async (organizationId, items) => {
    // Rulebook 1.8.0 §1 (`materialCatalogueWrites`): never delete-all and rewrite. Only changed items are written,
    // and an item missing from the list is deleted only after a successful fresh read of the catalogue and when the
    // list is not empty.
    const collectionRef = collection(db, 'organizations', organizationId, 'materialCatalogue')
    let stored: Array<{ id: string; data: Record<string, unknown> }> = []
    let loaded = false
    try {
      const snapshot = await getDocs(collectionRef)
      stored = snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
      loaded = true
    } catch {
      loaded = false
    }
    const next = items.map((item) => {
      const id = item.id || newUuid()
      return { ...materialPayload({ ...item, id }), id, name: item.name } as Parameters<typeof materialCatalogueWrites>[0]['next'][number]
    })
    const plan = materialCatalogueWrites({ stored, next, loaded })
    const metadata = writeMetadataFields(useAuthStore.getState().user?.id, 'web') ?? {}
    const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = []
    for (const entry of plan.write) {
      const ref = doc(collectionRef, entry.id)
      if (entry.create) {
        operations.push((batch) => batch.set(ref, { ...entry.set, updatedAt: serverTimestamp(), ...metadata }))
      } else {
        operations.push((batch) =>
          batch.update(ref, { ...firestoreUpdateFields(entry), updatedAt: serverTimestamp(), ...metadata })
        )
      }
    }
    for (const id of plan.remove) operations.push((batch) => batch.delete(doc(collectionRef, id)))
    for (let index = 0; index < operations.length; index += 400) {
      const batch = writeBatch(db)
      for (const apply of operations.slice(index, index + 400)) apply(batch)
      await batch.commit()
    }
    if (plan.remove.length > 0) markRowsRemoved(`materialCatalogue:${organizationId}`, plan.remove)
    await get().loadItems(organizationId)
  },
}))

export { MATERIAL_UNITS }
