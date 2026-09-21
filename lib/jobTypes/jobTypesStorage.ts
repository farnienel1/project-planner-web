/**
 * iOS parity source: Views/JobTypesManagementView.swift, FirebaseBackend.swift setData jobTypes
 * Spec: docs/ios-parity/sections/04-job-types.md
 */
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { ORG_SETTINGS_JOB_TYPES_DOC } from '@/lib/firebase/orgCollections'

export async function loadJobTypes(organizationId: string): Promise<string[]> {
  const snap = await getDoc(
    doc(db, 'organizations', organizationId, 'settings', ORG_SETTINGS_JOB_TYPES_DOC)
  )
  const list = snap.data()?.jobTypes
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : []
}

/** iOS overwrites the whole settings/jobTypes document — no merge. */
export async function saveJobTypes(organizationId: string, jobTypes: string[]): Promise<void> {
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
