/**
 * iOS parity source: FirebaseBackend.swift qualifications save (~3168)
 * Spec: docs/ios-parity/sections/05-qualifications.md
 */
import { collection, deleteDoc, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import type { Qualification } from '@/types'

export async function loadOrganisationQualifications(organizationId: string): Promise<Qualification[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'qualifications'))
  return snapshot.docs
    .map((entry) => {
      const data = entry.data()
      return {
        id: entry.id,
        name: String(data.name || ''),
        hasEndDate: data.hasEndDate === true,
        endDate: data.endDate?.toDate?.(),
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } satisfies Qualification
    })
    .filter((row) => row.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function qualificationNameTaken(name: string, existing: Qualification[], ignoreId?: string): boolean {
  const needle = name.trim().toLowerCase()
  return existing.some((row) => row.id !== ignoreId && row.name.trim().toLowerCase() === needle)
}

export async function saveOrganisationQualification(
  organizationId: string,
  input: { id?: string; name: string; createdAt?: Date }
): Promise<Qualification> {
  const now = new Date()
  const id = input.id || newUuid()
  const payload: Qualification = {
    id,
    name: input.name.trim(),
    hasEndDate: false,
    createdAt: input.createdAt || now,
    updatedAt: now,
  }
  await setDoc(doc(db, 'organizations', organizationId, 'qualifications', id), {
    name: payload.name,
    hasEndDate: false,
    createdAt: Timestamp.fromDate(payload.createdAt),
    updatedAt: Timestamp.fromDate(payload.updatedAt),
  })
  return payload
}

export async function deleteOrganisationQualification(organizationId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'organizations', organizationId, 'qualifications', id))
}
