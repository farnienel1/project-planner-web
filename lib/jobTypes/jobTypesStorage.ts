/**
 * iOS parity source: Views/JobTypesManagementView.swift, FirebaseBackend.swift setData jobTypes
 * Spec: docs/ios-parity/sections/04-job-types.md
 *
 * iOS overwrites settings/jobTypes with the in-memory set. An empty load plus save wipes the
 * catalogue while projects/small works still keep customJobType / jobType. Web unions those
 * names into the stored list even when the catalogue is not empty, then refuses to persist
 * an empty overwrite. Recommended iOS enum names (CAT A, CAT B, Small Works, Maintenance)
 * plus Decarbonisation (a custom type this organisation already used) are always re-seeded
 * if missing.
 */
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore'
import { watchOrgDocument } from '@/lib/firebase/watchOrgQuery'
import { auth, db } from '@/lib/firebase/config'
import {
  canonicalJobTypeName as rulebookCanonicalJobTypeName,
  coerceJobTypeList as rulebookCoerceJobTypeList,
  jobTypesChangeWriteFields,
  mergeJobTypeCatalogues as rulebookMergeJobTypeCatalogues,
  parseJobTypesDocument,
  stringFromJobTypeField as rulebookStringFromJobTypeField,
} from '@/lib/canonical'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { readOrganizationDocument } from '@/lib/firebase/orgDocumentCache'
import { ORG_SETTINGS_JOB_TYPES_DOC } from '@/lib/firebase/orgCollections'
import { unionUniqueStrings } from '@/lib/catalogues/catalogueWriteGuard'
import { DEFAULT_JOB_TYPES } from '@/types'
import { isLegacyPlaceholderDocumentId } from '@/lib/projects/legacyPlaceholderWork'

/** iOS enum names plus custom types this organisation already used that the empty overwrite dropped. */
export const RESTORED_JOB_TYPES = [...DEFAULT_JOB_TYPES, 'Decarbonisation'] as const

export function jobTypesFromWorkRecords(
  records: Array<{ jobType?: string; customJobType?: string }>
): string[] {
  const names: string[] = []
  for (const record of records) {
    if (record.customJobType?.trim()) names.push(canonicalJobTypeName(record.customJobType.trim()))
    if (record.jobType?.trim()) names.push(canonicalJobTypeName(record.jobType.trim()))
  }
  return unionUniqueStrings([], names)
}

const JOB_TYPE_ALIASES: Record<string, string> = {
  cata: 'CAT A',
  categorya: 'CAT A',
  catafitout: 'CAT A',
  catafit: 'CAT A',
  catb: 'CAT B',
  categoryb: 'CAT B',
  catbfitout: 'CAT B',
  smallworks: 'Small Works',
  smallwork: 'Small Works',
  maintenance: 'Maintenance',
  decarbonisation: 'Decarbonisation',
  decarbonization: 'Decarbonisation',
}

/** Rulebook 1.8.0 `canonicalJobTypeName` (`lib/canonical/operationsDocuments.ts`). */
export function canonicalJobTypeName(name: string): string {
  return rulebookCanonicalJobTypeName(name)
}

/**
 * Card and workspace badge. Keep a typed custom name such as "De-Carbonisation".
 * Map enum tokens (`smallWorks`, `catA`) onto the iOS raw value.
 */
export function visibleJobTypeLabel(jobType?: string | null, customJobType?: string | null): string {
  const custom = (customJobType || '').trim()
  if (custom) {
    if (!/[\s\-]/.test(custom)) {
      const compact = custom.replace(/[_]+/g, '').toLowerCase()
      const alias = JOB_TYPE_ALIASES[compact]
      if (alias) return alias
    }
    return custom
  }
  const raw = (jobType || '').trim()
  if (!raw) return ''
  return canonicalJobTypeName(raw)
}

/**
 * iOS ScheduleOperativeView schedule card: custom type, otherwise "Small works" or "Project".
 * The stored enum (`CAT A`) is not the label once a custom type is set.
 */
export function scheduleWorkKindLabel(project: { jobType?: string | null; customJobType?: string | null }): string {
  if (canonicalJobTypeName(project.jobType || '') === 'Small Works') return 'Small works'
  const custom = (project.customJobType || '').trim()
  if (custom) return custom
  return 'Project'
}

/** Rulebook 1.8.0 `coerceJobTypeList`. */
export function coerceJobTypeList(raw: unknown): string[] {
  return rulebookCoerceJobTypeList(raw)
}

/** Rulebook 1.8.0 `mergeJobTypeCatalogues` (stored + recovered + the restored defaults). */
export function mergeJobTypeCatalogues(stored: string[], recovered: string[]): string[] {
  return rulebookMergeJobTypeCatalogues(stored, recovered)
}

export function jobTypeListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const other = new Set(right)
  return left.every((item) => other.has(item))
}

/** iOS CreateProjectView: catalogue display name vs collection enum. */
export function collectionJobTypeForName(
  name: string,
  collection: 'projects' | 'smallWorks'
): string {
  const canonical = canonicalJobTypeName(name)
  if (collection === 'smallWorks') return 'Small Works'
  if (canonical === 'Small Works') return 'CAT A'
  if ((DEFAULT_JOB_TYPES as readonly string[]).includes(canonical)) return canonical
  return 'CAT A'
}

/** Rulebook 1.8.0 `stringFromJobTypeField`. */
export function stringFromJobTypeField(value: unknown): string {
  return rulebookStringFromJobTypeField(value)
}

/** iOS catalogue names can live on jobType, customJobType, or older worksType fields. */
export function jobTypeFieldsFromRecord(data: Record<string, unknown>): {
  jobType?: string
  customJobType?: string
} {
  return {
    jobType:
      stringFromJobTypeField(data.jobType) ||
      stringFromJobTypeField(data.type) ||
      stringFromJobTypeField(data.worksType) ||
      stringFromJobTypeField(data.projectWorksType),
    customJobType: stringFromJobTypeField(data.customJobType) || stringFromJobTypeField(data.worksType),
  }
}

export async function loadJobTypes(organizationId: string): Promise<string[]> {
  if (!db) return [...RESTORED_JOB_TYPES]
  try {
    const [snap, orgSnap] = await Promise.all([
      getDoc(doc(db, 'organizations', organizationId, 'settings', ORG_SETTINGS_JOB_TYPES_DOC)),
      readOrganizationDocument(db, organizationId),
    ])
    const orgData = orgSnap.data() as Record<string, unknown> | undefined
    // Rulebook 1.8.0 `parseJobTypesDocument`: settings/jobTypes, then the organisation document's list.
    const names = parseJobTypesDocument(snap.data() as Record<string, unknown> | undefined, orgData ?? null).jobTypes
    if (names.length) rememberJobTypes(organizationId, names)
    return names
  } catch {
    return []
  }
}

async function loadWorkJobTypeRecords(
  organizationId: string
): Promise<Array<{ jobType?: string; customJobType?: string }>> {
  if (!db) return []
  try {
    const [projectsSnap, smallSnap] = await Promise.all([
      getDocs(collection(db, 'organizations', organizationId, 'projects')),
      getDocs(collection(db, 'organizations', organizationId, 'smallWorks')),
    ])
    return [...projectsSnap.docs, ...smallSnap.docs]
      .filter((entry) => !isLegacyPlaceholderDocumentId(entry.id))
      .map((entry) => jobTypeFieldsFromRecord(entry.data() as Record<string, unknown>))
  } catch {
    return []
  }
}

const jobTypesMemory = new Map<string, string[]>()

export function peekCachedJobTypes(organizationId: string): string[] | undefined {
  const names = jobTypesMemory.get(organizationId)
  return names ? [...names] : undefined
}

function rememberJobTypes(organizationId: string, names: string[]): void {
  jobTypesMemory.set(organizationId, [...names])
}

const recoveredJobTypesOrgs = new Set<string>()

/**
 * `loadedWork`: projects and small works the stores already hold for this organisation. When
 * given (and not empty) they are used instead of re-downloading both collections.
 */
export async function recoverJobTypesFromWork(
  organizationId: string,
  loadedWork?: ReadonlyArray<{ id: string; jobType?: string; customJobType?: string }>
): Promise<string[]> {
  if (recoveredJobTypesOrgs.has(organizationId)) {
    return peekCachedJobTypes(organizationId) || loadJobTypes(organizationId)
  }
  recoveredJobTypesOrgs.add(organizationId)
  const stored = await loadJobTypes(organizationId)
  const records =
    loadedWork && loadedWork.length > 0
      ? loadedWork
          .filter((work) => !isLegacyPlaceholderDocumentId(work.id))
          .map((work) => ({ jobType: work.jobType, customJobType: work.customJobType }))
      : await loadWorkJobTypeRecords(organizationId)
  const recovered = jobTypesFromWorkRecords(records)
  const merged = mergeJobTypeCatalogues(stored, recovered)
  // Rulebook 1.9.0 §1 "Never re-save what you didn't change": the recovered names are shown, never written on load.
  // They are saved when a manager saves the job type list (a user action).
  const names = merged.length > 0 ? merged : [...RESTORED_JOB_TYPES]
  rememberJobTypes(organizationId, names)
  return names
}

/**
 * Save the manager's explicit change (rulebook 1.10.0 `jobTypesChangeWriteFields`): the stored list plus `add`
 * minus `remove`. Names recovered from live jobs are shown, never saved unless added here.
 */
export async function saveJobTypes(
  organizationId: string,
  change: { add?: string[]; remove?: string[] }
): Promise<void> {
  await persistJobTypes(organizationId, change)
}

/** Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): `settings/jobTypes` is live while a job-type screen is open. */
export function watchJobTypes(organizationId: string, onNames: (names: string[]) => void): Unsubscribe {
  return watchOrgDocument(organizationId, ['settings', ORG_SETTINGS_JOB_TYPES_DOC], (data) => {
    const names = parseJobTypesDocument(data ?? undefined, null).jobTypes
    if (names.length) rememberJobTypes(organizationId, names)
    onNames(names)
  })
}

/**
 * Rulebook 1.8.0 `jobTypesWriteFields`: an update of `jobTypes` only (canonical, de-duplicated, sorted), never a
 * whole-document overwrite and never an empty list. The document is created (with `organizationId`) only when missing.
 */
async function persistJobTypes(organizationId: string, change: { add?: string[]; remove?: string[] }): Promise<void> {
  const ref = doc(db, 'organizations', organizationId, 'settings', ORG_SETTINGS_JOB_TYPES_DOC)
  const snap = await getDoc(ref)
  const stored = snap.exists() ? coerceJobTypeList(snap.data()?.jobTypes) : []
  const write = jobTypesChangeWriteFields(stored, change)
  if (!write) {
    if (stored.length === 0 && (change.add ?? []).length === 0) {
      throw new Error('Job types cannot be empty. Add at least one type.')
    }
    rememberJobTypes(organizationId, stored)
    return
  }
  rememberJobTypes(organizationId, write.set.jobTypes)
  const metadata = writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}
  if (snap.exists()) {
    await updateDoc(ref, { ...write.set, updatedAt: serverTimestamp(), ...metadata })
  } else {
    await setDoc(ref, { ...write.set, organizationId, updatedAt: serverTimestamp(), ...metadata })
  }
}

export function validateJobTypeName(name: string, existing: string[]): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Job type name cannot be empty'
  if (existing.includes(trimmed)) return 'This job type already exists'
  return null
}
