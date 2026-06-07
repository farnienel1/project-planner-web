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
import type { Wholesaler, WholesalerContact } from '@/types'
import { newUuid, parseFirestoreDate, parseOptionalString, parseString, parseUuid } from '@/lib/firebase/firestoreUtils'

function parseContacts(rows: unknown): WholesalerContact[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const data = row as Record<string, unknown>
      const name = parseString(data.name)
      const email = parseString(data.email)
      const createdAt = parseFirestoreDate(data.createdAt)
      if (!name || !email || !createdAt) return null
      return {
        id: parseUuid(data.id),
        name,
        email,
        isPrimary: data.isPrimary === true,
        createdAt,
      } satisfies WholesalerContact
    })
    .filter((contact): contact is WholesalerContact => contact !== null)
}

function mapWholesaler(docId: string, data: Record<string, unknown>): Wholesaler | null {
  const name = parseString(data.name)
  const createdAt = parseFirestoreDate(data.createdAt)
  const updatedAt = parseFirestoreDate(data.updatedAt)
  if (!name || !createdAt || !updatedAt) return null

  let contacts = parseContacts(data.contacts)
  const primaryId = parseOptionalString(data.primaryContactId)
  if (primaryId && contacts.some((c) => c.id === primaryId)) {
    contacts = contacts.map((c) => ({ ...c, isPrimary: c.id === primaryId }))
  } else if (contacts.length > 0 && !contacts.some((c) => c.isPrimary)) {
    contacts = contacts.map((c, index) => ({ ...c, isPrimary: index === 0 }))
  }

  return {
    id: parseUuid(data.id, docId),
    name,
    address: parseOptionalString(data.address),
    trade: parseOptionalString(data.trade),
    accountNumber: parseOptionalString(data.accountNumber),
    primaryContactId: primaryId || contacts.find((c) => c.isPrimary)?.id,
    contacts,
    createdAt,
    updatedAt,
  }
}

function wholesalerPayload(wholesaler: Wholesaler) {
  return {
    id: wholesaler.id,
    name: wholesaler.name.trim(),
    address: wholesaler.address?.trim() || null,
    trade: wholesaler.trade?.trim() || null,
    accountNumber: wholesaler.accountNumber?.trim() || null,
    primaryContactId: wholesaler.primaryContactId || null,
    contacts: wholesaler.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name.trim(),
      email: contact.email.trim(),
      isPrimary: contact.isPrimary,
      createdAt: Timestamp.fromDate(contact.createdAt),
    })),
    createdAt: Timestamp.fromDate(wholesaler.createdAt),
    updatedAt: Timestamp.fromDate(wholesaler.updatedAt),
  }
}

interface WholesalerState {
  wholesalers: Wholesaler[]
  loading: boolean
  error: string | null
  loadWholesalers: (organizationId: string) => Promise<void>
  saveWholesaler: (organizationId: string, wholesaler: Wholesaler) => Promise<void>
  deleteWholesaler: (organizationId: string, id: string) => Promise<void>
}

export const useWholesalerStore = create<WholesalerState>((set, get) => ({
  wholesalers: [],
  loading: false,
  error: null,

  loadWholesalers: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const ref = collection(db, 'organizations', organizationId, 'wholesalers')
      const snapshot = await getDocs(ref)
      const wholesalers = snapshot.docs
        .map((entry) => mapWholesaler(entry.id, entry.data() as Record<string, unknown>))
        .filter((item): item is Wholesaler => item !== null)
        .sort((a, b) => a.name.localeCompare(b.name))
      set({ wholesalers, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load wholesalers', loading: false })
    }
  },

  saveWholesaler: async (organizationId, wholesaler) => {
    const id = wholesaler.id || newUuid()
    const payload = wholesalerPayload({ ...wholesaler, id, updatedAt: new Date() })
    await setDoc(doc(db, 'organizations', organizationId, 'wholesalers', id), payload)
    const mapped = mapWholesaler(id, payload as unknown as Record<string, unknown>)
    if (!mapped) return
    const { wholesalers } = get()
    set({
      wholesalers: [...wholesalers.filter((w) => w.id !== id), mapped].sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  deleteWholesaler: async (organizationId, id) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'wholesalers', id))
    set({ wholesalers: get().wholesalers.filter((w) => w.id !== id) })
  },
}))

export { newUuid as newWholesalerId }
