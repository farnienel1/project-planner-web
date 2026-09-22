/**
 * iOS parity source: FirebaseBackend.swift qualifications save (~3168) and load (~3221)
 * Spec: docs/ios-parity/sections/05-qualifications.md
 *
 * iOS loadQualifications requires name + hasEndDate + createdAt + updatedAt as exact types.
 * Docs missing hasEndDate as Bool are skipped, so Organisation Qualifications looks empty
 * while assignments on operative profiles still have names. iOS saveQualifications then
 * deletes the whole collection and rewrites the in-memory list — an empty load followed
 * by any save wipes templates. Expiry dates live on operative assignment maps, not templates.
 */
import { collection, deleteDoc, doc, getDocs, getDocsFromServer, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { newUuid, parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import type { Operative, Qualification } from '@/types'

function parseQualificationDoc(id: string, data: Record<string, unknown>): Qualification | null {
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name) return null
  const createdAt = parseFirestoreDate(data.createdAt) || new Date(0)
  const updatedAt = parseFirestoreDate(data.updatedAt) || createdAt || new Date()
  return {
    id,
    name,
    hasEndDate: data.hasEndDate === true,
    endDate: parseFirestoreDate(data.endDate),
    createdAt,
    updatedAt,
  }
}

export function assignedQualificationTemplates(operatives: Operative[]): Qualification[] {
  const byName = new Map<string, Qualification>()
  for (const operative of operatives) {
    for (const row of operative.qualifications || []) {
      const name = String(row?.name || '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (byName.has(key)) continue
      const id = String(row.id || '').trim() || newUuid()
      byName.set(key, {
        id,
        name,
        hasEndDate: false,
        createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
        updatedAt: new Date(),
      })
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function mergeQualificationTemplates(existing: Qualification[], assigned: Qualification[]): Qualification[] {
  const byName = new Map<string, Qualification>()
  for (const row of [...existing, ...assigned]) {
    const key = row.name.trim().toLowerCase()
    if (!key) continue
    if (!byName.has(key)) byName.set(key, row)
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function loadOrganisationQualifications(
  organizationId: string,
  options?: { fromServer?: boolean }
): Promise<Qualification[]> {
  const ref = collection(db, 'organizations', organizationId, 'qualifications')
  const snapshot = options?.fromServer
    ? await getDocsFromServer(ref).catch(() => getDocs(ref))
    : await getDocs(ref)
  return snapshot.docs
    .map((entry) => parseQualificationDoc(entry.id, entry.data() as Record<string, unknown>))
    .filter((row): row is Qualification => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** Re-create org templates from names still assigned on staff. Does not delete anything. */
export async function restoreOrganisationQualificationsFromAssignments(
  organizationId: string,
  operatives: Operative[]
): Promise<Qualification[]> {
  const existing = await loadOrganisationQualifications(organizationId)
  const assigned = assignedQualificationTemplates(operatives)
  const merged = mergeQualificationTemplates(existing, assigned)
  const existingNames = new Set(existing.map((row) => row.name.trim().toLowerCase()))
  for (const row of merged) {
    if (existingNames.has(row.name.trim().toLowerCase())) continue
    await saveOrganisationQualification(organizationId, {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
    })
  }
  return loadOrganisationQualifications(organizationId)
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
