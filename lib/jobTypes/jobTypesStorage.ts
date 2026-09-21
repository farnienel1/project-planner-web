/**
 * iOS parity source: Views/JobTypesManagementView.swift, FirebaseBackend.swift setData jobTypes
 * Spec: docs/ios-parity/sections/04-job-types.md
 *
 * iOS overwrites settings/jobTypes with the in-memory set. An empty load plus save wipes the
 * catalogue while projects/small works still keep customJobType / jobType. Web restores the
 * union of those names and refuses to persist an empty overwrite.
 */
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { ORG_SETTINGS_JOB_TYPES_DOC } from '@/lib/firebase/orgCollections'
import { unionUniqueStrings } from '@/lib/catalogues/catalogueWriteGuard'

export function jobTypesFromWorkRecords(
  records: Array<{ jobType?: string; customJobType?: string }>
): string[] {
  const names: string[] = []
  for (const record of records) {
    if (record.customJobType?.trim()) names.push(record.customJobType.trim())
    if (record.jobType?.trim()) names.push(record.jobType.trim())
  }
  return unionUniqueStrings([], names)
}

export async function loadJobTypes(organizationId: string): Promise<string[]> {
  const snap = await getDoc(
    doc(db, 'organizations', organizationId, 'settings', ORG_SETTINGS_JOB_TYPES_DOC)
  )
  const list = snap.data()?.jobTypes
  return Array.isArray(list)
    ? list.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
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
  if (stored.length > 0) return stored
  if (recovered.length === 0) return stored
  await persistJobTypes(organizationId, recovered)
  return recovered
}

/** iOS overwrites the whole settings/jobTypes document — no merge. Empty catalogues are restored from projects on load. */
export async function saveJobTypes(organizationId: string, jobTypes: string[]): Promise<void> {
  await persistJobTypes(
    organizationId,
    jobTypes.map((item) => item.trim()).filter(Boolean)
  )
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
