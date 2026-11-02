'use client'

import { create } from 'zustand'
import {
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { parseSubcontractorDocument, subcontractorWriteFields } from '@/lib/canonical/peopleDocuments'
import type { Subcontractor, SubcontractorContact } from '@/types'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'
import { forgetOrgCollectionDoc, subscribeOrgCollectionLoaded } from '@/lib/firebase/subscribeOrgCollection'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'

const SUBCONTRACTOR_LOAD_KEY = 'subcontractorStore:subcontractors'

/** `subcontractors/{id}` through the rulebook reader `parseSubcontractorDocument` (rulebook 1.6.0). */
function mapSubcontractor(docId: string, data: Record<string, unknown>): Subcontractor | null {
  const parsed = parseSubcontractorDocument(docId, data)
  if (!parsed) return null
  const createdAt = parsed.createdAtMs != null ? new Date(parsed.createdAtMs) : new Date()
  return {
    id: parsed.id,
    name: parsed.name,
    subcontractorType: parsed.subcontractorType,
    website: parsed.website ?? undefined,
    address: parsed.address ?? undefined,
    contacts: parsed.contacts.map((contact) => {
      const row: SubcontractorContact = {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        contactNumber: contact.contactNumber,
        position: contact.position,
        createdAt: contact.createdAtMs != null ? new Date(contact.createdAtMs) : new Date(),
      }
      if (contact.tradeType) row.tradeType = contact.tradeType
      return row
    }),
    createdAt,
    updatedAt: parsed.updatedAtMs != null ? new Date(parsed.updatedAtMs) : createdAt,
  }
}

function subcontractorPayload(subcontractor: Subcontractor) {
  return {
    id: subcontractor.id,
    name: subcontractor.name.trim(),
    subcontractorType: subcontractor.subcontractorType.trim(),
    website: subcontractor.website?.trim() || null,
    address: subcontractor.address?.trim() || null,
    contacts: subcontractor.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name.trim(),
      email: contact.email.trim(),
      contactNumber: contact.contactNumber.trim(),
      position: contact.position,
      tradeType: contact.tradeType?.trim() || null,
      createdAt: Timestamp.fromDate(contact.createdAt),
    })),
    createdAt: Timestamp.fromDate(subcontractor.createdAt),
    updatedAt: Timestamp.fromDate(subcontractor.updatedAt),
  }
}

interface SubcontractorState {
  subcontractors: Subcontractor[]
  loading: boolean
  error: string | null
  loadSubcontractors: (organizationId: string) => Promise<void>
  saveSubcontractor: (organizationId: string, subcontractor: Subcontractor) => Promise<void>
  deleteSubcontractor: (organizationId: string, id: string) => Promise<void>
}

let subcontractorOrgId = ''

export const useSubcontractorStore = create<SubcontractorState>((set, get) => ({
  subcontractors: [],
  loading: false,
  error: null,

  // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): subcontractors are a live listener; the load resolves on its first snapshot.
  loadSubcontractors: async (organizationId) => {
    if (!organizationId) return
    if (get().subcontractors.length === 0 || subcontractorOrgId !== organizationId) set({ loading: true, error: null })
    else set({ error: null })
    try {
      await subscribeOrgCollectionLoaded(SUBCONTRACTOR_LOAD_KEY, organizationId, 'subcontractors', (docs) => {
        if (!liveResultStillCurrent(organizationId)) return
        const subcontractors = docs
          .map((entry) => mapSubcontractor(entry.id, entry.data))
          .filter((item): item is Subcontractor => item !== null)
          .sort((a, b) => a.name.localeCompare(b.name))
        const previous = subcontractorOrgId === organizationId ? get().subcontractors : []
        const kept = retainScopedRows(`subcontractors:${organizationId}`, previous, subcontractors)
        subcontractorOrgId = organizationId
        set({ subcontractors: kept, loading: false })
      })
      set({ loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load subcontractors', loading: false })
      throw error
    }
  },

  saveSubcontractor: async (organizationId, subcontractor) => {
    const id = subcontractor.id || newUuid()
    const payload = subcontractorPayload({ ...subcontractor, id, updatedAt: new Date() })
    // Partial update of the changed fields only (rulebook §1, `subcontractorWriteFields`).
    await savePartialDocument(
      doc(db, 'organizations', organizationId, 'subcontractors', id),
      payload,
      subcontractorWriteFields,
      // Rulebook 1.9.0: an edit of a subcontractor deleted elsewhere is refused, never re-created.
      { userId: auth?.currentUser?.uid, missing: get().subcontractors.some((row) => row.id === id) ? 'refuse' : 'create' }
    )
    const mapped = mapSubcontractor(id, payload as unknown as Record<string, unknown>)
    if (!mapped) return
    const { subcontractors } = get()
    set({
      subcontractors: [...subcontractors.filter((s) => s.id !== id), mapped].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    })
  },

  deleteSubcontractor: async (organizationId, id) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'subcontractors', id))
    markRowsRemoved(`subcontractors:${organizationId}`, [id])
    forgetOrgCollectionDoc(SUBCONTRACTOR_LOAD_KEY, organizationId, id)
    set({ subcontractors: get().subcontractors.filter((s) => s.id !== id) })
  },
}))
