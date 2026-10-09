import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import {
  captureOrganizationContext,
  missingStarterQualificationCodes,
  organizationContextStillCurrent,
} from '@/lib/canonical'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { STARTER_QUALIFICATION_LIBRARY } from './starter/starterQualificationLibrary'
import { loadOrganisationQualifications, qualificationTemplateFirestoreFields } from './orgQualificationStorage'
import type { Qualification } from '@/types'

export const STARTER_QUALIFICATION_LIBRARY_VERSION = 1
const SEED_BATCH_SIZE = 400

export function starterQualificationItems(createdAt = new Date()): Qualification[] {
  return STARTER_QUALIFICATION_LIBRARY.map((row) => ({
    id: row.code,
    name: row.name,
    hasEndDate: false,
    createdAt,
    updatedAt: createdAt,
    code: row.code,
    section: row.section,
    subsection: row.subsection,
    awardingBody: row.awardingBody,
    level: row.level,
    renewYears: row.renewYears,
    renewalType: row.renewalType,
    status: row.status,
    notes: row.notes,
  }))
}

/**
 * Writes missing starter library rows into organizations/{orgId}/qualifications.
 * Merges by document id (library code). Never delete-all + rewrite.
 * A custom or guided-setup row must not block the library.
 * Failures must not block org create.
 */
export async function seedStarterQualificationLibrary(input: {
  organizationId: string
}): Promise<{ seeded: number; skipped: boolean }> {
  const db = getFirebaseDb()
  const ref = collection(db, 'organizations', input.organizationId, 'qualifications')
  const existing = await getDocs(ref)
  const items = starterQualificationItems()
  const missingCodes = new Set(
    missingStarterQualificationCodes(
      existing.docs.map((entry) => entry.id),
      items.map((item) => item.id)
    )
  )
  const missing = items.filter((item) => missingCodes.has(item.id))
  if (missing.length === 0) return { seeded: 0, skipped: true }

  for (let i = 0; i < missing.length; i += SEED_BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const item of missing.slice(i, i + SEED_BATCH_SIZE)) {
      batch.set(
        doc(db, 'organizations', input.organizationId, 'qualifications', item.id),
        qualificationTemplateFirestoreFields(item)
      )
    }
    await batch.commit()
  }
  return { seeded: missing.length, skipped: false }
}

/**
 * Load org templates, merging any missing starter library codes.
 * Call this before restoring names from assignments so those rows cannot block the seed.
 */
export async function loadOrganisationQualificationsEnsuringStarter(
  organizationId: string,
  options?: { fromServer?: boolean }
): Promise<Qualification[]> {
  const captured = captureOrganizationContext()
  const existing = await loadOrganisationQualifications(organizationId, options)
  if (!organizationContextStillCurrent(organizationId, captured)) return existing
  const missing = missingStarterQualificationCodes(
    existing.map((row) => row.id),
    STARTER_QUALIFICATION_LIBRARY.map((row) => row.code)
  )
  if (missing.length === 0) return existing
  try {
    await seedStarterQualificationLibrary({ organizationId })
  } catch {
    return existing
  }
  if (!organizationContextStillCurrent(organizationId, captured)) return existing
  return loadOrganisationQualifications(organizationId, options)
}

export function starterQualificationLibraryFields(item: Qualification): Record<string, unknown> {
  return qualificationTemplateFirestoreFields(item)
}
