/**
 * iOS parity source: Views/JobTypesManagementView.swift, FirebaseBackend.swift setData jobTypes
 * Spec: docs/ios-parity/sections/04-job-types.md
 *
 * iOS overwrites settings/jobTypes with the in-memory set. An empty load plus save wipes the
 * catalogue while projects/small works still keep customJobType / jobType. Web unions those
 * names into the stored list even when the catalogue is not empty, then refuses to persist
 * an empty overwrite. Recommended iOS enum names (CAT A, CAT B, Small Works, Maintenance)
 * are always re-seeded if missing.
 */
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { ORG_SETTINGS_JOB_TYPES_DOC } from '@/lib/firebase/orgCollections'
import { unionUniqueStrings } from '@/lib/catalogues/catalogueWriteGuard'
import { DEFAULT_JOB_TYPES } from '@/types'

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
    if (item && typeof item === 'object' && 'name' in item) {
      const nested = (item as { name?: unknown }).name
      if (typeof nested === 'string' && nested.trim()) names.push(canonicalJobTypeName(nested.trim()))
    }
  }
  return unionUniqueStrings([], names)
}

export function mergeJobTypeCatalogues(stored: string[], recovered: string[]): string[] {
  return unionUniqueStrings(
    unionUniqueStrings(
      stored.map((item) => canonicalJobTypeName(item)),
      recovered.map((item) => canonicalJobTypeName(item))
    ),
    [...DEFAULT_JOB_TYPES]
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

export async function loadJobTypes(organizationId: string): Promise<string[]> {
  const snap = await getDoc(
    doc(db, 'organizations', organizationId, 'settings', ORG_SETTINGS_JOB_TYPES_DOC)
  )
  return coerceJobTypeList(snap.data()?.jobTypes)
}

export async function recoverJobTypesFromWork(organizationId: string): Promise<string[]> {
  const [projectsSnap, smallSnap] = await Promise.all([
    getDocs(collection(db, 'organizations', organizationId, 'projects')),
    getDocs(collection(db, 'organizations', organizationId, 'smallWorks')),
  ])
  const recovered = jobTypesFromWorkRecords(
    [...projectsSnap.docs, ...smallSnap.docs].map((entry) => {
      const data = entry.data() as Record<string, unknown>
      return {
        jobType: typeof data.jobType === 'string' ? data.jobType : '',
        customJobType: typeof data.customJobType === 'string' ? data.customJobType : '',
      }
    })
  )
  const stored = await loadJobTypes(organizationId)
  const merged = mergeJobTypeCatalogues(stored, recovered)
  if (!jobTypeListsEqual(stored, merged)) {
    await persistJobTypes(organizationId, merged)
  }
  return merged
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
