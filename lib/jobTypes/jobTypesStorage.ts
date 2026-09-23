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
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { ORG_SETTINGS_JOB_TYPES_DOC } from '@/lib/firebase/orgCollections'
import { unionUniqueStrings } from '@/lib/catalogues/catalogueWriteGuard'
import { DEFAULT_JOB_TYPES } from '@/types'

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

export function canonicalJobTypeName(name: string): string {
  const compact = name.replace(/[\s_\-]+/g, '').toLowerCase()
  return JOB_TYPE_ALIASES[compact] || name.trim()
}

export function coerceJobTypeList(raw: unknown): string[] {
  let values: unknown[] = []
  if (Array.isArray(raw)) {
    values = raw
  } else if (typeof raw === 'string') {
    values = raw.split(',')
  } else if (raw && typeof raw === 'object') {
    values = Object.values(raw as Record<string, unknown>)
  }
  const names: string[] = []
  for (const item of values) {
    if (typeof item === 'string' && item.trim()) {
      names.push(canonicalJobTypeName(item.trim()))
      continue
    }
    const nested = stringFromJobTypeField(item)
    if (nested) names.push(canonicalJobTypeName(nested))
  }
  return unionUniqueStrings([], names)
}

export function mergeJobTypeCatalogues(stored: string[], recovered: string[]): string[] {
  return unionUniqueStrings(
    unionUniqueStrings(
      stored.map((item) => canonicalJobTypeName(item)),
      recovered.map((item) => canonicalJobTypeName(item))
    ),
    [...RESTORED_JOB_TYPES]
  )
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

export function stringFromJobTypeField(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.name === 'string' && record.name.trim()) return record.name.trim()
    if (typeof record.rawValue === 'string' && record.rawValue.trim()) return record.rawValue.trim()
  }
  return ''
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
      getDoc(doc(db, 'organizations', organizationId)),
    ])
    const orgData = orgSnap.data() as Record<string, unknown> | undefined
    const nestedSettings =
      orgData?.settings && typeof orgData.settings === 'object'
        ? (orgData.settings as Record<string, unknown>).jobTypes
        : undefined
    const names = unionUniqueStrings(
      coerceJobTypeList(snap.data()?.jobTypes),
      coerceJobTypeList(orgData?.jobTypes ?? nestedSettings)
    )
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
    return [...projectsSnap.docs, ...smallSnap.docs].map((entry) =>
      jobTypeFieldsFromRecord(entry.data() as Record<string, unknown>)
    )
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

export async function recoverJobTypesFromWork(organizationId: string): Promise<string[]> {
  if (recoveredJobTypesOrgs.has(organizationId)) {
    return peekCachedJobTypes(organizationId) || loadJobTypes(organizationId)
  }
  recoveredJobTypesOrgs.add(organizationId)
  const stored = await loadJobTypes(organizationId)
  const recovered = jobTypesFromWorkRecords(await loadWorkJobTypeRecords(organizationId))
  const merged = mergeJobTypeCatalogues(stored, recovered)
  if (!jobTypeListsEqual(stored, merged)) {
    try {
      await persistJobTypes(organizationId, merged)
    } catch {
      // Read-only accounts still get the restored list in the UI.
    }
  }
  const names = merged.length > 0 ? merged : [...RESTORED_JOB_TYPES]
  rememberJobTypes(organizationId, names)
  return names
}

/** iOS overwrites the whole settings/jobTypes document — no merge. Empty catalogues are restored from projects on load. */
export async function saveJobTypes(organizationId: string, jobTypes: string[]): Promise<void> {
  const names = jobTypes.map((item) => canonicalJobTypeName(item)).filter(Boolean)
  if (names.length === 0) {
    throw new Error('Job types cannot be empty. Add at least one type or restore from live jobs.')
  }
  await persistJobTypes(organizationId, names)
}

async function persistJobTypes(organizationId: string, jobTypes: string[]): Promise<void> {
  rememberJobTypes(organizationId, jobTypes)
  await setDoc(doc(db, 'organizations', organizationId, 'settings', ORG_SETTINGS_JOB_TYPES_DOC), {
    jobTypes,
    organizationId,
    updatedAt: Timestamp.now(),
  })
}

export function validateJobTypeName(name: string, existing: string[]): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Job type name cannot be empty'
  if (existing.includes(trimmed)) return 'This job type already exists'
  return null
}
