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
import type { Subcontractor, SubcontractorContact } from '@/types'
import { newUuid, parseFirestoreDate, parseOptionalString, parseString, parseUuid } from '@/lib/firebase/firestoreUtils'

function parseContacts(rows: unknown): SubcontractorContact[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const data = row as Record<string, unknown>
      const name = parseString(data.name)
      const email = parseString(data.email)
      const contactNumber = parseString(data.contactNumber)
      const position = parseString(data.position, 'Installer')
      const createdAt = parseFirestoreDate(data.createdAt)
      if (!name || !createdAt) return null
      return {
        id: parseUuid(data.id),
        name,
        email,
        contactNumber,
        position,
        createdAt,
      } satisfies SubcontractorContact
    })
    .filter((contact): contact is SubcontractorContact => contact !== null)
}

function mapSubcontractor(docId: string, data: Record<string, unknown>): Subcontractor | null {
  const name = parseString(data.name)
  const subcontractorType = parseString(data.subcontractorType)
  const createdAt = parseFirestoreDate(data.createdAt)
  const updatedAt = parseFirestoreDate(data.updatedAt)
  if (!name || !subcontractorType || !createdAt || !updatedAt) return null

  return {
    id: parseUuid(data.id, docId),
    name,
    subcontractorType,
    website: parseOptionalString(data.website),
    address: parseOptionalString(data.address),
    contacts: parseContacts(data.contacts),
    createdAt,
    updatedAt,
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

export const useSubcontractorStore = create<SubcontractorState>((set, get) => ({
  subcontractors: [],
  loading: false,
  error: null,

  loadSubcontractors: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const ref = collection(db, 'organizations', organizationId, 'subcontractors')
      const snapshot = await getDocs(ref)
      const subcontractors = snapshot.docs
        .map((entry) => mapSubcontractor(entry.id, entry.data() as Record<string, unknown>))
        .filter((item): item is Subcontractor => item !== null)
        .sort((a, b) => a.name.localeCompare(b.name))
      set({ subcontractors, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load subcontractors', loading: false })
    }
  },

  saveSubcontractor: async (organizationId, subcontractor) => {
    const id = subcontractor.id || newUuid()
    const payload = subcontractorPayload({ ...subcontractor, id, updatedAt: new Date() })
    await setDoc(doc(db, 'organizations', organizationId, 'subcontractors', id), payload)
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
    set({ subcontractors: get().subcontractors.filter((s) => s.id !== id) })
  },
}))
