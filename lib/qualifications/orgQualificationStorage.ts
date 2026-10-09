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

/** iOS EditOrganisationQualificationView.canSave — unchanged trimmed name cannot be saved. */
export function qualificationEditCanSave(name: string, original: string, saving = false): boolean {
  const trimmed = name.trim()
  if (!trimmed || saving) return false
  return trimmed !== original.trim()
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value == null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

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
    code: optionalString(data.code) || id,
    section: optionalString(data.section),
    subsection: optionalString(data.subsection),
    awardingBody: optionalString(data.awardingBody),
    level: optionalNumber(data.level) ?? (data.level === null ? null : undefined),
    renewYears: optionalNumber(data.renewYears) ?? (data.renewYears === null ? null : undefined),
    renewalType: optionalString(data.renewalType),
    status: optionalString(data.status),
    notes: optionalString(data.notes),
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
  operatives: Operative[],
  alreadyLoaded?: Qualification[]
): Promise<Qualification[]> {
  const existing = alreadyLoaded ?? (await loadOrganisationQualifications(organizationId))
  const assigned = assignedQualificationTemplates(operatives)
  const merged = mergeQualificationTemplates(existing, assigned)
  const existingNames = new Set(existing.map((row) => row.name.trim().toLowerCase()))
  const missing = merged.filter((row) => !existingNames.has(row.name.trim().toLowerCase()))
  if (missing.length === 0) return merged
  await Promise.all(
    missing.map((row) =>
      saveOrganisationQualification(organizationId, {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt,
      })
    )
  )
  return loadOrganisationQualifications(organizationId)
}

export function qualificationNameTaken(name: string, existing: Qualification[], ignoreId?: string): boolean {
  const needle = name.trim().toLowerCase()
  return existing.some((row) => row.id !== ignoreId && row.name.trim().toLowerCase() === needle)
}

/**
 * iOS saveQualification always writes name, hasEndDate, createdAt, and updatedAt.
 * Assigned qualifications are skipped on iOS unless hasEndDate is a Bool and both dates are Timestamps.
 */
export function qualificationTemplateFirestoreFields(input: {
  name: string
  hasEndDate?: boolean
  createdAt?: Date
  updatedAt?: Date
  endDate?: Date | null
  code?: string
  section?: string
  subsection?: string
  awardingBody?: string
  level?: number | null
  renewYears?: number | null
  renewalType?: string
  status?: string
  notes?: string
}): Record<string, unknown> {
  const now = input.updatedAt || new Date()
  const createdAt = input.createdAt || now
  const fields: Record<string, unknown> = {
    name: input.name.trim(),
    hasEndDate: input.hasEndDate === true,
    createdAt: Timestamp.fromDate(createdAt),
    updatedAt: Timestamp.fromDate(now),
  }
  if (input.endDate) fields.endDate = Timestamp.fromDate(input.endDate)
  if (input.code?.trim()) fields.code = input.code.trim()
  if (input.section?.trim()) fields.section = input.section.trim()
  if (input.subsection?.trim()) fields.subsection = input.subsection.trim()
  if (input.awardingBody?.trim()) fields.awardingBody = input.awardingBody.trim()
  if (input.level != null && Number.isFinite(input.level)) fields.level = input.level
  if (input.renewYears != null && Number.isFinite(input.renewYears)) fields.renewYears = input.renewYears
  if (input.renewalType?.trim()) fields.renewalType = input.renewalType.trim()
  if (input.status?.trim()) fields.status = input.status.trim()
  if (input.notes?.trim()) fields.notes = input.notes.trim()
  return fields
}

export async function saveOrganisationQualification(
  organizationId: string,
  input: {
    id?: string
    name: string
    createdAt?: Date
    hasEndDate?: boolean
    endDate?: Date | null
    code?: string
    section?: string
    subsection?: string
    awardingBody?: string
    level?: number | null
    renewYears?: number | null
    renewalType?: string
    status?: string
    notes?: string
  }
): Promise<Qualification> {
  const now = new Date()
  const id = input.id || input.code?.trim() || newUuid()
  const payload: Qualification = {
    id,
    name: input.name.trim(),
    hasEndDate: input.hasEndDate === true,
    endDate: input.endDate || undefined,
    createdAt: input.createdAt || now,
    updatedAt: now,
    code: input.code?.trim() || undefined,
    section: input.section?.trim() || undefined,
    subsection: input.subsection?.trim() || undefined,
    awardingBody: input.awardingBody?.trim() || undefined,
    level: input.level,
    renewYears: input.renewYears,
    renewalType: input.renewalType?.trim() || undefined,
    status: input.status?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  }
  const fields = qualificationTemplateFirestoreFields(payload)
  await setDoc(doc(db, 'organizations', organizationId, 'qualifications', id), fields, { merge: true })
  return payload
}

export async function deleteOrganisationQualification(organizationId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'organizations', organizationId, 'qualifications', id))
}
