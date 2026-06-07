'use client'

import { create } from 'zustand'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { OrgCollectionKey } from '@/lib/firebase/orgCollections'
import { ORG_COLLECTIONS } from '@/lib/firebase/orgCollections'

export type CatalogRecord = {
  id: string
  name: string
  subtitle?: string
  raw: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}

interface CatalogState {
  records: CatalogRecord[]
  loading: boolean
  error: string | null
  loadCatalog: (organizationId: string, collectionKey: OrgCollectionKey) => Promise<void>
  addRecord: (
    organizationId: string,
    collectionKey: OrgCollectionKey,
    data: Record<string, unknown>
  ) => Promise<void>
  updateRecord: (
    organizationId: string,
    collectionKey: OrgCollectionKey,
    id: string,
    data: Record<string, unknown>
  ) => Promise<void>
  deleteRecord: (organizationId: string, collectionKey: OrgCollectionKey, id: string) => Promise<void>
}

function displayName(data: Record<string, unknown>): string {
  const candidates = [
    data.name,
    data.title,
    data.label,
    data.siteName,
    data.reference,
    data.jobNumber,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return 'Untitled'
}

function displaySubtitle(data: Record<string, unknown>): string | undefined {
  const candidates = [data.email, data.status, data.description, data.notes, data.trade]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function mapDoc(id: string, data: Record<string, unknown>): CatalogRecord {
  return {
    id,
    name: displayName(data),
    subtitle: displaySubtitle(data),
    raw: data,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.(),
  }
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  records: [],
  loading: false,
  error: null,

  loadCatalog: async (organizationId, collectionKey) => {
    set({ loading: true, error: null })
    try {
      const collectionName = ORG_COLLECTIONS[collectionKey]
      const ref = collection(db, 'organizations', organizationId, collectionName)
      const snapshot = await getDocs(ref)
      const records = snapshot.docs.map((item) =>
        mapDoc(item.id, item.data() as Record<string, unknown>)
      )
      records.sort((a, b) => a.name.localeCompare(b.name))
      set({ records, loading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load data'
      set({ error: message, loading: false })
    }
  },

  addRecord: async (organizationId, collectionKey, data) => {
    const collectionName = ORG_COLLECTIONS[collectionKey]
    const ref = collection(db, 'organizations', organizationId, collectionName)
    const payload = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }
    const docRef = await addDoc(ref, payload)
    const { records } = get()
    set({
      records: [
        ...records,
        mapDoc(docRef.id, { ...data, createdAt: new Date(), updatedAt: new Date() }),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  updateRecord: async (organizationId, collectionKey, id, data) => {
    const collectionName = ORG_COLLECTIONS[collectionKey]
    const docRef = doc(db, 'organizations', organizationId, collectionName, id)
    await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() })
    const { records } = get()
    set({
      records: records
        .map((record) =>
          record.id === id
            ? mapDoc(id, { ...record.raw, ...data, updatedAt: new Date() })
            : record
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  deleteRecord: async (organizationId, collectionKey, id) => {
    const collectionName = ORG_COLLECTIONS[collectionKey]
    const docRef = doc(db, 'organizations', organizationId, collectionName, id)
    await deleteDoc(docRef)
    set({ records: get().records.filter((record) => record.id !== id) })
  },
}))
