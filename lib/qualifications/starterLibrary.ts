import { collection, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { STARTER_QUALIFICATION_LIBRARY } from './starter/starterQualificationLibrary'
import { qualificationTemplateFirestoreFields } from './orgQualificationStorage'
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
 * Writes the starter library into organizations/{orgId}/qualifications.
 * Skips when the collection already has a row. Failures must not block org create.
 */
export async function seedStarterQualificationLibrary(input: {
  organizationId: string
}): Promise<{ seeded: number; skipped: boolean }> {
  const db = getFirebaseDb()
  const ref = collection(db, 'organizations', input.organizationId, 'qualifications')
  const existing = await getDocs(query(ref, limit(1)))
  if (!existing.empty) return { seeded: 0, skipped: true }

  const items = starterQualificationItems()
  for (let i = 0; i < items.length; i += SEED_BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const item of items.slice(i, i + SEED_BATCH_SIZE)) {
      batch.set(
        doc(db, 'organizations', input.organizationId, 'qualifications', item.id),
        qualificationTemplateFirestoreFields(item)
      )
    }
    await batch.commit()
  }
  return { seeded: items.length, skipped: false }
}

export function starterQualificationLibraryFields(item: Qualification): Record<string, unknown> {
  return qualificationTemplateFirestoreFields(item)
}
