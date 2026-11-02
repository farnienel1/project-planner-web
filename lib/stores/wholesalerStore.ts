'use client'

import { create } from 'zustand'
import { deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { parseWholesalerDocument, wholesalerWriteFields } from '@/lib/canonical'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { useAuthStore } from '@/lib/stores/authStore'
import { db } from '@/lib/firebase/config'
import type { Wholesaler, WholesalerContact } from '@/types'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { forgetOrgCollectionDoc, subscribeOrgCollectionLoaded } from '@/lib/firebase/subscribeOrgCollection'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'

/** `wholesalers/{id}` through the rulebook reader `parseWholesalerDocument` (rulebook 1.8.0). */
function mapWholesaler(docId: string, data: Record<string, unknown>): Wholesaler | null {
  const parsed = parseWholesalerDocument(docId, data)
  if (!parsed) return null
  const createdAt = parsed.createdAtMs != null ? new Date(parsed.createdAtMs) : new Date()
  return {
    id: parsed.id,
    name: parsed.name,
    address: parsed.address ?? undefined,
    trade: parsed.trade ?? undefined,
    accountNumber: parsed.accountNumber ?? undefined,
    primaryContactId: parsed.primaryContactId ?? undefined,
    contacts: parsed.contacts.map((contact) => {
      const row: WholesalerContact = {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        isPrimary: contact.isPrimary,
        createdAt: contact.createdAtMs != null ? new Date(contact.createdAtMs) : createdAt,
      }
      if (contact.phone) row.phone = contact.phone
      return row
    }),
    createdAt,
    updatedAt: parsed.updatedAtMs != null ? new Date(parsed.updatedAtMs) : createdAt,
  }
}

function wholesalerPayload(wholesaler: Wholesaler): Record<string, unknown> {
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
      phone: contact.phone?.trim() || null,
      createdAt: Timestamp.fromDate(contact.createdAt),
    })),
    createdAt: Timestamp.fromDate(wholesaler.createdAt),
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

let wholesalerOrgId = ''

export const useWholesalerStore = create<WholesalerState>((set, get) => ({
  wholesalers: [],
  loading: false,
  error: null,

  loadWholesalers: async (organizationId) => {
    if (!organizationId) return
    if (wholesalerOrgId !== organizationId || get().wholesalers.length === 0) set({ loading: true, error: null })
    try {
      // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): a live listener; the load resolves on its first snapshot.
      await subscribeOrgCollectionLoaded('wholesalerStore:wholesalers', organizationId, 'wholesalers', (docs) => {
        if (!liveResultStillCurrent(organizationId)) return
        const mapped = docs
          .map((entry) => mapWholesaler(entry.id, entry.data))
          .filter((item): item is Wholesaler => item !== null)
          .sort((a, b) => a.name.localeCompare(b.name))
        const previous = wholesalerOrgId === organizationId ? get().wholesalers : []
        const kept = retainScopedRows(`wholesalers:${organizationId}`, previous, mapped)
        wholesalerOrgId = organizationId
        set({ wholesalers: kept, loading: false })
      })
      set({ loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load wholesalers', loading: false })
    }
  },

  saveWholesaler: async (organizationId, wholesaler) => {
    const id = wholesaler.id || newUuid()
    const payload = wholesalerPayload({ ...wholesaler, id })
    // Rulebook 1.8.0 §1: partial update (`wholesalerWriteFields`; contacts with the primary contact together).
    await savePartialDocument(doc(db, 'organizations', organizationId, 'wholesalers', id), payload, wholesalerWriteFields, {
      userId: useAuthStore.getState().user?.id,
      // Rulebook 1.9.0: an edit of a wholesaler deleted elsewhere is refused, never re-created.
      missing: get().wholesalers.some((row) => row.id === id) ? 'refuse' : 'create',
    })
    const mapped = mapWholesaler(id, { ...payload, updatedAt: Timestamp.now() })
    if (!mapped) return
    const { wholesalers } = get()
    set({
      wholesalers: [...wholesalers.filter((w) => w.id !== id), mapped].sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  deleteWholesaler: async (organizationId, id) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'wholesalers', id))
    markRowsRemoved(`wholesalers:${organizationId}`, [id])
    forgetOrgCollectionDoc('wholesalerStore:wholesalers', organizationId, id)
    set({ wholesalers: get().wholesalers.filter((w) => w.id !== id) })
  },
}))

export { newUuid as newWholesalerId }
